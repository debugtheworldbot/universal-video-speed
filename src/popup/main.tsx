import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { findCreatorRule, type CreatorContext, type CreatorContextResponse } from "../creator-defaults";
import { localizeDocument, t } from "../i18n";
import { PLAYBACK_RATE_COMMAND_MESSAGE } from "../playback-badge";
import { normalizeSettings } from "../settings";
import "./popup.css";

const COMMON_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

function shortcutLabel(key: string): string {
  if (key === " ") return t("space_key");
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

async function readCreatorContext(): Promise<CreatorContext | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "get-creator-context" }) as CreatorContextResponse;
      if (response.status === "ready") return response.context;
      if (response.status === "unsupported") return null;
    } catch {
      return null;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
  return null;
}

async function saveCreatorRate(context: CreatorContext, rate: number | null): Promise<void> {
  const { settings: saved } = await chrome.storage.sync.get("settings");
  const settings = normalizeSettings(saved);
  const matchingIds = new Set(context.creatorIds);
  const existing = findCreatorRule(settings.creatorRules, context.site, context.creatorIds);
  const creatorRules = settings.creatorRules.filter(
    (rule) => rule.site !== context.site || !matchingIds.has(rule.creatorId)
  );

  if (rate !== null) {
    creatorRules.push({
      site: context.site,
      creatorId: existing?.creatorId ?? context.creatorId,
      creatorName: context.creatorName,
      rate
    });
  }
  await chrome.storage.sync.set({ settings: { ...settings, creatorRules } });
}

async function applyPlaybackRate(rate: number): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  await chrome.tabs.sendMessage(tab.id, {
    type: PLAYBACK_RATE_COMMAND_MESSAGE,
    rate,
    source: "popup"
  });
}

function Popup(): React.JSX.Element {
  const [context, setContext] = useState<CreatorContext | null | undefined>(undefined);
  const [rate, setRate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shortcuts, setShortcuts] = useState<Array<[string, number]>>([]);

  useEffect(() => {
    void Promise.all([readCreatorContext(), chrome.storage.sync.get("settings")]).then(async ([detected, { settings }]) => {
      const normalized = normalizeSettings(settings);
      setContext(detected);
      setShortcuts(Object.entries(normalized.shortcuts));
      if (detected) {
        const existing = findCreatorRule(normalized.creatorRules, detected.site, detected.creatorIds);
        setRate(existing?.rate ?? null);
        if (existing && existing.creatorName !== detected.creatorName) {
          const creatorRules = normalized.creatorRules.map((rule) =>
            rule === existing ? { ...rule, creatorName: detected.creatorName } : rule
          );
          await chrome.storage.sync.set({ settings: { ...normalized, creatorRules } });
        }
      }
    });
  }, []);

  const rateOptions = useMemo(() => {
    const rates = new Set(COMMON_RATES);
    if (rate !== null) rates.add(rate);
    return [...rates].sort((a, b) => a - b);
  }, [rate]);

  async function changeRate(value: string): Promise<void> {
    if (!context) return;
    const nextRate = value === "" ? null : Number(value);
    setRate(nextRate);
    setSaving(true);
    setSaved(false);
    try {
      await saveCreatorRate(context, nextRate);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1_500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="popup-shell">
      {context === undefined ? (
        <section className="state-card loading" aria-live="polite">
          <span className="scan-line" />
          <p>{t("detecting_creator")}</p>
        </section>
      ) : context ? (
        <section className="creator-card">
          <div className="platform-line">
            <span className={`platform-dot ${context.site}`} />
            <span>{context.site === "youtube" ? t("youtube_channel") : t("bilibili_creator")}</span>
            <span className={saving || saved ? "save-state visible" : "save-state"}>{saving ? t("saving") : t("saved")}</span>
          </div>
          <h1>{context.creatorName}</h1>
          <p className="creator-id">{context.creatorId}</p>

          <label className="rate-control">
            <span>{t("default_speed")}</span>
            <span className="select-wrap">
              <select value={rate ?? ""} disabled={saving} onChange={(event) => void changeRate(event.target.value)}>
                <option value="">{t("not_set")}</option>
                {rateOptions.map((option) => <option key={option} value={option}>{option}×</option>)}
              </select>
            </span>
          </label>
          <p className="note">{t("creator_change_note")}</p>
        </section>
      ) : (
        <section className="state-card">
          <p className="state-kicker">{t("no_creator_detected")}</p>
          <h1>{t("open_supported_video")}</h1>
          <p>{t("popup_recognition_hint")}</p>
        </section>
      )}

      <section className="shortcut-summary" aria-labelledby="shortcut-summary-title">
        <div className="shortcut-heading">
          <h2 id="shortcut-summary-title">{t("shortcuts_title")}</h2>
          <span>{t("key_speed_label")}</span>
        </div>
        <div className="shortcut-grid">
          {shortcuts.map(([key, shortcutRate]) => (
            <button
              className="shortcut-item"
              key={key}
              type="button"
              aria-label={t("shortcut_speed_aria", [shortcutLabel(key), String(shortcutRate)])}
              onClick={() => {
                void applyPlaybackRate(shortcutRate).then(() => window.close()).catch((error: unknown) => {
                  console.error("[Universal Video Speed] popup failed to apply playback rate", error);
                });
              }}
            >
              <kbd>{shortcutLabel(key)}</kbd>
              <span>{shortcutRate}×</span>
            </button>
          ))}
        </div>
      </section>

      <button className="settings-link" type="button" onClick={() => {
        void chrome.runtime.openOptionsPage();
        window.close();
      }}>
        <span>{t("all_settings")}</span><span aria-hidden="true">↗</span>
      </button>
    </main>
  );
}

localizeDocument();
createRoot(document.getElementById("root")!).render(<Popup />);
