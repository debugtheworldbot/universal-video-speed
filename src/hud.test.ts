import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("showRateHud", () => {
  const originalShowPopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "showPopover");
  const originalHidePopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "hidePopover");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    if (originalShowPopover) Object.defineProperty(HTMLElement.prototype, "showPopover", originalShowPopover);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
    if (originalHidePopover) Object.defineProperty(HTMLElement.prototype, "hidePopover", originalHidePopover);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
  });

  it("uses a manual popover so the HUD can appear above fullscreen video", async () => {
    let popoverOpen = false;
    const showPopover = vi.fn(() => {
      popoverOpen = true;
    });
    const hidePopover = vi.fn(() => {
      popoverOpen = false;
    });
    Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: showPopover });
    Object.defineProperty(HTMLElement.prototype, "hidePopover", { configurable: true, value: hidePopover });

    const nativeMatches = HTMLElement.prototype.matches;
    vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (this: HTMLElement, selector: string): boolean {
      return selector === ":popover-open" ? popoverOpen : nativeMatches.call(this, selector);
    });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    const video = document.createElement("video");
    document.body.append(video);
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 1280,
      bottom: 720,
      left: 0,
      width: 1280,
      height: 720,
      toJSON: () => ({})
    });

    const { showRateHud } = await import("./hud");
    showRateHud(video, 2.3);

    const hud = document.querySelector<HTMLDivElement>("[popover='manual']");
    expect(hud?.textContent).toBe("2.3×");
    expect(hud?.parentElement).toBe(document.documentElement);
    expect(showPopover).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1_040);
    expect(hidePopover).toHaveBeenCalledOnce();
  });
});
