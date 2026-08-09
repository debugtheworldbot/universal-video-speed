import { debugLog, videoDebugInfo } from "./debug";

interface ProtectedRate {
  rate: number;
  until: number;
}

const protectedRates = new WeakMap<HTMLVideoElement, ProtectedRate>();
let protectionInstalled = false;

function applyRate(video: HTMLVideoElement, rate: number): void {
  if (video.defaultPlaybackRate !== rate) video.defaultPlaybackRate = rate;
  if (video.playbackRate !== rate) video.playbackRate = rate;
}

export function setVideoPlaybackRate(
  video: HTMLVideoElement,
  rate: number,
  protectForMs = 3_000,
  now = performance.now()
): void {
  protectedRates.set(video, { rate, until: now + protectForMs });
  debugLog("rate-set-request", { rate, protectForMs, video: videoDebugInfo(video) });
  applyRate(video, rate);
  debugLog("rate-set-complete", { rate, video: videoDebugInfo(video) });
}

export function restoreProtectedPlaybackRate(video: HTMLVideoElement, now = performance.now()): boolean {
  const protectedRate = protectedRates.get(video);
  if (!protectedRate || now > protectedRate.until) {
    if (protectedRate) {
      debugLog("rate-protection-expired", {
        expectedRate: protectedRate.rate,
        video: videoDebugInfo(video)
      });
    }
    protectedRates.delete(video);
    return false;
  }

  const wasReset = video.playbackRate !== protectedRate.rate || video.defaultPlaybackRate !== protectedRate.rate;
  if (wasReset) {
    debugLog("rate-reset-detected", {
      expectedRate: protectedRate.rate,
      video: videoDebugInfo(video)
    });
  }
  applyRate(video, protectedRate.rate);
  if (wasReset) debugLog("rate-restored", { expectedRate: protectedRate.rate, video: videoDebugInfo(video) });
  return true;
}

export function installPlaybackRateProtection(): void {
  if (protectionInstalled) return;
  protectionInstalled = true;

  document.addEventListener(
    "ratechange",
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        debugLog("ratechange", { video: videoDebugInfo(event.target) });
        restoreProtectedPlaybackRate(event.target);
      }
    },
    true
  );
  document.addEventListener(
    "loadedmetadata",
    (event) => {
      if (event.target instanceof HTMLVideoElement) restoreProtectedPlaybackRate(event.target);
    },
    true
  );
}
