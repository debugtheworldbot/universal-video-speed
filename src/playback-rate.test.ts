import { describe, expect, it } from "vitest";
import {
  installPlaybackRateProtection,
  restoreProtectedPlaybackRate,
  setVideoPlaybackRate
} from "./playback-rate";

describe("playback rate", () => {
  it("sets both the current and default playback rates", () => {
    const video = document.createElement("video");

    setVideoPlaybackRate(video, 3);

    expect(video.playbackRate).toBe(3);
    expect(video.defaultPlaybackRate).toBe(3);
  });

  it("restores a rate reset by the player during the protection window", () => {
    installPlaybackRateProtection();
    const video = document.createElement("video");
    document.body.append(video);
    setVideoPlaybackRate(video, 2);

    video.playbackRate = 1;
    video.defaultPlaybackRate = 1;
    video.dispatchEvent(new Event("ratechange"));

    expect(video.playbackRate).toBe(2);
    expect(video.defaultPlaybackRate).toBe(2);
  });

  it("allows later rate changes after the protection window", () => {
    const video = document.createElement("video");
    setVideoPlaybackRate(video, 2, 3_000, 1_000);
    video.playbackRate = 1;

    expect(restoreProtectedPlaybackRate(video, 4_001)).toBe(false);
    expect(video.playbackRate).toBe(1);
  });
});
