import type { ShortcutMapping } from "./settings";

export interface ShortcutKeyEvent {
  key: string;
  code: string;
}

export function resolveShortcutRate(event: ShortcutKeyEvent, shortcuts: ShortcutMapping): number | undefined {
  const directRate = shortcuts[event.key];
  if (directRate !== undefined) return directRate;

  const digit = event.code.match(/^(?:Digit|Numpad)(\d)$/)?.[1];
  return digit ? shortcuts[digit] : undefined;
}

export function shortcutEventId(event: ShortcutKeyEvent): string {
  return event.code || event.key;
}
