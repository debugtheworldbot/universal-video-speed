import { showRateHud } from "./hud";
import { installPlaybackRateProtection, setVideoPlaybackRate } from "./playback-rate";
import { creatorSiteForHostname, detectCreatorContext, detectCreatorIds, findCreatorRule, isVideoPage, pageVideoKey, type CreatorContextResponse } from "./creator-defaults";
import { DEFAULT_SETTINGS, isHostDisabled, normalizeSettings, type Settings } from "./settings";
import { findPrimaryVideo, installVideoActivityTracking } from "./video-target";
import { PLAYBACK_BADGE_MESSAGE, type PlaybackBadgeMessage } from "./playback-badge";

const LOG_PREFIX = "[Universal Video Speed]";
let settings: Settings = DEFAULT_SETTINGS;

function frameLabel(): "top" | "iframe" {
  return window === window.top ? "top" : "iframe";
}

function videoState(video: HTMLVideoElement): Record<string, number | boolean> {
  const rect = video.getBoundingClientRect();
  return {
    playbackRate: video.playbackRate,
    defaultPlaybackRate: video.defaultPlaybackRate,
    paused: video.paused,
    ended: video.ended,
    readyState: video.readyState,
    connected: video.isConnected,
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

console.info(`${LOG_PREFIX} content script loaded`, {
  origin: location.origin,
  frame: frameLabel()
});

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
  console.info(`${LOG_PREFIX} settings loaded`, {
    shortcutKeys: Object.keys(settings.shortcuts),
    disabledForHost: isHostDisabled(location.hostname, settings.disabledHosts),
    frame: frameLabel()
  });
  scheduleCreatorDefault();
}).catch((error: unknown) => {
  console.error(`${LOG_PREFIX} failed to load settings; using defaults`, error);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue);
    console.info(`${LOG_PREFIX} settings updated`, {
      shortcutKeys: Object.keys(settings.shortcuts),
      disabledForHost: isHostDisabled(location.hostname, settings.disabledHosts),
      frame: frameLabel()
    });
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
  creatorDefaultTimer = window.setTimeout(() => {
    applyCreatorDefault();
    reportPlaybackBadge();
  }, 100);
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
  const rate = settings.shortcuts[event.key];
  if (rate === undefined) return;

  const ignoredReason = event.repeat ? "repeated key"
    : event.isComposing ? "IME composition"
    : event.metaKey || event.ctrlKey || event.altKey ? "modifier key held"
    : isEditableTarget(event) ? "editable element focused"
    : isHostDisabled(location.hostname, settings.disabledHosts) ? "host disabled"
    : null;
  if (ignoredReason) {
    console.info(`${LOG_PREFIX} shortcut ignored`, {
      key: event.key,
      rate,
      reason: ignoredReason,
      frame: frameLabel()
    });
    return;
  }

  console.info(`${LOG_PREFIX} shortcut captured`, {
    key: event.key,
    rate,
    frame: frameLabel()
  });

  const video = findPrimaryVideo();
  if (!video) {
    console.warn(`${LOG_PREFIX} no video found in the focused frame`, {
      videosInFrame: document.querySelectorAll("video").length,
      frame: frameLabel()
    });
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  console.info(`${LOG_PREFIX} applying playback rate`, {
    requestedRate: rate,
    before: videoState(video),
    videosInFrame: document.querySelectorAll("video").length,
    frame: frameLabel()
  });

  try {
    setVideoPlaybackRate(video, rate);
    showRateHud(video, rate);
  } catch (error) {
    console.error(`${LOG_PREFIX} failed to set playback rate`, error);
    return;
  }

  for (const delay of [0, 250, 1_000]) {
    window.setTimeout(() => {
      const state = videoState(video);
      const method = state.playbackRate === rate && state.defaultPlaybackRate === rate ? "info" : "warn";
      console[method](`${LOG_PREFIX} playback rate check`, {
        requestedRate: rate,
        delayMs: delay,
        ...state,
        frame: frameLabel()
      });
    }, delay);
  }
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
