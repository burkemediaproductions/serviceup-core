import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { deleteFromSupabase, getSignedUrl, uploadToSupabase } from '../../lib/storage';

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function PixelCard({ pixel, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: pixel.title || '', alt_text: pixel.alt_text || '', caption: pixel.caption || '' });
  const [preview, setPreview] = useState(pixel.public_url || '');

  useEffect(() => {
    if (pixel.public_url || !pixel.mime_type?.startsWith('image/')) return;
    getSignedUrl(pixel.bucket, pixel.storage_path).then(setPreview).catch(() => {});
  }, [pixel]);

  const save = async () => {
    const updated = await api.patch(`/api/pixels/${pixel.id}`, form);
    onSaved(updated);
    setEditing(false);
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${pixel.title}” from Pixels and Storage?`)) return;
    await api.del(`/api/pixels/${pixel.id}`);
    onDeleted(pixel.id);
  };

  return (
    <article className="su-card" style={{ overflow: 'hidden' }}>
      <div style={{ aspectRatio: '16 / 10', background: 'var(--su-bg, #f5f6f7)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {preview && pixel.mime_type?.startsWith('image/')
          ? <img src={preview} alt={pixel.alt_text || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 42 }} aria-hidden="true">{pixel.mime_type?.startsWith('video/') ? '🎬' : '📄'}</span>}
      </div>
      <div style={{ padding: 16 }}>
        {editing ? <>
          <label className="su-label">Title<input className="su-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="su-label">Alt text<input className="su-input" value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })} placeholder="Describe the image for accessibility" /></label>
          <label className="su-label">Caption<textarea className="su-input" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="su-btn primary" onClick={save}>Save</button><button className="su-btn" onClick={() => setEditing(false)}>Cancel</button></div>
        </> : <>
          <h2 style={{ fontSize: 17, margin: 0 }}>{pixel.title}</h2>
          <p style={{ fontSize: 12, opacity: .7, wordBreak: 'break-word' }}>{pixel.original_name || pixel.storage_path}</p>
          <p style={{ fontSize: 12 }}>{pixel.mime_type || 'File'} · {formatBytes(pixel.size_bytes)} · {pixel.bucket === 'uploads-public' ? 'Public' : 'Private'}</p>
          {pixel.mime_type?.startsWith('image/') && !pixel.alt_text && <p style={{ color: '#9a5a00', fontSize: 12 }}>Alt text needed</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="su-btn" onClick={() => setEditing(true)}>Edit details</button>
            {pixel.public_url && <button className="su-btn" onClick={() => navigator.clipboard.writeText(pixel.public_url)}>Copy URL</button>}
            <button className="su-btn danger" onClick={remove}>Delete</button>
          </div>
        </>}
      </div>
    </article>
  );
}

export default function PixelsPage() {
  const [pixels, setPixels] = useState([]);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      setPixels(await api.get('/api/pixels'));
    } catch (error) {
      setMessage(error.message || 'Unable to load Pixels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return pixels;
    return pixels.filter((pixel) => [pixel.title, pixel.original_name, pixel.alt_text].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [pixels, query]);

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setMessage('');
    for (const file of files) {
      let stored;
      try {
        const bucket = visibility === 'public' ? 'uploads-public' : 'uploads-private';
        stored = await uploadToSupabase(file, { bucket, pathPrefix: 'pixels', makePublic: visibility === 'public' });
        const created = await api.post('/api/pixels', {
          title: file.name.replace(/\.[^.]+$/, ''), original_name: file.name,
          bucket: stored.bucket, storage_path: stored.path,
          mime_type: file.type, size_bytes: file.size,
        });
        setPixels((current) => [created, ...current]);
      } catch (error) {
        if (stored) await deleteFromSupabase(stored.bucket, stored.path).catch(() => {});
        setMessage(`Could not upload ${file.name}: ${error.message}`);
      }
    }
    event.target.value = '';
    setUploading(false);
  };

  return (
    <section>
      <h1>Pixels</h1>
      <p>Manage images, videos, documents, and other media used across your websites, apps, CRM, and CMS.</p>
      <div className="su-card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 20 }}>
        <label className="su-label" style={{ flex: '1 1 260px' }}>Search Pixels<input className="su-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles, filenames, or alt text" /></label>
        <label className="su-label">Upload visibility<select className="su-select" value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Public media</option><option value="private">Private file</option></select></label>
        <label className="su-btn primary" style={{ cursor: uploading ? 'wait' : 'pointer' }}>{uploading ? 'Uploading…' : '+ Upload Pixels'}<input type="file" multiple hidden disabled={uploading} onChange={upload} /></label>
      </div>
      {message && <p role="status">{message}</p>}
      {loading ? <p>Loading Pixels…</p> : filtered.length === 0 ? <p>No Pixels found. Upload an image, video, or document to begin.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
          {filtered.map((pixel) => <PixelCard key={pixel.id} pixel={pixel} onSaved={(updated) => setPixels((items) => items.map((item) => item.id === updated.id ? updated : item))} onDeleted={(id) => setPixels((items) => items.filter((item) => item.id !== id))} />)}
        </div>
      )}
    </section>
  );
}
