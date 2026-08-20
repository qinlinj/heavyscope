import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
  parseGrokParsedProducts,
  parseSyncInterval,
  SETTING_CURSOR_CONNECTED,
  SETTING_CURSOR_LAST_SYNCED_AT,
  SETTING_CURSOR_SESSION_TOKEN,
  SETTING_CURSOR_SYNC_MESSAGE,
  SETTING_GROK_BEARER_TOKEN,
  SETTING_GROK_CONNECTED,
  SETTING_GROK_LAST_SYNCED_AT,
  SETTING_GROK_PARSED_PRODUCTS,
  SETTING_GROK_SESSION_TOKEN,
  SETTING_GROK_SYNC_MESSAGE,
  SETTING_SYNC_ENABLED,
  SETTING_SYNC_INTERVAL_MIN,
  SYNC_INTERVAL_OPTIONS,
} from "@/lib/settings";
import { writeTrayInterval, writeTraySyncEnabled } from "@/lib/traySettings";
import { runTrayRefresh } from "@/lib/trayView";

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

export function TraySettings() {
  const { t, i18n } = useTranslation();
  const {
    ready,
    settings,
    setSetting,
    connectCursor,
    disconnectCursor,
    connectGrok,
    disconnectGrok,
    refreshLiveProviders,
  } = useDatabase();
  const [cursorToken, setCursorToken] = useState("");
  const [grokCookie, setGrokCookie] = useState("");
  const [grokBearer, setGrokBearer] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [parsedOpen, setParsedOpen] = useState(false);

  const interval = String(parseSyncInterval(settings[SETTING_SYNC_INTERVAL_MIN]));
  const enabled = settings[SETTING_SYNC_ENABLED] === "true";
  const cursorHasToken = Boolean(settings[SETTING_CURSOR_SESSION_TOKEN]?.trim());
  const grokHasToken = Boolean(
    settings[SETTING_GROK_SESSION_TOKEN]?.trim() || settings[SETTING_GROK_BEARER_TOKEN]?.trim(),
  );
  const parsedProducts = parseGrokParsedProducts(settings[SETTING_GROK_PARSED_PRODUCTS]);
  const showMacHelper = isMacDesktop();

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

  async function handleRefresh() {
    setBusy(true);
    try {
      const report = await runTrayRefresh(refreshLiveProviders);
      setFlash(report.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-muted-foreground">{t("tray.settingsHint")}</p>

      <section className="space-y-2 rounded-lg border border-foreground/10 p-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-medium">{t("live.cursorTitle")}</h3>
          <p className="text-[10px] text-muted-foreground">
            {connectorLabel(settings[SETTING_CURSOR_CONNECTED], cursorHasToken, t)}
          </p>
        </div>
        <Input
          id="tray-cursor-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={cursorToken}
          placeholder={cursorHasToken ? t("live.tokenStored") : t("live.cursorTokenPlaceholder")}
          disabled={!ready || busy}
          onChange={(event) => setCursorToken(event.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <Button
            size="xs"
            disabled={!ready || busy || !cursorToken.trim()}
            onClick={() => void handleConnectCursor("api")}
          >
            {t("live.connect")}
          </Button>
          <Button size="xs" variant="outline" disabled={!ready || busy || !cursorHasToken} onClick={disconnectCursor}>
            {t("live.disconnect")}
          </Button>
          {showMacHelper ? (
            <Button size="xs" variant="outline" disabled={!ready || busy} onClick={() => void handleReadCursorApp()}>
              {t("live.cursorReadApp")}
            </Button>
          ) : null}
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          {t("live.lastSynced")}:{" "}
          {settings[SETTING_CURSOR_LAST_SYNCED_AT]
            ? formatDateTime(settings[SETTING_CURSOR_LAST_SYNCED_AT], i18n.language)
            : t("live.lastSyncedNever")}
          {settings[SETTING_CURSOR_SYNC_MESSAGE] ? ` — ${settings[SETTING_CURSOR_SYNC_MESSAGE]}` : ""}
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-foreground/10 p-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-medium">{t("live.grokTitle")}</h3>
          <p className="text-[10px] text-muted-foreground">
            {connectorLabel(settings[SETTING_GROK_CONNECTED], grokHasToken, t)}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tray-grok-cookie" className="text-[11px]">
            {t("live.grokCookie")}
          </Label>
          <Input
            id="tray-grok-cookie"
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
          <Label htmlFor="tray-grok-bearer" className="text-[11px]">
            {t("live.grokBearer")}
          </Label>
          <Input
            id="tray-grok-bearer"
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
        <div className="flex flex-wrap gap-1">
          <Button
            size="xs"
            disabled={!ready || busy || (!grokCookie.trim() && !grokBearer.trim())}
            onClick={() => void handleConnectGrok()}
          >
            {t("live.connect")}
          </Button>
          <Button size="xs" variant="outline" disabled={!ready || busy || !grokHasToken} onClick={disconnectGrok}>
            {t("live.disconnect")}
          </Button>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          {t("live.lastSynced")}:{" "}
          {settings[SETTING_GROK_LAST_SYNCED_AT]
            ? formatDateTime(settings[SETTING_GROK_LAST_SYNCED_AT], i18n.language)
            : t("live.lastSyncedNever")}
          {settings[SETTING_GROK_SYNC_MESSAGE] ? ` — ${settings[SETTING_GROK_SYNC_MESSAGE]}` : ""}
        </p>
        {parsedProducts.length > 0 ? (
          <div>
            <button
              type="button"
              className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setParsedOpen((current) => !current)}
            >
              {t("tray.grokParsedToggle")}
            </button>
            {parsedOpen ? (
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                {parsedProducts
                  .map((item) => `${item.name || t("live.unnamedProduct")} ${item.percent.toFixed(1)}%`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-2 rounded-lg border border-foreground/10 p-2">
        <div className="grid gap-1.5">
          <Label className="text-[11px]">{t("settings.syncInterval")}</Label>
          <Select
            value={interval}
            onValueChange={(value) => writeTrayInterval(setSetting, value)}
            disabled={!ready}
          >
            <SelectTrigger className="h-7 w-full text-xs">
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
        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!ready}
            onChange={(event) => writeTraySyncEnabled(setSetting, event.target.checked)}
            className="size-3.5 accent-primary"
          />
          {t("settings.syncEnabled")}
        </label>
        <Button
          size="xs"
          variant="outline"
          disabled={!ready || busy || (!cursorHasToken && !grokHasToken)}
          onClick={() => void handleRefresh()}
        >
          {t("live.refreshNow")}
        </Button>
      </section>

      {flash ? <p className="text-[10px] text-foreground/80">{flash}</p> : null}

      <p className="text-[10px] leading-snug text-muted-foreground">{t("tray.moreOnWeb")}</p>
    </div>
  );
}
