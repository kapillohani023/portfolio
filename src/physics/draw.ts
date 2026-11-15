import { CARD_INK, PAGE_BG } from "@/content/stage";
import type { Viewport } from "@/physics/layout";

export type DrawCard = {
  readonly bitmap: ImageBitmap;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly width: number;
  readonly height: number;
  readonly hovered: boolean;
  readonly cornerRadius: number;
};

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  cards: readonly DrawCard[],
): void {
  ctx.clearRect(0, 0, viewport.cssWidth, viewport.cssHeight);
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, viewport.cssWidth, viewport.cssHeight);

  for (const card of cards) {
    ctx.save();
    ctx.translate(card.x, card.y);
    ctx.rotate(card.angle);
    ctx.drawImage(card.bitmap, -card.width / 2, -card.height / 2, card.width, card.height);
    if (card.hovered) {
      ctx.strokeStyle = CARD_INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-card.width / 2, -card.height / 2, card.width, card.height, card.cornerRadius);
      ctx.stroke();
    }
    ctx.restore();
  }
}
