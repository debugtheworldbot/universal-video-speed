import {
  formatPlaybackBadgeRate,
  formatPlaybackBadgeText,
  isPlaybackBadgeMessage,
  isPlaybackRateCommandMessage
} from "./playback-badge";
import { t } from "./i18n";

interface FramePlaybackState {
  hasVideo: boolean;
  rate?: number;
  updatedAt: number;
}

const tabPlaybackStates = new Map<number, Map<number, FramePlaybackState>>();

async function relayPlaybackRate(tabId: number, sourceFrameId: number, message: unknown): Promise<void> {
  const frameStates = tabPlaybackStates.get(tabId);
  const targetFrameId = frameStates
    ? [...frameStates.entries()]
        .filter(([frameId, state]) => frameId !== sourceFrameId && state.hasVideo)
        .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)[0]?.[0]
    : undefined;

  if (targetFrameId !== undefined) {
    try {
      await chrome.tabs.sendMessage(tabId, message, { frameId: targetFrameId });
      return;
    } catch {
      // The recorded frame may have navigated; fall through and ask every live frame.
    }
  }

  await chrome.tabs.sendMessage(tabId, message);
}

async function renderBadge(tabId: number): Promise<void> {
  const frameStates = tabPlaybackStates.get(tabId);
  const activeState = frameStates
    ? [...frameStates.values()]
        .filter((state): state is FramePlaybackState & { rate: number } => state.hasVideo && state.rate !== undefined)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    : undefined;
  const rateText = activeState ? formatPlaybackBadgeRate(activeState.rate) : "";
  const badgeText = activeState ? formatPlaybackBadgeText(activeState.rate) : "";

  await Promise.all([
    chrome.action.setBadgeText({ tabId, text: badgeText }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#171719" }),
    chrome.action.setBadgeTextColor({ tabId, color: "#FFFFFF" }),
    chrome.action.setTitle({
      tabId,
      title: activeState ? t("playback_title", rateText) : t("extension_name")
    })
  ]);
}

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (isPlaybackRateCommandMessage(message) && sender.tab?.id !== undefined) {
    void relayPlaybackRate(sender.tab.id, sender.frameId ?? 0, message).catch(() => undefined);
    return;
  }

  if (!isPlaybackBadgeMessage(message) || sender.tab?.id === undefined) return;

  const tabId = sender.tab.id;
  const frameId = sender.frameId ?? 0;
  if (message.reset) tabPlaybackStates.delete(tabId);

  const frameStates = tabPlaybackStates.get(tabId) ?? new Map<number, FramePlaybackState>();
  frameStates.set(frameId, {
    hasVideo: message.hasVideo,
    rate: message.rate,
    updatedAt: Date.now()
  });
  tabPlaybackStates.set(tabId, frameStates);
  void renderBadge(tabId).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabPlaybackStates.delete(tabId);
});
