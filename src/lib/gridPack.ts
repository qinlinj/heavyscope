/**
 * CSS Grid occupancy for the dashboard / tray widget canvas.
 *
 * Spans are honest column counts on a fixed track (4 on the web dashboard
 * from `md` up, 2 on `/tray`). If a tile's span is larger than the leftover
 * columns in the current row, it wraps — the CSS default when `grid-auto-flow`
 * is `row` and we do not enable `dense`.
 */

export function tileFitsInRow(leftoverColumns: number, span: number): boolean {
  if (span <= 0 || leftoverColumns <= 0) return false;
  return span <= leftoverColumns;
}

/**
 * Place `span` onto a row that still has `leftover` columns.
 * When it cannot fit, wrap to a fresh row of `columns` tracks.
 */
export function leftoverAfterPlace(
  leftover: number,
  span: number,
  columns: number,
): { leftover: number; wrapped: boolean } {
  const safeColumns = Math.max(1, columns);
  const safeSpan = Math.min(Math.max(1, span), safeColumns);
  const available = leftover <= 0 ? safeColumns : leftover;
  if (safeSpan <= available) {
    return {
      leftover: available - safeSpan,
      wrapped: leftover > 0 && safeSpan > leftover,
    };
  }
  return { leftover: safeColumns - safeSpan, wrapped: true };
}

export type PackedSpan = {
  span: number;
  wrapped: boolean;
  leftoverAfter: number;
};

/** Sequential packing used by tests and as the documented CSS-grid contract. */
export function packSpans(spans: readonly number[], columns: number): PackedSpan[] {
  const safeColumns = Math.max(1, columns);
  let leftover = safeColumns;
  return spans.map((raw) => {
    const span = Math.min(Math.max(1, raw), safeColumns);
    const placed = leftoverAfterPlace(leftover, span, safeColumns);
    leftover = placed.leftover;
    return { span, wrapped: placed.wrapped, leftoverAfter: placed.leftover };
  });
}
