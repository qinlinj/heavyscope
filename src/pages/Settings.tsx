import { Copy, Download, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataSourcesCard } from "@/components/DataSourcesCard";
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
import {
  BACKUP_FILENAME,
  parseBackup,
  type BackupMode,
} from "@/lib/backup";
import { isDemoSeeded } from "@/lib/demoSeed";
import { formatAmount, usagePercent } from "@/lib/format";
import { displayPoolName } from "@/lib/poolName";
import {
  isValidThresholds,
  SETTING_CRIT_PERCENT,
  SETTING_WARN_PERCENT,
} from "@/lib/settings";
import { APP_VERSION } from "@/lib/version";

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

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
    exportLocalBackup,
    importLocalBackup,
    applyDemoSeed,
    settings,
  } = useDatabase();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pool | null>(null);
  const [warnInput, setWarnInput] = useState(String(thresholds.warn));
  const [critInput, setCritInput] = useState(String(thresholds.crit));
  const [backupDraft, setBackupDraft] = useState("");
  const [backupMode, setBackupMode] = useState<BackupMode>("merge");
  const [backupFlash, setBackupFlash] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const [demoFlash, setDemoFlash] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Pool | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

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

  function handleExport() {
    const json = exportLocalBackup();
    if (!json) return;
    downloadText(BACKUP_FILENAME, json);
  }

  async function handleCopy() {
    const json = exportLocalBackup();
    if (!json) {
      setCopyFlash(t("settings.backupCopyFailed"));
      return;
    }
    try {
      await navigator.clipboard.writeText(json);
      setCopyFlash(t("settings.backupCopied"));
    } catch {
      setCopyFlash(t("settings.backupCopyFailed"));
    }
  }

  function runDemoSeed(force: boolean) {
    const report = applyDemoSeed(force);
    if (report.skipped) {
      setDemoFlash(t("settings.demoSkipped"));
      return;
    }
    setDemoFlash(t("settings.demoApplied", { count: report.inserted }));
  }

  function handleDemoSeed() {
    if (isDemoSeeded(settings)) {
      setDemoOpen(true);
      return;
    }
    runDemoSeed(false);
  }

  async function onBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    setBackupDraft(text);
    setBackupFlash(null);
  }

  function applyImportedBackup() {
    const parsed = parseBackup(backupDraft);
    if (!parsed.ok) {
      setBackupFlash(t("settings.backupInvalid"));
      return;
    }
    const report = importLocalBackup(parsed.backup, backupMode);
    setBackupFlash(
      t("settings.backupApplied", {
        pools: report.poolsUpserted,
        inserted: report.recordsInserted,
        skipped: report.recordsSkipped,
      }),
    );
  }

  function handleImport() {
    if (!backupDraft.trim()) {
      setBackupFlash(t("settings.backupEmpty"));
      return;
    }
    const parsed = parseBackup(backupDraft);
    if (!parsed.ok) {
      setBackupFlash(t("settings.backupInvalid"));
      return;
    }
    setBackupOpen(true);
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

      <DataSourcesCard />

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
                      {displayPoolName(pool, t)}
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
                      onClick={() => setPendingDelete(pool)}
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
            {t("settings.version")}: {APP_VERSION}
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{t("settings.data")}</CardTitle>
          <CardDescription>{t("settings.dataHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("settings.demoHint")}</p>
            <Button size="sm" disabled={!ready} onClick={handleDemoSeed}>
              <Sparkles data-icon="inline-start" />
              {t("settings.demoLoad")}
            </Button>
            {demoFlash && <p className="text-xs text-foreground/80">{demoFlash}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("settings.backupExportHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!ready} onClick={handleExport}>
                <Download data-icon="inline-start" />
                {t("settings.backupExport")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!ready}
                onClick={() => void handleCopy()}
              >
                <Copy data-icon="inline-start" />
                {t("settings.backupCopy")}
              </Button>
            </div>
            {copyFlash && <p className="text-xs text-foreground/80">{copyFlash}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="backup-json">{t("settings.backupImport")}</Label>
            <p className="text-sm text-muted-foreground">{t("settings.backupImportHint")}</p>
            <textarea
              id="backup-json"
              value={backupDraft}
              onChange={(event) => {
                setBackupDraft(event.target.value);
                setBackupFlash(null);
              }}
              placeholder={t("settings.backupPlaceholder")}
              rows={8}
              className="min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!ready} asChild>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(event) => void onBackupFile(event)}
                  />
                  {t("settings.backupFile")}
                </label>
              </Button>
              <Button
                size="sm"
                disabled={!ready || !backupDraft.trim()}
                onClick={handleImport}
              >
                {t("settings.backupApply")}
              </Button>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="sr-only">{t("settings.backupImport")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="backup-mode"
                  value="merge"
                  checked={backupMode === "merge"}
                  onChange={() => setBackupMode("merge")}
                  className="size-4 accent-primary"
                />
                {t("settings.backupModeMerge")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="backup-mode"
                  value="replace"
                  checked={backupMode === "replace"}
                  onChange={() => setBackupMode("replace")}
                  className="size-4 accent-primary"
                />
                {t("settings.backupModeReplace")}
              </label>
            </fieldset>
            {backupFlash && <p className="text-xs text-foreground/80">{backupFlash}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("settings.resetDataHint")}</p>
            <Button
              variant="destructive"
              disabled={!ready}
              onClick={() => setResetOpen(true)}
            >
              {t("settings.resetData")}
            </Button>
          </div>
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
      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("form.deleteTitle")}
        description={t("form.confirmDelete")}
        confirmLabel={t("pool.delete")}
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) deletePool(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        title={t("settings.resetTitle")}
        description={t("settings.resetDataHint")}
        confirmLabel={t("settings.resetData")}
        destructive
        onOpenChange={setResetOpen}
        onConfirm={resetLocalData}
      />
      <ConfirmDialog
        open={demoOpen}
        title={t("settings.demoTitle")}
        description={t("settings.demoConfirmAgain")}
        confirmLabel={t("settings.demoLoad")}
        onOpenChange={setDemoOpen}
        onConfirm={() => runDemoSeed(true)}
      />
      <ConfirmDialog
        open={backupOpen}
        title={t("settings.backupTitle")}
        description={t("settings.backupConfirm")}
        confirmLabel={t("settings.backupApply")}
        onOpenChange={setBackupOpen}
        onConfirm={() => {
          if (backupMode === "replace") {
            setReplaceOpen(true);
            return;
          }
          applyImportedBackup();
        }}
      />
      <ConfirmDialog
        open={replaceOpen}
        title={t("settings.backupReplaceTitle")}
        description={t("settings.backupConfirmReplace")}
        confirmLabel={t("common.confirm")}
        destructive
        onOpenChange={setReplaceOpen}
        onConfirm={applyImportedBackup}
      />
    </div>
  );
}
