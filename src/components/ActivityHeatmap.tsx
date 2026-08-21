import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { OverflowStrip } from "@/components/OverflowStrip";
import type { Pool, UsageRecord } from "@/db/schema";
import type { TileSize } from "@/lib/dashboardLayout";
import { formatAmount } from "@/lib/format";
import type { ChartScale } from "@/lib/charts";
import type { HeatmapCell, PlotBox } from "@/lib/heatmap";
import {
  HEATMAP_CELL_GAP_PX,
  HEATMAP_MONTH_ROW_PX,
  HEATMAP_WEEKDAY_COL_PX,
  clampSquareCellPx,
  fitWebHeatmap,
  flipTooltipPosition,
  heatmapCellIntensity,
  heatmapDayTotal,
  heatmapFallbackBox,
  heatmapGrid,
  heatmapLevel,
  heatmapMonthLabels,
  heatmapWeekOffsetPx,
  squareCellPx,
} from "@/lib/heatmap";
import {
  clampTrayHeatmapZoomWeeks,
  fitTrayHeatmap,
  trayHeatFill,
  trayHeatmapWeeksFromDrag,
  TRAY_HEATMAP_WEEKS,
} from "@/lib/trayView";
import { displayPoolName } from "@/lib/poolName";
import { cn } from "@/lib/utils";

type HeatmapPool = Pick<Pool, "id" | "unit" | "name" | "color">;

type Props = {
  records: UsageRecord[];
  pools?: HeatmapPool[];
  weeks?: number;
  compact?: boolean;
  size?: TileSize;
  minCellPx?: number;
  maxCellPx?: number;
  /** Ignored on the tray compact path. Web Usage still owns Day/Week/Month. */
  scale?: ChartScale;
};

const HEAT_LEVELS = [0, 1, 2, 3, 4] as const;

const TIP_STYLE: CSSProperties = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  opacity: 1,
  boxShadow: "0 8px 24px color-mix(in oklch, var(--foreground) 18%, transparent)",
};

