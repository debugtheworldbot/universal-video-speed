import { describe, expect, it } from "vitest";
import {
  formatPlaybackBadgeRate,
  formatPlaybackBadgeText,
  isPlaybackBadgeMessage,
  PLAYBACK_BADGE_MESSAGE
} from "./playback-badge";

describe("playback badge", () => {
  it.each([
    [1, "1"],
    [1.5, "1.5"],
    [0.75, "0.75"],
    [1.333, "1.33"]
  ])("formats %s compactly", (rate, expected) => {
    expect(formatPlaybackBadgeRate(rate)).toBe(expected);
  });

  it("optically centers single-character badge text", () => {
    expect(formatPlaybackBadgeText(3)).toBe("\u20093");
    expect(formatPlaybackBadgeText(1.5)).toBe("1.5");
    expect(formatPlaybackBadgeText(0.75)).toBe("0.75");
  });

  it("accepts video-present and video-absent state messages", () => {
    expect(isPlaybackBadgeMessage({ type: PLAYBACK_BADGE_MESSAGE, hasVideo: true, rate: 2 })).toBe(true);
    expect(isPlaybackBadgeMessage({ type: PLAYBACK_BADGE_MESSAGE, hasVideo: false })).toBe(true);
  });

  it("rejects a video-present message without a valid rate", () => {
    expect(isPlaybackBadgeMessage({ type: PLAYBACK_BADGE_MESSAGE, hasVideo: true })).toBe(false);
    expect(isPlaybackBadgeMessage({ type: PLAYBACK_BADGE_MESSAGE, hasVideo: true, rate: 0 })).toBe(false);
  });
});
