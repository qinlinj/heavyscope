import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="mx-auto mt-10 max-w-lg rounded-xl bg-card/90 p-6 ring-1 ring-destructive/40"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">{t("common.dbErrorTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("common.dbErrorBody")}</p>
          <p className="text-sm break-all text-destructive">{message}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}
