import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

function menuItems(menu) {
  const config = typeof menu?.config === 'string'
    ? (() => { try { return JSON.parse(menu.config); } catch { return {}; } })()
    : menu?.config || {};
  return Array.isArray(config.items) ? config.items : [];
}

function newItem() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `menu-item-${Date.now()}`,
    label: '',
    url: '/',
    target: '_self',
  };
}

export default function MenusPage() {
  const [menus, setMenus] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/api/menus')
      .then((res) => setMenus(Array.isArray(res) ? res : res?.data || []))
      .catch((err) => setError(err.message || 'Failed to load menus'))
      .finally(() => setLoading(false));
  }, []);

  function selectMenu(menu) {
    setSelected(menu);
    setDraft({
      label: menu.label || '',
      slug: menu.slug || '',
      items: menuItems(menu).map((item) => ({ ...item })),
    });
    setError('');
    setMessage('');
  }

  async function addMenu() {
    if (!newLabel.trim()) return;
    try {
      setSaving(true);
      setError('');
      const created = await api.post('/api/menus', { label: newLabel.trim() });
      setMenus((current) => [...current, created]);
      setNewLabel('');
      selectMenu(created);
    } catch (err) {
      setError(err.message || 'Failed to create menu');
    } finally {
      setSaving(false);
    }
  }

  function updateItem(index, key, value) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function moveItem(index, direction) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.items.length) return current;
      const items = [...current.items];
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, items };
    });
  }

  async function saveMenu() {
    if (!selected || !draft?.label.trim() || !draft?.slug.trim()) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const saved = await api.put(`/api/menus/${selected.id}`, {
        label: draft.label.trim(),
        slug: draft.slug.trim(),
        config: { items: draft.items },
      });
      setMenus((current) => current.map((menu) => menu.id === saved.id ? saved : menu));
      selectMenu(saved);
      setMessage('Menu saved.');
    } catch (err) {
      setError(err.message || 'Failed to save menu');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMenu() {
    if (!selected || !window.confirm(`Delete “${selected.label}”?`)) return;
    try {
      setSaving(true);
      setError('');
      await api.del(`/api/menus/${selected.id}`);
      setMenus((current) => current.filter((menu) => menu.id !== selected.id));
      setSelected(null);
      setDraft(null);
    } catch (err) {
      setError(err.message || 'Failed to delete menu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="su-space-y-md">
      <div className="su-card">
        <div className="su-card-body">
          <h2>Menus</h2>
          <p className="su-text-sm su-text-muted">Create navigation menus, then click a menu to edit its links.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="su-input" placeholder="Menu name…" value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMenu(); }} />
            <button className="su-btn primary" onClick={addMenu} disabled={saving || !newLabel.trim()}>
              {saving ? 'Working…' : 'Add New'}
            </button>
          </div>
          {error && <p className="su-text-sm" style={{ color: 'var(--su-danger)' }}>{error}</p>}
          {message && <p className="su-text-sm" style={{ color: 'var(--su-success)' }}>{message}</p>}
        </div>
      </div>

      <div className="su-grid md:grid-cols-2 gap-md">
        <div className="su-card">
          <div className="su-card-body">
            <h3>Saved menus</h3>
            {loading && <p>Loading menus…</p>}
            {!loading && menus.length === 0 && <p>No menus yet.</p>}
            <div className="su-space-y-sm">
              {menus.map((menu) => (
                <button type="button" key={menu.id}
                  className={`su-btn ${selected?.id === menu.id ? 'primary' : ''}`}
                  style={{ width: '100%', justifyContent: 'space-between' }}
                  onClick={() => selectMenu(menu)}>
                  <span>{menu.label}</span>
                  <span className="su-text-muted">{menuItems(menu).length} links →</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="su-card">
          <div className="su-card-body">
            {!draft && <p className="su-text-muted">Select a menu to edit it.</p>}
            {draft && (
              <div className="su-space-y-md">
                <h3>Edit menu</h3>
                <div>
                  <label className="su-form-label">Name</label>
                  <input className="su-input" value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                </div>
                <div>
                  <label className="su-form-label">Slug</label>
                  <input className="su-input" value={draft.slug}
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                </div>

                <div className="su-flex su-items-center su-justify-between">
                  <h4 style={{ margin: 0 }}>Menu links</h4>
                  <button type="button" className="su-btn"
                    onClick={() => setDraft({ ...draft, items: [...draft.items, newItem()] })}>
                    + Add link
                  </button>
                </div>

                {draft.items.length === 0 && <p className="su-text-sm su-text-muted">No links yet.</p>}
                {draft.items.map((item, index) => (
                  <div className="su-card" key={item.id || index} style={{ background: 'var(--su-surface)' }}>
                    <div className="su-card-body su-space-y-sm">
                      <input className="su-input" placeholder="Link label" value={item.label}
                        onChange={(e) => updateItem(index, 'label', e.target.value)} />
                      <input className="su-input" placeholder="/page or https://example.com" value={item.url}
                        onChange={(e) => updateItem(index, 'url', e.target.value)} />
                      <label className="su-text-sm">
                        <input type="checkbox" checked={item.target === '_blank'}
                          onChange={(e) => updateItem(index, 'target', e.target.checked ? '_blank' : '_self')} />{' '}
                        Open in a new tab
                      </label>
                      <div className="su-flex su-gap-sm">
                        <button type="button" className="su-btn" disabled={index === 0}
                          onClick={() => moveItem(index, -1)}>↑ Up</button>
                        <button type="button" className="su-btn" disabled={index === draft.items.length - 1}
                          onClick={() => moveItem(index, 1)}>↓ Down</button>
                        <button type="button" className="su-btn"
                          onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="su-flex su-gap-sm">
                  <button type="button" className="su-btn primary" onClick={saveMenu}
                    disabled={saving || !draft.label.trim() || !draft.slug.trim()}>
                    {saving ? 'Saving…' : 'Save Menu'}
                  </button>
                  <button type="button" className="su-btn" onClick={deleteMenu} disabled={saving}>
                    Delete Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
