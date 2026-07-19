import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const emptyStripe = {
  is_enabled: true,
  site_url: '',
  automatic_tax: false,
  secret_key: '',
  webhook_secret: '',
  has_credentials: false,
};

const emptyFitDegree = {
  is_enabled: true,
  base_url: 'https://api.fitdegree.com',
  company_id: '',
  auth_header: 'Authorization',
  auth_scheme: 'Bearer',
  api_key: '',
  has_credentials: false,
};

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', marginBottom: 5 }}>{label}</span>
      <input
        className="su-input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: '100%' }}
      />
    </label>
  );
}

export default function IntegrationsSettings() {
  const [stripe, setStripe] = useState(emptyStripe);
  const [fitdegree, setFitDegree] = useState(emptyFitDegree);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/api/integrations')
      .then((rows) => {
        if (!active) return;
        const stripeRow = (rows || []).find((row) => row.slug === 'stripe');
        const fitdegreeRow = (rows || []).find((row) => row.slug === 'fitdegree');
        if (stripeRow) {
          setStripe((previous) => ({
            ...previous,
            ...stripeRow.config,
            is_enabled: stripeRow.is_enabled,
            has_credentials: stripeRow.has_credentials,
          }));
        }
        if (fitdegreeRow) {
          setFitDegree((previous) => ({
            ...previous,
            ...fitdegreeRow.config,
            is_enabled: fitdegreeRow.is_enabled,
            has_credentials: fitdegreeRow.has_credentials,
          }));
        }
      })
      .catch((error) => setMessage(error.message || 'Failed to load integrations'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function saveStripe() {
    setSaving('stripe');
    setMessage('');
    try {
      const credentials = {};
      if (stripe.secret_key.trim()) credentials.secret_key = stripe.secret_key.trim();
      if (stripe.webhook_secret.trim()) credentials.webhook_secret = stripe.webhook_secret.trim();
      const saved = await api.put('/api/integrations/stripe', {
        is_enabled: stripe.is_enabled,
        config: {
          site_url: stripe.site_url.trim(),
          automatic_tax: stripe.automatic_tax,
        },
        ...(Object.keys(credentials).length ? { credentials } : {}),
      });
      setStripe((previous) => ({
        ...previous,
        secret_key: '',
        webhook_secret: '',
        has_credentials: saved.has_credentials,
      }));
      setMessage('Stripe settings saved for this client.');
    } catch (error) {
      setMessage(error.message || 'Failed to save Stripe settings');
    } finally {
      setSaving('');
    }
  }

  async function saveFitDegree() {
    setSaving('fitdegree');
    setMessage('');
    try {
      const credentials = {};
      if (fitdegree.api_key.trim()) credentials.api_key = fitdegree.api_key.trim();
      const saved = await api.put('/api/integrations/fitdegree', {
        is_enabled: fitdegree.is_enabled,
        config: {
          base_url: fitdegree.base_url.trim(),
          company_id: fitdegree.company_id.trim(),
          auth_header: fitdegree.auth_header.trim(),
          auth_scheme: fitdegree.auth_scheme,
        },
        ...(Object.keys(credentials).length ? { credentials } : {}),
      });
      setFitDegree((previous) => ({
        ...previous,
        api_key: '',
        has_credentials: saved.has_credentials,
      }));
      setMessage('fitDegree settings saved for this client.');
    } catch (error) {
      setMessage(error.message || 'Failed to save fitDegree settings');
    } finally {
      setSaving('');
    }
  }

  if (loading) return <div className="su-card">Loading integrations…</div>;

  return (
    <div>
      <h1>Client Integrations</h1>
      <p style={{ opacity: 0.8 }}>
        These settings belong only to the active ServiceUp client. Saved credentials are encrypted and are never displayed again.
      </p>
      {message && <div className="su-card" style={{ marginBottom: 16 }}>{message}</div>}

      <div className="su-card" style={{ marginBottom: 18, maxWidth: 760 }}>
        <h2>Stripe</h2>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={stripe.is_enabled}
            onChange={(event) => setStripe({ ...stripe, is_enabled: event.target.checked })}
          />{' '}Enabled for this client
        </label>
        <Field label="Website URL" value={stripe.site_url} onChange={(site_url) => setStripe({ ...stripe, site_url })} />
        <label style={{ display: 'block', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={stripe.automatic_tax}
            onChange={(event) => setStripe({ ...stripe, automatic_tax: event.target.checked })}
          />{' '}Enable Stripe automatic tax
        </label>
        <Field label="Secret key" type="password" value={stripe.secret_key} placeholder={stripe.has_credentials ? 'Saved — enter only to replace' : ''} onChange={(secret_key) => setStripe({ ...stripe, secret_key })} />
        <Field label="Webhook secret" type="password" value={stripe.webhook_secret} placeholder={stripe.has_credentials ? 'Saved — enter only to replace' : ''} onChange={(webhook_secret) => setStripe({ ...stripe, webhook_secret })} />
        <button className="su-btn primary" onClick={saveStripe} disabled={saving === 'stripe'}>
          {saving === 'stripe' ? 'Saving…' : 'Save Stripe'}
        </button>
      </div>

      <div className="su-card" style={{ maxWidth: 760 }}>
        <h2>fitDegree</h2>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={fitdegree.is_enabled}
            onChange={(event) => setFitDegree({ ...fitdegree, is_enabled: event.target.checked })}
          />{' '}Enabled for this client
        </label>
        <Field label="API base URL" value={fitdegree.base_url} onChange={(base_url) => setFitDegree({ ...fitdegree, base_url })} />
        <Field label="Company ID" value={fitdegree.company_id} onChange={(company_id) => setFitDegree({ ...fitdegree, company_id })} />
        <Field label="Authorization header" value={fitdegree.auth_header} onChange={(auth_header) => setFitDegree({ ...fitdegree, auth_header })} />
        <Field label="Authorization scheme" value={fitdegree.auth_scheme} onChange={(auth_scheme) => setFitDegree({ ...fitdegree, auth_scheme })} />
        <Field label="API key" type="password" value={fitdegree.api_key} placeholder={fitdegree.has_credentials ? 'Saved — enter only to replace' : ''} onChange={(api_key) => setFitDegree({ ...fitdegree, api_key })} />
        <button className="su-btn primary" onClick={saveFitDegree} disabled={saving === 'fitdegree'}>
          {saving === 'fitdegree' ? 'Saving…' : 'Save fitDegree'}
        </button>
      </div>
    </div>
  );
}
