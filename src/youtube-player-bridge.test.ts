import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyYouTubePlayerRate,
  installYouTubePlayerRateBridge,
  requestYouTubePlayerRate
} from "./youtube-player-bridge";

describe("YouTube player bridge", () => {
  beforeEach(() => document.body.replaceChildren());

  it("sets the rate through YouTube's player API", () => {
    const player = document.createElement("div") as HTMLDivElement & { setPlaybackRate: (rate: number) => void };
    player.id = "movie_player";
    player.setPlaybackRate = vi.fn();
    document.body.append(player);

    expect(applyYouTubePlayerRate(2, document)).toBe(true);
    expect(player.setPlaybackRate).toHaveBeenCalledWith(2);
  });

  it("relays rate requests from the isolated content world", () => {
    const player = document.createElement("div") as HTMLDivElement & { setPlaybackRate: (rate: number) => void };
    player.id = "movie_player";
    player.setPlaybackRate = vi.fn();
    document.body.append(player);
    const uninstall = installYouTubePlayerRateBridge(document);

    requestYouTubePlayerRate(3, document);

    expect(player.setPlaybackRate).toHaveBeenCalledWith(3);
    uninstall();
  });

  it("ignores invalid rates and pages without the YouTube player API", () => {
    expect(applyYouTubePlayerRate(Number.NaN, document)).toBe(false);
    expect(applyYouTubePlayerRate(2, document)).toBe(false);
  });
});
