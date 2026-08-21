import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Pool, UsageRecord } from "@/db/schema";
import {
  type ChartModuleId,
  type ChartScale,
  chartRecords,
  poolUsageBars,
  scaleSeries,
  seriesHasUsage,
} from "@/lib/charts";
import type { TileSize } from "@/lib/dashboardLayout";
import { displayPoolName } from "@/lib/poolName";

type Props = {
  pools: Pool[];
  records: UsageRecord[];
  modules: ChartModuleId[];
  showHeading?: boolean;
  compact?: boolean;
  size?: TileSize;
};

const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 };
const GRID = "var(--border)";
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px color-mix(in oklch, var(--foreground) 18%, transparent)",
};
const TOOLTIP_LABEL = { color: "var(--muted-foreground)" };

const SCALES: ChartScale[] = ["day", "week", "month"];

function shortKey(value: string): string {
  return value.length > 7 ? value.slice(5) : value;
}

export function ChartsPanel({
  pools,
  records,
  modules,
  showHeading = true,
  compact = false,
  size = "lg",
}: Props) {
  const { t } = useTranslation();
  const [scale, setScale] = useState<ChartScale>("day");
  const showHeatmap = modules.includes("heatmap");
  const showTrend = modules.includes("trend");
  const chartHeight = size === "xl" ? 320 : compact || size === "sm" ? 160 : 240;

  const liveRecords = useMemo(() => chartRecords(records), [records]);
  const series = useMemo(() => scaleSeries(liveRecords, scale, pools), [liveRecords, scale, pools]);
  const bars = useMemo(
    () => poolUsageBars(pools, (pool) => displayPoolName(pool, t)),
    [pools, t],
  );
  const showSeries = seriesHasUsage(series);
  const showStackedChart = showTrend && size !== "sm";

  if (!showHeatmap && !showTrend) return null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-2.5">
      {showHeading ? (
        <div>
          <h3 className="font-heading text-base font-semibold">{t("charts.title")}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("charts.subtitle")}</p>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3">
        {showHeatmap && (
          <ChartCard title={t("charts.heatmap")} hint={t("charts.heatmapHint")} size={size}>
            <ActivityHeatmap records={liveRecords} pools={pools} compact={compact} size={size} />
          </ChartCard>
        )}

        {showTrend && (
          <ChartCard
            title={t("charts.trend")}
            hint={t(`charts.trendHint.${scale}`)}
            size={size}
            action={
              showStackedChart ? (
                <div className="flex flex-wrap gap-1">
                  {SCALES.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      size="xs"
                      variant={scale === item ? "default" : "outline"}
                      onClick={() => setScale(item)}
                    >
                      {t(`charts.scale.${item}`)}
                    </Button>
                  ))}
                </div>
              ) : undefined
            }
          >
            {showStackedChart ? (
              showSeries ? (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  {scale === "day" ? (
                    <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="key" tick={AXIS} tickFormatter={shortKey} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL}
                        cursor={{ stroke: GRID }}
                        formatter={(value) => [`+${Number(value ?? 0)}`, undefined]}
                      />
                      <Legend />
                      {pools.map((pool) => (
                        <Area
                          key={pool.id}
                          type="monotone"
                          dataKey={pool.id}
                          name={displayPoolName(pool, t)}
                          stackId="usage"
                          stroke={pool.color}
                          fill={pool.color}
                          fillOpacity={0.35}
                        />
                      ))}
                    </AreaChart>
                  ) : (
                    <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="key" tick={AXIS} tickFormatter={shortKey} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL}
                        cursor={{ fill: "color-mix(in oklch, var(--foreground) 8%, transparent)" }}
                        formatter={(value) => [`+${Number(value ?? 0)}`, undefined]}
                      />
                      <Legend />
                      {pools.map((pool) => (
                        <Bar
                          key={pool.id}
                          dataKey={pool.id}
                          name={displayPoolName(pool, t)}
                          stackId="usage"
                          fill={pool.color}
                          radius={[3, 3, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <EmptyChart label={t("charts.empty")} height={chartHeight} />
              )
            ) : null}
            {showTrend && bars.length > 0 && (
              <ul className={`max-h-36 overflow-y-auto pr-1 ${showStackedChart ? "mt-3 space-y-2.5" : "space-y-2.5"}`}>
                {bars.map((bar) => (
                  <li key={bar.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: bar.color }} />
                        <span className="truncate">{bar.name}</span>
                        <span className="text-muted-foreground">{bar.unit}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">{bar.percent.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${bar.percent}%`, backgroundColor: bar.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        )}
      </div>
    </section>
  );
}

function tileContentMinH(size: TileSize): string {
  if (size === "sm") return "min-h-[168px]";
  if (size === "md") return "min-h-[200px]";
  if (size === "lg") return "min-h-[240px]";
  return "min-h-80";
}

function ChartCard({
  title,
  hint,
  className,
  action,
  size,
  children,
}: {
  title: string;
  hint: string;
  className?: string;
  action?: ReactNode;
  size: TileSize;
  children: ReactNode;
}) {
  return (
    <Card className={`flex h-full min-h-0 flex-col overflow-hidden bg-card/90 ring-1 ring-foreground/10 backdrop-blur ${className ?? ""}`}>
      <CardHeader className={action ? "gap-2" : undefined}>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
        {action ? <div className="col-span-full">{action}</div> : null}
      </CardHeader>
      <CardContent className={`min-h-0 flex-1 ${tileContentMinH(size)}`}>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ label, height }: { label: string; height: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
      {label}
    </div>
  );
}
