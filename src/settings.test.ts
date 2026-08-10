import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, isHostDisabled, normalizeSettings, normalizeUrlPrefix } from "./settings";

describe("settings", () => {
  it("includes the default 1.75x shortcut", () => {
    expect(DEFAULT_SETTINGS.shortcuts["7"]).toBe(1.75);
  });

  it("falls back to defaults for invalid shortcut mappings", () => {
    expect(normalizeSettings({ shortcuts: { Shift: 2, "1": 0.1 } }).shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
  });

  it("retains valid custom shortcuts", () => {
    expect(normalizeSettings({ shortcuts: { q: 1.25, ArrowUp: 2 } }).shortcuts).toEqual({ q: 1.25, ArrowUp: 2 });
  });

  it("retains valid creator defaults and removes invalid ones", () => {
    const settings = normalizeSettings({
      creatorRules: [
        { site: "youtube", creatorId: "@creator", creatorName: "Creator", rate: 1.5 },
        { site: "bilibili", creatorId: "123", rate: 2 },
        { site: "vimeo", creatorId: "bad", rate: 2 },
        { site: "youtube", creatorId: "@invalid-name", creatorName: 123, rate: 2 },
        { site: "youtube", creatorId: "bad-rate", rate: 20 }
      ]
    });
    expect(settings.creatorRules).toEqual([
      { site: "youtube", creatorId: "@creator", creatorName: "Creator", rate: 1.5 },
      { site: "bilibili", creatorId: "123", rate: 2 }
    ]);
  });

  it("matches exact hosts and their subdomains", () => {
    expect(isHostDisabled("video.example.com", ["example.com"])).toBe(true);
    expect(isHostDisabled("notexample.com", ["example.com"])).toBe(false);
  });

  it("retains valid fallback and URL-prefix rules", () => {
    const settings = normalizeSettings({
      fallbackRates: { youtube: 1.5, bilibili: 20 },
      urlRules: [
        { prefix: "https://example.com/path", rate: 2 },
        { prefix: "javascript:alert(1)", rate: 2 },
        { prefix: "https://example.com/slow", rate: 20 }
      ]
    });
    expect(settings.fallbackRates).toEqual({ youtube: 1.5 });
    expect(settings.urlRules).toEqual([{ prefix: "https://example.com/path", rate: 2 }]);
  });

  it("normalizes safe HTTP URL prefixes", () => {
    expect(normalizeUrlPrefix(" https://EXAMPLE.com/path#part ")).toBe("https://example.com/path");
    expect(normalizeUrlPrefix("example.com/path")).toBeNull();
    expect(normalizeUrlPrefix("https://user:pass@example.com/")).toBeNull();
  });
});
