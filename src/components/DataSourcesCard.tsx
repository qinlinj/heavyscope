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
import { isMacDesktop, readCursorSessionTokenFromApp } from "@/lib/desktop";
import { formatDateTime } from "@/lib/format";
import {
  nextSyncAt,
  parseGrokParsedProducts,
  parseSyncInterval,
  parseSyncSource,
  syncSourceHas,
  SETTING_CURSOR_CONNECTED,
  SETTING_CURSOR_LAST_SYNCED_AT,
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_CURSOR_SNAPSHOT,
  SETTING_CURSOR_SYNC_MESSAGE,
  SETTING_CURSOR_SYNC_SOURCE,
  SETTING_GROK_BEARER_TOKEN,
  SETTING_GROK_BOT_LIVE,
  SETTING_GROK_CONNECTED,
  SETTING_GROK_PARSED_PRODUCTS,
  SETTING_GROK_LAST_SYNCED_AT,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_GROK_SYNC_MESSAGE,
  SETTING_GROK_SYNC_SOURCE,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
  SETTING_SYNC_LAST_AT,
  SETTING_SYNC_LAST_MESSAGE,
  SETTING_SYNC_LAST_STATUS,
  SETTING_SYNC_SOURCE,
  SYNC_INTERVAL_OPTIONS,
} from "@/lib/settings";

function connectorLabel(
  connected: string | undefined,
  hasToken: boolean,
  t: (key: string) => string,
): string {
  if (!hasToken) return t("live.notConnected");
  if (connected === "expired") return t("live.expired");
  if (connected === "true") return t("live.connected");
  return t("live.notConnected");
}

