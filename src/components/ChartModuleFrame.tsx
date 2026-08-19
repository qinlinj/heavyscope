import { GripVertical } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { readModuleDrag, writeModuleDrag } from "@/lib/chartDnD";
import type { ChartModuleId } from "@/lib/charts";
import { cn } from "@/lib/utils";

type FrameProps = {
  id: ChartModuleId;
  onReorder: (fromId: ChartModuleId, toId: ChartModuleId) => void;
  children: ReactNode;
  className?: string;
};

export function ChartModuleFrame({ id, onReorder, children, className }: FrameProps) {
  const { t } = useTranslation();
  const [over, setOver] = useState(false);

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(true);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const fromId = readModuleDrag(event);
    if (!fromId) return;
    onReorder(fromId, id);
  }

  return (
    <div
      className={cn("relative", over && "rounded-xl ring-2 ring-primary/50", className)}
      onDragOver={handleDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <button
        type="button"
        draggable
        onDragStart={(event) => writeModuleDrag(event, id)}
        className="absolute right-2 top-2 z-10 inline-flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label={t("charts.dragHandle")}
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}
