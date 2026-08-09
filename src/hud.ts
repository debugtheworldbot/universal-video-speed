let hud: HTMLDivElement | null = null;
let hideTimer: number | undefined;
let positionFrame: number | undefined;
const VIDEO_INSET = 18;

function trackVideoPosition(video: HTMLVideoElement): void {
  if (positionFrame !== undefined) window.cancelAnimationFrame(positionFrame);

  const update = (): void => {
    if (!hud || !video.isConnected) {
      positionFrame = undefined;
      return;
    }

    const rect = video.getBoundingClientRect();
    hud.style.left = `${rect.left + VIDEO_INSET}px`;
    hud.style.top = `${rect.top + VIDEO_INSET}px`;
    positionFrame = window.requestAnimationFrame(update);
  };

  update();
}

export function showRateHud(video: HTMLVideoElement, rate: number): void {
  if (!hud || !hud.isConnected) {
    hud = document.createElement("div");
    hud.setAttribute("aria-hidden", "true");
    Object.assign(hud.style, {
      position: "fixed",
      zIndex: "2147483647",
      pointerEvents: "none",
      padding: "10px 16px",
      border: "2px solid rgba(232, 255, 71, 0.92)",
      borderRadius: "10px",
      color: "white",
      background: "rgba(16, 16, 18, 0.88)",
      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.55), 0 10px 30px rgba(0, 0, 0, 0.32)",
      backdropFilter: "blur(12px)",
      font: "600 22px/1.1 system-ui, -apple-system, sans-serif",
      letterSpacing: "-0.02em",
      transform: "scale(0.96)",
      transformOrigin: "top left",
      opacity: "0",
      transition: "opacity 120ms ease, transform 120ms ease"
    });
    document.documentElement.append(hud);
  }

  const fullscreenRoot = document.fullscreenElement;
  const overlayRoot = fullscreenRoot instanceof HTMLElement && !(fullscreenRoot instanceof HTMLMediaElement)
    ? fullscreenRoot
    : document.documentElement;
  if (hud.parentElement !== overlayRoot) overlayRoot.append(hud);

  hud.textContent = `${Number.isInteger(rate) ? rate.toFixed(0) : rate}×`;
  trackVideoPosition(video);
  hud.style.opacity = "1";
  hud.style.transform = "scale(1)";

  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (!hud) return;
    if (positionFrame !== undefined) window.cancelAnimationFrame(positionFrame);
    positionFrame = undefined;
    hud.style.opacity = "0";
    hud.style.transform = "scale(0.96)";
  }, 900);
}
