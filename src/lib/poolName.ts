import type { Pool } from "@/db/schema";

export const PRESET_POOL_IDS = [
  "preset-grok-heavy",
  "preset-grok-bot",
  "preset-cursor-models",
  "preset-cursor-other",
] as const;

export type PresetPoolId = (typeof PRESET_POOL_IDS)[number];

const PRESET_NAME_KEYS: Record<PresetPoolId, string> = {
  "preset-grok-heavy": "presets.preset-grok-heavy",
  "preset-grok-bot": "presets.preset-grok-bot",
  "preset-cursor-models": "presets.preset-cursor-models",
  "preset-cursor-other": "presets.preset-cursor-other",
};

export function isPresetPoolId(id: string): id is PresetPoolId {
  return (PRESET_POOL_IDS as readonly string[]).includes(id);
}

/** Localized label for a known preset. Custom pools keep `pool.name`. */
export function displayPoolName(
  pool: Pick<Pool, "id" | "name">,
  t: (key: string) => string,
): string {
  if (!isPresetPoolId(pool.id)) return pool.name;
  return t(PRESET_NAME_KEYS[pool.id]);
}
