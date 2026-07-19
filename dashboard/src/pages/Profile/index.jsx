import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const empty = {
  display_name: '', legal_name: '', legal_name_public: false, description: '',
  phone_numbers: [], email_addresses: [], addresses: [], websites: [], social_profiles: [],
};

const definitions = {
  phone_numbers: { title: 'Phone Numbers', fields: [['label', 'Label'], ['value', 'Phone number']] },
  email_addresses: { title: 'Email Addresses', fields: [['label', 'Label'], ['value', 'Email address']] },
  websites: { title: 'Websites', fields: [['label', 'Label'], ['url', 'Website URL']] },
  social_profiles: { title: 'Social Profiles', fields: [['platform', 'Platform'], ['url', 'Profile URL']] },
  addresses: { title: 'Locations and Addresses', fields: [['label', 'Label'], ['street', 'Street address'], ['city', 'City'], ['region', 'State/region'], ['postal_code', 'Postal code'], ['country', 'Country']] },
};

function Repeater({ name, items, onChange }) {
  const definition = definitions[name];
  const update = (index, field, value) => onChange(items.map((item, itemIndex) => {
    if (field === 'is_primary' && value === true) return { ...item, is_primary: itemIndex === index };
    return itemIndex === index ? { ...item, [field]: value } : item;
  }));
  const add = () => onChange([...items, { label: '', value: '', url: '', is_primary: items.length === 0, is_public: true }]);
  return (
    <section className="su-card" style={{ padding: 20, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><h2>{definition.title}</h2><button type="button" className="su-btn" onClick={add}>+ Add</button></div>
      {!items.length && <p style={{ opacity: .7 }}>No {definition.title.toLowerCase()} added yet.</p>}
      {items.map((item, index) => (
        <div key={index} style={{ borderTop: index ? '1px solid var(--su-border)' : 0, paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {definition.fields.map(([field, label]) => <label className="su-label" key={field}>{label}<input className="su-input" value={item[field] || ''} onChange={(event) => update(index, field, event.target.value)} /></label>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
            <label><input type="checkbox" checked={item.is_primary === true} onChange={(event) => update(index, 'is_primary', event.target.checked)} /> Primary</label>
            <label><input type="checkbox" checked={item.is_public !== false} onChange={(event) => update(index, 'is_public', event.target.checked)} /> Public</label>
            <button type="button" className="su-btn danger" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
          </div>
        </div>
      ))}
    </section>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/api/profile').then((data) => setProfile({ ...empty, ...data })).catch((error) => setMessage(error.message || 'Unable to load Profile.')).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMessage('');
    try {
      setProfile({ ...profile, ...(await api.put('/api/profile', profile)) });
      setMessage('Organization Profile saved.');
    } catch (error) {
      setMessage(error.message || 'Unable to save Profile.');
    } finally { setSaving(false); }
  };

  if (loading) return <p>Loading Profile…</p>;
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap' }}>
        <div><h1>Organization Profile</h1><p>Manage the identity and contact information reused across your websites, apps, CRM, and CMS.</p></div>
        <button className="su-btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
      </div>
      {message && <p role="status">{message}</p>}
      <section className="su-card" style={{ padding: 20, marginBottom: 18 }}>
        <h2>Basic Information</h2>
        <label className="su-label">Public/display name<input className="su-input" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} /></label>
        <label className="su-label">Legal name<input className="su-input" value={profile.legal_name || ''} onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })} /></label>
        <label style={{ display: 'block', margin: '8px 0 14px' }}><input type="checkbox" checked={profile.legal_name_public === true} onChange={(e) => setProfile({ ...profile, legal_name_public: e.target.checked })} /> Include legal name in the public API</label>
        <label className="su-label">Organization description<textarea className="su-input" rows="4" value={profile.description || ''} onChange={(e) => setProfile({ ...profile, description: e.target.value })} /></label>
      </section>
      {Object.keys(definitions).map((name) => <Repeater key={name} name={name} items={profile[name] || []} onChange={(items) => setProfile({ ...profile, [name]: items })} />)}
    </section>
  );
}
