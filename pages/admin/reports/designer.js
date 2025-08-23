// pages/admin/reports/designer.js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

// ---- Template schema (kept intentionally simple & explicit) ----
const DEFAULT_TEMPLATE = {
  name: 'Default Template',
  page: {
    size: 'A4', // 'A4' | 'Letter'
    orientation: 'portrait', // 'portrait' | 'landscape'
    margin: { top: 18, right: 14, bottom: 18, left: 14 }, // mm
  },
  branding: {
    logoUrl: '',
    primaryColor: '#111827',
    accentColor: '#4f46e5',
  },
  sections: [
    { key: 'cover',        enabled: true },
    { key: 'summary',      enabled: true },
    { key: 'categories',   enabled: true },
    { key: 'categoryText', enabled: true },
    { key: 'responses',    enabled: false },
  ],
};

const ALL_SECTION_META = {
  cover:        { label: 'Cover' },
  summary:      { label: 'Summary (total % + band text)' },
  categories:   { label: 'Categories (per-category %)' },
  categoryText: { label: 'Category text (per-category band descriptions)' },
  responses:    { label: 'Responses (answers table)' },
};

function clamp(n, lo, hi) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : lo;
}

export default function PdfReportDesigner() {
  const router = useRouter();
  const surveyId = router.query.surveyId ? String(router.query.surveyId) : null;
  const storageKey = `report-template:${surveyId || 'global'}`;

  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [loadedKey, setLoadedKey] = useState(storageKey);
  const [savedMessage, setSavedMessage] = useState('');

  // Load from localStorage on mount / when surveyId changes
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setTemplate(safeMergeTemplate(parsed));
          setLoadedKey(storageKey);
          return;
        }
      }
    } catch {
      // ignore parse errors and fall back to defaults
    }
    setTemplate(DEFAULT_TEMPLATE);
    setLoadedKey(storageKey);
  }, [storageKey]);

  // Normalise incoming objects against DEFAULT_TEMPLATE
  function safeMergeTemplate(incoming) {
    const t = { ...DEFAULT_TEMPLATE, ...incoming };
    t.page = {
      ...DEFAULT_TEMPLATE.page,
      ...(incoming.page || {}),
      margin: { ...DEFAULT_TEMPLATE.page.margin, ...(incoming.page?.margin || {}) },
    };
    t.branding = { ...DEFAULT_TEMPLATE.branding, ...(incoming.branding || {}) };
    t.sections = Array.isArray(incoming.sections) && incoming.sections.length
      ? incoming.sections
          .filter(s => ALL_SECTION_META[s.key])
          .map(s => ({ key: s.key, enabled: !!s.enabled }))
      : DEFAULT_TEMPLATE.sections;
    return t;
  }

  function updateSectionEnabled(key, enabled) {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(s => (s.key === key ? { ...s, enabled } : s)),
    }));
  }

  function moveSection(key, dir) {
    setTemplate(prev => {
      const idx = prev.sections.findIndex(s => s.key === key);
      if (idx < 0) return prev;
      const next = [...prev.sections];
      const swapWith = dir === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return { ...prev, sections: next };
    });
  }

  function saveTemplate() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(template));
      setSavedMessage(`Saved to ${storageKey}`);
      setTimeout(() => setSavedMessage(''), 2000);
    } catch (e) {
      setSavedMessage('Failed to save template');
      setTimeout(() => setSavedMessage(''), 2500);
    }
  }

  function resetToDefault() {
    setTemplate(DEFAULT_TEMPLATE);
  }

  const enabledSections = useMemo(
    () => template.sections.filter(s => s.enabled).map(s => s.key),
    [template.sections]
  );

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>PDF Report Designer</h1>
          <div style={{ color: '#666', fontSize: 14 }}>
            Storage key: <code>{storageKey}</code>
          </div>
          {surveyId ? (
            <div style={{ marginTop: 6 }}>
              <a href="/admin/reports/designer" style={{ fontSize: 14 }}>Switch to global template</a>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={resetToDefault}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            Reset to default
          </button>
          <button onClick={saveTemplate}
            style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}>
            Save
          </button>
        </div>
      </header>

      {savedMessage ? <div style={{ marginTop: 10, color: '#0a7' }}>{savedMessage}</div> : null}

      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left column: Controls */}
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
            <h2 style={{ marginTop: 0 }}>Page options</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <label>
                <div style={{ fontSize: 13, color: '#555' }}>Size</div>
                <select
                  value={template.page.size}
                  onChange={e => setTemplate(prev => ({ ...prev, page: { ...prev.page, size: e.target.value } }))}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </label>

              <label>
                <div style={{ fontSize: 13, color: '#555' }}>Orientation</div>
                <select
                  value={template.page.orientation}
                  onChange={e => setTemplate(prev => ({ ...prev, page: { ...prev.page, orientation: e.target.value } }))}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                >
                  <option value="portrait">portrait</option>
                  <option value="landscape">landscape</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {['top', 'right', 'bottom', 'left'].map(edge => (
                  <label key={edge}>
                    <div style={{ fontSize: 12, color: '#555' }}>{edge} (mm)</div>
                    <input
                      type="number"
                      min={0}
                      value={template.page.margin[edge]}
                      onChange={e => {
                        const v = clamp(e.target.value, 0, 50);
                        setTemplate(prev => ({
                          ...prev,
                          page: { ...prev.page, margin: { ...prev.page.margin, [edge]: v } },
                        }));
                      }}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
            <h2 style={{ marginTop: 0 }}>Branding</h2>
            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#555' }}>Logo URL (optional)</div>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={template.branding.logoUrl}
                onChange={e => setTemplate(prev => ({ ...prev, branding: { ...prev.branding, logoUrl: e.target.value } }))}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>
                <div style={{ fontSize: 13, color: '#555' }}>Primary colour</div>
                <input
                  type="text"
                  value={template.branding.primaryColor}
                  onChange={e => setTemplate(prev => ({ ...prev, branding: { ...prev.branding, primaryColor: e.target.value } }))}
                  placeholder="#111827"
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                />
              </label>
              <label>
                <div style={{ fontSize: 13, color: '#555' }}>Accent colour</div>
                <input
                  type="text"
                  value={template.branding.accentColor}
                  onChange={e => setTemplate(prev => ({ ...prev, branding: { ...prev.branding, accentColor: e.target.value } }))}
                  placeholder="#4f46e5"
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                />
              </label>
            </div>
          </div>

          <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
            <h2 style={{ marginTop: 0 }}>Sections & order</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {template.sections.map((s, idx) => {
                const label = ALL_SECTION_META[s.key]?.label || s.key;
                return (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #eee', borderRadius: 6, padding: 10 }}>
                    <input
                      id={`sec-${s.key}`}
                      type="checkbox"
                      checked={!!s.enabled}
                      onChange={e => updateSectionEnabled(s.key, e.target.checked)}
                    />
                    <label htmlFor={`sec-${s.key}`} style={{ flex: 1 }}>{label}</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => moveSection(s.key, 'up')}
                        disabled={idx === 0}
                        title="Move up"
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                      >↑</button>
                      <button
                        onClick={() => moveSection(s.key, 'down')}
                        disabled={idx === template.sections.length - 1}
                        title="Move down"
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: idx === template.sections.length - 1 ? 'not-allowed' : 'pointer' }}
                      >↓</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Live outline */}
        <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Live outline preview</h2>
          <div style={{ fontSize: 14, color: '#666' }}>
            <div>Template name: <b>{template.name || 'Untitled'}</b></div>
            <div>Page: {template.page.size}, {template.page.orientation}</div>
            <div>Margins (mm): top {template.page.margin.top}, right {template.page.margin.right}, bottom {template.page.margin.bottom}, left {template.page.margin.left}</div>
            <div>Branding: primary {template.branding.primaryColor}, accent {template.branding.accentColor}</div>
          </div>
          <ol style={{ marginTop: 12 }}>
            {template.sections.map((s) => (
              <li key={s.key} style={{ opacity: s.enabled ? 1 : 0.4 }}>
                {ALL_SECTION_META[s.key]?.label || s.key} {s.enabled ? '' : '(disabled)'}
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 16, padding: 12, borderLeft: '4px solid #4f46e5', background: '#f8f9fa', borderRadius: 6 }}>
            Enabled order for this template:
            <div style={{ marginTop: 6 }}>
              {enabledSections.length ? enabledSections.join(' → ') : <i>No sections enabled</i>}
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
            Tip: pass <code>?surveyId=&lt;id&gt;</code> to target a specific survey, otherwise the template is stored under <b>global</b>.
          </div>
        </div>
      </section>
    </div>
  );
}
