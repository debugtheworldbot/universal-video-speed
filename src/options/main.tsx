import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_SETTINGS, normalizeSettings, type ShortcutMapping } from "../settings";
import "./options.css";

type Row = { id: string; key: string; rate: string };

function mappingToRows(mapping: ShortcutMapping): Row[] {
  return Object.entries(mapping).map(([key, rate], index) => ({ id: `${key}-${index}`, key, rate: String(rate) }));
}

function Options(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(mappingToRows(DEFAULT_SETTINGS.shortcuts));
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void chrome.storage.sync.get("settings").then(({ settings }) => {
      setRows(mappingToRows(normalizeSettings(settings).shortcuts));
      setLoaded(true);
    });
  }, []);

  const error = useMemo(() => {
    const keys = rows.map((row) => row.key);
    if (rows.length === 0) return "Add at least one shortcut.";
    if (rows.some((row) => !/^\d$/.test(row.key))) return "Shortcuts must be one number key (0–9).";
    if (new Set(keys).size !== keys.length) return "Each number key can only be used once.";
    if (rows.some((row) => !Number.isFinite(Number(row.rate)) || Number(row.rate) < 0.25 || Number(row.rate) > 16)) {
      return "Speed must be between 0.25× and 16×.";
    }
    return "";
  }, [rows]);

  function updateRow(id: string, patch: Partial<Row>): void {
    setStatus("idle");
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function save(): Promise<void> {
    if (error) return;
    const shortcuts = Object.fromEntries(rows.map((row) => [row.key, Number(row.rate)]));
    const { settings } = await chrome.storage.sync.get("settings");
    const current = normalizeSettings(settings);
    await chrome.storage.sync.set({ settings: { ...current, shortcuts } });
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 1_800);
  }

  return (
    <main className="page">
      <section className="hero" aria-labelledby="page-title">
        <div className="mark" aria-hidden="true">UV</div>
        <p className="eyebrow">Universal Video Speed</p>
        <h1 id="page-title">One key.<br />Any video.</h1>
        <p className="lede">Choose the number keys that feel natural. Changes sync across your Chrome browsers.</p>
      </section>

      <section className="settings" aria-labelledby="shortcuts-title">
        <div className="section-heading">
          <div>
            <p className="index">01</p>
            <h2 id="shortcuts-title">Shortcuts</h2>
          </div>
          <p className="hint">Works when you’re not typing in a field.</p>
        </div>

        <div className="table" aria-busy={!loaded}>
          <div className="table-header"><span>Number key</span><span>Playback speed</span><span /></div>
          {rows.map((row) => (
            <div className="shortcut-row" key={row.id}>
              <label>
                <span className="sr-only">Number key</span>
                <input className="key-input" inputMode="numeric" maxLength={1} value={row.key}
                  onChange={(event) => updateRow(row.id, { key: event.target.value })} />
              </label>
              <label className="rate-wrap">
                <span className="sr-only">Playback speed</span>
                <input type="number" min="0.25" max="16" step="0.05" value={row.rate}
                  onChange={(event) => updateRow(row.id, { rate: event.target.value })} />
                <span>×</span>
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

        <div className="footer">
          <p className={error ? "message error" : "message"} role="status">{error || (status === "saved" ? "Saved. Ready everywhere." : "")}</p>
          <button className="save" type="button" disabled={Boolean(error) || !loaded} onClick={() => void save()}>
            {status === "saved" ? "Saved" : "Save changes"}
          </button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Options />);
