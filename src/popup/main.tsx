import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { findCreatorRule, type CreatorContext, type CreatorContextResponse } from "../creator-defaults";
import { normalizeSettings, type CreatorSpeedRule } from "../settings";
import "./popup.css";

const COMMON_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

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
      rate
    });
  }
  await chrome.storage.sync.set({ settings: { ...settings, creatorRules } });
}

function Popup(): React.JSX.Element {
  const [context, setContext] = useState<CreatorContext | null | undefined>(undefined);
  const [rate, setRate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void Promise.all([readCreatorContext(), chrome.storage.sync.get("settings")]).then(([detected, { settings }]) => {
      setContext(detected);
      if (detected) {
        setRate(findCreatorRule(normalizeSettings(settings).creatorRules, detected.site, detected.creatorIds)?.rate ?? null);
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
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">UV</span>
        <span>Universal Video Speed</span>
      </header>

      {context === undefined ? (
        <section className="state-card loading" aria-live="polite">
          <span className="scan-line" />
          <p>Detecting creator…</p>
        </section>
      ) : context ? (
        <section className="creator-card">
          <div className="platform-line">
            <span className={`platform-dot ${context.site}`} />
            <span>{context.site === "youtube" ? "YouTube channel" : "Bilibili creator"}</span>
            <span className={saving || saved ? "save-state visible" : "save-state"}>{saving ? "Saving" : "Saved"}</span>
          </div>
          <h1>{context.creatorName}</h1>
          <p className="creator-id">{context.creatorId}</p>

          <label className="rate-control">
            <span>Default speed</span>
            <span className="select-wrap">
              <select value={rate ?? ""} disabled={saving} onChange={(event) => void changeRate(event.target.value)}>
                <option value="">Not set</option>
                {rateOptions.map((option) => <option key={option} value={option}>{option}×</option>)}
              </select>
            </span>
          </label>
          <p className="note">Changes apply to this video now and to future videos from this creator.</p>
        </section>
      ) : (
        <section className="state-card">
          <p className="state-kicker">No creator detected</p>
          <h1>Open a YouTube or Bilibili video.</h1>
          <p>The popup will recognize the channel automatically.</p>
        </section>
      )}

      <button className="settings-link" type="button" onClick={() => {
        void chrome.runtime.openOptionsPage();
        window.close();
      }}>
        <span>All settings</span><span aria-hidden="true">↗</span>
      </button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
