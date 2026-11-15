"use client";

import { useEffect, useRef, useState } from "react";
import type Matter from "matter-js";
import { linkKey, type LinkHref, type SocialLink } from "@/content/social-links";
import { drawFrame, type DrawCard } from "@/physics/draw";
import { hoverIdFor, reduceGesture, type Gesture } from "@/physics/gesture";
import { cardBox, spawnPose, wallSpecs, type Viewport } from "@/physics/layout";
import { rasterizeCard } from "@/physics/raster";

const WORLD = {
  cardRestitution: 0.6,
  wallRestitution: 0.45,
  friction: 0.1,
  frictionAir: 0.02,
  matterGravityUnit: 0.001,
} as const;

const RAIN_MIN_MS = 900;
const RAIN_MAX_MS = 2200;
const MAX_CARDS = 64;

type MatterApi = typeof import("matter-js");

type Pose = {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly angularVelocity: number;
};

type CardRecord = {
  readonly id: string;
  readonly linkId: string;
  readonly href: LinkHref;
  body: Matter.Body;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  cornerRadius: number;
};

type Session = {
  readonly generation: number;
  readonly links: readonly SocialLink[];
  readonly engine: Matter.Engine;
  readonly runner: Matter.Runner;
  readonly mouse: Matter.Mouse;
  readonly mouseConstraint: Matter.MouseConstraint;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly matter: MatterApi;
  cards: Map<string, CardRecord>;
  sprites: Map<string, ImageBitmap>;
  nextCardId: number;
  walls: Matter.Body[];
  viewport: Viewport;
  gesture: Gesture;
  pointer: { readonly x: number; readonly y: number } | null;
  raf: number;
  disposed: boolean;
  rasterToken: number;
  spawnStarted: boolean;
  rainTimer: number | null;
  observer: ResizeObserver | null;
  stopPointer: () => void;
};

type Slot = {
  session: Session | null;
  generation: number;
};

export type PhysicsCanvasProps = {
  links: readonly SocialLink[];
};

function resolveMatter(loaded: unknown): MatterApi {
  if (loaded && typeof loaded === "object" && "Engine" in loaded) return loaded as MatterApi;
  if (loaded && typeof loaded === "object" && "default" in loaded) {
    const inner = (loaded as { default: unknown }).default;
    if (inner && typeof inner === "object" && "Engine" in inner) return inner as MatterApi;
  }
  throw new Error("matter-js did not load");
}

export function PhysicsCanvas({ links }: PhysicsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [slot] = useState<Slot>(() => ({ session: null, generation: 0 }));
  const linksRef = useRef(links);
  const key = linkKey(links);

  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dispose = () => {};
    let active = true;
    void import("matter-js").then((loaded) => {
      if (!active) return;
      dispose = mountSession(resolveMatter(loaded), canvas, linksRef.current, slot);
    });
    return () => {
      active = false;
      dispose();
    };
  }, [key, slot]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-hidden />
    </div>
  );
}

function mountSession(
  Matter: MatterApi,
  canvas: HTMLCanvasElement,
  links: readonly SocialLink[],
  slot: Slot,
): () => void {
  const generation = slot.generation + 1;
  slot.generation = generation;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable");

  const engine = Matter.Engine.create({ enableSleeping: true });
  engine.gravity.x = 0;
  engine.gravity.y = 1;
  engine.gravity.scale = WORLD.matterGravityUnit;
  const runner = Matter.Runner.create();
  const mouse = Matter.Mouse.create(canvas);
  const mouseConstraint = Matter.MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.15 },
  });
  Matter.Composite.add(engine.world, mouseConstraint);

  const session: Session = {
    generation,
    links,
    engine,
    runner,
    mouse,
    mouseConstraint,
    canvas,
    ctx,
    matter: Matter,
    cards: new Map(),
    sprites: new Map(),
    nextCardId: 0,
    walls: [],
    viewport: { cssWidth: 0, cssHeight: 0, dpr: 1 },
    gesture: { phase: "idle" },
    pointer: null,
    raf: 0,
    disposed: false,
    rasterToken: 0,
    spawnStarted: false,
    rainTimer: null,
    observer: null,
    stopPointer: () => {},
  };

  Matter.Events.on(engine, "beforeUpdate", () => {
    if (session.disposed || session.gesture.phase === "drag") return;
    mouseConstraint.body = null as unknown as Matter.Body;
    mouseConstraint.constraint.bodyB = null;
  });

  session.stopPointer = bindPointer(session);
  slot.session = session;
  syncViewport(session, slot);
  const parent = canvas.parentElement;
  if (parent) {
    const observer = new ResizeObserver(() => {
      if (session.disposed) return;
      syncViewport(session, slot);
    });
    observer.observe(parent);
    session.observer = observer;
  }

  return () => disposeSession(session, slot);
}

