import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PoolFormDialog } from "@/components/PoolFormDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pool, PoolDraft } from "@/db/schema";
import { persistLanguage } from "@/i18n";
import { useDatabase } from "@/hooks/useDatabase";
import { formatAmount, usagePercent } from "@/lib/format";
import {
  isValidThresholds,
  SETTING_CRIT_PERCENT,
  SETTING_WARN_PERCENT,
} from "@/lib/settings";

export function Settings() {
  const { t, i18n } = useTranslation();
  const {
    setSetting,
    resetLocalData,
    ready,
    pools,
    createPool,
    updatePool,
    deletePool,
    thresholds,
  } = useDatabase();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pool | null>(null);
  const [warnInput, setWarnInput] = useState(String(thresholds.warn));
  const [critInput, setCritInput] = useState(String(thresholds.crit));

  useEffect(() => {
    setWarnInput(String(thresholds.warn));
    setCritInput(String(thresholds.crit));
  }, [thresholds.warn, thresholds.crit]);

  const warnValue = Number(warnInput);
  const critValue = Number(critInput);
  const thresholdsOk = isValidThresholds(warnValue, critValue);

  function changeLanguage(next: string) {
    persistLanguage(next, setSetting);
  }

  function commitThresholds(nextWarn: string, nextCrit: string) {
    const warn = Number(nextWarn);
    const crit = Number(nextCrit);
    if (!isValidThresholds(warn, crit)) return;
    if (warn !== thresholds.warn) setSetting(SETTING_WARN_PERCENT, String(warn));
    if (crit !== thresholds.crit) setSetting(SETTING_CRIT_PERCENT, String(crit));
  }

  function handleSubmit(draft: PoolDraft) {
    if (editing) updatePool(editing.id, draft);
    else createPool(draft);
    setEditing(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="border-b border-foreground/10 pb-2">
        <h2 className="font-heading text-xl font-semibold">{t("settings.title")}</h2>
      </div>

      <Card size="sm">
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

      <Card size="sm">
        <CardHeader>
          <CardTitle>{t("settings.thresholds")}</CardTitle>
          <CardDescription>{t("settings.thresholdsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="warn-percent">{t("settings.warnPercent")}</Label>
              <Input
                id="warn-percent"
                type="number"
                min={1}
                max={99}
                step={1}
                value={warnInput}
                onChange={(event) => {
                  const next = event.target.value;
                  setWarnInput(next);
                  commitThresholds(next, critInput);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="crit-percent">{t("settings.critPercent")}</Label>
              <Input
                id="crit-percent"
                type="number"
                min={2}
                max={100}
                step={1}
                value={critInput}
                onChange={(event) => {
                  const next = event.target.value;
                  setCritInput(next);
                  commitThresholds(warnInput, next);
                }}
              />
            </div>
          </div>
          {!thresholdsOk && (
            <p className="text-xs text-amber-400">{t("settings.thresholdsInvalid")}</p>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{t("settings.pools")}</CardTitle>
          <CardDescription>{t("settings.poolsHint")}</CardDescription>
          <CardAction>
            <Button
              size="sm"
              disabled={!ready}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus data-icon="inline-start" />
              {t("dashboard.addPool")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {pools.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("settings.noPools")}</p>
          ) : (
            <ul className="divide-y divide-foreground/10">
              {pools.map((pool) => (
                <li key={pool.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: pool.color }}
                      />
                      {pool.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatAmount(pool.quota_used, pool.unit)} / {formatAmount(pool.quota_total, pool.unit)}
                      {" · "}
                      {usagePercent(pool).toFixed(0)}%
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(pool);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil />
                      <span className="sr-only">{t("pool.edit")}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (window.confirm(t("form.confirmDelete"))) deletePool(pool.id);
                      }}
                    >
                      <Trash2 />
                      <span className="sr-only">{t("pool.delete")}</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
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
            {t("settings.version")}: {__APP_VERSION__}
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
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

      <PoolFormDialog
        open={formOpen}
        pool={editing}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