export function ActivityHeatmap({
  records,
  pools,
  weeks,
  compact = false,
  size,
  minCellPx,
  maxCellPx,
  scale: _scale,
}: Props) {
  const { t, i18n } = useTranslation();
  const fallback = useMemo(() => heatmapFallbackBox(size ?? (compact ? "sm" : "lg")), [size, compact]);
  const { boxRef, width, height } = usePlotBox(fallback);
  const webFit = size ? fitWebHeatmap(width, size, fallback.width) : null;
  const trayFit = compact && !size ? fitTrayHeatmap(width, fallback.width) : null;
  const autoWeeks = useHeatmapWeeks(compact);
  const [zoomWeeks, setZoomWeeks] = useState<number | null>(null);
  const fittedTrayWeeks = trayFit?.weeks ?? autoWeeks;
  const trayWeeks = trayFit
    ? clampTrayHeatmapZoomWeeks(zoomWeeks ?? fittedTrayWeeks, fittedTrayWeeks)
    : null;
  const resolvedWeeks = webFit?.weeks ?? trayWeeks ?? weeks ?? autoWeeks;
  void _scale;
  const grid = useMemo(() => heatmapGrid(records, resolvedWeeks, new Date(), pools), [records, resolvedWeeks, pools]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [tip, setTip] = useState<{ cell: HeatmapCell; anchor: DOMRect } | null>(null);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const months = useMemo(() => heatmapMonthLabels(grid.cells, grid.weeks, locale), [grid, locale]);
  const today = useMemo(() => localTodayKey(), []);
  const maxValue = grid.intensityMetric === "amount" ? grid.maxAmount : grid.maxCount;
  const minCell = minCellPx ?? (compact ? 8 : undefined);
  const maxCell = maxCellPx ?? (compact ? 10 : undefined);
  const plotHeight = compact
    ? 7 * (maxCell ?? 10) + 6 * HEATMAP_CELL_GAP_PX
    : Math.max(0, height - HEATMAP_MONTH_ROW_PX);
  const fitted = squareCellPx(
    Math.max(0, width - HEATMAP_WEEKDAY_COL_PX),
    plotHeight,
    grid.weeks,
    HEATMAP_CELL_GAP_PX,
    { width: Math.max(0, fallback.width - HEATMAP_WEEKDAY_COL_PX), height: fallback.height },
  );
  const cell = webFit?.cell ?? trayFit?.cell ?? clampSquareCellPx(fitted, minCell, maxCell);
  const safeCell = cell > 0 ? cell : 11;
  const showMonthRow = compact || safeCell >= 12;
  const heatColor = (level: 0 | 1 | 2 | 3 | 4) => (compact ? trayHeatFill(level) : `var(--heat-${level})`);
  const gap = HEATMAP_CELL_GAP_PX;
  const gridW = grid.weeks * safeCell + (grid.weeks - 1) * gap;
  const gridH = 7 * safeCell + 6 * gap;

  const plot = (
    <div
      className="grid shrink-0 grid-cols-[auto_auto] gap-x-1"
      style={{
        width: gridW + HEATMAP_WEEKDAY_COL_PX + 4,
        gridTemplateRows: showMonthRow ? "auto auto" : "auto",
      }}
    >
      {showMonthRow ? (
        <>
          <div aria-hidden="true" />
          <div
            className={cn("relative mb-1 overflow-visible", compact && "mb-0.5")}
            style={{ width: gridW, height: HEATMAP_MONTH_ROW_PX }}
          >
            {[...months.entries()].map(([weekIndex, label]) => (
              <span
                key={weekIndex}
                className="absolute top-0 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                style={{ left: heatmapWeekOffsetPx(weekIndex, safeCell, gap) }}
              >
                {label}
              </span>
            ))}
          </div>
        </>
      ) : null}
      <div
        className="grid text-[9px] leading-none text-muted-foreground"
        style={{ gridTemplateRows: `repeat(7, ${safeCell}px)`, rowGap: gap, height: gridH }}
      >
        {weekdays.map((label, weekday) => (
          <span
            key={label + weekday}
            className={cn("flex w-3 items-center justify-end", weekday % 2 === 0 && "invisible")}
          >
            {label}
          </span>
        ))}
      </div>
      <div
        className="grid grid-flow-col grid-rows-7"
        style={{
          width: gridW,
          height: gridH,
          gridTemplateColumns: `repeat(${grid.weeks}, ${safeCell}px)`,
          gap,
        }}
      >
        {grid.cells.map((cellItem) => {
          const intensity = heatmapCellIntensity(cellItem, grid);
          const level = heatmapLevel(intensity, maxValue);
          return (
            <button
              key={cellItem.date}
              type="button"
              className={cn("rounded-[2px]", cellItem.date === today && "ring-1 ring-foreground/50")}
              style={{
                width: safeCell,
                height: safeCell,
                backgroundColor: heatColor(level),
                boxShadow: compact ? undefined : "inset 0 0 0 1px var(--heat-outline)",
              }}
              onMouseEnter={(event) => setTip({ cell: cellItem, anchor: event.currentTarget.getBoundingClientRect() })}
              onMouseLeave={() => setTip(null)}
              onFocus={(event) => setTip({ cell: cellItem, anchor: event.currentTarget.getBoundingClientRect() })}
              onBlur={() => setTip(null)}
            >
              <span className="sr-only">{heatmapAria(t, cellItem)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const legend = (
    <span className="flex shrink-0 items-center gap-1">
      <span>{t("charts.less")}</span>
      {HEAT_LEVELS.map((level) => (
        <span
          key={level}
          className="size-2.5 rounded-[2px]"
          style={{
            backgroundColor: heatColor(level),
            boxShadow: compact ? undefined : "inset 0 0 0 1px var(--heat-outline)",
          }}
        />
      ))}
      <span>{t("charts.more")}</span>
    </span>
  );

  const stats = (
    <div
      className={cn(
        "flex min-w-[9rem] flex-1 items-center justify-between gap-2 text-xs text-muted-foreground",
        compact && "mt-1.5 w-full justify-end",
        !compact && "min-h-4",
      )}
    >
      {compact ? null : (
        <span className="min-h-4 min-w-0 truncate tabular-nums">
          {t("charts.heatmapPeriod", {
            weeks: grid.weeks,
            metric:
              grid.intensityMetric === "amount"
                ? t("charts.heatmapMetricAmount")
                : t("charts.heatmapMetricCount"),
          })}
        </span>
      )}
      {legend}
    </div>
  );

  return (
    <div
      className={cn("flex w-full", compact ? "flex-col" : "h-full min-h-0 flex-col")}
    >
      {compact ? (
        <div ref={boxRef} className="w-full min-w-0">
          <CompactTrayPlot
            gridWeeks={grid.weeks}
            cells={grid.cells}
            months={months}
            weekdays={weekdays}
            today={today}
            maxValue={maxValue}
            intensity={(cellItem) => heatmapCellIntensity(cellItem, grid)}
            t={t}
            fittedWeeks={fittedTrayWeeks}
            zoomWeeks={trayWeeks ?? fittedTrayWeeks}
            onZoomWeeks={setZoomWeeks}
          />
        </div>
      ) : (
        <div
          ref={boxRef}
          className="flex min-h-0 w-full flex-1 flex-wrap content-end items-end gap-x-3 gap-y-2"
        >
          <OverflowStrip wheel="x" className="min-w-0 shrink-0">
            <div className="flex w-max min-h-0 justify-start">{plot}</div>
          </OverflowStrip>
          {stats}
        </div>
      )}
      {!compact && tip ? <HeatmapHoverTip cell={tip.cell} anchor={tip.anchor} pools={pools ?? []} /> : null}
    </div>
  );
}

function CompactTrayPlot({
  gridWeeks,
  cells,
  months,
  weekdays,
  today,
  maxValue,
  intensity,
  t,
  fittedWeeks,
  zoomWeeks,
  onZoomWeeks,
}: {
  gridWeeks: number;
  cells: HeatmapCell[];
  months: Map<number, string>;
  weekdays: string[];
  today: string;
  maxValue: number;
  intensity: (cell: HeatmapCell) => number;
  t: (key: string, opts?: Record<string, unknown>) => string;
  fittedWeeks: number;
  zoomWeeks: number;
  onZoomWeeks: (weeks: number | null) => void;
}) {
  const gap = HEATMAP_CELL_GAP_PX;
  const drag = useRef<{ x: number; weeks: number } | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, weeks: zoomWeeks };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next = trayHeatmapWeeksFromDrag(
      drag.current.weeks,
      event.clientX - drag.current.x,
      event.currentTarget.clientWidth,
      fittedWeeks,
    );
    onZoomWeeks(next);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  }

  return (
    <div
      className="grid w-full min-w-0 touch-pan-y select-none"
      style={{
        gridTemplateColumns: `${HEATMAP_WEEKDAY_COL_PX}px repeat(${gridWeeks}, minmax(0, 1fr))`,
        gridTemplateRows: `${HEATMAP_MONTH_ROW_PX}px repeat(7, auto)`,
        columnGap: gap,
        rowGap: gap,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onZoomWeeks(null)}
    >
      <div aria-hidden="true" style={{ gridColumn: 1, gridRow: 1 }} />
      {Array.from({ length: gridWeeks }, (_, weekIndex) => (
        <span
          key={`month-${weekIndex}`}
          className="overflow-visible text-[8.5px] leading-none whitespace-nowrap text-muted-foreground"
          style={{ gridColumn: weekIndex + 2, gridRow: 1 }}
        >
          {months.get(weekIndex) ?? ""}
        </span>
      ))}
      {weekdays.map((label, weekday) => (
        <span
          key={`dow-${label}-${weekday}`}
          className={cn(
            "flex items-center justify-end text-[8.5px] leading-none text-muted-foreground",
            weekday % 2 === 0 && "invisible",
          )}
          style={{ gridColumn: 1, gridRow: weekday + 2 }}
        >
          {label}
        </span>
      ))}
      {cells.map((cellItem) => {
        const level = heatmapLevel(intensity(cellItem), maxValue);
        const hovered = hoverDate === cellItem.date;
        return (
          <button
            key={cellItem.date}
            type="button"
            className={cn(
              "w-full rounded-[2px] aspect-square",
              cellItem.date === today && "ring-1 ring-foreground/50",
              hovered && "opacity-80 ring-1 ring-foreground/70",
            )}
            style={{
              gridColumn: cellItem.weekIndex + 2,
              gridRow: cellItem.weekday + 2,
              width: "100%",
              aspectRatio: "1 / 1",
              backgroundColor: trayHeatFill(level),
            }}
            onMouseEnter={() => setHoverDate(cellItem.date)}
            onMouseLeave={() => setHoverDate(null)}
            onFocus={() => setHoverDate(cellItem.date)}
            onBlur={() => setHoverDate(null)}
          >
            <span className="sr-only">{heatmapAria(t, cellItem)}</span>
          </button>
        );
      })}
    </div>
  );
}

function HeatmapHoverTip({
  cell,
  anchor,
  pools,
}: {
  cell: HeatmapCell;
  anchor: DOMRect;
  pools: HeatmapPool[];
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [tipSize, setTipSize] = useState({ width: 220, height: 120 });
  const total = heatmapDayTotal(cell);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setTipSize({ width: node.offsetWidth, height: node.offsetHeight });
  }, [cell]);

  const pos = flipTooltipPosition(
    { x: anchor.left, y: anchor.top, width: anchor.width, height: anchor.height },
    tipSize,
    { width: window.innerWidth, height: window.innerHeight },
  );

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 min-w-40 max-w-64 px-2.5 py-1.5 text-xs"
      style={{ top: pos.top, left: pos.left, ...TIP_STYLE }}
    >
      <p className="font-medium tabular-nums text-popover-foreground">{cell.date}</p>
      {cell.pools.length === 0 ? (
        <p className="mt-1 text-muted-foreground">{t("charts.heatmapTooltipRecords", { count: cell.count })}</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {cell.pools.map((line) => {
            const pool = pools.find((item) => item.id === line.poolId);
            const name = pool ? displayPoolName(pool, t) : line.poolId;
            return (
              <li key={line.poolId} className="flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: pool?.color || "var(--muted-foreground)" }}
                />
                <span className="min-w-0 truncate">{name}</span>
                <span className="ml-auto tabular-nums">{formatAmount(line.amount, line.unit)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 border-t border-border pt-1 text-muted-foreground tabular-nums">
        {total.kind === "amount"
          ? t("charts.heatmapTooltipTotal", { amount: formatAmount(total.amount, total.unit) })
          : t("charts.heatmapTooltipRecords", { count: total.count })}
      </p>
    </div>,
    document.body,
  );
}

function heatmapAria(
  t: (key: string, opts?: Record<string, unknown>) => string,
  cell: HeatmapCell,
): string {
  const total = heatmapDayTotal(cell);
  if (total.kind === "amount") {
    return t("charts.heatmapTooltipAmount", {
      date: cell.date,
      count: cell.count,
      amount: formatAmount(total.amount, total.unit),
    });
  }
  return t("charts.heatmapTooltip", { date: cell.date, total: cell.count });
}

function usePlotBox(fallback: PlotBox): { boxRef: RefObject<HTMLDivElement | null> } & PlotBox {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastGood = useRef(fallback);
  const [box, setBox] = useState(fallback);

  useEffect(() => {
    lastGood.current = fallback;
  }, [fallback.width, fallback.height]);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const apply = (nextWidth: number, nextHeight: number) => {
      if (nextWidth > 0 && nextHeight > 0) {
        lastGood.current = { width: nextWidth, height: nextHeight };
        setBox((current) =>
          current.width === nextWidth && current.height === nextHeight
            ? current
            : { width: nextWidth, height: nextHeight },
        );
        return;
      }
      setBox((current) =>
        current.width === lastGood.current.width && current.height === lastGood.current.height
          ? current
          : lastGood.current,
      );
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
  }, []);

  return { boxRef, ...box };
}

function useHeatmapWeeks(compact: boolean): number {
  const [weeks, setWeeks] = useState(compact ? TRAY_HEATMAP_WEEKS : 26);
  useEffect(() => {
    if (compact) {
      setWeeks(TRAY_HEATMAP_WEEKS);
      return;
    }
    const wide = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWeeks(wide.matches ? 26 : 12);
    apply();
    wide.addEventListener("change", apply);
    return () => wide.removeEventListener("change", apply);
  }, [compact]);
  return weeks;
}

function localTodayKey(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function weekdayLabels(locale: string): string[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const date = new Date(2026, 7, 16 + weekday);
    return date.toLocaleDateString(locale, { weekday: "narrow" });
  });
}

