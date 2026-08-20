import { EyeOff, GripVertical } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { readTileDrag, writeTileDrag } from "@/lib/chartDnD";
import { TILE_SIZES, type LayoutTile, type TileSize } from "@/lib/dashboardLayout";
import { cn } from "@/lib/utils";

type Props = {
  tile: LayoutTile;
  columns: 2 | 4;
  editing: boolean;
  sizes?: readonly TileSize[];
  onReorder: (fromId: string, toId: string) => void;
  onSize: (id: string, size: TileSize) => void;
  onHide: (id: string) => void;
  children: ReactNode;
};

export function WidgetTile({
  tile,
  columns,
  editing,
  sizes = TILE_SIZES,
  onReorder,
  onSize,
  onHide,
  children,
}: Props) {
  const { t } = useTranslation();
  const [over, setOver] = useState(false);

  function handleDragOver(event: DragEvent) {
    if (!editing) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(true);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (!editing) return;
    const fromId = readTileDrag(event);
    if (!fromId) return;
    onReorder(fromId, tile.id);
  }

  return (
    <div
      data-tile-id={tile.id}
      data-tile-size={tile.size}
      className={cn(
        "relative min-w-0 min-h-0",
        spanClass(tile.size, columns),
        tile.size === "xl" && "min-h-80",
      )}
      onDragOver={handleDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          "relative h-full min-h-0 overflow-hidden rounded-xl",
          !editing && "transition duration-150 hover:-translate-y-0.5 hover:shadow-md",
          editing && "ring-2 ring-dashed ring-primary/30",
          over && "ring-2 ring-primary/60",
        )}
      >
        {editing ? (
          <div className="absolute top-1.5 right-1.5 z-20 flex flex-wrap items-center justify-end gap-0.5 rounded-md bg-background/90 p-0.5 shadow-sm ring-1 ring-foreground/10 backdrop-blur">
            <button
              type="button"
              draggable
              onDragStart={(event) => writeTileDrag(event, tile.id)}
              className="inline-flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              aria-label={t("layout.dragHandle")}
            >
              <GripVertical className="size-3.5" />
            </button>
            <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label={t("layout.sizeGroup")}>
              {sizes.map((size) => (
                <Button
                  key={size}
                  type="button"
                  size="xs"
                  variant={tile.size === size ? "default" : "ghost"}
                  className="px-1.5"
                  onClick={() => onSize(tile.id, size)}
                  aria-pressed={tile.size === size}
                  aria-label={t(`layout.sizeAria.${size}`)}
                >
                  {t(`layout.size.${size}`)}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => onHide(tile.id)}
              aria-label={t("layout.hideCard")}
            >
              <EyeOff />
            </Button>
          </div>
        ) : null}
        <div className="h-full min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function spanClass(size: TileSize, columns: 2 | 4): string {
  if (columns === 2) return size === "sm" ? "col-span-1" : "col-span-2";
  if (size === "sm") return "col-span-1";
  if (size === "md") return "col-span-1 md:col-span-2";
  return "col-span-1 md:col-span-4";
}
