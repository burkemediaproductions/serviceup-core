import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const LABELS = {
  content_types: 'Content types, fields & Panels',
  taxonomies: 'Taxonomies & terms',
  menus: 'Menus',
  entries: 'Entries and existing content',
  entry_views: 'Entry Views',
  list_views: 'List Views',
  dashboard: 'Dashboard settings & navigation',
};

function messageFrom(error) {
  const raw = String(error?.message || error || 'Unknown error');
  try {
    const parsed = JSON.parse(raw);
    return parsed.detail ? `${parsed.error}: ${parsed.detail}` : parsed.error || raw;
  } catch { return raw; }
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export default function ImportExportPage() {
  const [manifest, setManifest] = useState(null);
  const [fileName, setFileName] = useState('');
  const [validation, setValidation] = useState(null);
  const [selected, setSelected] = useState(Object.keys(LABELS));
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const tenantSlug = validation?.tenant?.slug || '';
  const canImport = manifest && validation?.ok && confirmation.trim().toLowerCase() === tenantSlug.toLowerCase() && selected.length > 0;
  const summaryRows = useMemo(() => validation?.summary ? Object.entries(validation.summary) : [], [validation]);

  async function loadHistory() {
    try { setHistory(await api.get('/api/tenant-transfer/history')); }
    catch { setHistory([]); }
  }
  useEffect(() => { loadHistory(); }, []);

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setNotice(''); setValidation(null); setConfirmation('');
    try {
      const parsed = JSON.parse(await file.text());
      setManifest(parsed); setFileName(file.name); setBusy('validate');
      const result = await api.post('/api/tenant-transfer/validate', { manifest: parsed });
      setValidation(result);
      setSelected(result.available_sections || Object.keys(LABELS));
      setNotice(`Package validated for ${result.tenant?.name || result.tenant?.slug}.`);
    } catch (err) {
      setManifest(null); setError(messageFrom(err));
    } finally { setBusy(''); }
  }

  function toggle(section) {
    setSelected((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  }

  async function dryRun() {
    setBusy('dry-run'); setError(''); setNotice('');
    try {
      const result = await api.post('/api/tenant-transfer/import', { manifest, sections: selected, dry_run: true });
      setValidation((current) => ({ ...current, ...result, ok: true }));
      setNotice('Dry run passed. Nothing was written. Review the summary, then type the tenant slug to enable Import.');
    } catch (err) { setError(messageFrom(err)); }
    finally { setBusy(''); }
  }

  async function runImport() {
    if (!canImport) return;
    setBusy('import'); setError(''); setNotice('');
    try {
      const result = await api.post('/api/tenant-transfer/import', { manifest, sections: selected, dry_run: false });
      setNotice(`Import completed for ${result.tenant?.name || result.tenant?.slug}. Backup ID: ${result.import_id}`);
      setConfirmation(''); await loadHistory();
    } catch (err) { setError(messageFrom(err)); }
    finally { setBusy(''); }
  }

  async function exportCurrent() {
    setBusy('export'); setError('');
    try {
      const data = await api.get('/api/tenant-transfer/export');
      downloadJson(data, `serviceup-${data.tenant?.slug || 'tenant'}-export.json`);
      setNotice('Current tenant export downloaded.');
    } catch (err) { setError(messageFrom(err)); }
    finally { setBusy(''); }
  }

  async function downloadBackup(id) {
    setBusy(id); setError('');
    try {
      const data = await api.get(`/api/tenant-transfer/backups/${id}`);
      downloadJson(data, `serviceup-pre-import-backup-${id}.json`);
    } catch (err) { setError(messageFrom(err)); }
    finally { setBusy(''); }
  }

  return (
    <div className="su-page su-page--import-export">
      <div className="su-page-header">
        <div><h1 className="su-page-title">Import &amp; Export</h1><p className="su-page-subtitle">Move tenant configuration and content with validation, dry runs, and automatic backups.</p></div>
        <button className="su-btn" type="button" onClick={exportCurrent} disabled={!!busy}>{busy === 'export' ? 'Exporting…' : 'Export current tenant'}</button>
      </div>

      {error && <div className="su-alert su-alert--error"><strong>Could not continue</strong><div>{error}</div></div>}
      {notice && <div className="su-alert su-alert--success">{notice}</div>}

      <section className="su-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2>1. Choose a ServiceUp package</h2>
        <p className="su-text-muted">Upload the complete <code>serviceup-tenant-migration/v1</code> JSON manifest—not the ZIP or one of its smaller reference files.</p>
        <label className="su-btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
          {busy === 'validate' ? 'Validating…' : 'Choose JSON file'}
          <input type="file" accept="application/json,.json" onChange={chooseFile} hidden disabled={!!busy} />
        </label>
        {fileName && <span style={{ marginLeft: 12 }}>{fileName}</span>}
      </section>

      {validation?.ok && <>
        <section className="su-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2>2. Review package</h2>
          <p><strong>Target:</strong> {validation.tenant?.name} (<code>{tenantSlug}</code>)</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, margin: '18px 0' }}>
            {summaryRows.map(([key, value]) => <div className="su-card" style={{ padding: 14 }} key={key}><strong style={{ display: 'block', fontSize: 24 }}>{value}</strong><span className="su-text-muted">{key.replaceAll('_', ' ')}</span></div>)}
          </div>
          {validation.warnings?.map((warning) => <div className="su-alert" key={warning}>{warning}</div>)}
          {(validation.conflicts?.existing_content_types?.length > 0 || validation.conflicts?.existing_menus?.length > 0) && <p className="su-text-muted">Existing items with matching slugs will be updated, not duplicated.</p>}
        </section>

        <section className="su-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2>3. Choose sections</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(LABELS).map(([key, label]) => <label className="su-card" style={{ padding: 14, cursor: 'pointer' }} key={key}><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} /> <span style={{ marginLeft: 8 }}>{label}</span></label>)}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <button className="su-btn primary" type="button" onClick={dryRun} disabled={!!busy || !selected.length}>{busy === 'dry-run' ? 'Checking…' : 'Run dry test'}</button>
          </div>
        </section>

        <section className="su-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2>4. Import into this tenant</h2>
          <p>An automatic snapshot will be stored before changes begin. A failed import rolls back.</p>
          <label>Type <strong>{tenantSlug}</strong> to confirm
            <input style={{ display: 'block', width: '100%', maxWidth: 440, marginTop: 8 }} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={tenantSlug} />
          </label>
          <button className="su-btn primary" style={{ marginTop: 16 }} type="button" onClick={runImport} disabled={!canImport || !!busy}>{busy === 'import' ? 'Importing…' : `Import into ${validation.tenant?.name}`}</button>
        </section>
      </>}

      <section className="su-card" style={{ padding: 24 }}>
        <h2>Import history</h2>
        {!history.length && <p className="su-text-muted">No completed imports yet.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {history.map((item) => <div className="su-card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }} key={item.id}><div><strong>{item.source_name || 'Migration package'}</strong><div className="su-text-muted">{new Date(item.created_at).toLocaleString()} · {item.summary?.entries || 0} entries</div></div><button className="su-btn" type="button" onClick={() => downloadBackup(item.id)} disabled={!!busy}>{busy === item.id ? 'Preparing…' : 'Download pre-import backup'}</button></div>)}
        </div>
      </section>
    </div>
  );
}
