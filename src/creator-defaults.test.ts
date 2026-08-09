import { beforeEach, describe, expect, it } from "vitest";
import { creatorSiteForHostname, detectCreatorIds, findCreatorRule, normalizeCreatorInput, pageVideoKey } from "./creator-defaults";

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("creator defaults", () => {
  it("normalizes supported YouTube channel identifiers", () => {
    expect(normalizeCreatorInput("youtube", "https://www.youtube.com/@Example/videos")).toBe("@example");
    expect(normalizeCreatorInput("youtube", "UCabc_123")).toBe("UCabc_123");
    expect(normalizeCreatorInput("youtube", "a display name")).toBeNull();
  });

  it("normalizes Bilibili space URLs and UIDs", () => {
    expect(normalizeCreatorInput("bilibili", "https://space.bilibili.com/12345/video")).toBe("12345");
    expect(normalizeCreatorInput("bilibili", "67890")).toBe("67890");
    expect(normalizeCreatorInput("bilibili", "https://www.bilibili.com/video/BV1x")).toBeNull();
  });

  it("detects the YouTube owner without collecting unrelated channel links", () => {
    document.head.innerHTML = '<meta itemprop="channelId" content="UCstable">';
    document.body.innerHTML = '<ytd-watch-metadata><ytd-video-owner-renderer><a href="/@Example"></a></ytd-video-owner-renderer></ytd-watch-metadata>';
    expect(detectCreatorIds("youtube")).toEqual(["@example", "UCstable"]);
  });

  it("detects a Bilibili owner UID", () => {
    document.body.innerHTML = '<a class="up-name" href="https://space.bilibili.com/24680">Creator</a>';
    expect(detectCreatorIds("bilibili")).toEqual(["24680"]);
  });

  it("matches site-specific rules and stable video page keys", () => {
    const rules = [
      { site: "youtube" as const, creatorId: "@a", rate: 1.5 },
      { site: "bilibili" as const, creatorId: "123", rate: 2 }
    ];
    expect(findCreatorRule(rules, "bilibili", ["123"])?.rate).toBe(2);
    expect(pageVideoKey("youtube", new URL("https://youtube.com/watch?v=video-id&t=4"))).toBe("video-id");
    expect(pageVideoKey("bilibili", new URL("https://www.bilibili.com/video/BV123?p=2"))).toBe("BV123");
  });

  it("recognizes only supported video hosts", () => {
    expect(creatorSiteForHostname("www.youtube.com")).toBe("youtube");
    expect(creatorSiteForHostname("www.bilibili.com")).toBe("bilibili");
    expect(creatorSiteForHostname("example.com")).toBeNull();
  });
});
