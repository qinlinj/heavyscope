import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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
import { flipTooltipPosition, type PlotBox } from "@/lib/heatmap";
import { displayPoolName } from "@/lib/poolName";
import { cn } from "@/lib/utils";

type Props = {
  pools: Pool[];
  compact?: boolean;
  size?: TileSize;
};

export type LegendMode = "none" | "short" | "full";

export function pieLegendMode(size: TileSize, compact: boolean): LegendMode {
  if (compact || size === "sm") return "none";
  if (size === "md") return "short";
  return "full";
}

export function pieShowsRemaining(size: TileSize, compact: boolean): boolean {
  if (compact) return false;
  return size === "lg" || size === "xl";
}

export function pieMinOuterRadius(size: TileSize): number {
  return size === "sm" ? 56 : 72;
}

export function pieOuterRadiusPx(size: TileSize, boxPx: number): number {
  const min = pieMinOuterRadius(size);
  if (boxPx <= 0) return min;
  return Math.max(min, Math.floor(boxPx / 2) - 4);
}

export function pieChartHeight(size: TileSize): number {
  if (size === "sm") return 132;
  if (size === "md") return 190;
  if (size === "xl") return 260;
  return 220;
}

/** Dashboard pies only: no Recharts default white sector stroke (dark-mode halo). */
export const DASHBOARD_PIE_SECTOR_STROKE = "none";

function tileContentMinH(size: TileSize): string {
  if (size === "sm") return "min-h-[168px]";
  if (size === "md") return "min-h-[200px]";
  if (size === "lg") return "min-h-[240px]";
  return "min-h-80";
}

const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  opacity: 1,
  boxShadow: "0 8px 24px color-mix(in oklch, var(--foreground) 18%, transparent)",
};

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
  const legend = pieLegendMode(size, compact);
  const showRemaining = pieShowsRemaining(size, compact);
  const height = pieChartHeight(size);

  return (
    <Card className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-card/90 ring-1 ring-foreground/10 backdrop-blur">
      <CardHeader>
        <CardTitle>{t("charts.pies")}</CardTitle>
        <CardDescription>{t("charts.piesHint")}</CardDescription>
      </CardHeader>
      <CardContent className={cn("min-h-0 flex-1", tileContentMinH(size))}>
        <div className={showRemaining ? "grid min-h-0 gap-4 md:grid-cols-2" : "grid min-h-0 gap-3"}>
          <PieBlock
            title={t("charts.piesUsed")}
            empty={t("charts.empty")}
            slices={used}
            height={height}
            size={size}
            legend={legend}
            tooltipValue={(slice) =>
              t("charts.piesTooltipUsed", {
                name: slice.name,
                percent: slice.value.toFixed(0),
                remaining: formatAmount(slice.remaining, slice.unit),
              })
            }
            legendValue={(slice) => `${slice.value.toFixed(0)}%`}
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
              size={size}
              legend={legend}
              tooltipValue={(slice) =>
                `${slice.name} · ${t("charts.piesTooltip", {
                  percent:
                    remaining.mode === "absolute"
                      ? formatAmount(slice.value, slice.unit)
                      : `${slice.value.toFixed(0)}%`,
                  remaining: formatAmount(slice.remaining, slice.unit),
                })}`
              }
              legendValue={(slice) =>
                legend === "full" ? formatAmount(slice.remaining, slice.unit) : `${slice.value.toFixed(0)}%`
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
  size,
  legend,
  tooltipValue,
  legendValue,
}: {
  title: string;
  empty: string;
  slices: PieSlice[];
  height: number;
  size: TileSize;
  legend: LegendMode;
  tooltipValue: (slice: PieSlice) => string;
  legendValue: (slice: PieSlice) => string;
}) {
  const { boxRef, width, height: boxHeight } = useBoxSize({ width: height, height });
  const box = Math.min(width > 0 ? width : height, boxHeight > 0 ? boxHeight : height);
  const outer = pieOuterRadiusPx(size, box);
  const inner = size === "sm" ? 0 : Math.round(outer * 0.45);

  if (slices.length === 0) {
    return (
      <div className="min-w-0">
        {legend !== "none" ? <p className="mb-2 text-xs font-medium">{title}</p> : null}
        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
          {empty}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {legend !== "none" ? <p className="mb-2 text-xs font-medium">{title}</p> : null}
      <div ref={boxRef} className="min-h-0 w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart className="[&_.recharts-sector]:stroke-none">
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={2}
              label={false}
              stroke={DASHBOARD_PIE_SECTOR_STROKE}
            >
              {slices.map((slice) => (
                <Cell key={slice.id} fill={slice.color} stroke={DASHBOARD_PIE_SECTOR_STROKE} />
              ))}
            </Pie>
            <Tooltip
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ outline: "none", pointerEvents: "none", visibility: "hidden" }}
              content={(props) => (
                <EscapingTooltip active={Boolean(props.active)} payload={props.payload} render={tooltipValue} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {legend !== "none" ? <PieLegend slices={slices} mode={legend} valueOf={legendValue} /> : null}
    </div>
  );
}

function PieLegend({
  slices,
  mode,
  valueOf,
}: {
  slices: PieSlice[];
  mode: "short" | "full";
  valueOf: (slice: PieSlice) => string;
}) {
  return (
    <ul
      className={cn(
        "mt-1 flex flex-wrap justify-center gap-x-2 gap-y-1 text-muted-foreground",
        mode === "short" ? "text-[10px] leading-tight sm:text-[11px]" : "text-xs",
      )}
    >
      {slices.map((slice) => (
        <li key={slice.id} className="flex min-w-0 items-center gap-1">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
          <span className="truncate">{slice.name}</span>
          <span className="tabular-nums">{valueOf(slice)}</span>
        </li>
      ))}
    </ul>
  );
}

function EscapingTooltip({
  active,
  payload,
  render,
}: {
  active: boolean;
  payload?: ReadonlyArray<{ payload?: PieSlice }>;
  render: (slice: PieSlice) => string;
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <HoverPortal>
      <span className="block max-w-56 text-xs leading-snug">{render(slice)}</span>
    </HoverPortal>
  );
}

function HoverPortal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [tip, setTip] = useState({ width: 200, height: 72 });

  useEffect(() => {
    const move = (event: MouseEvent) => setMouse({ x: event.clientX, y: event.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setTip({ width: node.offsetWidth, height: node.offsetHeight });
  }, [children]);

  const pos = flipTooltipPosition(
    { x: mouse.x, y: mouse.y, width: 1, height: 1 },
    tip,
    { width: window.innerWidth, height: window.innerHeight },
  );

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 px-2.5 py-1.5 text-xs"
      style={{
        top: pos.top,
        left: pos.left,
        ...TOOLTIP_STYLE,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function useBoxSize(fallback: PlotBox): { boxRef: RefObject<HTMLDivElement | null> } & PlotBox {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastGood = useRef(fallback);
  const [box, setBox] = useState(fallback);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const apply = (width: number, height: number) => {
      if (width > 0 && height > 0) {
        lastGood.current = { width, height };
        setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
        return;
      }
      setBox(lastGood.current);
    };
    apply(node.clientWidth, node.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      apply(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fallback.height, fallback.width]);

  return { boxRef, ...box };
}
