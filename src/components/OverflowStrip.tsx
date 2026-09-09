import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { overflowCanScroll, overflowScrollDelta, type OverflowScrollState } from "@/lib/overflowStrip";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** Convert vertical wheel / shift-wheel into horizontal scroll when the row overflows. */
  wheel?: "native" | "x";
  viewportRef?: RefObject<HTMLDivElement | null>;
};

export function OverflowStrip({ children, className, wheel = "native", viewportRef }: Props) {
  const { t } = useTranslation();
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = viewportRef ?? innerRef;
  const [state, setState] = useState<OverflowScrollState>({ prev: false, next: false });

  const sync = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setState(overflowCanScroll(node.scrollLeft, node.scrollWidth, node.clientWidth));
  }, [ref]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    sync();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    observer?.observe(node);
    if (node.firstElementChild) observer?.observe(node.firstElementChild);
    node.addEventListener("scroll", sync, { passive: true });

    const onWheel = (event: WheelEvent) => {
      if (wheel !== "x") return;
      if (node.scrollWidth <= node.clientWidth) return;
      const delta =
        event.shiftKey || Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (delta === 0) return;
      const max = node.scrollWidth - node.clientWidth;
      const nextLeft = Math.min(max, Math.max(0, node.scrollLeft + delta));
      if (nextLeft === node.scrollLeft) return;
      event.preventDefault();
      node.scrollLeft = nextLeft;
    };
    node.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer?.disconnect();
      node.removeEventListener("scroll", sync);
      node.removeEventListener("wheel", onWheel);
    };
  }, [ref, sync, wheel]);

  function scrollByDir(dir: -1 | 1) {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: dir * overflowScrollDelta(node.clientWidth), behavior: "smooth" });
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      {state.prev ? (
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          className="absolute top-1/2 left-0 z-10 -translate-y-1/2 bg-background/90"
          onClick={() => scrollByDir(-1)}
          title={t("tray.scrollPrev")}
        >
          <ChevronLeft />
          <span className="sr-only">{t("tray.scrollPrev")}</span>
        </Button>
      ) : null}
      <div ref={ref} className="min-w-0 overflow-x-auto overscroll-x-contain">
        {children}
      </div>
      {state.next ? (
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          className="absolute top-1/2 right-0 z-10 -translate-y-1/2 bg-background/90"
          onClick={() => scrollByDir(1)}
          title={t("tray.scrollNext")}
        >
          <ChevronRight />
          <span className="sr-only">{t("tray.scrollNext")}</span>
        </Button>
      ) : null}
    </div>
  );
}
