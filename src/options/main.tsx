import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { normalizeCreatorInput } from "../creator-defaults";
import { DEFAULT_SETTINGS, isSupportedShortcutKey, normalizeSettings, type CreatorSite, type CreatorSpeedRule, type ShortcutMapping } from "../settings";
import "./options.css";

type Row = { id: string; key: string; rate: string };
type CreatorRow = { id: string; site: CreatorSite; creator: string; rate: string };

function mappingToRows(mapping: ShortcutMapping): Row[] {
  return Object.entries(mapping).map(([key, rate], index) => ({ id: `${key}-${index}`, key, rate: String(rate) }));
}

function rulesToRows(rules: CreatorSpeedRule[]): CreatorRow[] {
  return rules.map((rule, index) => ({ id: `${rule.site}-${rule.creatorId}-${index}`, site: rule.site, creator: rule.creatorId, rate: String(rule.rate) }));
}

function shortcutLabel(key: string): string {
  if (key === " ") return "Space";
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function Options(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(mappingToRows(DEFAULT_SETTINGS.shortcuts));
  const [creatorRows, setCreatorRows] = useState<CreatorRow[]>(rulesToRows(DEFAULT_SETTINGS.creatorRules));
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void chrome.storage.sync.get("settings").then(({ settings }) => {
      const normalized = normalizeSettings(settings);
      setRows(mappingToRows(normalized.shortcuts));
      setCreatorRows(rulesToRows(normalized.creatorRules));
      setLoaded(true);
    });
  }, []);

  const error = useMemo(() => {
    const keys = rows.map((row) => row.key);
    if (rows.length === 0) return "Add at least one shortcut.";
    if (rows.some((row) => !isSupportedShortcutKey(row.key))) return "Choose a shortcut for every row.";
    if (new Set(keys).size !== keys.length) return "Each shortcut can only be used once.";
    if (rows.some((row) => !Number.isFinite(Number(row.rate)) || Number(row.rate) < 0.25 || Number(row.rate) > 16)) {
      return "Speed must be between 0.25× and 16×.";
    }
    return "";
  }, [rows]);

  const creatorError = useMemo(() => {
    const normalizedIds = creatorRows.map((row) => normalizeCreatorInput(row.site, row.creator));
    if (normalizedIds.some((id) => !id)) return "Use a YouTube channel URL, @handle, channel ID, or a Bilibili space URL/UID.";
    const keys = creatorRows.map((row, index) => `${row.site}:${normalizedIds[index]}`);
    if (new Set(keys).size !== keys.length) return "Each creator can only have one default speed.";
    if (creatorRows.some((row) => !Number.isFinite(Number(row.rate)) || Number(row.rate) < 0.25 || Number(row.rate) > 16)) {
      return "Creator speed must be between 0.25× and 16×.";
    }
    return "";
  }, [creatorRows]);

  function updateRow(id: string, patch: Partial<Row>): void {
    setStatus("idle");
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateCreatorRow(id: string, patch: Partial<CreatorRow>): void {
    setStatus("idle");
    setCreatorRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function save(): Promise<void> {
    if (error || creatorError) return;
    const shortcuts = Object.fromEntries(rows.map((row) => [row.key, Number(row.rate)]));
    const creatorRules: CreatorSpeedRule[] = creatorRows.map((row) => ({
      site: row.site,
      creatorId: normalizeCreatorInput(row.site, row.creator)!,
      rate: Number(row.rate)
    }));
    const { settings } = await chrome.storage.sync.get("settings");
    const current = normalizeSettings(settings);
    await chrome.storage.sync.set({ settings: { ...current, shortcuts, creatorRules } });
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 1_800);
  }

  return (
    <main className="page">
      <section className="hero" aria-labelledby="page-title">
        <div className="mark" aria-hidden="true">UV</div>
        <p className="eyebrow">Universal Video Speed</p>
        <h1 id="page-title">One key.<br />Any video.</h1>
        <p className="lede">Choose the shortcuts that feel natural. Changes sync across your Chrome browsers.</p>
      </section>

      <section className="settings" aria-labelledby="shortcuts-title">
        <div className="section-heading">
          <h2 id="shortcuts-title">Shortcuts</h2>
          <p className="hint">Works when you’re not typing in a field.</p>
        </div>

        <div className="table" aria-busy={!loaded}>
          <div className="table-header"><span>Shortcut</span><span>Playback speed</span><span /></div>
          {rows.map((row) => (
            <div className="shortcut-row" key={row.id}>
              <label>
                <span className="sr-only">Shortcut</span>
                <input className="key-input" value={shortcutLabel(row.key)} placeholder="Press a key" readOnly
                  onKeyDown={(event) => {
                    if (!isSupportedShortcutKey(event.key)) return;
                    event.preventDefault();
                    updateRow(row.id, { key: event.key });
                    event.currentTarget.blur();
                  }} />
              </label>
              <label className="rate-wrap">
                <span className="sr-only">Playback speed</span>
                <input type="number" min="0.25" max="16" step="0.05" value={row.rate}
                  onChange={(event) => updateRow(row.id, { rate: event.target.value })} />
              </label>
              <button className="remove" type="button" aria-label={`Remove shortcut ${row.key}`}
                onClick={() => { setStatus("idle"); setRows((current) => current.filter(({ id }) => id !== row.id)); }}>×</button>
            </div>
          ))}
        </div>

        <button className="add" type="button" onClick={() => {
          setStatus("idle");
          setRows((current) => [...current, { id: crypto.randomUUID(), key: "", rate: "1" }]);
        }}>+ Add shortcut</button>

        <div className="settings-block">
          <div className="section-heading">
            <h2 id="creators-title">Creator defaults</h2>
            <p className="hint">Applied once when a creator’s video loads.</p>
          </div>

          <div className="table creator-table" aria-labelledby="creators-title" aria-busy={!loaded}>
            <div className="table-header"><span>Platform</span><span>Channel / creator</span><span>Speed</span><span /></div>
            {creatorRows.map((row) => (
              <div className="creator-row" key={row.id}>
                <label>
                  <span className="sr-only">Platform</span>
                  <select value={row.site} onChange={(event) => updateCreatorRow(row.id, { site: event.target.value as CreatorSite, creator: "" })}>
                    <option value="youtube">YouTube</option>
                    <option value="bilibili">Bilibili</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Channel or creator URL/ID</span>
                  <input className="creator-input" value={row.creator}
                    placeholder={row.site === "youtube" ? "URL, @handle, or channel ID" : "Space URL or UID"}
                    onChange={(event) => updateCreatorRow(row.id, { creator: event.target.value })} />
                </label>
                <label>
                  <span className="sr-only">Default playback speed</span>
                  <input type="number" min="0.25" max="16" step="0.05" value={row.rate}
                    onChange={(event) => updateCreatorRow(row.id, { rate: event.target.value })} />
                </label>
                <button className="remove" type="button" aria-label={`Remove creator ${row.creator}`}
                  onClick={() => { setStatus("idle"); setCreatorRows((current) => current.filter(({ id }) => id !== row.id)); }}>×</button>
              </div>
            ))}
          </div>

          <button className="add" type="button" onClick={() => {
            setStatus("idle");
            setCreatorRows((current) => [...current, { id: crypto.randomUUID(), site: "youtube", creator: "", rate: "1.5" }]);
          }}>+ Add creator default</button>
        </div>

        <div className="footer">
          <p className={error || creatorError ? "message error" : "message"} role="status">{error || creatorError || (status === "saved" ? "Saved. Ready everywhere." : "")}</p>
          <button className="save" type="button" disabled={Boolean(error || creatorError) || !loaded} onClick={() => void save()}>
            {status === "saved" ? "Saved" : "Save changes"}
          </button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Options />);
