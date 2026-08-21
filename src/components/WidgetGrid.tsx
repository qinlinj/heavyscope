import { useLayoutEffect, useRef, type DragEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

type Props = {
  columns: 2 | 4;
  editing: boolean;
  dragging?: boolean;
  gridRef?: Ref<HTMLDivElement | null>;
  children: ReactNode;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

export function WidgetGrid({
  columns,
  editing,
  dragging = false,
  gridRef,
  children,
  onDragOver,
  onDrop,
}: Props) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    const root = localRef.current;
    if (!root || !dragging) {
      prevRects.current.clear();
      root?.querySelectorAll<HTMLElement>("[data-tile-id]").forEach((node) => {
        node.style.transform = "";
        node.style.transition = "";
      });
      return;
    }

    const nodes = [...root.querySelectorAll<HTMLElement>("[data-tile-id]")];
    const next = new Map<string, DOMRect>();
    for (const node of nodes) {
      const id = node.dataset.tileId;
      if (!id) continue;
      const rect = node.getBoundingClientRect();
      next.set(id, rect);
      const prev = prevRects.current.get(id);
      if (!prev) continue;
      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (dx === 0 && dy === 0) continue;
      node.style.transition = "transform 0s";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        node.style.transition = "transform 180ms ease";
        node.style.transform = "";
      });
    }
    prevRects.current = next;
  }, [children, dragging]);

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        assignRef(gridRef, node);
      }}
      data-widget-grid={columns}
      data-editing={editing ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      className={cn(
        "grid w-full min-w-0 items-stretch gap-3 [grid-auto-flow:row]",
        columns === 4
          ? "grid-cols-1 md:grid-cols-[repeat(4,minmax(0,1fr))]"
          : "grid-cols-[repeat(2,minmax(0,1fr))]",
        editing && "rounded-2xl border border-dashed border-foreground/25 bg-muted/15 p-2 sm:p-3",
      )}
      onDragOver={editing ? onDragOver : undefined}
      onDrop={editing ? onDrop : undefined}
    >
      {children}
    </div>
  );
}
