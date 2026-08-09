export const PLAYBACK_BADGE_MESSAGE = "playback-badge-state";
export const PLAYBACK_RATE_COMMAND_MESSAGE = "playback-rate-command";

export interface PlaybackBadgeMessage {
  type: typeof PLAYBACK_BADGE_MESSAGE;
  hasVideo: boolean;
  rate?: number;
  reset?: boolean;
}

export interface PlaybackRateCommandMessage {
  type: typeof PLAYBACK_RATE_COMMAND_MESSAGE;
  rate: number;
}

export function isPlaybackBadgeMessage(message: unknown): message is PlaybackBadgeMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<PlaybackBadgeMessage>;
  if (candidate.type !== PLAYBACK_BADGE_MESSAGE || typeof candidate.hasVideo !== "boolean") return false;
  return !candidate.hasVideo || (typeof candidate.rate === "number" && Number.isFinite(candidate.rate) && candidate.rate > 0);
}

export function isPlaybackRateCommandMessage(message: unknown): message is PlaybackRateCommandMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<PlaybackRateCommandMessage>;
  return candidate.type === PLAYBACK_RATE_COMMAND_MESSAGE &&
    typeof candidate.rate === "number" &&
    Number.isFinite(candidate.rate) &&
    candidate.rate >= 0.25 &&
    candidate.rate <= 16;
}

export function formatPlaybackBadgeRate(rate: number): string {
  return String(Number(rate.toFixed(2)));
}

export function formatPlaybackBadgeText(rate: number): string {
  const text = formatPlaybackBadgeRate(rate);
  // Chrome renders single-glyph action badges slightly left of their optical center.
  return text.length === 1 ? `\u2009${text}` : text;
}
