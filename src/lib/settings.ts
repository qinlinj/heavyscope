export const SETTING_LANGUAGE = "language";
export const SETTING_WARN_PERCENT = "warn_percent";
export const SETTING_CRIT_PERCENT = "crit_percent";

export const DEFAULT_LANGUAGE = "zh-CN";
export const DEFAULT_WARN_PERCENT = 70;
export const DEFAULT_CRIT_PERCENT = 90;

export type AlertThresholds = {
  warn: number;
  crit: number;
};

export function isValidThresholds(warn: number, crit: number): boolean {
  return Number.isFinite(warn) && Number.isFinite(crit) && warn >= 1 && warn < crit && crit <= 100;
}

export function parseThresholds(settings: Record<string, string>): AlertThresholds {
  const warn = Number(settings[SETTING_WARN_PERCENT] ?? DEFAULT_WARN_PERCENT);
  const crit = Number(settings[SETTING_CRIT_PERCENT] ?? DEFAULT_CRIT_PERCENT);
  if (isValidThresholds(warn, crit)) return { warn, crit };
  return { warn: DEFAULT_WARN_PERCENT, crit: DEFAULT_CRIT_PERCENT };
}
