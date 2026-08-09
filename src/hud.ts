let hud: HTMLDivElement | null = null;
let hideTimer: number | undefined;
const VIDEO_INSET = 18;
const VIEWPORT_MARGIN = 12;

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

  const rect = video.getBoundingClientRect();
  hud.textContent = `${Number.isInteger(rate) ? rate.toFixed(0) : rate}×`;
  const maxLeft = Math.max(VIEWPORT_MARGIN, innerWidth - hud.offsetWidth - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, innerHeight - hud.offsetHeight - VIEWPORT_MARGIN);
  hud.style.left = `${Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, rect.left + VIDEO_INSET))}px`;
  hud.style.top = `${Math.min(maxTop, Math.max(VIEWPORT_MARGIN, rect.top + VIDEO_INSET))}px`;
  hud.style.opacity = "1";
  hud.style.transform = "scale(1)";

  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (!hud) return;
    hud.style.opacity = "0";
    hud.style.transform = "scale(0.96)";
  }, 900);
}
