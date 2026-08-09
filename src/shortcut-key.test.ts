import { describe, expect, it } from "vitest";
import { resolveShortcutRate, shortcutEventId } from "./shortcut-key";

const shortcuts = { "2": 2, "3": 3, q: 1.5 };

describe("shortcut key resolution", () => {
  it("uses the configured logical key first", () => {
    expect(resolveShortcutRate({ key: "q", code: "KeyQ" }, shortcuts)).toBe(1.5);
  });

  it("falls back to the physical top-row digit on alternate keyboard layouts", () => {
    expect(resolveShortcutRate({ key: "é", code: "Digit2" }, shortcuts)).toBe(2);
  });

  it("supports numpad digits", () => {
    expect(resolveShortcutRate({ key: "Unidentified", code: "Numpad3" }, shortcuts)).toBe(3);
  });

  it("uses the physical code to deduplicate keydown and keyup", () => {
    expect(shortcutEventId({ key: "2", code: "Digit2" })).toBe("Digit2");
  });
});
