import { showRateHud } from "./hud";
import { installPlaybackRateProtection, setVideoPlaybackRate } from "./playback-rate";
import { creatorSiteForHostname, detectCreatorContext, detectCreatorIds, findCreatorRule, isVideoPage, pageVideoKey, type CreatorContextResponse } from "./creator-defaults";
import { DEFAULT_SETTINGS, isHostDisabled, normalizeSettings, type Settings } from "./settings";
import { findPrimaryVideo, installVideoActivityTracking } from "./video-target";
import { PLAYBACK_BADGE_MESSAGE, type PlaybackBadgeMessage } from "./playback-badge";

let settings: Settings = DEFAULT_SETTINGS;

function reportPlaybackBadge(reset = false, forceStopped = false): void {
  const video = forceStopped ? null : findPrimaryVideo();
  const playing = Boolean(video && !video.paused && !video.ended);
  const message: PlaybackBadgeMessage = {
    type: PLAYBACK_BADGE_MESSAGE,
    playing,
    ...(playing && video ? { rate: video.playbackRate } : {}),
    ...(reset ? { reset: true } : {})
  };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

void chrome.storage.sync.get("settings").then(({ settings: saved }) => {
  settings = normalizeSettings(saved);
  scheduleCreatorDefault();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue);
    scheduleCreatorDefault();
  }
});

function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.composedPath().find((item): item is Element => item instanceof Element);
  return Boolean(target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

const appliedDefaults = new WeakMap<HTMLVideoElement, string>();
let creatorDefaultTimer: number | undefined;

function scheduleCreatorDefault(): void {
  window.clearTimeout(creatorDefaultTimer);
  creatorDefaultTimer = window.setTimeout(applyCreatorDefault, 100);
}

function applyCreatorDefault(): void {
  const site = creatorSiteForHostname(location.hostname);
  if (!site || !isVideoPage(site) || settings.creatorRules.length === 0 || isHostDisabled(location.hostname, settings.disabledHosts)) return;

  const rule = findCreatorRule(settings.creatorRules, site, detectCreatorIds(site));
  const video = rule ? findPrimaryVideo() : null;
  if (!rule || !video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;

  const signature = `${site}:${pageVideoKey(site)}:${rule.creatorId}:${rule.rate}`;
  if (appliedDefaults.get(video) === signature) return;
  setVideoPlaybackRate(video, rule.rate);
  appliedDefaults.set(video, signature);
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
  setVideoPlaybackRate(video, rate);
  showRateHud(video, rate);
}

installVideoActivityTracking();
installPlaybackRateProtection();
window.addEventListener("keydown", onKeyDown, true);
document.addEventListener("loadedmetadata", scheduleCreatorDefault, true);
document.addEventListener("play", scheduleCreatorDefault, true);
for (const eventName of ["play", "playing", "pause", "ended", "ratechange", "loadedmetadata"] as const) {
  document.addEventListener(eventName, () => reportPlaybackBadge(), true);
}
window.addEventListener("pagehide", () => reportPlaybackBadge(window === window.top, true), true);
reportPlaybackBadge(window === window.top);

function observeCreatorChanges(): void {
  if (!document.documentElement) return;
  new MutationObserver(scheduleCreatorDefault).observe(document.documentElement, { childList: true, subtree: true });
  scheduleCreatorDefault();
}

if (document.documentElement) observeCreatorChanges();
else document.addEventListener("DOMContentLoaded", observeCreatorChanges, { once: true });
