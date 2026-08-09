const MESSAGE_SOURCE = "universal-video-speed-main-world";

function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.composedPath().find((item): item is Element => item instanceof Element);
  return Boolean(target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

window.addEventListener(
  "keyup",
  (event) => {
    window.postMessage({
      source: MESSAGE_SOURCE,
      version: 1,
      keyEvent: {
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        isComposing: event.isComposing,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        editable: isEditableTarget(event)
      }
    }, "*");
  },
  true
);

console.info("[UVS] main-world-ready");
