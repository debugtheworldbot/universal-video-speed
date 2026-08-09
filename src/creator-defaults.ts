import type { CreatorSite, CreatorSpeedRule } from "./settings";

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const BILIBILI_HOSTS = new Set(["bilibili.com", "www.bilibili.com", "m.bilibili.com"]);

export function creatorSiteForHostname(hostname: string): CreatorSite | null {
  const host = hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) return "youtube";
  if (BILIBILI_HOSTS.has(host)) return "bilibili";
  return null;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value, "https://www.youtube.com");
  } catch {
    return null;
  }
}

function youtubeIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const first = parts[0];
  if (!first) return null;
  if (first.startsWith("@")) return first.toLowerCase();
  if (first === "channel" && parts[1]) return parts[1];
  if ((first === "c" || first === "user") && parts[1]) return `${first}/${parts[1].toLowerCase()}`;
  return null;
}

export function normalizeCreatorInput(site: CreatorSite, input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (site === "bilibili") {
    if (/^\d+$/.test(value)) return value;
    const url = parseUrl(value);
    if (!url || url.hostname !== "space.bilibili.com") return null;
    return url.pathname.split("/").filter(Boolean)[0]?.match(/^\d+$/)?.[0] ?? null;
  }

  if (value.startsWith("@")) return /^@[a-zA-Z0-9._-]+$/.test(value) ? value.toLowerCase() : null;
  if (/^UC[a-zA-Z0-9_-]+$/.test(value)) return value;
  const url = parseUrl(value.startsWith("/") ? value : value.includes("://") ? value : `/${value}`);
  if (!url || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
  return youtubeIdFromPath(url.pathname);
}

export function detectCreatorIds(site: CreatorSite, root: ParentNode = document): string[] {
  const ids = new Set<string>();
  if (site === "youtube") {
    const selectors = [
      "ytd-watch-metadata ytd-video-owner-renderer a[href]",
      "#owner a[href]",
      'ytd-reel-player-overlay-renderer #channel-name a[href]'
    ];
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>(selectors.join(","))) {
      const id = normalizeCreatorInput("youtube", anchor.getAttribute("href") || anchor.href || "");
      if (id) ids.add(id);
    }
    const channelId = root.querySelector<HTMLMetaElement>('meta[itemprop="channelId"][content]')?.content;
    if (channelId) ids.add(channelId);
  } else {
    const selectors = [
      'a.up-name[href*="space.bilibili.com"]',
      '.up-info-container a[href*="space.bilibili.com"]',
      '.video-owner a[href*="space.bilibili.com"]',
      '[class*="up-info"] a[href*="space.bilibili.com"]'
    ];
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>(selectors.join(","))) {
      const id = normalizeCreatorInput("bilibili", anchor.getAttribute("href") || anchor.href || "");
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export function findCreatorRule(rules: CreatorSpeedRule[], site: CreatorSite, creatorIds: string[]): CreatorSpeedRule | null {
  for (const creatorId of creatorIds) {
    const rule = rules.find((candidate) => candidate.site === site && candidate.creatorId === creatorId);
    if (rule) return rule;
  }
  return null;
}

export function pageVideoKey(site: CreatorSite, url: URL = new URL(location.href)): string {
  if (site === "youtube") return url.searchParams.get("v") ?? url.pathname;
  return url.pathname.match(/\/video\/([^/?]+)/)?.[1] ?? url.pathname;
}
