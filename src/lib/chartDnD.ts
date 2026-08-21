import type { DragEvent } from "react";
import { isChartModuleId, type ChartModuleId } from "@/lib/charts";

export const TILE_DRAG_MIME = "application/x-heavyscope-tile";
/** @deprecated Use TILE_DRAG_MIME. */
export const MODULE_DRAG_MIME = TILE_DRAG_MIME;

export function writeTileDrag(event: DragEvent, id: string): void {
  event.dataTransfer.setData(TILE_DRAG_MIME, id);
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.effectAllowed = "move";
}

export function readTileDrag(event: DragEvent): string | null {
  const raw = event.dataTransfer.getData(TILE_DRAG_MIME) || event.dataTransfer.getData("text/plain");
  const id = raw.trim();
  return id.length > 0 ? id : null;
}

export type TilePointerRect = {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

export type PointerPoint = { x: number; y: number };

function rectContains(pointer: PointerPoint, rect: Omit<TilePointerRect, "id">): boolean {
  return (
    pointer.x >= rect.left &&
    pointer.x <= rect.left + rect.width &&
    pointer.y >= rect.top &&
    pointer.y <= rect.top + rect.height
  );
}

function distanceToRect(pointer: PointerPoint, rect: Omit<TilePointerRect, "id">): number {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const dx = pointer.x < rect.left ? rect.left - pointer.x : pointer.x > right ? pointer.x - right : 0;
  const dy = pointer.y < rect.top ? rect.top - pointer.y : pointer.y > bottom ? pointer.y - bottom : 0;
  return Math.hypot(dx, dy);
}

/** Top / first half = insert before; bottom / second half = insert after. */
export function pointerInsertSide(pointer: PointerPoint, rect: Omit<TilePointerRect, "id">): "before" | "after" {
  return pointer.y < rect.top + rect.height / 2 ? "before" : "after";
}

/**
 * Insert index among the given visible cards (dragged card omitted).
 * 0 = before the first card; `rects.length` = after the last.
 * Over a card: first half → before it, second half → after it.
 * Over a gap: same-row gaps use left-to-right midpoints; stacked gaps use the nearest card's half.
 */
export function insertIndexFromPointer(pointer: PointerPoint, rects: readonly TilePointerRect[]): number {
  if (rects.length === 0) return 0;

  for (let i = 0; i < rects.length; i++) {
    const card = rects[i]!;
    if (!rectContains(pointer, card)) continue;
    return pointerInsertSide(pointer, card) === "before" ? i : i + 1;
  }

  const row = rects
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => pointer.y >= card.top && pointer.y <= card.top + card.height);
  if (row.length > 0) {
    for (const { card, index } of row) {
      if (pointer.x < card.left + card.width / 2) return index;
    }
    return row[row.length - 1]!.index + 1;
  }

  let nearestIndex = 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rects.length; i++) {
    const distance = distanceToRect(pointer, rects[i]!);
    if (distance < nearest) {
      nearest = distance;
      nearestIndex = i;
    }
  }
  return pointerInsertSide(pointer, rects[nearestIndex]!) === "before" ? nearestIndex : nearestIndex + 1;
}

/** @deprecated Use writeTileDrag. */
export const writeModuleDrag = writeTileDrag;

/** @deprecated Use readTileDrag. */
export function readModuleDrag(event: DragEvent): ChartModuleId | null {
  const raw = readTileDrag(event);
  return raw && isChartModuleId(raw) ? raw : null;
}
