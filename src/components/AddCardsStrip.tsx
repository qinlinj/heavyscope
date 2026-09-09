import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { LayoutTile } from "@/lib/dashboardLayout";

type Props = {
  tiles: LayoutTile[];
  labelFor: (tile: LayoutTile) => string;
  onRestore: (id: string) => void;
};

export function AddCardsStrip({ tiles, labelFor, onRestore }: Props) {
  const { t } = useTranslation();
  if (tiles.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-heading text-sm font-semibold">{t("layout.addCards")}</h3>
        <p className="text-xs text-muted-foreground">{t("layout.addCardsHint")}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {tiles.map((tile) => (
          <li key={tile.id}>
            <Button type="button" size="sm" variant="outline" onClick={() => onRestore(tile.id)}>
              <Plus data-icon="inline-start" />
              {t("layout.addCard")}: {labelFor(tile)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
