import type { DragEvent } from "react";
import { isChartModuleId, type ChartModuleId } from "@/lib/charts";

export const MODULE_DRAG_MIME = "application/x-heavyscope-module";

export function writeModuleDrag(event: DragEvent, id: ChartModuleId): void {
  event.dataTransfer.setData(MODULE_DRAG_MIME, id);
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.effectAllowed = "move";
}

export function readModuleDrag(event: DragEvent): ChartModuleId | null {
  const raw = event.dataTransfer.getData(MODULE_DRAG_MIME) || event.dataTransfer.getData("text/plain");
  return isChartModuleId(raw) ? raw : null;
}
