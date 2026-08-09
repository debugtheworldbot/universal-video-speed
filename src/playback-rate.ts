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
  applyRate(video, rate);
}

export function restoreProtectedPlaybackRate(video: HTMLVideoElement, now = performance.now()): boolean {
  const protectedRate = protectedRates.get(video);
  if (!protectedRate || now > protectedRate.until) {
    protectedRates.delete(video);
    return false;
  }

  applyRate(video, protectedRate.rate);
  return true;
}

export function installPlaybackRateProtection(): void {
  if (protectionInstalled) return;
  protectionInstalled = true;

  document.addEventListener(
    "ratechange",
    (event) => {
      if (event.target instanceof HTMLVideoElement) restoreProtectedPlaybackRate(event.target);
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
