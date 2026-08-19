import { GripVertical } from "lucide-react";
import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { readModuleDrag, writeModuleDrag } from "@/lib/chartDnD";
import { type ChartModuleId, type ChartPrefs } from "@/lib/charts";
import { cn } from "@/lib/utils";

type Props = {
  prefs: ChartPrefs;
  onToggle: (id: ChartModuleId, show: boolean) => void;
  onReorder: (fromId: ChartModuleId, toId: ChartModuleId) => void;
};

export function ChartLayoutControls({ prefs, onToggle, onReorder }: Props) {
  const { t } = useTranslation();
  const [overId, setOverId] = useState<ChartModuleId | null>(null);

  function handleDragOver(event: DragEvent, id: ChartModuleId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOverId(id);
  }

  function handleDrop(event: DragEvent, id: ChartModuleId) {
    event.preventDefault();
    setOverId(null);
    const fromId = readModuleDrag(event);
    if (!fromId) return;
    onReorder(fromId, id);
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-heading text-base font-semibold">{t("charts.modules")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("charts.modulesHint")}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {prefs.order.map((id) => (
          <li
            key={id}
            draggable
            onDragStart={(event) => writeModuleDrag(event, id)}
            onDragOver={(event) => handleDragOver(event, id)}
            onDragLeave={() => setOverId((current) => (current === id ? null : current))}
            onDrop={(event) => handleDrop(event, id)}
            className={cn(
              "flex cursor-grab items-center gap-1 rounded-lg bg-card/90 px-2 py-1 ring-1 ring-foreground/10 active:cursor-grabbing",
              overId === id && "ring-2 ring-primary/50",
            )}
          >
            <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label className="flex cursor-pointer items-center gap-1.5 pr-1 text-xs font-medium">
              <input
                type="checkbox"
                className="size-3.5 accent-emerald-600 dark:accent-emerald-400"
                checked={prefs.show[id]}
                onChange={(event) => onToggle(id, event.target.checked)}
                onClick={(event) => event.stopPropagation()}
              />
              {t(`charts.module.${id}`)}
            </label>
            <span className="sr-only">{t("charts.dragHandle")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
