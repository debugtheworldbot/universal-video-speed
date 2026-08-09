import englishMessages from "../public/_locales/en/messages.json";
import simplifiedChineseMessages from "../public/_locales/zh_CN/messages.json";
import { describe, expect, it, vi } from "vitest";
import { localizeDocument, t } from "./i18n";

describe("localization", () => {
  it("keeps the English and Simplified Chinese message catalogs in sync", () => {
    expect(Object.keys(simplifiedChineseMessages).sort()).toEqual(Object.keys(englishMessages).sort());
    expect(Object.values(simplifiedChineseMessages).every(({ message }) => message.length > 0)).toBe(true);
    expect(simplifiedChineseMessages.creator_defaults_title.message).toBe("频道指定速度");
    expect(simplifiedChineseMessages.creator_defaults_hint.message).toBe("设定频道的视频加载时自动应用。通过点击右上角的图标设置最方便。");
  });

  it("reads messages from the browser locale and updates the document", () => {
    const getMessage = vi.fn((name: string) => name === "extension_name" ? "通用视频变速" : "");
    vi.stubGlobal("chrome", {
      i18n: {
        getMessage,
        getUILanguage: () => "zh-CN"
      }
    });

    expect(t("extension_name")).toBe("通用视频变速");
    localizeDocument();
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.title).toBe("通用视频变速");

    vi.unstubAllGlobals();
  });
});
