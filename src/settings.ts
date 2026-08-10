export type ShortcutMapping = Record<string, number>;
export type CreatorSite = "youtube" | "bilibili";

export interface CreatorSpeedRule {
  site: CreatorSite;
  creatorId: string;
  creatorName?: string;
  rate: number;
}

export type SiteFallbackRates = Partial<Record<CreatorSite, number>>;

export interface UrlSpeedRule {
  prefix: string;
  rate: number;
}

export interface Settings {
  shortcuts: ShortcutMapping;
  disabledHosts: string[];
  creatorRules: CreatorSpeedRule[];
  fallbackRates: SiteFallbackRates;
  urlRules: UrlSpeedRule[];
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
  creatorRules: [],
  fallbackRates: {},
  urlRules: []
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
      (rule.creatorName === undefined || typeof rule.creatorName === "string") &&
      typeof rule.rate === "number" &&
      rule.rate >= 0.25 &&
      rule.rate <= 16
    ))
    : [];
  const fallbackCandidate = candidate.fallbackRates && typeof candidate.fallbackRates === "object"
    ? candidate.fallbackRates
    : {};
  const fallbackRates: SiteFallbackRates = {};
  for (const site of ["youtube", "bilibili"] as const) {
    const rate = fallbackCandidate[site];
    if (typeof rate === "number" && rate >= 0.25 && rate <= 16) fallbackRates[site] = rate;
  }
  const urlRules = Array.isArray(candidate.urlRules)
    ? candidate.urlRules.filter((rule): rule is UrlSpeedRule => Boolean(
      rule &&
      typeof rule === "object" &&
      typeof rule.prefix === "string" &&
      normalizeUrlPrefix(rule.prefix) === rule.prefix &&
      typeof rule.rate === "number" &&
      rule.rate >= 0.25 &&
      rule.rate <= 16
    ))
    : [];

  return {
    shortcuts: Object.keys(shortcuts).length ? shortcuts : DEFAULT_SETTINGS.shortcuts,
    disabledHosts,
    creatorRules,
    fallbackRates,
    urlRules
  };
}

export function normalizeUrlPrefix(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function isHostDisabled(hostname: string, disabledHosts: string[]): boolean {
  return disabledHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
