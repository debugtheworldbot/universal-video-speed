# Universal Video Speed

Keyboard playback-speed shortcuts for videos across the web, including videos inside embedded players.

## Installation

1. Open the [latest GitHub release](https://github.com/debugtheworldbot/universal-video-speed/releases/latest) and download `universal-video-speed.zip` from **Assets**.
2. Unzip the downloaded file to a permanent folder. Do not delete that folder after installation.
3. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the unzipped folder (the folder containing `manifest.json`).

To update the extension, download and unzip the new release over the same folder, then click **Reload** for Universal Video Speed on the extensions page.

## Default shortcuts

- `1` → 1×
- `5` → 1.5×
- `7` → 1.75×
- `2` → 2×
- `3` → 3×

Shortcuts are injected on regular web pages and into embedded player frames. If the focused frame does not contain the video, the shortcut is relayed to the most recently active video frame. Shortcuts are ignored while typing, composing text, or holding Meta, Ctrl, or Alt. When a page contains multiple videos, the extension ranks playback state, viewport visibility, rendered area, recent progress, and mute state to choose the most likely active video.

Browser-internal pages, browser extension stores, and other protected pages do not allow extensions to inject scripts. Some sites may also use a non-standard player or actively restrict playback rates, so universal coverage is best effort.

You can replace the defaults with any single non-modifier key from the extension's settings page.

Vimium and similar keyboard-navigation extensions can intercept single-key shortcuts before they reach the page. The settings page shows a compatible **Excluded URLs and keys** rule using the currently configured shortcut keys.

## Automatic defaults

You can set independent fallback speeds for YouTube and Bilibili, plus custom rules that match the beginning of a webpage URL. When multiple custom prefixes match, the longest prefix wins.

Creator-specific defaults are also available for individual YouTube channels and Bilibili creators. From the settings page, paste a YouTube channel URL, `@handle`, or channel ID; for Bilibili, paste a space URL or numeric UID. Valid entries are resolved to a stable ID and display their current nickname automatically.

Automatic speeds are applied once per video. The priority is a manual shortcut change, then a creator-specific setting, then a custom webpage prefix, then the platform fallback. This lets you change the speed afterward without the automatic rule taking control again.

On a YouTube or Bilibili video page, open the extension popup to detect the current creator and set or clear their default speed immediately.

## Development

Requires Node.js 20.19 or newer.

```sh
npm install
npm run check
npm run build
npm run zip
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

`npm run zip` rebuilds the extension and creates `universal-video-speed.zip` for distribution.

Clicking the extension icon opens the creator shortcut popup. Settings are stored with `chrome.storage.sync`.
