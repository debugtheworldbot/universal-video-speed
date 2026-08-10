export const YOUTUBE_PLAYBACK_RATE_REQUEST = "universal-video-speed:youtube-playback-rate";

interface YouTubePlayerElement extends Element {
  setPlaybackRate?: (rate: number) => void;
}

function hasPlaybackRateApi(element: Element | null): element is YouTubePlayerElement & {
  setPlaybackRate: (rate: number) => void;
} {
  return typeof (element as YouTubePlayerElement | null)?.setPlaybackRate === "function";
}

function findPlayerFromVideo(video: Element | null): YouTubePlayerElement | null {
  let element = video;
  while (element) {
    if (hasPlaybackRateApi(element)) return element;
    element = element.parentElement;
  }
  return null;
}

export function applyYouTubePlayerRate(
  rate: number,
  root: ParentNode = document,
  video: Element | null = null
): boolean {
  if (!Number.isFinite(rate) || rate <= 0) return false;

  const moviePlayer = root.querySelector<YouTubePlayerElement>("#movie_player");
  const player = hasPlaybackRateApi(moviePlayer) ? moviePlayer : findPlayerFromVideo(video);
  if (!player || !hasPlaybackRateApi(player)) return false;

  player.setPlaybackRate(rate);
  return true;
}

export function requestYouTubePlayerRate(video: HTMLVideoElement, rate: number): void {
  video.dispatchEvent(new CustomEvent<number>(YOUTUBE_PLAYBACK_RATE_REQUEST, {
    bubbles: true,
    composed: true,
    detail: rate
  }));
}

export function installYouTubePlayerRateBridge(target: Document = document): () => void {
  const onRateRequest = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail !== "number") return;
    applyYouTubePlayerRate(detail, target, event.target instanceof Element ? event.target : null);
  };

  target.addEventListener(YOUTUBE_PLAYBACK_RATE_REQUEST, onRateRequest);
  return () => target.removeEventListener(YOUTUBE_PLAYBACK_RATE_REQUEST, onRateRequest);
}
