import { creatorSiteForHostname, findCreatorRule, isVideoPage } from "./creator-defaults";
import { normalizeUrlPrefix, type Settings } from "./settings";

export interface AutoSpeedMatch {
  rate: number;
  priority: number;
  signature: string;
}

export function findUrlRule(settings: Settings, url: URL): AutoSpeedMatch | null {
  const href = url.href;
  const match = settings.urlRules
    .filter((rule) => href.startsWith(rule.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? { rate: match.rate, priority: 1, signature: `url:${match.prefix}:${match.rate}` } : null;
}

export function findAutoSpeed(settings: Settings, url: URL, creatorIds: string[]): AutoSpeedMatch | null {
  const site = creatorSiteForHostname(url.hostname);
  if (site && isVideoPage(site, url)) {
    const creatorRule = findCreatorRule(settings.creatorRules, site, creatorIds);
    if (creatorRule) {
      return {
        rate: creatorRule.rate,
        priority: 2,
        signature: `creator:${site}:${creatorRule.creatorId}:${creatorRule.rate}`
      };
    }
  }

  const urlRule = findUrlRule(settings, url);
  if (urlRule) return urlRule;

  const fallbackRate = site ? settings.fallbackRates[site] : undefined;
  return fallbackRate === undefined
    ? null
    : { rate: fallbackRate, priority: 0, signature: `fallback:${site}:${fallbackRate}` };
}

export function normalizedUrlRule(prefix: string, rate: number): { prefix: string; rate: number } | null {
  const normalized = normalizeUrlPrefix(prefix);
  return normalized ? { prefix: normalized, rate } : null;
}