function bindPointer(session: Session): () => void {
  const canvas = session.canvas;
  const pointOf = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    onPointer(session, "down", pointOf(event));
  };
  const onMove = (event: PointerEvent) => onPointer(session, "move", pointOf(event));
  const onUp = (event: PointerEvent) => onPointer(session, "up", pointOf(event));
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
  };
}

function onPointer(
  session: Session,
  kind: "down" | "move" | "up",
  point: { x: number; y: number },
): void {
  session.pointer = point;
  const hit = hitId(session, point);
  const step = reduceGesture(session.gesture, { kind, x: point.x, y: point.y, hit });
  session.gesture = step.gesture;
  if (kind !== "up" || step.openId === null) return;
  const card = session.cards.get(step.openId);
  if (!card) return;
  releaseDrag(session);
  openHref(card.href);
}

function hitId(session: Session, point: { x: number; y: number }): string | null {
  const bodies: Matter.Body[] = [];
  for (const card of session.cards.values()) bodies.push(card.body);
  const found = session.matter.Query.point(bodies, point);
  for (const card of session.cards.values()) {
    if (found.includes(card.body)) return card.id;
  }
  return null;
}

function openHref(href: LinkHref): void {
  if (href.kind === "web") {
    window.open(href.url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.assign(href.url);
}

function frame(slot: Slot, time: number): void {
  const session = slot.session;
  if (!session || session.disposed) return;
  session.matter.Runner.tick(session.runner, session.engine, time);

  let hovered: string | null = null;
  if (session.pointer) {
    hovered = hoverIdFor(session.gesture, hitId(session, session.pointer));
  }

  const cards: DrawCard[] = [];
  for (const card of session.cards.values()) {
    cards.push({
      bitmap: card.bitmap,
      x: card.body.position.x,
      y: card.body.position.y,
      angle: card.body.angle,
      width: card.width,
      height: card.height,
      hovered: card.id === hovered,
      cornerRadius: card.cornerRadius,
    });
  }
  drawFrame(session.ctx, session.viewport, cards);
  session.canvas.style.cursor = hovered ? "pointer" : "default";
  if (session.disposed) return;
  session.raf = requestAnimationFrame((next) => frame(slot, next));
}

function releaseDrag(session: Session): void {
  session.mouseConstraint.body = null as unknown as Matter.Body;
  session.mouseConstraint.constraint.bodyB = null;
  session.gesture = { phase: "idle" };
}

function readPose(body: Matter.Body): Pose {
  return {
    x: body.position.x,
    y: body.position.y,
    angle: body.angle,
    velocityX: body.velocity.x,
    velocityY: body.velocity.y,
    angularVelocity: body.angularVelocity,
  };
}

function applyPose(Matter: MatterApi, body: Matter.Body, pose: Pose): void {
  Matter.Body.setPosition(body, { x: pose.x, y: pose.y });
  Matter.Body.setAngle(body, pose.angle);
  Matter.Body.setVelocity(body, { x: pose.velocityX, y: pose.velocityY });
  Matter.Body.setAngularVelocity(body, pose.angularVelocity);
  Matter.Sleeping.set(body, false);
}

function makeBody(Matter: MatterApi, box: ReturnType<typeof cardBox>, pose: Pose): Matter.Body {
  return Matter.Bodies.rectangle(pose.x, pose.y, box.width, box.height, {
    restitution: WORLD.cardRestitution,
    friction: WORLD.friction,
    frictionAir: WORLD.frictionAir,
    density: box.density,
    chamfer: { radius: box.cornerRadius },
  });
}

function addFallingCard(session: Session, link: SocialLink): CardRecord | null {
  if (session.cards.size >= MAX_CARDS) return null;
  const bitmap = session.sprites.get(link.id);
  if (!bitmap) return null;
  const box = cardBox(session.viewport.cssWidth);
  const pose = spawnPose(session.viewport, box);
  const body = makeBody(session.matter, box, pose);
  session.matter.Composite.add(session.engine.world, body);
  const id = `${link.id}-${session.nextCardId}`;
  session.nextCardId += 1;
  const card: CardRecord = {
    id,
    linkId: link.id,
    href: link.href,
    body,
    bitmap,
    width: box.width,
    height: box.height,
    cornerRadius: box.cornerRadius,
  };
  session.cards.set(id, card);
  return card;
}

function rainOne(session: Session): void {
  if (session.cards.size >= MAX_CARDS) {
    stopRain(session);
    return;
  }
  const link = session.links[Math.floor(Math.random() * session.links.length)];
  if (!link) return;
  addFallingCard(session, link);
}

function scheduleRain(session: Session): void {
  if (session.disposed || session.cards.size >= MAX_CARDS) return;
  if (session.rainTimer !== null) window.clearTimeout(session.rainTimer);
  const delay = RAIN_MIN_MS + Math.random() * (RAIN_MAX_MS - RAIN_MIN_MS);
  session.rainTimer = window.setTimeout(() => {
    session.rainTimer = null;
    if (session.disposed) return;
    rainOne(session);
    scheduleRain(session);
  }, delay);
}

function stopRain(session: Session): void {
  if (session.rainTimer === null) return;
  window.clearTimeout(session.rainTimer);
  session.rainTimer = null;
}

function syncViewport(session: Session, slot: Slot): void {
  const parent = session.canvas.parentElement;
  if (!parent) return;
  const cssWidth = parent.clientWidth;
  const cssHeight = parent.clientHeight;
  if (cssWidth === 0 || cssHeight === 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const previous = session.viewport;
  if (previous.cssWidth === cssWidth && previous.cssHeight === cssHeight && previous.dpr === dpr) {
    startSpawn(session, slot);
    return;
  }

  session.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  session.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  session.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  session.mouse.pixelRatio = dpr;
  session.viewport = { cssWidth, cssHeight, dpr };
  replaceWalls(session);

  const next = cardBox(cssWidth);
  const sizeChanged = [...session.cards.values()].some(
    (card) => card.width !== next.width || card.height !== next.height,
  );
  const dprChanged = previous.cssWidth !== 0 && previous.dpr !== dpr;
  if (session.cards.size > 0 && (sizeChanged || dprChanged)) {
    void refitCards(session);
  }
  startSpawn(session, slot);
}

function startSpawn(session: Session, slot: Slot): void {
  if (session.spawnStarted || session.viewport.cssWidth === 0) return;
  session.spawnStarted = true;
  void spawnCards(session, slot);
}

function replaceWalls(session: Session): void {
  const { Bodies, Composite } = session.matter;
  for (const wall of session.walls) Composite.remove(session.engine.world, wall);
  const walls = wallSpecs(session.viewport).map((spec) =>
    Bodies.rectangle(spec.x, spec.y, spec.width, spec.height, {
      isStatic: true,
      restitution: WORLD.wallRestitution,
      friction: WORLD.friction,
    }),
  );
  Composite.add(session.engine.world, walls);
  session.walls = walls;
}

async function rasterAll(session: Session, viewport: Viewport): Promise<ImageBitmap[]> {
  const box = cardBox(viewport.cssWidth);
  return Promise.all(
    session.links.map((link) =>
      rasterizeCard(
        {
          label: link.label,
          iconPath: link.iconPath,
          width: box.width,
          height: box.height,
          cornerRadius: box.cornerRadius,
        },
        viewport.dpr,
      ),
    ),
  );
}

function closeBitmaps(bitmaps: readonly ImageBitmap[]): void {
  for (const bitmap of bitmaps) bitmap.close();
}

async function spawnCards(session: Session, slot: Slot): Promise<void> {
  const token = session.rasterToken + 1;
  session.rasterToken = token;
  const viewport = session.viewport;
  const bitmaps = await rasterAll(session, viewport);
  if (session.disposed || token !== session.rasterToken || slot.generation !== session.generation) {
    closeBitmaps(bitmaps);
    return;
  }
  if (
    session.viewport.cssWidth !== viewport.cssWidth ||
    session.viewport.cssHeight !== viewport.cssHeight ||
    session.viewport.dpr !== viewport.dpr
  ) {
    closeBitmaps(bitmaps);
    void spawnCards(session, slot);
    return;
  }

  session.links.forEach((link, index) => {
    const bitmap = bitmaps[index];
    if (!bitmap) return;
    session.sprites.set(link.id, bitmap);
  });

  const order = [...session.links].sort(() => Math.random() - 0.5);
  order.forEach((link, index) => {
    window.setTimeout(() => {
      if (session.disposed) return;
      addFallingCard(session, link);
    }, index * (180 + Math.random() * 220));
  });

  if (session.raf === 0 && !session.disposed) {
    session.raf = requestAnimationFrame((time) => frame(slot, time));
  }
  scheduleRain(session);
}

async function refitCards(session: Session): Promise<void> {
  const token = session.rasterToken + 1;
  session.rasterToken = token;
  const viewport = session.viewport;
  const poses = new Map<string, Pose>();
  for (const [id, card] of session.cards) poses.set(id, readPose(card.body));
  const bitmaps = await rasterAll(session, viewport);
  if (session.disposed || token !== session.rasterToken) {
    closeBitmaps(bitmaps);
    return;
  }
  if (session.viewport.cssWidth !== viewport.cssWidth || session.viewport.dpr !== viewport.dpr) {
    closeBitmaps(bitmaps);
    void refitCards(session);
    return;
  }

  for (const old of session.sprites.values()) old.close();
  session.sprites.clear();
  session.links.forEach((link, index) => {
    const bitmap = bitmaps[index];
    if (bitmap) session.sprites.set(link.id, bitmap);
  });

  const box = cardBox(viewport.cssWidth);
  for (const card of session.cards.values()) {
    const bitmap = session.sprites.get(card.linkId);
    if (!bitmap) continue;
    const pose = poses.get(card.id) ?? readPose(card.body);
    const sizeChanged = card.width !== box.width || card.height !== box.height;
    card.bitmap = bitmap;
    card.width = box.width;
    card.height = box.height;
    card.cornerRadius = box.cornerRadius;
    if (!sizeChanged) continue;
    session.matter.Composite.remove(session.engine.world, card.body);
    const body = makeBody(session.matter, box, pose);
    applyPose(session.matter, body, pose);
    session.matter.Composite.add(session.engine.world, body);
    card.body = body;
  }
}

function disposeSession(session: Session, slot: Slot): void {
  if (session.disposed) return;
  session.disposed = true;
  session.rasterToken += 1;
  slot.generation += 1;
  stopRain(session);
  cancelAnimationFrame(session.raf);
  session.stopPointer();
  session.matter.Events.off(session.engine, "beforeUpdate");
  unbindMouse(session.mouse);
  session.observer?.disconnect();
  session.cards.clear();
  for (const bitmap of session.sprites.values()) bitmap.close();
  session.sprites.clear();
  session.matter.Composite.clear(session.engine.world, false, true);
  session.matter.Engine.clear(session.engine);
  if (slot.session === session) slot.session = null;
}

function unbindMouse(mouse: Matter.Mouse): void {
  const element = mouse.element;
  const handlers = mouse as Matter.Mouse & {
    mousemove: EventListener;
    mousedown: EventListener;
    mouseup: EventListener;
    mousewheel: EventListener;
  };
  element.removeEventListener("mousemove", handlers.mousemove);
  element.removeEventListener("mousedown", handlers.mousedown);
  element.removeEventListener("mouseup", handlers.mouseup);
  element.removeEventListener("wheel", handlers.mousewheel);
  element.removeEventListener("touchmove", handlers.mousemove);
  element.removeEventListener("touchstart", handlers.mousedown);
  element.removeEventListener("touchend", handlers.mouseup);
}
