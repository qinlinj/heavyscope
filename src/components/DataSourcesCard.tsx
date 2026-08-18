import { useEffect, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDatabase } from "@/hooks/useDatabase";
import { formatDateTime } from "@/lib/format";
import {
  parseSyncInterval,
  SETTING_CURSOR_SNAPSHOT,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
  SETTING_SYNC_LAST_AT,
  SETTING_SYNC_LAST_MESSAGE,
  SETTING_SYNC_LAST_STATUS,
  SETTING_SYNC_SOURCE,
} from "@/lib/settings";

export function DataSourcesCard() {
  const { t, i18n } = useTranslation();
  const { ready, settings, setSetting, applyImportedSnapshot, applyStoredSnapshot } = useDatabase();
  const storedSnapshot = settings[SETTING_CURSOR_SNAPSHOT] ?? "";
  const [draft, setDraft] = useState(storedSnapshot);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setDraft(storedSnapshot);
  }, [storedSnapshot]);

  const enabled = settings[SETTING_SYNC_ENABLED] === "true";
  const source = settings[SETTING_SYNC_SOURCE] === "cursor" ? "cursor" : "none";
  const interval = String(parseSyncInterval(settings[SETTING_SYNC_INTERVAL_MIN]));
  const lastAt = settings[SETTING_SYNC_LAST_AT];
  const lastStatus = settings[SETTING_SYNC_LAST_STATUS];
  const lastMessage = settings[SETTING_SYNC_LAST_MESSAGE];

  async function applyDraft() {
    setBusy(true);
    try {
      const report = await applyImportedSnapshot(draft);
      setFlash(report.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      const report = await applyStoredSnapshot();
      setFlash(report.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    setDraft(text);
  }

  const statusLabel =
    lastStatus === "ok"
      ? t("settings.syncStatusOk")
      : lastStatus === "skipped"
        ? t("settings.syncStatusSkipped")
        : lastStatus === "error"
          ? t("settings.syncStatusError")
          : t("settings.lastSyncNever");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("settings.dataSources")}</CardTitle>
        <CardDescription>{t("settings.dataSourcesHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="cursor-snapshot">{t("settings.snapshotLabel")}</Label>
          <textarea
            id="cursor-snapshot"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("settings.snapshotPlaceholder")}
            rows={8}
            className="min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!ready || busy || !draft.trim()} onClick={() => void applyDraft()}>
              {t("settings.snapshotApply")}
            </Button>
            <Button size="sm" variant="outline" disabled={!ready || busy} asChild>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json,.csv,.txt,application/json,text/csv"
                  className="sr-only"
                  onChange={(event) => void onFile(event)}
                />
                {t("settings.snapshotFile")}
              </label>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || busy || !storedSnapshot}
              onClick={() => void syncNow()}
            >
              {t("settings.syncNow")}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("settings.lastSync")}: {lastAt ? formatDateTime(lastAt, i18n.language) : t("settings.lastSyncNever")}
          {" · "}
          {statusLabel}
          {lastMessage ? ` — ${lastMessage}` : ""}
        </p>
        {flash && <p className="text-xs text-foreground/80">{flash}</p>}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!ready}
            onChange={(event) => setSetting(SETTING_SYNC_ENABLED, event.target.checked ? "true" : "false")}
            className="size-4 accent-primary"
          />
          {t("settings.syncEnabled")}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="sync-interval">{t("settings.syncInterval")}</Label>
            <Input
              id="sync-interval"
              type="number"
              min={1}
              max={1440}
              step={1}
              value={interval}
              disabled={!ready}
              onChange={(event) => {
                const next = parseSyncInterval(event.target.value);
                setSetting(SETTING_SYNC_INTERVAL_MIN, String(next));
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("settings.syncSource")}</Label>
            <Select
              value={source}
              onValueChange={(value) => setSetting(SETTING_SYNC_SOURCE, value)}
              disabled={!ready}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("settings.syncSourceNone")}</SelectItem>
                <SelectItem value="cursor">{t("settings.syncSourceCursor")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {enabled && source === "cursor" && !storedSnapshot && (
          <p className="text-xs text-amber-400">{t("settings.noSnapshot")}</p>
        )}

        <p className="text-xs text-muted-foreground">{t("settings.manualTruth")}</p>
        <p className="text-xs text-muted-foreground">{t("settings.grokReserved")}</p>
      </CardContent>
    </Card>
  );
}
