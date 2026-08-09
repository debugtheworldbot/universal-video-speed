import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, isHostDisabled, normalizeSettings } from "./settings";

describe("settings", () => {
  it("falls back to defaults for invalid shortcut mappings", () => {
    expect(normalizeSettings({ shortcuts: { q: 2, "1": 0.1 } }).shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
  });

  it("retains valid custom shortcuts", () => {
    expect(normalizeSettings({ shortcuts: { "4": 1.25 } }).shortcuts).toEqual({ "4": 1.25 });
  });

  it("matches exact hosts and their subdomains", () => {
    expect(isHostDisabled("video.example.com", ["example.com"])).toBe(true);
    expect(isHostDisabled("notexample.com", ["example.com"])).toBe(false);
  });
});
