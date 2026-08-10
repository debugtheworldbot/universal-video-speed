import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyYouTubePlayerRate,
  installYouTubePlayerRateBridge,
  requestYouTubePlayerRate
} from "./youtube-player-bridge";

describe("YouTube player bridge", () => {
  beforeEach(() => document.body.replaceChildren());

  it("prefers the #movie_player API", () => {
    const moviePlayer = document.createElement("div") as HTMLDivElement & { setPlaybackRate: (rate: number) => void };
    moviePlayer.id = "movie_player";
    moviePlayer.setPlaybackRate = vi.fn();
    const fallbackPlayer = document.createElement("div") as HTMLDivElement & { setPlaybackRate: (rate: number) => void };
    fallbackPlayer.setPlaybackRate = vi.fn();
    const video = document.createElement("video");
    fallbackPlayer.append(video);
    document.body.append(moviePlayer, fallbackPlayer);

    expect(applyYouTubePlayerRate(2, document, video)).toBe(true);
    expect(moviePlayer.setPlaybackRate).toHaveBeenCalledWith(2);
    expect(fallbackPlayer.setPlaybackRate).not.toHaveBeenCalled();
  });

  it("falls back to the nearest video ancestor with the player API", () => {
    const player = document.createElement("div") as HTMLDivElement & { setPlaybackRate: (rate: number) => void };
    player.setPlaybackRate = vi.fn();
    const video = document.createElement("video");
    player.append(video);
    document.body.append(player);

    expect(applyYouTubePlayerRate(1.75, document, video)).toBe(true);
    expect(player.setPlaybackRate).toHaveBeenCalledWith(1.75);
  });

  it("relays the target video from the isolated content world", () => {
    const player = document.createElement("div") as HTMLDivElement & { setPlaybackRate: (rate: number) => void };
    player.setPlaybackRate = vi.fn();
    const video = document.createElement("video");
    player.append(video);
    document.body.append(player);
    const uninstall = installYouTubePlayerRateBridge(document);

    requestYouTubePlayerRate(video, 3);

    expect(player.setPlaybackRate).toHaveBeenCalledWith(3);
    uninstall();
  });

  it("ignores invalid rates and pages without the YouTube player API", () => {
    expect(applyYouTubePlayerRate(Number.NaN, document)).toBe(false);
    expect(applyYouTubePlayerRate(2, document)).toBe(false);
  });
});
