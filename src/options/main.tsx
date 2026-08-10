import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { normalizeCreatorInput } from "../creator-defaults";
import { resolveCreatorMetadata } from "../creator-metadata";
import { localizeDocument, t } from "../i18n";
import {
  DEFAULT_SETTINGS,
  isSupportedShortcutKey,
  normalizeSettings,
  normalizeUrlPrefix,
  type CreatorSite,
  type CreatorSpeedRule,
  type ShortcutMapping,
  type UrlSpeedRule
} from "../settings";
import "./options.css";

type Row = { id: string; key: string; rate: string };
type UrlRow = { id: string; prefix: string; rate: string };
type CreatorResolution = "idle" | "resolving" | "resolved" | "error";
type CreatorRow = {
  id: string;
  site: CreatorSite;
  creator: string;
  creatorName: string;
  rate: string;
  resolution: CreatorResolution;
};
type CreatorEditor = { sourceId: string | null; row: CreatorRow };
type RemovedItem =
  | { kind: "shortcut"; row: Row; index: number }
  | { kind: "creator"; row: CreatorRow; index: number }
  | { kind: "url"; row: UrlRow; index: number };

function mappingToRows(mapping: ShortcutMapping): Row[] {
  return Object.entries(mapping).map(([key, rate], index) => ({ id: `${key}-${index}`, key, rate: String(rate) }));
}

function rulesToRows(rules: CreatorSpeedRule[]): CreatorRow[] {
  return rules.map((rule, index) => ({
    id: `${rule.site}-${rule.creatorId}-${index}`,
    site: rule.site,
    creator: rule.creatorId,
    creatorName: rule.creatorName ?? "",
    rate: String(rule.rate),
    resolution: rule.creatorName ? "resolved" : "idle"
  }));
}

function urlRulesToRows(rules: UrlSpeedRule[]): UrlRow[] {
  return rules.map((rule, index) => ({ id: `${rule.prefix}-${index}`, prefix: rule.prefix, rate: String(rule.rate) }));
}

