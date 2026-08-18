import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Pool, UsageRecord } from "@/db/schema";
import { dailySeries, poolShare, seriesHasUsage, weeklySeries } from "@/lib/charts";
import { displayPoolName } from "@/lib/poolName";

type Props = {
  pools: Pool[];
  records: UsageRecord[];
};

const AXIS = { fill: "oklch(0.708 0 0)", fontSize: 11 };
const GRID = "oklch(1 0 0 / 10%)";
const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.205 0 0)",
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: "0.75rem",
  color: "oklch(0.985 0 0)",
  boxShadow: "0 8px 24px oklch(0 0 0 / 35%)",
};
const TOOLTIP_LABEL = { color: "oklch(0.708 0 0)" };

function shortDate(value: string): string {
  return value.slice(5);
}

export function ChartsPanel({ pools, records }: Props) {
  const { t } = useTranslation();

  const daily = useMemo(() => dailySeries(records, pools, 14), [records, pools]);
  const weekly = useMemo(() => weeklySeries(records, 8, pools), [records, pools]);
  const share = useMemo(
    () => poolShare(pools, undefined, (pool) => displayPoolName(pool, t)),
    [pools, t],
  );
  const showDaily = seriesHasUsage(daily);
  const showWeekly = seriesHasUsage(weekly);
  const showShare = share.length > 0;

  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="font-heading text-base font-semibold">{t("charts.title")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("charts.subtitle")}</p>
      </div>

      {!showDaily && !showWeekly && !showShare ? (
        <p className="rounded-xl bg-card/80 px-4 py-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
          {t("charts.empty")}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard title={t("charts.daily")} hint={t("charts.dailyHint")}>
            {showDaily ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={AXIS} tickFormatter={shortDate} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL}
                    cursor={{ stroke: GRID }}
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
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.empty")} />
            )}
          </ChartCard>

          <ChartCard title={t("charts.weekly")} hint={t("charts.weeklyHint")}>
            {showWeekly ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" tick={AXIS} tickFormatter={shortDate} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL}
                    cursor={{ fill: "oklch(1 0 0 / 6%)" }}
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
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.empty")} />
            )}
          </ChartCard>

          <ChartCard title={t("charts.share")} hint={t("charts.shareHint")} className="lg:col-span-2">
            {showShare ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} />
                  <Legend />
                  <Pie
                    data={share}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={2}
                    stroke="oklch(0.205 0 0)"
                  >
                    {share.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.empty")} />
            )}
          </ChartCard>
        </div>
      )}
    </section>
  );
}

function ChartCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`bg-card/90 ring-1 ring-foreground/10 backdrop-blur ${className ?? ""}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
