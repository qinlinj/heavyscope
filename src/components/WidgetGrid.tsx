import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  columns: 2 | 4;
  editing: boolean;
  children: ReactNode;
};

export function WidgetGrid({ columns, editing, children }: Props) {
  return (
    <div
      data-widget-grid={columns}
      data-editing={editing ? "true" : "false"}
      className={cn(
        "grid items-stretch gap-3 [grid-auto-flow:row]",
        columns === 4
          ? "grid-cols-1 md:grid-cols-[repeat(4,minmax(0,1fr))]"
          : "grid-cols-[repeat(2,minmax(0,1fr))]",
        editing && "rounded-2xl border border-dashed border-foreground/25 bg-muted/15 p-2 sm:p-3",
      )}
    >
      {children}
    </div>
  );
}
