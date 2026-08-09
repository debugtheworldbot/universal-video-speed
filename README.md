# Universal Video Speed

One keyboard shortcut. Any video.

## Default shortcuts

- `1` → 1×
- `5` → 1.5×
- `7` → 1.75×
- `2` → 2×
- `3` → 3×

Shortcuts are ignored while typing, composing text, or holding Meta, Ctrl, or Alt. When a page contains multiple videos, the extension ranks playback state, viewport visibility, rendered area, recent progress, and mute state to choose the most likely active video.

You can replace the defaults with any single non-modifier key from the extension's settings page.

## Creator defaults

Set a default playback speed for individual YouTube channels or Bilibili creators from the settings page. Paste a YouTube channel URL, `@handle`, or channel ID; for Bilibili, paste a space URL or numeric UID. The creator speed is applied once when each video loads, so you can still change it afterward.

On a YouTube or Bilibili video page, open the extension popup to detect the current creator and set or clear their default speed immediately.

## Development

Requires Node.js 20.19 or newer.

```sh
npm install
npm run check
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

Clicking the extension icon opens the shortcut settings page. Settings are stored with `chrome.storage.sync`.