function shortcutLabel(key: string): string {
  if (key === " ") return t("space_key");
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function settingsFingerprint(
  rows: Row[],
  creatorRows: CreatorRow[],
  fallbackRates: Record<CreatorSite, string>,
  urlRows: UrlRow[]
): string {
  return JSON.stringify({
    shortcuts: rows.map(({ key, rate }) => ({ key, rate })),
    creators: creatorRows.map(({ site, creator, creatorName, rate }) => ({ site, creator, creatorName, rate })),
    fallbackRates,
    urls: urlRows.map(({ prefix, rate }) => ({ prefix, rate }))
  });
}

function Options(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(mappingToRows(DEFAULT_SETTINGS.shortcuts));
  const [creatorRows, setCreatorRows] = useState<CreatorRow[]>(rulesToRows(DEFAULT_SETTINGS.creatorRules));
  const [fallbackRates, setFallbackRates] = useState<Record<CreatorSite, string>>({ youtube: "", bilibili: "" });
  const [urlRows, setUrlRows] = useState<UrlRow[]>(urlRulesToRows(DEFAULT_SETTINGS.urlRules));
  const [creatorEditor, setCreatorEditor] = useState<CreatorEditor | null>(null);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [urlRulesOpen, setUrlRulesOpen] = useState(false);
  const [removedItem, setRemovedItem] = useState<RemovedItem | null>(null);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [loaded, setLoaded] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void chrome.storage.sync.get("settings").then(({ settings }) => {
      const normalized = normalizeSettings(settings);
      const nextRows = mappingToRows(normalized.shortcuts);
      const nextCreatorRows = rulesToRows(normalized.creatorRules);
      const nextFallbackRates = {
        youtube: normalized.fallbackRates.youtube === undefined ? "" : String(normalized.fallbackRates.youtube),
        bilibili: normalized.fallbackRates.bilibili === undefined ? "" : String(normalized.fallbackRates.bilibili)
      };
      const nextUrlRows = urlRulesToRows(normalized.urlRules);
      setRows(nextRows);
      setCreatorRows(nextCreatorRows);
      setFallbackRates(nextFallbackRates);
      setUrlRows(nextUrlRows);
      setUrlRulesOpen(nextUrlRows.length > 0);
      setSavedFingerprint(settingsFingerprint(nextRows, nextCreatorRows, nextFallbackRates, nextUrlRows));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const editor = creatorEditor;
    if (!editor || editor.row.resolution !== "idle" || !normalizeCreatorInput(editor.row.site, editor.row.creator)) return;

    const requestedSite = editor.row.site;
    const requestedCreator = editor.row.creator;
    const timer = window.setTimeout(() => {
      setCreatorEditor((current) => current ? { ...current, row: { ...current.row, resolution: "resolving" } } : null);
      void resolveCreatorMetadata(requestedSite, requestedCreator).then((metadata) => {
        setCreatorEditor((current) => {
          if (!current || current.row.site !== requestedSite || current.row.creator !== requestedCreator) return current;
          if (!metadata) return { ...current, row: { ...current.row, resolution: "error" } };
          return {
            ...current,
            row: {
              ...current.row,
              creator: metadata.creatorId,
              creatorName: metadata.creatorName,
              resolution: "resolved"
            }
          };
        });
      }).catch(() => {
        setCreatorEditor((current) =>
          current && current.row.site === requestedSite && current.row.creator === requestedCreator
            ? { ...current, row: { ...current.row, resolution: "error" } }
            : current
        );
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [creatorEditor]);

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

  const error = useMemo(() => {
    const keys = rows.map((row) => row.key);
    if (rows.length === 0) return t("error_shortcut_required");
    if (rows.some((row) => !isSupportedShortcutKey(row.key))) return t("error_shortcut_missing");
    if (new Set(keys).size !== keys.length) return t("error_shortcut_duplicate");
    if (rows.some((row) => !Number.isFinite(Number(row.rate)) || Number(row.rate) < 0.25 || Number(row.rate) > 16)) {
      return t("error_speed_range");
    }
    return "";
  }, [rows]);

  const creatorError = useMemo(() => {
    const normalizedIds = creatorRows.map((row) => normalizeCreatorInput(row.site, row.creator));
    if (normalizedIds.some((id) => !id)) return t("error_creator_invalid");
    const keys = creatorRows.map((row, index) => `${row.site}:${normalizedIds[index]}`);
    if (new Set(keys).size !== keys.length) return t("error_creator_duplicate");
    if (creatorRows.some((row) => !Number.isFinite(Number(row.rate)) || Number(row.rate) < 0.25 || Number(row.rate) > 16)) {
      return t("error_creator_speed_range");
    }
    return "";
  }, [creatorRows]);

  const creatorEditorError = useMemo(() => {
    if (!creatorEditor) return "";
    const normalizedId = normalizeCreatorInput(creatorEditor.row.site, creatorEditor.row.creator);
    if (!normalizedId) return t("error_creator_invalid");
    const duplicate = creatorRows.some((row) =>
      row.id !== creatorEditor.sourceId
      && row.site === creatorEditor.row.site
      && normalizeCreatorInput(row.site, row.creator) === normalizedId
    );
    if (duplicate) return t("error_creator_duplicate");
    const rate = Number(creatorEditor.row.rate);
    if (!Number.isFinite(rate) || rate < 0.25 || rate > 16) return t("error_creator_speed_range");
    return "";
  }, [creatorEditor, creatorRows]);

  const fallbackError = useMemo(() => {
    const values = Object.values(fallbackRates).filter((value) => value !== "");
    return values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0.25 || Number(value) > 16)
      ? t("error_fallback_speed_range")
      : "";
  }, [fallbackRates]);

  const urlError = useMemo(() => {
    const prefixes = urlRows.map((row) => normalizeUrlPrefix(row.prefix));
    if (prefixes.some((prefix) => !prefix)) return t("error_url_prefix_invalid");
    if (new Set(prefixes).size !== prefixes.length) return t("error_url_prefix_duplicate");
    if (urlRows.some((row) => !Number.isFinite(Number(row.rate)) || Number(row.rate) < 0.25 || Number(row.rate) > 16)) {
      return t("error_url_speed_range");
    }
    return "";
  }, [urlRows]);

  const currentFingerprint = useMemo(
    () => settingsFingerprint(rows, creatorRows, fallbackRates, urlRows),
    [rows, creatorRows, fallbackRates, urlRows]
  );
  const dirty = loaded && savedFingerprint !== currentFingerprint;
  const visibleCreatorRows = useMemo(() => {
    const query = creatorQuery.trim().toLocaleLowerCase();
    if (!query) return creatorRows;
    return creatorRows.filter((row) =>
      `${row.site} ${row.creatorName} ${row.creator}`.toLocaleLowerCase().includes(query)
    );
  }, [creatorQuery, creatorRows]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  function markChanged(): void {
    setStatus("idle");
  }

  function updateRow(id: string, patch: Partial<Row>): void {
    markChanged();
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateUrlRow(id: string, patch: Partial<UrlRow>): void {
    markChanged();
    setUrlRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateCreatorEditor(patch: Partial<CreatorRow>): void {
    setCreatorEditor((current) => current ? { ...current, row: { ...current.row, ...patch } } : null);
  }

  function finishCreatorEdit(): void {
    if (!creatorEditor || creatorEditorError || creatorEditor.row.resolution === "resolving") return;
    const normalizedId = normalizeCreatorInput(creatorEditor.row.site, creatorEditor.row.creator)!;
    const nextRow = {
      ...creatorEditor.row,
      creator: normalizedId,
      creatorName: creatorEditor.row.creatorName.trim()
    };
    markChanged();
    setCreatorRows((current) => creatorEditor.sourceId
      ? current.map((row) => row.id === creatorEditor.sourceId ? nextRow : row)
      : [...current, nextRow]
    );
    setCreatorEditor(null);
  }

  function showUndo(item: RemovedItem): void {
    setRemovedItem(item);
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setRemovedItem(null), 5_000);
  }

  function removeShortcut(id: string): void {
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return;
    markChanged();
    showUndo({ kind: "shortcut", row: rows[index], index });
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function removeCreator(id: string): void {
    const index = creatorRows.findIndex((row) => row.id === id);
    if (index < 0) return;
    markChanged();
    showUndo({ kind: "creator", row: creatorRows[index], index });
    setCreatorRows((current) => current.filter((row) => row.id !== id));
    if (creatorEditor?.sourceId === id) setCreatorEditor(null);
  }

  function removeUrl(id: string): void {
    const index = urlRows.findIndex((row) => row.id === id);
    if (index < 0) return;
    markChanged();
    showUndo({ kind: "url", row: urlRows[index], index });
    setUrlRows((current) => current.filter((row) => row.id !== id));
  }

  function undoRemove(): void {
    if (!removedItem) return;
    markChanged();
    const restore = <T,>(current: T[], row: T, index: number): T[] => {
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, row);
      return next;
    };
    if (removedItem.kind === "shortcut") {
      setRows((current) => restore(current, removedItem.row, removedItem.index));
    } else if (removedItem.kind === "creator") {
      setCreatorRows((current) => restore(current, removedItem.row, removedItem.index));
    } else {
      setUrlRows((current) => restore(current, removedItem.row, removedItem.index));
    }
    setRemovedItem(null);
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }

  async function save(): Promise<void> {
    if (error || creatorError || fallbackError || urlError || creatorEditor) return;
    const shortcuts = Object.fromEntries(rows.map((row) => [row.key, Number(row.rate)]));
    const creatorRules: CreatorSpeedRule[] = creatorRows.map((row) => ({
      site: row.site,
      creatorId: normalizeCreatorInput(row.site, row.creator)!,
      ...(row.creatorName.trim() ? { creatorName: row.creatorName.trim() } : {}),
      rate: Number(row.rate)
    }));
    const nextFallbackRates = Object.fromEntries(
      (Object.entries(fallbackRates) as Array<[CreatorSite, string]>)
        .filter(([, rate]) => rate !== "")
        .map(([site, rate]) => [site, Number(rate)])
    );
    const urlRules: UrlSpeedRule[] = urlRows.map((row) => ({
      prefix: normalizeUrlPrefix(row.prefix)!,
      rate: Number(row.rate)
    }));
    const { settings } = await chrome.storage.sync.get("settings");
    const current = normalizeSettings(settings);
    await chrome.storage.sync.set({ settings: { ...current, shortcuts, creatorRules, fallbackRates: nextFallbackRates, urlRules } });
    setSavedFingerprint(currentFingerprint);
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 1_800);
  }

  async function discardChanges(): Promise<void> {
    const { settings } = await chrome.storage.sync.get("settings");
    const normalized = normalizeSettings(settings);
    const nextRows = mappingToRows(normalized.shortcuts);
    const nextCreatorRows = rulesToRows(normalized.creatorRules);
    const nextFallbackRates = {
      youtube: normalized.fallbackRates.youtube === undefined ? "" : String(normalized.fallbackRates.youtube),
      bilibili: normalized.fallbackRates.bilibili === undefined ? "" : String(normalized.fallbackRates.bilibili)
    };
    const nextUrlRows = urlRulesToRows(normalized.urlRules);
    setRows(nextRows);
    setCreatorRows(nextCreatorRows);
    setFallbackRates(nextFallbackRates);
    setUrlRows(nextUrlRows);
    setSavedFingerprint(settingsFingerprint(nextRows, nextCreatorRows, nextFallbackRates, nextUrlRows));
    setCreatorEditor(null);
    setRemovedItem(null);
    setStatus("idle");
  }

  const globalError = error || creatorError || fallbackError || urlError;

  return (
    <main className="page">
      <header className="hero" aria-labelledby="page-title">
        <img className="extension-icon" src="/icons/icon-128.png" alt="" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow" translate="no">{t("extension_name")}</p>
          <h1 id="page-title">{t("settings_title")}</h1>
          <p className="lede">{t("settings_lede")}</p>
        </div>
      </header>

      <div className="settings-shell">
        <nav className="section-nav" aria-label={t("settings_navigation")}>
          <a href="#shortcuts"><span>01</span>{t("shortcuts_title")}</a>
          <a href="#automatic"><span>02</span>{t("automatic_speed_title")}</a>
          <a href="#compatibility"><span>03</span>{t("compatibility_title")}</a>
        </nav>

        <div className="settings-content">
          <section className="setting-section" id="shortcuts" aria-labelledby="shortcuts-title">
            <div className="section-heading">
              <div>
                <p className="section-index" aria-hidden="true">01 / CONTROL</p>
                <h2 id="shortcuts-title">{t("shortcuts_title")}</h2>
              </div>
              <p>{t("shortcuts_hint")}</p>
            </div>

            <div className="map-list" aria-busy={!loaded}>
              <div className="shortcut-list-header" aria-hidden="true">
                <div className="shortcut-column-header">
                  <span>{t("key_label")}</span><span /><span>{t("speed_label")}</span><span />
                </div>
                <div className="shortcut-column-header">
                  <span>{t("key_label")}</span><span /><span>{t("speed_label")}</span><span />
                </div>
              </div>
              <div className="shortcut-grid">
                {rows.map((row, index) => (
                  <div className="map-row" key={row.id}>
                    <label className="key-field">
                      <span className="sr-only">{t("shortcut_key_number", String(index + 1))}</span>
                      <input
                        className="key-input"
                        name={`shortcut-${index}`}
                        autoComplete="off"
                        value={shortcutLabel(row.key)}
                        placeholder={t("press_key")}
                        readOnly
                        onKeyDown={(event) => {
                          if (!isSupportedShortcutKey(event.key)) return;
                          event.preventDefault();
                          updateRow(row.id, { key: event.key });
                          event.currentTarget.blur();
                        }}
                      />
                    </label>
                    <span className="map-arrow" aria-hidden="true">→</span>
                    <label className="rate-field">
                      <span className="sr-only">{t("shortcut_speed_number", String(index + 1))}</span>
                      <input
                        type="number"
                        name={`shortcut-speed-${index}`}
                        autoComplete="off"
                        inputMode="decimal"
                        min="0.25"
                        max="16"
                        step="0.05"
                        value={row.rate}
                        onChange={(event) => updateRow(row.id, { rate: event.target.value })}
                      />
                    </label>
                    <button
                      className="icon-action"
                      type="button"
                      aria-label={t("remove_shortcut", row.key || t("empty_value"))}
                      onClick={() => removeShortcut(row.id)}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
            {error ? <p className="inline-error" role="alert">{error}</p> : null}
            <button
              className="text-action"
              type="button"
              onClick={() => {
                markChanged();
                setRows((current) => [...current, { id: crypto.randomUUID(), key: "", rate: "1" }]);
              }}
            >{t("add_shortcut")}</button>
          </section>

          <section className="setting-section" id="automatic" aria-labelledby="automatic-title">
            <div className="section-heading automatic-heading">
              <div>
                <p className="section-index" aria-hidden="true">02 / AUTOMATION</p>
                <h2 id="automatic-title">{t("automatic_speed_title")}</h2>
              </div>
              <p>{t("automatic_speed_hint")}</p>
            </div>

            <ol className="priority-flow" aria-label={t("priority_label")}>
              <li>{t("priority_manual")}</li>
              <li>{t("priority_creator")}</li>
              <li>{t("priority_url")}</li>
              <li>{t("priority_platform")}</li>
            </ol>

            <div className="subsection">
              <div className="subsection-heading">
                <div>
                  <h3>{t("fallback_defaults_title")}</h3>
                  <p>{t("fallback_defaults_hint")}</p>
                </div>
              </div>
              <div className="fallback-sites" aria-busy={!loaded}>
                {(["youtube", "bilibili"] as const).map((site) => (
                  <label className="fallback-site" key={site}>
                    <span className={`platform-dot ${site}`} aria-hidden="true" />
                    <span translate="no">{site === "youtube" ? "YouTube" : "Bilibili"}</span>
                    <input
                      type="number"
                      name={`${site}-fallback-speed`}
                      autoComplete="off"
                      inputMode="decimal"
                      min="0.25"
                      max="16"
                      step="0.05"
                      value={fallbackRates[site]}
                      placeholder={t("not_set")}
                      aria-label={t("site_fallback_speed", site === "youtube" ? "YouTube" : "Bilibili")}
                      onChange={(event) => {
                        markChanged();
                        setFallbackRates((current) => ({ ...current, [site]: event.target.value }));
                      }}
                    />
                    <span aria-hidden="true">×</span>
                  </label>
                ))}
              </div>
              {fallbackError ? <p className="inline-error" role="alert">{fallbackError}</p> : null}
            </div>

            <div className="subsection creator-subsection">
              <div className="subsection-heading creator-toolbar">
                <div>
                  <h3>{t("creator_defaults_title")}</h3>
                  <p>{t("creator_defaults_compact_hint", String(creatorRows.length))}</p>
                </div>
                <button
                  className="solid-action"
                  type="button"
                  disabled={creatorEditor !== null}
                  onClick={() => setCreatorEditor({
                    sourceId: null,
                    row: { id: crypto.randomUUID(), site: "youtube", creator: "", creatorName: "", rate: "1.5", resolution: "idle" }
                  })}
                >{t("add_creator")}</button>
              </div>

              {creatorRows.length > 6 ? (
                <label className="search-field">
                  <span className="sr-only">{t("search_creators")}</span>
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    name="creator-search"
                    autoComplete="off"
                    spellCheck={false}
                    value={creatorQuery}
                    placeholder={t("search_creators_placeholder")}
                    onChange={(event) => setCreatorQuery(event.target.value)}
                  />
                </label>
              ) : null}

              {creatorEditor?.sourceId === null ? (
                <CreatorEditorPanel
                  editor={creatorEditor}
                  error={creatorEditorError}
                  onChange={updateCreatorEditor}
                  onCancel={() => setCreatorEditor(null)}
                  onDone={finishCreatorEdit}
                />
              ) : null}

              <div className="creator-table-wrap" aria-busy={!loaded}>
                <table className="creator-table">
                  <thead>
                    <tr>
                      <th>{t("creator_label")}</th>
                      <th>{t("platform_label")}</th>
                      <th>{t("speed_label")}</th>
                      <th><span className="sr-only">{t("actions_label")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCreatorRows.map((row) => creatorEditor?.sourceId === row.id ? (
                      <tr className="editor-table-row" key={row.id}>
                        <td colSpan={4}>
                          <CreatorEditorPanel
                            editor={creatorEditor}
                            error={creatorEditorError}
                            onChange={updateCreatorEditor}
                            onCancel={() => setCreatorEditor(null)}
                            onDone={finishCreatorEdit}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.creatorName || row.creator}</strong>
                          {row.creatorName ? <span className="creator-id" translate="no">{row.creator}</span> : null}
                        </td>
                        <td><span className={`platform-chip ${row.site}`} translate="no">{row.site === "youtube" ? "YouTube" : "Bilibili"}</span></td>
                        <td><span className="rate-chip">{row.rate}×</span></td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              onClick={() => setCreatorEditor({ sourceId: row.id, row: { ...row } })}
                            >{t("edit")}</button>
                            <button className="danger-action" type="button" onClick={() => removeCreator(row.id)}>
                              {t("remove")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {creatorRows.length === 0 && creatorEditor === null ? (
                <div className="empty">
                  <p className="empty-title">{t("no_creator_defaults")}</p>
                  <p>{t("no_creator_defaults_body")}</p>
                </div>
              ) : null}
              {creatorRows.length > 0 && visibleCreatorRows.length === 0 ? (
                <div className="empty"><p className="empty-title">{t("no_search_results")}</p></div>
              ) : null}
              {creatorError ? <p className="inline-error" role="alert">{creatorError}</p> : null}
            </div>

            <details className="advanced" open={urlRulesOpen} onToggle={(event) => setUrlRulesOpen(event.currentTarget.open)}>
              <summary>
                <span>
                  <strong>{t("url_defaults_title")}</strong>
                  <small>{t("url_defaults_hint")}</small>
                </span>
                <span className="rule-count">{urlRows.length}</span>
              </summary>
              <div className="advanced-body">
                <div className="url-list-header" aria-hidden="true">
                  <span>{t("url_prefix_label")}</span><span /><span>{t("speed_label")}</span><span />
                </div>
                {urlRows.map((row, index) => (
                  <div className="url-row" key={row.id}>
                    <label>
                      <span className="sr-only">{t("url_prefix_number", String(index + 1))}</span>
                      <input
                        className="url-prefix-input"
                        type="url"
                        name={`url-prefix-${index}`}
                        autoComplete="off"
                        inputMode="url"
                        spellCheck={false}
                        value={row.prefix}
                        placeholder="https://example.com/videos/…"
                        onChange={(event) => updateUrlRow(row.id, { prefix: event.target.value })}
                      />
                    </label>
                    <span className="map-arrow" aria-hidden="true">→</span>
                    <label className="rate-field">
                      <span className="sr-only">{t("url_speed_number", String(index + 1))}</span>
                      <input
                        type="number"
                        name={`url-speed-${index}`}
                        autoComplete="off"
                        inputMode="decimal"
                        min="0.25"
                        max="16"
                        step="0.05"
                        value={row.rate}
                        onChange={(event) => updateUrlRow(row.id, { rate: event.target.value })}
                      />
                    </label>
                    <button
                      className="icon-action"
                      type="button"
                      aria-label={t("remove_url_prefix", row.prefix || t("empty_value"))}
                      onClick={() => removeUrl(row.id)}
                    >×</button>
                  </div>
                ))}
                {urlError ? <p className="inline-error" role="alert">{urlError}</p> : null}
                <button
                  className="text-action"
                  type="button"
                  onClick={() => {
                    markChanged();
                    setUrlRows((current) => [...current, { id: crypto.randomUUID(), prefix: "", rate: "1.5" }]);
                  }}
                >{t("add_url_prefix")}</button>
              </div>
            </details>
          </section>

          <section className="setting-section compatibility-section" id="compatibility" aria-labelledby="compatibility-title">
            <div className="section-heading">
              <div>
                <p className="section-index" aria-hidden="true">03 / HELP</p>
                <h2 id="compatibility-title">{t("compatibility_title")}</h2>
              </div>
              <p>{t("compatibility_hint")}</p>
            </div>
            <details className="compatibility-details">
              <summary>
                <span className="conflict-mark" aria-hidden="true">!</span>
                <span>
                  <strong>{t("shortcut_conflict_title")}</strong>
                  <small>{t("shortcut_conflict_kicker")}</small>
                </span>
              </summary>
              <div className="compatibility-body">
                <p>{t("shortcut_conflict_body")}</p>
                <dl className="conflict-rule">
                  <div><dt>{t("vimium_pattern_label")}</dt><dd><code>https?://*/*</code></dd></div>
                  <div><dt>{t("vimium_keys_label")}</dt><dd><code>{rows.map(({ key }) => shortcutLabel(key)).filter(Boolean).join(" ") || "—"}</code></dd></div>
                </dl>
              </div>
            </details>
          </section>
        </div>
      </div>

      {removedItem ? (
        <div className="undo-toast" role="status">
          <span>{t("rule_removed")}</span>
          <button type="button" onClick={undoRemove}>{t("undo")}</button>
        </div>
      ) : null}

      {(dirty || status === "saved") ? (
        <footer className="save-dock">
          <p className={globalError ? "save-message error" : "save-message"} role="status">
            {globalError || (creatorEditor ? t("finish_creator_edit") : status === "saved" ? t("saved_synced") : t("unsaved_changes"))}
          </p>
          <div className="save-actions">
            <button
              className="discard"
              type="button"
              disabled={creatorEditor !== null || status === "saved"}
              onClick={() => void discardChanges()}
            >{t("discard_changes")}</button>
            <button
              className="save"
              type="button"
              disabled={Boolean(globalError) || creatorEditor !== null || !loaded || status === "saved"}
              onClick={() => void save()}
            >{status === "saved" ? t("saved") : t("save_changes")}</button>
          </div>
        </footer>
      ) : null}
    </main>
  );
}

type CreatorEditorPanelProps = {
  editor: CreatorEditor;
  error: string;
  onChange: (patch: Partial<CreatorRow>) => void;
  onCancel: () => void;
  onDone: () => void;
};

function CreatorEditorPanel({ editor, error, onChange, onCancel, onDone }: CreatorEditorPanelProps): React.JSX.Element {
  const row = editor.row;
  const statusId = `creator-status-${row.id}`;

  return (
    <div className="creator-editor">
      <div className="creator-editor-grid">
        <label>
          <span>{t("platform_label")}</span>
          <select
            name={`creator-site-${row.id}`}
            value={row.site}
            onChange={(event) => onChange({
              site: event.target.value as CreatorSite,
              creator: "",
              creatorName: "",
              resolution: "idle"
            })}
          >
            <option value="youtube">YouTube</option>
            <option value="bilibili">Bilibili</option>
          </select>
        </label>
        <label className="creator-input-label">
          <span>{t("creator_input_label")}</span>
          <input
            name={`creator-${row.id}`}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={statusId}
            value={row.creator}
            placeholder={row.site === "youtube" ? t("youtube_creator_placeholder") : t("bilibili_creator_placeholder")}
            onChange={(event) => onChange({
              creator: event.target.value,
              creatorName: "",
              resolution: "idle"
            })}
          />
        </label>
        <label>
          <span>{t("speed_label")}</span>
          <input
            type="number"
            name={`creator-speed-${row.id}`}
            autoComplete="off"
            inputMode="decimal"
            min="0.25"
            max="16"
            step="0.05"
            value={row.rate}
            onChange={(event) => onChange({ rate: event.target.value })}
          />
        </label>
      </div>
      <div className="creator-editor-footer">
        <p id={statusId} className={error ? "inline-error" : "lookup-status"} aria-live="polite">
          {error
            || (row.resolution === "resolving" ? t("looking_up_creator_ellipsis")
              : row.resolution === "error" ? t("creator_lookup_failed")
                : row.creatorName || "")}
        </p>
        <div>
          <button className="secondary-action" type="button" onClick={onCancel}>{t("cancel")}</button>
          <button
            className="solid-action"
            type="button"
            disabled={Boolean(error) || row.resolution === "resolving"}
            onClick={onDone}
          >{t("done")}</button>
        </div>
      </div>
    </div>
  );
}

localizeDocument();
createRoot(document.getElementById("root")!).render(<Options />);
