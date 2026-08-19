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
        "grid gap-3",
        columns === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2",
        editing && "rounded-2xl border border-dashed border-foreground/25 bg-muted/15 p-2 sm:p-3",
      )}
    >
      {children}
    </div>
  );
}
