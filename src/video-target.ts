const progressActivity = new WeakMap<HTMLVideoElement, number>();
let activityTrackingInstalled = false;

export function installVideoActivityTracking(): void {
  if (activityTrackingInstalled) return;
  activityTrackingInstalled = true;

  document.addEventListener(
    "timeupdate",
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        progressActivity.set(event.target, performance.now());
      }
    },
    true
  );
}

export function visibleMetrics(video: HTMLVideoElement): {
  visible: boolean;
  ratio: number;
  area: number;
  validSize: boolean;
} {
  const rect = video.getBoundingClientRect();
  const area = Math.max(0, rect.width) * Math.max(0, rect.height);
  const validSize = rect.width >= 80 && rect.height >= 45;
  if (!validSize) return { visible: false, ratio: 0, area, validSize };

  const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  const visibleArea = visibleWidth * visibleHeight;
  return {
    visible: visibleArea > 0,
    ratio: area > 0 ? visibleArea / area : 0,
    area,
    validSize
  };
}

export function scoreVideo(video: HTMLVideoElement, now = performance.now()): number {
  const { visible, ratio, area, validSize } = visibleMetrics(video);
  const playing = !video.paused && !video.ended && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  const recentlyProgressed = now - (progressActivity.get(video) ?? -Infinity) < 1_500;

  let score = 0;
  if (playing && visible) score += 10_000;
  else if (playing) score += 1_500;
  if (visible) score += 3_000;
  if (validSize) score += 500;
  if (recentlyProgressed && visible) score += 2_500;
  else if (recentlyProgressed) score += 500;
  score += ratio * 2_000;
  score += Math.min(area / 1_000, 2_500);
  if (video.muted) score -= 150;
  return score;
}

export function findPrimaryVideo(videos = Array.from(document.querySelectorAll("video"))): HTMLVideoElement | null {
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  return videos.reduce((best, video) => (scoreVideo(video) > scoreVideo(best) ? video : best));
}
