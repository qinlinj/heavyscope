import { useCallback, useEffect, useRef, useState } from "react";
import { insertIndexFromPointer, type TilePointerRect } from "@/lib/chartDnD";
import {
  previewReorderLayout,
  serializeLayout,
  type DashboardLayout,
} from "@/lib/dashboardLayout";

function sameTileOrder(left: DashboardLayout, right: DashboardLayout): boolean {
  if (left.tiles.length !== right.tiles.length) return false;
  return left.tiles.every((tile, index) => tile.id === right.tiles[index]?.id);
}

function collectRects(root: HTMLElement, omitId: string): TilePointerRect[] {
  const rects: TilePointerRect[] = [];
  root.querySelectorAll<HTMLElement>("[data-tile-id]").forEach((node) => {
    const id = node.dataset.tileId;
    if (!id || id === omitId) return;
    const box = node.getBoundingClientRect();
    rects.push({ id, top: box.top, left: box.left, width: box.width, height: box.height });
  });
  return rects;
}

function pointerLeftWindow(event: DragEvent): boolean {
  if (event.relatedTarget != null) return false;
  return (
    event.clientX <= 0 ||
    event.clientY <= 0 ||
    event.clientX >= window.innerWidth ||
    event.clientY >= window.innerHeight
  );
}

/**
 * Live insert-slot preview while a tile is dragged in Edit mode.
 * Writes `dashboard_layout` / `tray_layout` only through `persist` on drop.
 */
export function useTileDragPreview(
  layout: DashboardLayout,
  enabled: boolean,
  persist: (next: DashboardLayout) => void,
) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DashboardLayout | null>(null);
  const snapshotRef = useRef<DashboardLayout | null>(null);
  const previewRef = useRef<DashboardLayout | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const committedRef = useRef(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  draggingIdRef.current = draggingId;
  previewRef.current = preview;

  const displayLayout = preview ?? layout;

  const begin = useCallback(
    (id: string) => {
      if (!enabled) return;
      snapshotRef.current = layout;
      previewRef.current = layout;
      committedRef.current = false;
      setDraggingId(id);
      setPreview(layout);
    },
    [enabled, layout],
  );

  const updateFromPointer = useCallback(
    (x: number, y: number) => {
      const id = draggingIdRef.current;
      const snapshot = snapshotRef.current;
      const root = gridRef.current;
      if (!enabled || !id || !snapshot || !root) return;
      const next = previewReorderLayout(snapshot, id, insertIndexFromPointer({ x, y }, collectRects(root, id)));
      setPreview((current) => {
        if (current && sameTileOrder(current, next)) return current;
        previewRef.current = next;
        return next;
      });
    },
    [enabled],
  );

  const cancel = useCallback(() => {
    committedRef.current = true;
    snapshotRef.current = null;
    previewRef.current = null;
    draggingIdRef.current = null;
    setDraggingId(null);
    setPreview(null);
  }, []);

  const commit = useCallback(() => {
    const id = draggingIdRef.current;
    if (!enabled || !id) return;
    const next = previewRef.current ?? snapshotRef.current ?? layout;
    committedRef.current = true;
    if (serializeLayout(next) !== serializeLayout(layout)) persist(next);
    snapshotRef.current = null;
    previewRef.current = null;
    draggingIdRef.current = null;
    setDraggingId(null);
    setPreview(null);
  }, [enabled, layout, persist]);

  const end = useCallback(() => {
    if (!committedRef.current) cancel();
  }, [cancel]);

  useEffect(() => {
    if (!draggingId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancel();
    }

    function onDragLeave(event: DragEvent) {
      if (pointerLeftWindow(event)) cancel();
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("dragleave", onDragLeave);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("dragleave", onDragLeave);
    };
  }, [draggingId, cancel]);

  useEffect(() => {
    if (!enabled && draggingId) cancel();
  }, [enabled, draggingId, cancel]);

  return {
    displayLayout,
    draggingId,
    gridRef,
    begin,
    updateFromPointer,
    commit,
    cancel,
    end,
  };
}
