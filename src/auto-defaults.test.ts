import { describe, expect, it } from "vitest";
import { findAutoSpeed } from "./auto-defaults";
import { normalizeSettings } from "./settings";

const settings = normalizeSettings({
  fallbackRates: { youtube: 1.25, bilibili: 1.5 },
  urlRules: [
    { prefix: "https://example.com/", rate: 1.75 },
    { prefix: "https://example.com/courses/", rate: 2 }
  ],
  creatorRules: [{ site: "youtube", creatorId: "@fast", rate: 2.5 }]
});

describe("automatic speed defaults", () => {
  it("prefers a channel rule over URL and site fallbacks", () => {
    const match = findAutoSpeed(settings, new URL("https://www.youtube.com/watch?v=abc"), ["@fast"]);
    expect(match).toMatchObject({ rate: 2.5, priority: 2 });
  });

  it("uses independently configured site fallbacks", () => {
    expect(findAutoSpeed(settings, new URL("https://www.youtube.com/watch?v=abc"), [])?.rate).toBe(1.25);
    expect(findAutoSpeed(settings, new URL("https://www.bilibili.com/video/BV123"), [])?.rate).toBe(1.5);
  });

  it("uses the longest matching custom URL prefix", () => {
    expect(findAutoSpeed(settings, new URL("https://example.com/courses/one/video"), [])).toMatchObject({
      rate: 2,
      priority: 1
    });
  });
});
