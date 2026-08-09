# Universal Video Speed

One keyboard shortcut. Any video.

## MVP shortcuts

- `1` → 1×
- `5` → 1.5×
- `2` → 2×
- `3` → 3×

Shortcuts are ignored while typing, composing text, or holding Meta, Ctrl, or Alt. When a page contains multiple videos, the extension ranks playback state, viewport visibility, rendered area, recent progress, and mute state to choose the most likely active video.

## Development

Requires Node.js 20.19 or newer.

```sh
npm install
npm run check
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

Clicking the extension icon opens the shortcut settings page. Settings are stored with `chrome.storage.sync`.