export function DataSourcesCard() {
  const { t, i18n } = useTranslation();
  const {
    ready,
    settings,
    setSetting,
    applyImportedSnapshot,
    applyStoredSnapshot,
    refreshLiveProviders,
    connectCursor,
    disconnectCursor,
    connectGrok,
    disconnectGrok,
  } = useDatabase();
  const storedSnapshot = settings[SETTING_CURSOR_SNAPSHOT] ?? "";
  const [draft, setDraft] = useState(storedSnapshot);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [cursorToken, setCursorToken] = useState("");
  const [grokCookie, setGrokCookie] = useState("");
  const [grokBearer, setGrokBearer] = useState("");

  useEffect(() => {
    setDraft(storedSnapshot);
  }, [storedSnapshot]);

  const enabled = settings[SETTING_SYNC_ENABLED] === "true";
  const source = parseSyncSource(settings[SETTING_SYNC_SOURCE]);
  const interval = String(parseSyncInterval(settings[SETTING_SYNC_INTERVAL_MIN]));
  const lastAt = settings[SETTING_SYNC_LAST_AT];
  const lastStatus = settings[SETTING_SYNC_LAST_STATUS];
  const lastMessage = settings[SETTING_SYNC_LAST_MESSAGE];

  const cursorHasToken = Boolean(settings[SETTING_CURSOR_SESSION_TOKEN]?.trim());
  const grokHasToken = Boolean(
    settings[SETTING_GROK_SESSION_TOKEN]?.trim() || settings[SETTING_GROK_BEARER_TOKEN]?.trim(),
  );
  const showMacHelper = isMacDesktop();

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

  async function handleConnectCursor(sourceHint: "api" | "session" = "api") {
    setBusy(true);
    try {
      const report = await connectCursor(cursorToken, sourceHint);
      setFlash(report.message);
      if (!report.skipped) setCursorToken("");
    } finally {
      setBusy(false);
    }
  }

  async function handleReadCursorApp() {
    setBusy(true);
    try {
      const token = await readCursorSessionTokenFromApp();
      if (!token) {
        setFlash(t("live.cursorVscdbFailed"));
        return;
      }
      setCursorToken(token);
      const report = await connectCursor(token, "session");
      setFlash(report.message);
      if (!report.skipped) setCursorToken("");
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectGrok() {
    setBusy(true);
    try {
      const report = await connectGrok(grokCookie, grokBearer);
      setFlash(report.message);
      if (!report.skipped) {
        setGrokCookie("");
        setGrokBearer("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLiveRefresh(provider?: "cursor" | "grok") {
    setBusy(true);
    try {
      const report = await refreshLiveProviders(provider ? [provider] : undefined);
      setFlash(report.message);
    } finally {
      setBusy(false);
    }
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
      <CardContent className="space-y-6">
        <section className="space-y-3 rounded-lg border border-foreground/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">{t("live.cursorTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("live.cursorHint")}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {connectorLabel(settings[SETTING_CURSOR_CONNECTED], cursorHasToken, t)}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cursor-session-token">{t("live.cursorToken")}</Label>
            <Input
              id="cursor-session-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={cursorToken}
              placeholder={cursorHasToken ? t("live.tokenStored") : t("live.cursorTokenPlaceholder")}
              disabled={!ready || busy}
              onChange={(event) => setCursorToken(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!ready || busy || !cursorToken.trim()}
              onClick={() => void handleConnectCursor("api")}
            >
              {t("live.connect")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || busy || !cursorHasToken}
              onClick={disconnectCursor}
            >
              {t("live.disconnect")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || busy || !cursorHasToken}
              onClick={() => void handleLiveRefresh("cursor")}
            >
              {t("live.refreshNow")}
            </Button>
            {showMacHelper && (
              <Button
                size="sm"
                variant="outline"
                disabled={!ready || busy}
                onClick={() => void handleReadCursorApp()}
              >
                {t("live.cursorReadApp")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("live.lastSynced")}:{" "}
            {settings[SETTING_CURSOR_LAST_SYNCED_AT]
              ? formatDateTime(settings[SETTING_CURSOR_LAST_SYNCED_AT], i18n.language)
              : t("live.lastSyncedNever")}
            {cursorHasToken
              ? ` · ${t("live.nextSync")}: ${formatDateTime(nextSyncAt(settings[SETTING_CURSOR_LAST_SYNCED_AT], Number(interval)) ?? new Date().toISOString(), i18n.language)}`
              : ""}
            {settings[SETTING_CURSOR_SYNC_SOURCE]
              ? ` · ${t(`live.badge.${settings[SETTING_CURSOR_SYNC_SOURCE]}`)}`
              : ""}
            {settings[SETTING_CURSOR_SYNC_MESSAGE] ? ` — ${settings[SETTING_CURSOR_SYNC_MESSAGE]}` : ""}
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-foreground/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">{t("live.grokTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("live.grokHint")}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {connectorLabel(settings[SETTING_GROK_CONNECTED], grokHasToken, t)}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grok-session-token">{t("live.grokCookie")}</Label>
            <Input
              id="grok-session-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={grokCookie}
              placeholder={
                settings[SETTING_GROK_SESSION_TOKEN]?.trim()
                  ? t("live.tokenStored")
                  : t("live.grokCookiePlaceholder")
              }
              disabled={!ready || busy}
              onChange={(event) => setGrokCookie(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grok-bearer-token">{t("live.grokBearer")}</Label>
            <Input
              id="grok-bearer-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={grokBearer}
              placeholder={
                settings[SETTING_GROK_BEARER_TOKEN]?.trim()
                  ? t("live.tokenStored")
                  : t("live.grokBearerPlaceholder")
              }
              disabled={!ready || busy}
              onChange={(event) => setGrokBearer(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!ready || busy || (!grokCookie.trim() && !grokBearer.trim())}
              onClick={() => void handleConnectGrok()}
            >
              {t("live.connect")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || busy || !grokHasToken}
              onClick={disconnectGrok}
            >
              {t("live.disconnect")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || busy || !grokHasToken}
              onClick={() => void handleLiveRefresh("grok")}
            >
              {t("live.refreshNow")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("live.lastSynced")}:{" "}
            {settings[SETTING_GROK_LAST_SYNCED_AT]
              ? formatDateTime(settings[SETTING_GROK_LAST_SYNCED_AT], i18n.language)
              : t("live.lastSyncedNever")}
            {grokHasToken
              ? ` · ${t("live.nextSync")}: ${formatDateTime(nextSyncAt(settings[SETTING_GROK_LAST_SYNCED_AT], Number(interval)) ?? new Date().toISOString(), i18n.language)}`
              : ""}
            {settings[SETTING_GROK_SYNC_SOURCE]
              ? ` · ${t(`live.badge.${settings[SETTING_GROK_SYNC_SOURCE]}`)}`
              : ""}
            {settings[SETTING_GROK_SYNC_MESSAGE] ? ` — ${settings[SETTING_GROK_SYNC_MESSAGE]}` : ""}
          </p>
          {settings[SETTING_GROK_BOT_LIVE] === "unavailable" && (
            <p className="text-xs text-amber-400">{t("live.grokBotUnavailable")}</p>
          )}
          {parseGrokParsedProducts(settings[SETTING_GROK_PARSED_PRODUCTS]).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("live.grokParsed")}:{" "}
              {parseGrokParsedProducts(settings[SETTING_GROK_PARSED_PRODUCTS])
                .map((item) => `${item.name || t("live.unnamedProduct")} ${item.percent.toFixed(1)}%`)
                .join(" · ")}
            </p>
          )}
        </section>

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
            <Label>{t("settings.syncInterval")}</Label>
            <Select
              value={interval}
              onValueChange={(value) => setSetting(SETTING_SYNC_INTERVAL_MIN, String(parseSyncInterval(value)))}
              disabled={!ready}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVAL_OPTIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {t("live.intervalMinutes", { count: minutes })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <SelectItem value="grok">{t("settings.syncSourceGrok")}</SelectItem>
                <SelectItem value="both">{t("settings.syncSourceBoth")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {enabled &&
          syncSourceHas(source, "cursor") &&
          !cursorHasToken &&
          !storedSnapshot && (
          <p className="text-xs text-amber-400">{t("settings.noSnapshot")}</p>
        )}

        <p className="text-xs text-muted-foreground">{t("settings.manualTruth")}</p>
      </CardContent>
    </Card>
  );
}
