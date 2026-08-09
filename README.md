# Universal Video Speed

Keyboard playback-speed shortcuts for YouTube and Bilibili.

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

Shortcuts are injected only on YouTube and Bilibili. They are ignored while typing, composing text, or holding Meta, Ctrl, or Alt. When a page contains multiple videos, the extension ranks playback state, viewport visibility, rendered area, recent progress, and mute state to choose the most likely active video.

You can replace the defaults with any single non-modifier key from the extension's settings page.

## Creator defaults

Set a default playback speed for individual YouTube channels or Bilibili creators from the settings page. Paste a YouTube channel URL, `@handle`, or channel ID; for Bilibili, paste a space URL or numeric UID. Valid entries are resolved to a stable ID and display their current nickname automatically. The creator speed is applied once when each video loads, so you can still change it afterward.

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
