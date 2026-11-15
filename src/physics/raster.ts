import { CARD_FACE, CARD_INK } from "@/content/stage";

export type RasterSpec = {
  readonly label: string;
  readonly iconPath: string;
  readonly width: number;
  readonly height: number;
  readonly cornerRadius: number;
};

export function rasterizeCard(spec: RasterSpec, dpr: number): Promise<ImageBitmap> {
  const width = Math.max(1, spec.width);
  const height = Math.max(1, spec.height);
  const canvas = new OffscreenCanvas(Math.round(width * dpr), Math.round(height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context is unavailable");

  ctx.scale(dpr, dpr);
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, spec.cornerRadius);
  ctx.clip();
  ctx.fillStyle = CARD_FACE;
  ctx.fillRect(0, 0, width, height);

  const inset = 1.5;
  ctx.strokeStyle = CARD_INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(inset, inset, width - inset * 2, height - inset * 2, Math.max(0, spec.cornerRadius - inset));
  ctx.stroke();

  const iconSize = 0.42 * Math.min(width, height);
  const labelBand = 22;
  ctx.save();
  ctx.translate((width - iconSize) / 2, (height - labelBand - iconSize) / 2);
  ctx.scale(iconSize / 24, iconSize / 24);
  ctx.fillStyle = CARD_INK;
  ctx.fill(new Path2D(spec.iconPath));
  ctx.restore();

  ctx.fillStyle = CARD_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxText = width - 16;
  let fontSize = 13;
  ctx.font = `${fontSize}px sans-serif`;
  while (fontSize > 9 && ctx.measureText(spec.label).width > maxText) {
    fontSize -= 1;
    ctx.font = `${fontSize}px sans-serif`;
  }
  ctx.fillText(spec.label, width / 2, height - 14);

  return createImageBitmap(canvas);
}
