export const PLAYBACK_BADGE_MESSAGE = "playback-badge-state";

export interface PlaybackBadgeMessage {
  type: typeof PLAYBACK_BADGE_MESSAGE;
  playing: boolean;
  rate?: number;
  reset?: boolean;
}

export function isPlaybackBadgeMessage(message: unknown): message is PlaybackBadgeMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<PlaybackBadgeMessage>;
  if (candidate.type !== PLAYBACK_BADGE_MESSAGE || typeof candidate.playing !== "boolean") return false;
  return !candidate.playing || (typeof candidate.rate === "number" && Number.isFinite(candidate.rate) && candidate.rate > 0);
}

export function formatPlaybackBadgeRate(rate: number): string {
  return String(Number(rate.toFixed(2)));
}

export function formatPlaybackBadgeText(rate: number): string {
  const text = formatPlaybackBadgeRate(rate);
  // Chrome renders single-glyph action badges slightly left of their optical center.
  return text.length === 1 ? `\u2009${text}` : text;
}
