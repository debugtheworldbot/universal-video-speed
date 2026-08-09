import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPrimaryVideo, installVideoActivityTracking, scoreVideo } from "./video-target";

function videoWithRect(rect: Partial<DOMRect>, state: { paused?: boolean; muted?: boolean } = {}): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "paused", { value: state.paused ?? true });
  Object.defineProperty(video, "ended", { value: false });
  Object.defineProperty(video, "readyState", { value: HTMLMediaElement.HAVE_CURRENT_DATA });
  Object.defineProperty(video, "muted", { value: state.muted ?? false, writable: true });
  vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 640, bottom: 360, width: 640, height: 360,
    toJSON: () => ({}), ...rect
  });
  return video;
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 720, configurable: true });
});

describe("video targeting", () => {
  it("returns the only video regardless of its state", () => {
    const video = videoWithRect({ width: 0, height: 0, right: 0, bottom: 0 });
    expect(findPrimaryVideo([video])).toBe(video);
  });

  it("prefers a playing visible video over a larger paused one", () => {
    const paused = videoWithRect({ width: 1000, height: 600, right: 1000, bottom: 600 });
    const playing = videoWithRect({ width: 480, height: 270, right: 480, bottom: 270 }, { paused: false });
    expect(findPrimaryVideo([paused, playing])).toBe(playing);
    expect(scoreVideo(playing)).toBeGreaterThan(scoreVideo(paused));
  });

  it("prefers the most visible large video when all are paused", () => {
    const mostlyOffscreen = videoWithRect({ left: -900, right: 100, width: 1000, height: 600, bottom: 600 });
    const visible = videoWithRect({ left: 100, right: 740, width: 640, height: 360, bottom: 360 });
    expect(findPrimaryVideo([mostlyOffscreen, visible])).toBe(visible);
  });

  it("does not let an offscreen playing preview beat a large visible video", () => {
    const hiddenPreview = videoWithRect(
      { left: -400, right: -80, width: 320, height: 180, bottom: 180 },
      { paused: false, muted: true }
    );
    const visible = videoWithRect({ left: 80, right: 1080, width: 1000, height: 600, bottom: 600 });
    expect(findPrimaryVideo([hiddenPreview, visible])).toBe(visible);
  });

  it("prefers the visible playing video that most recently advanced", () => {
    installVideoActivityTracking();
    const first = videoWithRect({ left: 0, right: 640, width: 640, height: 360, bottom: 360 }, { paused: false });
    const current = videoWithRect({ left: 640, right: 1280, width: 640, height: 360, bottom: 360 }, { paused: false });
    document.body.append(first, current);

    first.dispatchEvent(new Event("timeupdate"));
    current.dispatchEvent(new Event("timeupdate"));

    expect(findPrimaryVideo([first, current])).toBe(current);
  });
});
