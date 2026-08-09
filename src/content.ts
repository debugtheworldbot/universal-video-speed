import { showRateHud } from "./hud";
import { debugLog, videoDebugInfo } from "./debug";
import { installPlaybackRateProtection, setVideoPlaybackRate } from "./playback-rate";
import { creatorSiteForHostname, detectCreatorContext, detectCreatorIds, findCreatorRule, isVideoPage, pageVideoKey, type CreatorContextResponse } from "./creator-defaults";
import { resolveShortcutRate, shortcutEventId } from "./shortcut-key";
import { DEFAULT_SETTINGS, isHostDisabled, normalizeSettings, type Settings } from "./settings";
import { findPrimaryVideo, installVideoActivityTracking } from "./video-target";

let settings: Settings = DEFAULT_SETTINGS;

void chrome.storage.sync.get("settings").then(({ settings: saved }) => {
  settings = normalizeSettings(saved);
  debugLog("settings-loaded", {
    shortcutKeys: Object.keys(settings.shortcuts),
    disabledOnHost: isHostDisabled(location.hostname, settings.disabledHosts)
  });
  scheduleCreatorDefault();
}).catch((error: unknown) => {
  debugLog("settings-load-failed", { error: error instanceof Error ? error.message : String(error) });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue);
    debugLog("settings-changed", {
      shortcutKeys: Object.keys(settings.shortcuts),
      disabledOnHost: isHostDisabled(location.hostname, settings.disabledHosts)
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

const handledShortcutKeys = new Set<string>();

function handleShortcut(event: KeyboardEvent, phase: "keydown" | "keyup"): boolean {
  const editable = isEditableTarget(event);
  const disabledOnHost = isHostDisabled(location.hostname, settings.disabledHosts);
  const rate = resolveShortcutRate(event, settings.shortcuts);
  const shouldLog = rate !== undefined || /^(?:Digit|Numpad)\d$/.test(event.code);

  if (shouldLog) {
    debugLog("key-event", {
      phase,
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      composing: event.isComposing,
      modifiers: { meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey },
      editable,
      disabledOnHost,
      resolvedRate: rate ?? null
    });
  }

  if (event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || editable || disabledOnHost) {
    if (shouldLog) debugLog("shortcut-ignored", { phase, reason: "guard-condition" });
    return false;
  }

  if (rate === undefined) {
    if (shouldLog) debugLog("shortcut-ignored", { phase, reason: "no-mapping" });
    return false;
  }

  const video = findPrimaryVideo();
  if (!video) {
    debugLog("shortcut-ignored", { phase, reason: "no-video", videoCount: document.querySelectorAll("video").length });
    return false;
  }

  debugLog("video-selected", {
    phase,
    requestedRate: rate,
    videoCount: document.querySelectorAll("video").length,
    video: videoDebugInfo(video)
  });

  event.preventDefault();
  event.stopImmediatePropagation();
  setVideoPlaybackRate(video, rate);
  showRateHud(video, rate);
  debugLog("shortcut-applied", { phase, requestedRate: rate, video: videoDebugInfo(video) });
  window.setTimeout(() => {
    debugLog("shortcut-check-500ms", { requestedRate: rate, video: videoDebugInfo(video) });
  }, 500);
  return true;
}

function onKeyDown(event: KeyboardEvent): void {
  if (handleShortcut(event, "keydown")) handledShortcutKeys.add(shortcutEventId(event));
}

function onKeyUp(event: KeyboardEvent): void {
  const id = shortcutEventId(event);
  if (handledShortcutKeys.delete(id)) {
    debugLog("keyup-deduplicated", { key: event.key, code: event.code });
    return;
  }
  handleShortcut(event, "keyup");
}

installVideoActivityTracking();
installPlaybackRateProtection();
window.addEventListener("keydown", onKeyDown, true);
window.addEventListener("keyup", onKeyUp, true);
document.addEventListener("loadedmetadata", scheduleCreatorDefault, true);
document.addEventListener("play", scheduleCreatorDefault, true);

function observeCreatorChanges(): void {
  if (!document.documentElement) return;
  new MutationObserver(scheduleCreatorDefault).observe(document.documentElement, { childList: true, subtree: true });
  scheduleCreatorDefault();
}

if (document.documentElement) observeCreatorChanges();
else document.addEventListener("DOMContentLoaded", observeCreatorChanges, { once: true });

debugLog("content-script-ready", {
  version: chrome.runtime.getManifest().version,
  hostname: location.hostname,
  frame: window === window.top ? "top" : "child",
  readyState: document.readyState
});
