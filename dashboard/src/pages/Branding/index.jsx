import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';

const defaults = { app_name: 'ServiceUp', logoUrl: '', faviconUrl: '', appIconUrl: '', poweredByText: 'Powered by ServiceUp', poweredByUrl: 'https://serviceup.tech', theme: { mode: 'light', primary: '#0f766e', secondary: '#f97316', accent: '#2563eb', bg: '#f7f8fa', surface: '#ffffff', text: '#1f2937', border: '#d8dee6', radius: 10, headingFont: 'system-ui', bodyFont: 'system-ui' } };

export default function BrandingPage() {
  const { settings, setSettings } = useSettings();
  const [form, setForm] = useState(defaults);
  const [pixels, setPixels] = useState([]);
  const [message, setMessage] = useState('');
  useEffect(() => { if (settings) setForm({ ...defaults, ...settings, theme: { ...defaults.theme, ...(settings.theme || {}) } }); }, [settings]);
  useEffect(() => { api.get('/api/pixels?mime=image/').then(setPixels).catch(() => setPixels([])); }, []);
  const theme = (key, value) => setForm((current) => ({ ...current, theme: { ...current.theme, [key]: value } }));
  const save = async () => { try { const saved = await api.put('/settings', form); setSettings(saved); setMessage('Branding saved.'); } catch (error) { setMessage(error.message || 'Unable to save Branding.'); } };
  const imageSelect = (label, key) => <label className="su-label">{label}<select className="su-select" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}><option value="">No image selected</option>{pixels.filter((pixel) => pixel.public_url).map((pixel) => <option key={pixel.id} value={pixel.public_url}>{pixel.title}</option>)}</select></label>;
  return <section><div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><h1>Branding &amp; Appearance</h1><p>Customize this tenant’s ServiceUp dashboard without forking its CSS.</p></div><button className="su-btn primary" onClick={save}>Save Branding</button></div>{message && <p role="status">{message}</p>}
    <section className="su-card" style={{padding:20,marginBottom:18}}><h2>Brand</h2><label className="su-label">Dashboard name<input className="su-input" value={form.app_name || ''} onChange={(e)=>setForm({...form,app_name:e.target.value})}/></label>{imageSelect('Primary logo (from Pixels)','logoUrl')}{imageSelect('Favicon (from Pixels)','faviconUrl')}{imageSelect('App icon (from Pixels)','appIconUrl')}<label className="su-label">Powered-by text<input className="su-input" value={form.poweredByText || ''} onChange={(e)=>setForm({...form,poweredByText:e.target.value})}/></label><label className="su-label">Powered-by URL<input className="su-input" value={form.poweredByUrl || ''} onChange={(e)=>setForm({...form,poweredByUrl:e.target.value})}/></label></section>
    <section className="su-card" style={{padding:20}}><h2>Theme</h2><label className="su-label">Mode<select className="su-select" value={form.theme.mode} onChange={(e)=>theme('mode',e.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>{[['primary','Primary'],['secondary','Secondary'],['accent','Accent'],['bg','Background'],['surface','Surface'],['text','Text'],['border','Border']].map(([key,label])=><label className="su-label" key={key}>{label}<input className="su-input" type="color" value={form.theme[key]} onChange={(e)=>theme(key,e.target.value)}/></label>)}</div><label className="su-label">Corner radius: {form.theme.radius}px<input style={{width:'100%'}} type="range" min="0" max="24" value={form.theme.radius} onChange={(e)=>theme('radius',Number(e.target.value))}/></label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}><label className="su-label">Heading font<input className="su-input" value={form.theme.headingFont} onChange={(e)=>theme('headingFont',e.target.value)}/></label><label className="su-label">Body font<input className="su-input" value={form.theme.bodyFont} onChange={(e)=>theme('bodyFont',e.target.value)}/></label></div></section>
  </section>;
}
