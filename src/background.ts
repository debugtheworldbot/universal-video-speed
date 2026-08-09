import { formatPlaybackBadgeRate, formatPlaybackBadgeText, isPlaybackBadgeMessage } from "./playback-badge";

interface FramePlaybackState {
  playing: boolean;
  rate?: number;
  updatedAt: number;
}

const tabPlaybackStates = new Map<number, Map<number, FramePlaybackState>>();

async function renderBadge(tabId: number): Promise<void> {
  const frameStates = tabPlaybackStates.get(tabId);
  const activeState = frameStates
    ? [...frameStates.values()]
        .filter((state): state is FramePlaybackState & { rate: number } => state.playing && state.rate !== undefined)
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
      title: activeState ? `Universal Video Speed · ${rateText}×` : "Universal Video Speed"
    })
  ]);
}

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isPlaybackBadgeMessage(message) || sender.tab?.id === undefined) return;

  const tabId = sender.tab.id;
  const frameId = sender.frameId ?? 0;
  if (message.reset) tabPlaybackStates.delete(tabId);

  const frameStates = tabPlaybackStates.get(tabId) ?? new Map<number, FramePlaybackState>();
  frameStates.set(frameId, {
    playing: message.playing,
    rate: message.rate,
    updatedAt: Date.now()
  });
  tabPlaybackStates.set(tabId, frameStates);
  void renderBadge(tabId).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabPlaybackStates.delete(tabId);
});
