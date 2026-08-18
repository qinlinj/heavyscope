import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANG_STORAGE_KEY } from "@/i18n";
import { useDatabase } from "@/hooks/useDatabase";

export function Settings() {
  const { t, i18n } = useTranslation();
  const { setSetting, resetLocalData, ready } = useDatabase();

  function changeLanguage(next: string) {
    void i18n.changeLanguage(next);
    localStorage.setItem(LANG_STORAGE_KEY, next);
    setSetting("language", next);
    document.documentElement.lang = next;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="font-heading text-2xl font-semibold">{t("settings.title")}</h2>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
          <CardDescription>{t("settings.languageHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-1.5">
            <Label>{t("settings.language")}</Label>
            <Select value={i18n.resolvedLanguage ?? "zh-CN"} onValueChange={changeLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">{t("settings.zh")}</SelectItem>
                <SelectItem value="en">{t("settings.en")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.about")}</CardTitle>
          <CardDescription>{t("settings.aboutBody")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            {t("settings.stack")}: Vite + React + TypeScript + Tailwind CSS + shadcn/ui +
            Recharts + react-i18next + sql.js
          </p>
          <p>
            {t("settings.version")}: 0.3.0
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.data")}</CardTitle>
          <CardDescription>{t("settings.dataHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("settings.resetDataHint")}</p>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => {
              if (window.confirm(t("form.confirmDelete"))) resetLocalData();
            }}
          >
            {t("settings.resetData")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
