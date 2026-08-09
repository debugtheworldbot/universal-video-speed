import { normalizeCreatorInput } from "./creator-defaults";
import type { CreatorSite } from "./settings";

export interface CreatorMetadata {
  creatorId: string;
  creatorName: string;
}

export function parseYouTubeCreatorPage(html: string): CreatorMetadata | null {
  const document = new DOMParser().parseFromString(html, "text/html");
  const creatorId = document.querySelector<HTMLMetaElement>('meta[itemprop="channelId"]')?.content
    ?? html.match(/["']externalId["']\s*:\s*["'](UC[a-zA-Z0-9_-]+)["']/)?.[1]
    ?? html.match(/["']channelId["']\s*:\s*["'](UC[a-zA-Z0-9_-]+)["']/)?.[1];
  const creatorName = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content;
  if (!creatorId || !creatorName) return null;
  return { creatorId, creatorName: creatorName.trim() };
}

export function parseBilibiliCreatorResponse(value: unknown): CreatorMetadata | null {
  if (!value || typeof value !== "object") return null;
  const response = value as { code?: unknown; data?: { mid?: unknown; name?: unknown } };
  if (response.code !== 0 || !response.data || typeof response.data.name !== "string") return null;
  const creatorId = String(response.data.mid ?? "");
  if (!/^\d+$/.test(creatorId) || !response.data.name.trim()) return null;
  return { creatorId, creatorName: response.data.name.trim() };
}

export async function resolveCreatorMetadata(
  site: CreatorSite,
  creator: string,
  fetcher: typeof fetch = fetch
): Promise<CreatorMetadata | null> {
  const normalized = normalizeCreatorInput(site, creator);
  if (!normalized) return null;

  if (site === "bilibili") {
    const response = await fetcher(`https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(normalized)}`, {
      credentials: "omit"
    });
    if (!response.ok) return null;
    return parseBilibiliCreatorResponse(await response.json());
  }

  const path = normalized.startsWith("UC") ? `/channel/${normalized}` : `/${normalized}`;
  const response = await fetcher(`https://www.youtube.com${path}`, { credentials: "omit" });
  if (!response.ok) return null;
  return parseYouTubeCreatorPage(await response.text());
}
