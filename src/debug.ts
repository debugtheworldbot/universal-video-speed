const PREFIX = "[UVS]";

export function debugLog(event: string, details: Record<string, unknown> = {}): void {
  console.info(`${PREFIX} ${event} ${JSON.stringify(details)}`);
}

export function videoDebugInfo(video: HTMLVideoElement): Record<string, unknown> {
  const rect = video.getBoundingClientRect();
  return {
    connected: video.isConnected,
    paused: video.paused,
    ended: video.ended,
    readyState: video.readyState,
    currentTime: Number(video.currentTime.toFixed(3)),
    playbackRate: video.playbackRate,
    defaultPlaybackRate: video.defaultPlaybackRate,
    muted: video.muted,
    rect: {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  };
}
