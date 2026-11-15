export const DRAG_SLOP_PX = 6;

export type Gesture =
  | { readonly phase: "idle" }
  | { readonly phase: "armed"; readonly id: string; readonly x: number; readonly y: number }
  | { readonly phase: "drag"; readonly id: string };

export type PointerSample = {
  readonly kind: "down" | "move" | "up";
  readonly x: number;
  readonly y: number;
  readonly hit: string | null;
};

export type GestureStep = {
  readonly gesture: Gesture;
  readonly openId: string | null;
};

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function reduceGesture(gesture: Gesture, sample: PointerSample): GestureStep {
  if (sample.kind === "down") {
    if (sample.hit === null) return { gesture: { phase: "idle" }, openId: null };
    return {
      gesture: { phase: "armed", id: sample.hit, x: sample.x, y: sample.y },
      openId: null,
    };
  }

  if (sample.kind === "move") {
    if (
      gesture.phase === "armed" &&
      distance(sample.x, sample.y, gesture.x, gesture.y) > DRAG_SLOP_PX
    ) {
      return { gesture: { phase: "drag", id: gesture.id }, openId: null };
    }
    return { gesture, openId: null };
  }

  if (gesture.phase === "armed") {
    return { gesture: { phase: "idle" }, openId: gesture.id };
  }
  return { gesture: { phase: "idle" }, openId: null };
}

export function hoverIdFor(gesture: Gesture, hit: string | null): string | null {
  if (gesture.phase === "drag") return null;
  if (gesture.phase === "armed") return gesture.id;
  return hit;
}
