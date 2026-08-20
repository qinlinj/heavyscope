export type OverflowScrollState = {
  prev: boolean;
  next: boolean;
};

/** Whether a horizontal scroller can move backward / forward. */
export function overflowCanScroll(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): OverflowScrollState {
  const max = Math.max(0, scrollWidth - clientWidth);
  return {
    prev: scrollLeft > 1,
    next: scrollLeft < max - 1,
  };
}

export function overflowScrollDelta(clientWidth: number): number {
  return Math.max(80, Math.round(clientWidth * 0.6));
}
