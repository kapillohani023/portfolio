export type Viewport = {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
};

export type CssBox = {
  readonly width: number;
  readonly height: number;
  readonly density: number;
  readonly cornerRadius: number;
};

export type WallSpec = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type SpawnPose = {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly angularVelocity: number;
};

const BASE_SIZE = 96;
const WALL_THICKNESS = 40;
const MATTER_DENSITY = 0.001;

function sizeScale(viewportWidth: number): number {
  if (viewportWidth < 640) return 0.72;
  if (viewportWidth < 1024) return 0.88;
  return 1;
}

export function cardBox(viewportWidth: number): CssBox {
  const scale = sizeScale(viewportWidth);
  const size = BASE_SIZE * scale;
  return {
    width: size,
    height: size,
    density: MATTER_DENSITY,
    cornerRadius: 14 * scale,
  };
}

export function wallSpecs(viewport: Viewport): readonly WallSpec[] {
  const thickness = WALL_THICKNESS;
  const width = viewport.cssWidth;
  const height = viewport.cssHeight;
  return [
    { x: 0, y: height / 2, width: thickness, height: height + thickness * 2 },
    { x: width, y: height / 2, width: thickness, height: height + thickness * 2 },
    {
      x: width / 2,
      y: height + thickness / 2,
      width: width + thickness * 2,
      height: thickness,
    },
  ];
}

export function spawnPose(viewport: Viewport, box: CssBox): SpawnPose {
  const half = box.width / 2;
  const minX = WALL_THICKNESS / 2 + half + 8;
  const maxX = Math.max(minX, viewport.cssWidth - WALL_THICKNESS / 2 - half - 8);
  const x = minX + Math.random() * (maxX - minX);
  const y = -box.height * (1.2 + Math.random() * 2.4);

  return {
    x,
    y,
    angle: (Math.random() - 0.5) * 0.8,
    velocityX: (Math.random() - 0.5) * 3.5,
    velocityY: 0.5 + Math.random() * 1.5,
    angularVelocity: (Math.random() - 0.5) * 0.35,
  };
}
