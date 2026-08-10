export const YOUTUBE_PLAYBACK_RATE_REQUEST = "universal-video-speed:youtube-playback-rate";

interface YouTubePlayerElement extends Element {
  setPlaybackRate?: (rate: number) => void;
}

export function applyYouTubePlayerRate(rate: number, root: ParentNode = document): boolean {
  if (!Number.isFinite(rate) || rate <= 0) return false;

  const player = root.querySelector<YouTubePlayerElement>("#movie_player");
  if (typeof player?.setPlaybackRate !== "function") return false;

  player.setPlaybackRate(rate);
  return true;
}

export function requestYouTubePlayerRate(rate: number, target: Document = document): void {
  target.dispatchEvent(new CustomEvent<number>(YOUTUBE_PLAYBACK_RATE_REQUEST, { detail: rate }));
}

export function installYouTubePlayerRateBridge(target: Document = document): () => void {
  const onRateRequest = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail !== "number") return;
    applyYouTubePlayerRate(detail, target);
  };

  target.addEventListener(YOUTUBE_PLAYBACK_RATE_REQUEST, onRateRequest);
  return () => target.removeEventListener(YOUTUBE_PLAYBACK_RATE_REQUEST, onRateRequest);
}
