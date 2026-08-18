import { SETTING_CURSOR_SNAPSHOT } from "@/lib/settings";
import type { AdapterContext, AdapterResult, AdapterUsageDraft, PoolHint, UsageAdapter } from "./types";

export type CursorSnapshotPool = {
  hint: string;
  used: number;
  total?: number;
  note?: string;
};

export type CursorSnapshot = {
  source: "cursor";
  fetchedAt: string;
  pools: CursorSnapshotPool[];
};

const HINT_ALIASES: Record<string, PoolHint> = {
  grok_heavy: "grok_heavy",
  "grok-heavy": "grok_heavy",
  heavy: "grok_heavy",
  "preset-grok-heavy": "grok_heavy",
  grok_bot: "grok_bot",
  "grok-bot": "grok_bot",
  bot: "grok_bot",
  "preset-grok-bot": "grok_bot",
  cursor_models: "cursor_models",
  "cursor-models": "cursor_models",
  models: "cursor_models",
  "preset-cursor-models": "cursor_models",
  cursor_other: "cursor_other",
  "cursor-other": "cursor_other",
  other: "cursor_other",
  other_models: "cursor_other",
  "other-models": "cursor_other",
  "preset-cursor-other": "cursor_other",
};

export function normalizeHint(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (HINT_ALIASES[lower]) return HINT_ALIASES[lower];
  if (lower.startsWith("custom:")) return `custom:${trimmed.slice("custom:".length).trim()}`;
  if (lower.startsWith("preset-")) return trimmed;
  return `custom:${trimmed}`;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseCsvSnapshot(raw: string): CursorSnapshot | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length < 2) return null;
  const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const poolIdx = header.indexOf("pool");
  const amountIdx = header.indexOf("amount");
  const noteIdx = header.indexOf("note");
  if (poolIdx < 0 || amountIdx < 0) return null;
  const pools: CursorSnapshotPool[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const hint = normalizeHint(cols[poolIdx] ?? "");
    const used = Number(cols[amountIdx]);
    if (!hint || !Number.isFinite(used) || used < 0) continue;
    const note = noteIdx >= 0 ? (cols[noteIdx] || undefined) : undefined;
    pools.push({ hint, used, note });
  }
  if (pools.length === 0) return null;
  return { source: "cursor", fetchedAt: new Date().toISOString(), pools };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonSnapshot(raw: string): CursorSnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.pools)) return null;
  if (parsed.source != null && parsed.source !== "cursor") return null;
  const fetchedAt =
    typeof parsed.fetchedAt === "string" && parsed.fetchedAt.trim()
      ? parsed.fetchedAt
      : new Date().toISOString();
  const pools: CursorSnapshotPool[] = [];
  for (const item of parsed.pools) {
    if (!isRecord(item)) continue;
    const hintRaw = typeof item.hint === "string" ? item.hint : typeof item.pool === "string" ? item.pool : "";
    const hint = normalizeHint(hintRaw);
    const used = Number(item.used ?? item.amount);
    if (!hint || !Number.isFinite(used) || used < 0) continue;
    const total = item.total == null ? undefined : Number(item.total);
    const note = typeof item.note === "string" ? item.note : undefined;
    pools.push({
      hint,
      used,
      total: total != null && Number.isFinite(total) && total > 0 ? total : undefined,
      note,
    });
  }
  if (pools.length === 0) return null;
  return { source: "cursor", fetchedAt, pools };
}

export function parseCursorInput(raw: string): { ok: boolean; snapshot: CursorSnapshot | null; message?: string } {
  const text = raw.trim();
  if (!text) {
    return { ok: false, snapshot: null, message: "No Cursor snapshot imported" };
  }
  const snapshot = text.startsWith("{") || text.startsWith("[")
    ? parseJsonSnapshot(text) ?? parseCsvSnapshot(text)
    : parseCsvSnapshot(text) ?? parseJsonSnapshot(text);
  if (!snapshot) {
    return {
      ok: false,
      snapshot: null,
      message: "Could not parse snapshot. Expected Cursor JSON or CSV (pool,amount,note).",
    };
  }
  return { ok: true, snapshot };
}

function snapshotToResult(snapshot: CursorSnapshot): AdapterResult {
  const records: AdapterUsageDraft[] = [];
  const totals: Record<string, number> = {};
  for (const pool of snapshot.pools) {
    records.push({
      poolHint: pool.hint,
      amount: pool.used,
      recordedAt: snapshot.fetchedAt,
      note: pool.note ?? "Cursor snapshot",
    });
    if (pool.total != null) totals[pool.hint] = pool.total;
  }
  return {
    ok: true,
    records,
    totals: Object.keys(totals).length > 0 ? totals : undefined,
    message: "Cursor snapshot parsed",
  };
}

/*
 * TODO(Tauri): optional read-only hook for a user-exported Cursor usage
 * snapshot already on disk (file picker). Do NOT scrape Cursor credentials,
 * cookies, session tokens, local DBs, or private APIs.
 *
 * async function readCursorLocalSnapshot(_ctx: AdapterContext): Promise<string | null> {
 *   // Example (not implemented): invoke a Tauri command that opens a
 *   // user-selected export file via the OS file picker.
 *   return null;
 * }
 */

export const cursorAdapter: UsageAdapter = {
  id: "cursor",
  labelKey: "adapters.cursor",
  async pull(ctx: AdapterContext): Promise<AdapterResult> {
    const raw = ctx.snapshot ?? ctx.settings?.[SETTING_CURSOR_SNAPSHOT] ?? "";
    const parsed = parseCursorInput(raw);
    if (!parsed.ok || !parsed.snapshot) {
      return {
        ok: false,
        records: [],
        message: parsed.message ?? "No Cursor snapshot imported",
      };
    }
    return snapshotToResult(parsed.snapshot);
  },
};
