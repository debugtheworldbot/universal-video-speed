import { showRateHud } from "./hud";
import { findAutoSpeed } from "./auto-defaults";
import { releaseNativeFullscreenControlFocus, releaseVideoControlFocus } from "./fullscreen-focus";
import { installPlaybackRateProtection, setVideoPlaybackRate } from "./playback-rate";
import { creatorSiteForHostname, detectCreatorContext, detectCreatorIds, isVideoPage, pageVideoKey, type CreatorContextResponse } from "./creator-defaults";
import { DEFAULT_SETTINGS, isHostDisabled, normalizeSettings, type Settings } from "./settings";
import { findPrimaryVideo, installVideoActivityTracking } from "./video-target";
import { requestYouTubePlayerRate } from "./youtube-player-bridge";
import {
  isPlaybackRateCommandMessage,
  PLAYBACK_BADGE_MESSAGE,
  PLAYBACK_RATE_COMMAND_MESSAGE,
  type PlaybackBadgeMessage
} from "./playback-badge";

let settings: Settings = DEFAULT_SETTINGS;

function setPlaybackRate(video: HTMLVideoElement, rate: number): void {
  if (creatorSiteForHostname(location.hostname) === "youtube") requestYouTubePlayerRate(rate);
  setVideoPlaybackRate(video, rate);
}

function reportPlaybackBadge(reset = false, forceStopped = false): void {
  const video = forceStopped ? null : findPrimaryVideo();
  const message: PlaybackBadgeMessage = {
    type: PLAYBACK_BADGE_MESSAGE,
    hasVideo: video !== null,
    ...(video ? { rate: video.playbackRate } : {}),
    ...(reset ? { reset: true } : {})
  };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

void chrome.storage.sync.get("settings").then(({ settings: saved }) => {
  settings = normalizeSettings(saved);
  scheduleAutoDefault();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue);
    appliedDefaults = new WeakMap();
    scheduleAutoDefault();
  }
});

function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.composedPath().find((item): item is Element => item instanceof Element);
  return Boolean(target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

interface AppliedDefault {
  contextKey: string;
  priority: number;
  signature: string;
}

let appliedDefaults = new WeakMap<HTMLVideoElement, AppliedDefault>();
const manualOverrides = new WeakMap<HTMLVideoElement, string>();
let autoDefaultTimer: number | undefined;

function scheduleAutoDefault(): void {
  window.clearTimeout(autoDefaultTimer);
  autoDefaultTimer = window.setTimeout(() => {
    applyAutoDefault();
    reportPlaybackBadge();
  }, 100);
}

function playbackContextKey(video: HTMLVideoElement): string {
  const site = creatorSiteForHostname(location.hostname);
  if (site && isVideoPage(site)) return `${site}:${pageVideoKey(site)}`;
  return `${location.href}:${video.currentSrc || video.src}`;
}

function markManualOverride(video: HTMLVideoElement): void {
  manualOverrides.set(video, playbackContextKey(video));
}

function applyAutoDefault(): void {
  if (isHostDisabled(location.hostname, settings.disabledHosts)) return;

  const video = findPrimaryVideo();
  if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
  const site = creatorSiteForHostname(location.hostname);
  const match = findAutoSpeed(settings, new URL(location.href), site ? detectCreatorIds(site) : []);
  if (!match) return;

  const contextKey = playbackContextKey(video);
  if (manualOverrides.get(video) === contextKey) return;
  const applied = appliedDefaults.get(video);
  if (applied?.contextKey === contextKey) {
    if (applied.signature === match.signature || applied.priority > match.priority) return;
  }
  setPlaybackRate(video, match.rate);
  appliedDefaults.set(video, { contextKey, priority: match.priority, signature: match.signature });
}

if (window === window.top) {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || (message as { type?: unknown }).type !== "get-creator-context") return;
    const site = creatorSiteForHostname(location.hostname);
    let response: CreatorContextResponse;
    if (!site || !isVideoPage(site)) {
      response = { status: "unsupported" };
    } else {
      const context = detectCreatorContext(location.hostname);
      response = context ? { status: "ready", context } : { status: "detecting" };
    }
    sendResponse(response);
  });
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isPlaybackRateCommandMessage(message)) return;
  const video = findPrimaryVideo();
  if (!video) return;

  setPlaybackRate(video, message.rate);
  markManualOverride(video);
  showRateHud(video, message.rate);
});

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

  event.preventDefault();
  event.stopImmediatePropagation();

  const video = findPrimaryVideo();
  if (!video) {
    void chrome.runtime.sendMessage({
      type: PLAYBACK_RATE_COMMAND_MESSAGE,
      rate
    }).catch(() => undefined);
    return;
  }

  setPlaybackRate(video, rate);
  markManualOverride(video);
  showRateHud(video, rate);
}

installVideoActivityTracking();
installPlaybackRateProtection();
window.addEventListener("keydown", onKeyDown, true);
document.addEventListener("fullscreenchange", releaseNativeFullscreenControlFocus, true);
document.addEventListener("webkitbeginfullscreen", (event) => {
  if (event.target instanceof HTMLVideoElement) releaseVideoControlFocus(event.target);
}, true);
document.addEventListener("loadedmetadata", scheduleAutoDefault, true);
document.addEventListener("play", scheduleAutoDefault, true);
for (const eventName of ["play", "playing", "pause", "ended", "ratechange", "loadedmetadata"] as const) {
  document.addEventListener(eventName, () => reportPlaybackBadge(), true);
}
window.addEventListener("pagehide", () => reportPlaybackBadge(window === window.top, true), true);
reportPlaybackBadge(window === window.top);

function observeCreatorChanges(): void {
  if (!document.documentElement) return;
  new MutationObserver(scheduleAutoDefault).observe(document.documentElement, { childList: true, subtree: true });
  scheduleAutoDefault();
}

if (document.documentElement) observeCreatorChanges();
else document.addEventListener("DOMContentLoaded", observeCreatorChanges, { once: true });
