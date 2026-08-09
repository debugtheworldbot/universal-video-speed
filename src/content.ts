import { showRateHud } from "./hud";
import { DEFAULT_SETTINGS, isHostDisabled, normalizeSettings, type Settings } from "./settings";
import { findPrimaryVideo, installVideoActivityTracking } from "./video-target";

let settings: Settings = DEFAULT_SETTINGS;

void chrome.storage.sync.get("settings").then(({ settings: saved }) => {
  settings = normalizeSettings(saved);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue);
  }
});

function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.composedPath().find((item): item is Element => item instanceof Element);
  return Boolean(target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

function onKeyDown(event: KeyboardEvent): void {
  if (
    event.repeat ||
    event.isComposing ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    isEditableTarget(event) ||
    isHostDisabled(location.hostname, settings.disabledHosts)
  ) {
    return;
  }

  const rate = settings.shortcuts[event.key];
  if (rate === undefined) return;

  const video = findPrimaryVideo();
  if (!video) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  video.playbackRate = rate;
  showRateHud(video, rate);
}

installVideoActivityTracking();
window.addEventListener("keydown", onKeyDown, true);
