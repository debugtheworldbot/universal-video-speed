export type ShortcutMapping = Record<string, number>;
export type CreatorSite = "youtube" | "bilibili";

export interface CreatorSpeedRule {
  site: CreatorSite;
  creatorId: string;
  rate: number;
}

export interface Settings {
  shortcuts: ShortcutMapping;
  disabledHosts: string[];
  creatorRules: CreatorSpeedRule[];
}

export const DEFAULT_SETTINGS: Settings = {
  shortcuts: {
    "1": 1,
    "5": 1.5,
    "7": 1.75,
    "2": 2,
    "3": 3
  },
  disabledHosts: [],
  creatorRules: []
};

const UNSUPPORTED_SHORTCUT_KEYS = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift", "Dead", "Process", "Unidentified"]);

export function isSupportedShortcutKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= 32 && !UNSUPPORTED_SHORTCUT_KEYS.has(key);
}

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const candidate = value as Partial<Settings>;
  const shortcuts = Object.fromEntries(
    Object.entries(candidate.shortcuts ?? {}).filter(
      ([key, rate]) => isSupportedShortcutKey(key) && typeof rate === "number" && rate >= 0.25 && rate <= 16
    )
  );
  const disabledHosts = Array.isArray(candidate.disabledHosts)
    ? candidate.disabledHosts.filter((host): host is string => typeof host === "string")
    : [];
  const creatorRules = Array.isArray(candidate.creatorRules)
    ? candidate.creatorRules.filter((rule): rule is CreatorSpeedRule => Boolean(
      rule &&
      typeof rule === "object" &&
      (rule.site === "youtube" || rule.site === "bilibili") &&
      typeof rule.creatorId === "string" &&
      rule.creatorId.length > 0 &&
      typeof rule.rate === "number" &&
      rule.rate >= 0.25 &&
      rule.rate <= 16
    ))
    : [];

  return {
    shortcuts: Object.keys(shortcuts).length ? shortcuts : DEFAULT_SETTINGS.shortcuts,
    disabledHosts,
    creatorRules
  };
}

export function isHostDisabled(hostname: string, disabledHosts: string[]): boolean {
  return disabledHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
