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

/** @deprecated Use writeTileDrag. */
export const writeModuleDrag = writeTileDrag;

/** @deprecated Use readTileDrag. */
export function readModuleDrag(event: DragEvent): ChartModuleId | null {
  const raw = readTileDrag(event);
  return raw && isChartModuleId(raw) ? raw : null;
}
