import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Pool } from "@/db/schema";
import { remainingSharePie, usedPercentPies, type PieSlice } from "@/lib/charts";
import type { TileSize } from "@/lib/dashboardLayout";
import { formatAmount } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";

type Props = {
  pools: Pool[];
  compact?: boolean;
  size?: TileSize;
};

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  color: "var(--popover-foreground)",
};

type LegendMode = "none" | "short" | "full";

function legendModeFor(size: TileSize, compact: boolean): LegendMode {
  if (compact || size === "sm") return "none";
  if (size === "md") return "short";
  return "full";
}

export function PiesPanel({ pools, compact = false, size = "lg" }: Props) {
  const { t } = useTranslation();
  const used = useMemo(
    () => usedPercentPies(pools, (pool) => displayPoolName(pool, t)).filter((slice) => slice.value > 0),
    [pools, t],
  );
  const remaining = useMemo(
    () => remainingSharePie(pools, (pool) => displayPoolName(pool, t)),
    [pools, t],
  );
  const remainingSlices = remaining.slices.filter((slice) => slice.value > 0);
  const legend = legendModeFor(size, compact);
  const height = size === "xl" ? 260 : legend === "none" ? 160 : 220;
  const showRemaining = legend !== "none";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-card/90 ring-1 ring-foreground/10 backdrop-blur">
      <CardHeader>
        <CardTitle>{t("charts.pies")}</CardTitle>
        <CardDescription>{t("charts.piesHint")}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <div className={showRemaining ? "grid min-h-0 gap-4 md:grid-cols-2" : "grid min-h-0 gap-3"}>
          <PieBlock
            title={t("charts.piesUsed")}
            empty={t("charts.empty")}
            slices={used}
            height={height}
            legend={legend}
            tooltipValue={(slice) =>
              t("charts.piesTooltip", {
                percent: slice.value.toFixed(0),
                remaining: formatAmount(slice.remaining, slice.unit),
              })
            }
            legendValue={(slice) =>
              legend === "full"
                ? `${formatAmount(slice.remaining, slice.unit)} · ${slice.value.toFixed(0)}%`
                : `${slice.value.toFixed(0)}%`
            }
          />
          {showRemaining ? (
            <PieBlock
              title={
                remaining.mode === "absolute"
                  ? t("charts.piesRemainingShare")
                  : t("charts.piesRemainingPercent")
              }
              empty={t("charts.empty")}
              slices={remainingSlices}
              height={height}
              legend={legend}
              tooltipValue={(slice) =>
                t("charts.piesTooltip", {
                  percent:
                    remaining.mode === "absolute"
                      ? formatAmount(slice.value, slice.unit)
                      : `${slice.value.toFixed(0)}%`,
                  remaining: formatAmount(slice.remaining, slice.unit),
                })
              }
              legendValue={(slice) =>
                legend === "full" ? formatAmount(slice.remaining, slice.unit) : slice.name
              }
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PieBlock({
  title,
  empty,
  slices,
  height,
  legend,
  tooltipValue,
  legendValue,
}: {
  title: string;
  empty: string;
  slices: PieSlice[];
  height: number;
  legend: LegendMode;
  tooltipValue: (slice: PieSlice) => string;
  legendValue: (slice: PieSlice) => string;
}) {
  if (slices.length === 0) {
    return (
      <div className="min-w-0">
        <p className="mb-2 text-xs font-medium">{title}</p>
        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
          {empty}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="45%"
            outerRadius={legend === "none" ? "80%" : "70%"}
            paddingAngle={2}
            label={false}
          >
            {slices.map((slice) => (
              <Cell key={slice.id} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(_value, name, item) => {
              const slice = item?.payload as PieSlice | undefined;
              return slice ? [tooltipValue(slice), name] : "";
            }}
          />
          {legend !== "none" ? (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              formatter={(name, entry) => {
                const slice = entry.payload as PieSlice | undefined;
                if (!slice) return String(name);
                return legend === "short" ? `${name} · ${slice.value.toFixed(0)}%` : `${name} · ${legendValue(slice)}`;
              }}
            />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
