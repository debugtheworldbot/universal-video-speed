import { describe, expect, it, vi } from "vitest";
import {
  parseBilibiliCreatorResponse,
  parseYouTubeCreatorPage,
  resolveCreatorMetadata
} from "./creator-metadata";

describe("creator metadata", () => {
  it("extracts a stable YouTube channel ID and decoded display name", () => {
    const html = '<meta itemprop="channelId" content="UCabc_123"><meta property="og:title" content="Cats &amp; Dogs">';
    expect(parseYouTubeCreatorPage(html)).toEqual({ creatorId: "UCabc_123", creatorName: "Cats & Dogs" });
  });

  it("uses YouTube's current external ID field when channel metadata is absent", () => {
    const html = '<meta property="og:title" content="Example Channel"><script>{"externalId":"UCstable_123"}</script>';
    expect(parseYouTubeCreatorPage(html)).toEqual({ creatorId: "UCstable_123", creatorName: "Example Channel" });
  });

  it("parses a successful Bilibili creator response", () => {
    expect(parseBilibiliCreatorResponse({ code: 0, data: { mid: 24680, name: "Creator" } })).toEqual({
      creatorId: "24680",
      creatorName: "Creator"
    });
    expect(parseBilibiliCreatorResponse({ code: -404, data: null })).toBeNull();
  });

  it("resolves a YouTube handle through its official channel page", async () => {
    const fetcher = vi.fn(async () => new Response(
      '<meta itemprop="channelId" content="UCstable"><meta property="og:title" content="Example Channel">'
    ));

    await expect(resolveCreatorMetadata("youtube", "https://youtube.com/@Example/videos", fetcher)).resolves.toEqual({
      creatorId: "UCstable",
      creatorName: "Example Channel"
    });
    expect(fetcher).toHaveBeenCalledWith("https://www.youtube.com/@example", { credentials: "omit" });
  });
});
