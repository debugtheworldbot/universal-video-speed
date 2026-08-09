export type ShortcutMapping = Record<string, number>;

export interface Settings {
  shortcuts: ShortcutMapping;
  disabledHosts: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  shortcuts: {
    "1": 1,
    "5": 1.5,
    "2": 2,
    "3": 3
  },
  disabledHosts: []
};

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const candidate = value as Partial<Settings>;
  const shortcuts = Object.fromEntries(
    Object.entries(candidate.shortcuts ?? {}).filter(
      ([key, rate]) => /^\d$/.test(key) && typeof rate === "number" && rate >= 0.25 && rate <= 16
    )
  );
  const disabledHosts = Array.isArray(candidate.disabledHosts)
    ? candidate.disabledHosts.filter((host): host is string => typeof host === "string")
    : [];

  return {
    shortcuts: Object.keys(shortcuts).length ? shortcuts : DEFAULT_SETTINGS.shortcuts,
    disabledHosts
  };
}

export function isHostDisabled(hostname: string, disabledHosts: string[]): boolean {
  return disabledHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
