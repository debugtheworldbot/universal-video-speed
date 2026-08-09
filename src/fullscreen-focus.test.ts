import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { releaseNativeFullscreenControlFocus, releaseVideoControlFocus } from "./fullscreen-focus";

describe("native fullscreen control focus", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (document as unknown as { fullscreenElement?: Element | null }).fullscreenElement;
  });

  it("releases focus from native video controls on the next frame", () => {
    const video = document.createElement("video");
    video.tabIndex = 0;
    document.body.append(video);
    video.focus();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    releaseVideoControlFocus(video);

    expect(document.activeElement).not.toBe(video);
  });

  it("does not blur a newer focus target", () => {
    const video = document.createElement("video");
    const button = document.createElement("button");
    video.tabIndex = 0;
    document.body.append(video, button);
    video.focus();
    let scheduled: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduled = callback;
      return 1;
    });

    releaseVideoControlFocus(video);
    button.focus();
    scheduled?.(0);

    expect(document.activeElement).toBe(button);
  });

  it("targets only a video that is itself fullscreen", () => {
    const container = document.createElement("div");
    const video = document.createElement("video");
    video.tabIndex = 0;
    container.append(video);
    document.body.append(container);
    video.focus();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => container });
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");

    releaseNativeFullscreenControlFocus();

    expect(requestFrame).not.toHaveBeenCalled();
  });
});
