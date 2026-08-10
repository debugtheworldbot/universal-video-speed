import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { normalizeCreatorInput } from "../creator-defaults";
import { resolveCreatorMetadata } from "../creator-metadata";
import { localizeDocument, t } from "../i18n";
import { DEFAULT_SETTINGS, isSupportedShortcutKey, normalizeSettings, normalizeUrlPrefix, type CreatorSite, type CreatorSpeedRule, type ShortcutMapping, type UrlSpeedRule } from "../settings";
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

function Options(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(mappingToRows(DEFAULT_SETTINGS.shortcuts));
  const [creatorRows, setCreatorRows] = useState<CreatorRow[]>(rulesToRows(DEFAULT_SETTINGS.creatorRules));
  const [fallbackRates, setFallbackRates] = useState<Record<CreatorSite, string>>({ youtube: "", bilibili: "" });
  const [urlRows, setUrlRows] = useState<UrlRow[]>(urlRulesToRows(DEFAULT_SETTINGS.urlRules));
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void chrome.storage.sync.get("settings").then(({ settings }) => {
      const normalized = normalizeSettings(settings);
      setRows(mappingToRows(normalized.shortcuts));
      setCreatorRows(rulesToRows(normalized.creatorRules));
      setFallbackRates({
        youtube: normalized.fallbackRates.youtube === undefined ? "" : String(normalized.fallbackRates.youtube),
        bilibili: normalized.fallbackRates.bilibili === undefined ? "" : String(normalized.fallbackRates.bilibili)
      });
      setUrlRows(urlRulesToRows(normalized.urlRules));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const timers = creatorRows.flatMap((row) => {
      if (row.resolution !== "idle" || !normalizeCreatorInput(row.site, row.creator)) return [];

      return [window.setTimeout(() => {
        const requestedSite = row.site;
        const requestedCreator = row.creator;
        updateCreatorRow(row.id, { resolution: "resolving" });
        void resolveCreatorMetadata(requestedSite, requestedCreator).then((metadata) => {
          setCreatorRows((current) => current.map((currentRow) => {
            if (currentRow.id !== row.id || currentRow.site !== requestedSite || currentRow.creator !== requestedCreator) {
              return currentRow;
            }
            if (!metadata) return { ...currentRow, resolution: "error" };
            return {
              ...currentRow,
              creator: metadata.creatorId,
              creatorName: metadata.creatorName,
              resolution: "resolved"
            };
          }));
        }).catch(() => {
          setCreatorRows((current) => current.map((currentRow) =>
            currentRow.id === row.id && currentRow.site === requestedSite && currentRow.creator === requestedCreator
              ? { ...currentRow, resolution: "error" }
              : currentRow
          ));
        });
      }, 450)];
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [creatorRows]);

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
  const resolvingCreators = creatorRows.some((row) => row.resolution === "resolving");

  function updateRow(id: string, patch: Partial<Row>): void {
    setStatus("idle");
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateCreatorRow(id: string, patch: Partial<CreatorRow>): void {
    setStatus("idle");
    setCreatorRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateUrlRow(id: string, patch: Partial<UrlRow>): void {
    setStatus("idle");
    setUrlRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function save(): Promise<void> {
    if (error || creatorError || fallbackError || urlError || resolvingCreators) return;
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
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 1_800);
  }

  return (
    <main className="page">
      <header className="hero" aria-labelledby="page-title">
        <div className="mark" aria-hidden="true">UV</div>
        <div className="hero-copy">
          <p className="eyebrow">{t("extension_name")}</p>
          <h1 id="page-title">{t("settings_title")}</h1>
          <p className="lede">{t("settings_lede")}</p>
        </div>
      </header>

      <div className="settings" aria-label={t("playback_settings")}>
        <section className="panel fallback-panel" aria-labelledby="fallback-title">
          <div className="panel-head">
            <h2 id="fallback-title">{t("fallback_defaults_title")}</h2>
            <p className="hint">{t("fallback_defaults_hint")}</p>
          </div>

          <div className="fallback-sites" aria-busy={!loaded}>
            {(["youtube", "bilibili"] as const).map((site) => (
              <label className="fallback-site" key={site}>
                <span className={`platform-dot ${site}`} aria-hidden="true" />
                <span>{site === "youtube" ? "YouTube" : "Bilibili"}</span>
                <input
                  type="number"
                  min="0.25"
                  max="16"
                  step="0.05"
                  value={fallbackRates[site]}
                  placeholder={t("not_set")}
                  aria-label={t("site_fallback_speed", site === "youtube" ? "YouTube" : "Bilibili")}
                  onChange={(event) => {
                    setStatus("idle");
                    setFallbackRates((current) => ({ ...current, [site]: event.target.value }));
                  }}
                />
                <span aria-hidden="true">×</span>
              </label>
            ))}
          </div>

          <div className="url-defaults">
            <div className="url-defaults-head">
              <h3>{t("url_defaults_title")}</h3>
              <p>{t("url_defaults_hint")}</p>
            </div>
            {urlRows.map((row) => (
              <div className="url-row" key={row.id}>
                <label>
                  <span className="sr-only">{t("url_prefix_label")}</span>
                  <input
                    className="url-prefix-input"
                    type="url"
                    value={row.prefix}
                    placeholder="https://example.com/videos/"
                    onChange={(event) => updateUrlRow(row.id, { prefix: event.target.value })}
                  />
                </label>
                <span className="map-arrow" aria-hidden="true">→</span>
                <label className="rate-field">
                  <span className="sr-only">{t("default_playback_speed")}</span>
                  <input
                    type="number"
                    min="0.25"
                    max="16"
                    step="0.05"
                    value={row.rate}
                    onChange={(event) => updateUrlRow(row.id, { rate: event.target.value })}
                  />
                </label>
                <button
                  className="remove"
                  type="button"
                  aria-label={t("remove_url_prefix", row.prefix || t("empty_value"))}
                  onClick={() => {
                    setStatus("idle");
                    setUrlRows((current) => current.filter(({ id }) => id !== row.id));
                  }}
                >×</button>
              </div>
            ))}
            <button
              className="add"
              type="button"
              onClick={() => {
                setStatus("idle");
                setUrlRows((current) => [...current, { id: crypto.randomUUID(), prefix: "", rate: "1.5" }]);
              }}
            >{t("add_url_prefix")}</button>
          </div>
        </section>

        <section className="panel" aria-labelledby="shortcuts-title">
          <div className="panel-head">
            <h2 id="shortcuts-title">{t("shortcuts_title")}</h2>
            <p className="hint shortcut-hint">{t("shortcuts_hint")}</p>
          </div>

          <div className="map-list" aria-busy={!loaded}>
            <div className="map-list-header" aria-hidden="true">
              <span>{t("key_label")}</span>
              <span />
              <span>{t("speed_label")}</span>
              <span />
            </div>
            {rows.map((row) => (
              <div className="map-row" key={row.id}>
                <label className="key-field">
                  <span className="sr-only">{t("shortcut_key")}</span>
                  <input
                    className="key-input"
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
                  <span className="sr-only">{t("playback_speed")}</span>
                  <input
                    type="number"
                    min="0.25"
                    max="16"
                    step="0.05"
                    value={row.rate}
                    onChange={(event) => updateRow(row.id, { rate: event.target.value })}
                  />
                </label>
                <button
                  className="remove"
                  type="button"
                  aria-label={t("remove_shortcut", row.key || t("empty_value"))}
                  onClick={() => {
                    setStatus("idle");
                    setRows((current) => current.filter(({ id }) => id !== row.id));
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            className="add"
            type="button"
            onClick={() => {
              setStatus("idle");
              setRows((current) => [...current, { id: crypto.randomUUID(), key: "", rate: "1" }]);
            }}
          >
            {t("add_shortcut")}
          </button>

          <aside className="shortcut-conflict" aria-labelledby="shortcut-conflict-title">
            <span className="conflict-mark" aria-hidden="true">!</span>
            <div className="conflict-copy">
              <p className="conflict-kicker">{t("shortcut_conflict_kicker")}</p>
              <h3 id="shortcut-conflict-title">{t("shortcut_conflict_title")}</h3>
              <p>{t("shortcut_conflict_body")}</p>
              <dl className="conflict-rule">
                <div>
                  <dt>{t("vimium_pattern_label")}</dt>
                  <dd><code>https?://*/*</code></dd>
                </div>
                <div>
                  <dt>{t("vimium_keys_label")}</dt>
                  <dd><code>{rows.map(({ key }) => shortcutLabel(key)).filter(Boolean).join(" ") || "—"}</code></dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>

        <section className="panel" aria-labelledby="creators-title">
          <div className="panel-head">
            <h2 id="creators-title">{t("creator_defaults_title")}</h2>
            <p className="hint creator-hint">{t("creator_defaults_hint")}</p>
          </div>

          {creatorRows.length === 0 ? (
            <div className="empty" aria-busy={!loaded}>
              <p className="empty-title">{t("no_creator_defaults")}</p>
              <p className="empty-body">
                {t("no_creator_defaults_body")}
              </p>
            </div>
          ) : (
            <div className="map-list creator-list" aria-busy={!loaded}>
              <div className="map-list-header creator-header" aria-hidden="true">
                <span>{t("platform_label")}</span>
                <span>{t("creator_label")}</span>
                <span>{t("speed_label")}</span>
                <span />
              </div>
              {creatorRows.map((row) => (
                <div className="creator-row" key={row.id}>
                  <label className="site-field">
                    <span className="sr-only">{t("platform_label")}</span>
                    <select
                      value={row.site}
                      onChange={(event) =>
                        updateCreatorRow(row.id, {
                          site: event.target.value as CreatorSite,
                          creator: "",
                          creatorName: "",
                          resolution: "idle"
                        })
                      }
                    >
                      <option value="youtube">YouTube</option>
                      <option value="bilibili">Bilibili</option>
                    </select>
                  </label>
                  <div className="creator-identity">
                    <label className="sr-only" htmlFor={`creator-${row.id}`}>{t("creator_input_label")}</label>
                    <div className="creator-input-row">
                      <input
                        id={`creator-${row.id}`}
                        className="creator-input"
                        value={row.creator}
                        placeholder={row.site === "youtube" ? t("youtube_creator_placeholder") : t("bilibili_creator_placeholder")}
                        onChange={(event) => updateCreatorRow(row.id, {
                          creator: event.target.value,
                          creatorName: "",
                          resolution: "idle"
                        })}
                      />
                      {row.resolution === "resolving" ? (
                        <button className="creator-loading" type="button" disabled aria-label={t("looking_up_creator")}>
                          <span className="creator-spinner" aria-hidden="true" />
                          {t("loading")}
                        </button>
                      ) : null}
                    </div>
                    {row.creatorName ? <span className="creator-name">{row.creatorName}</span> : null}
                    {row.resolution === "error" ? (
                      <span className="creator-name creator-name-error">{t("creator_lookup_failed")}</span>
                    ) : null}
                  </div>
                  <label className="rate-field">
                    <span className="sr-only">{t("default_playback_speed")}</span>
                    <input
                      type="number"
                      min="0.25"
                      max="16"
                      step="0.05"
                      value={row.rate}
                      onChange={(event) => updateCreatorRow(row.id, { rate: event.target.value })}
                    />
                  </label>
                  <button
                    className="remove"
                    type="button"
                    aria-label={t("remove_creator", row.creatorName || row.creator || t("empty_value"))}
                    onClick={() => {
                      setStatus("idle");
                      setCreatorRows((current) => current.filter(({ id }) => id !== row.id));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            className="add"
            type="button"
            onClick={() => {
              setStatus("idle");
              setCreatorRows((current) => [
                ...current,
                { id: crypto.randomUUID(), site: "youtube", creator: "", creatorName: "", rate: "1.5", resolution: "idle" }
              ]);
            }}
          >
            {t("add_creator")}
          </button>
        </section>
      </div>

      <footer className="footer">
        <p className={error || creatorError || fallbackError || urlError ? "message error" : "message"} role="status">
          {error || creatorError || fallbackError || urlError || (resolvingCreators ? t("looking_up_creator_ellipsis") : status === "saved" ? t("saved_synced") : "")}
        </p>
        <button className="save" type="button" disabled={Boolean(error || creatorError || fallbackError || urlError) || resolvingCreators || !loaded} onClick={() => void save()}>
          {status === "saved" ? t("saved") : t("save_changes")}
        </button>
      </footer>
    </main>
  );
}

localizeDocument();
createRoot(document.getElementById("root")!).render(<Options />);
