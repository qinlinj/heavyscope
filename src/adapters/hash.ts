/** Stable signature + hash for idempotent snapshot apply. */

import type { AdapterResult } from "./types";

export function adapterSignature(result: AdapterResult): string {
  const rows = result.records
    .map((record) => ({
      h: record.poolHint,
      a: Number(record.amount),
      t: result.totals?.[record.poolHint] ?? null,
    }))
    .sort((left, right) => left.h.localeCompare(right.h));
  return JSON.stringify(rows);
}

export async function hashSignature(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return `djb2-${(hash >>> 0).toString(16)}`;
}
