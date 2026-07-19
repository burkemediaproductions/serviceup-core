import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const blank = { name: '', slug: '', domains: '', plan: 'shared' };

export default function PlatformClients() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async ({ preserveMessage = false } = {}) => {
    setLoading(true);
    try {
      setClients(await api.get('/api/platform/tenants'));
      if (!preserveMessage) setMessage('');
    } catch (error) {
      setMessage('Platform-owner access is required to manage ServiceUp clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      await api.post('/api/platform/tenants', {
        name: form.name,
        slug: form.slug,
        plan: form.plan,
        domains: form.domains.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setForm(blank);
      setMessage('Client created. You are now an administrator of its tenant.');
      await load({ preserveMessage: true });
    } catch (error) {
      setMessage(error.message || 'Unable to create client.');
    }
  };

  return (
    <section>
      <h1>ServiceUp Clients</h1>
      <p>Create and review the organizations hosted by this ServiceUp platform.</p>

      <form onSubmit={create} className="su-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2>Add a client</h2>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label>Client name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Client slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="generated from name" /></label>
          <label>Plan<select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}><option value="shared">Shared</option><option value="dedicated">Dedicated</option></select></label>
          <label>Domains<input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="dashboard.example.com, example.com" /></label>
        </div>
        <button className="su-btn su-btn-primary" type="submit" style={{ marginTop: 16 }}>Create client</button>
      </form>

      {message && <p role="status">{message}</p>}
      {loading ? <p>Loading clients…</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%' }}>
            <thead><tr><th align="left">Client</th><th align="left">Slug</th><th align="left">Plan</th><th align="left">Status</th><th align="left">Domains</th></tr></thead>
            <tbody>{clients.map((client) => (
              <tr key={client.id}><td>{client.name}</td><td>{client.slug}</td><td>{client.plan}</td><td>{client.status}</td><td>{client.domains?.join(', ') || '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
