export function releaseVideoControlFocus(video: HTMLVideoElement): void {
  window.requestAnimationFrame(() => {
    if (video.isConnected && document.activeElement === video) video.blur();
  });
}

export function releaseNativeFullscreenControlFocus(): void {
  const fullscreenElement = document.fullscreenElement;
  if (fullscreenElement instanceof HTMLVideoElement) releaseVideoControlFocus(fullscreenElement);
}
