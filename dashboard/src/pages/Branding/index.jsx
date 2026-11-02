import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import { DEFAULT_THEME, normalizeTheme } from '../../lib/branding';

const defaults = {
  app_name: 'ServiceUp', logoUrl: '', faviconUrl: '', appIconUrl: '',
  topbarLogoUrl: '', sidebarLogoUrl: '', loginLogoUrl: '', loadingImageUrl: '',
  showTopbarLogo: true, showSidebarLogo: true, showLoginLogo: true, showTopbarTitle: true,
  sidebarCloseContent: '✕',
  poweredByText: 'Powered by ServiceUp', poweredByUrl: 'https://serviceup.tech',
  customCss: '', theme: DEFAULT_THEME,
};

const COLOR_FIELDS = [
  ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Links / accent'],
  ['bg', 'Page background'], ['surface', 'Cards / surfaces'], ['text', 'Text'], ['border', 'Borders'],
];
const MENU_FIELDS = [
  ['menuButtonBg', 'Button'], ['menuButtonText', 'Button text'],
  ['menuButtonHoverBg', 'Button hover'], ['menuButtonActiveBg', 'Active button'],
  ['menuButtonActiveText', 'Active text'],
];
const ACTION_FIELDS = [
  ['danger', 'Delete / remove button'], ['dangerText', 'Delete / remove text'],
];
const SIDEBAR_FIELDS = [
  ['sidebarBg', 'Sidebar background'], ['sidebarText', 'Sidebar text'],
  ['sidebarButtonBg', 'Sidebar button'], ['sidebarButtonText', 'Sidebar button text'],
  ['sidebarButtonActiveBg', 'Sidebar active button'], ['sidebarButtonActiveText', 'Sidebar active text'],
];
const TOPBAR_FIELDS = [
  ['topbarBg', 'Top bar background'], ['topbarText', 'Top bar text'],
  ['topbarButtonBg', 'Top bar button'], ['topbarButtonText', 'Top bar button text'],
];

function ColorGrid({ palette, onChange, fields }) {
  return <div className="su-brand-color-grid">{fields.map(([key, label]) =>
    <label className="su-label su-color-field" key={key}>
      <span>{label}</span>
      <span className="su-color-control">
        <input type="color" value={palette[key] || '#000000'} onChange={(event) => onChange(key, event.target.value)} />
        <input className="su-input" value={palette[key] || ''} onChange={(event) => onChange(key, event.target.value)} />
      </span>
    </label>
  )}</div>;
}

export default function BrandingPage() {
  const { settings, setSettings, setThemeMode } = useSettings();
  const [form, setForm] = useState(defaults);
  const [pixels, setPixels] = useState([]);
  const [message, setMessage] = useState('');
  const [previewMode, setPreviewMode] = useState('light');

  useEffect(() => {
    if (!settings) return;
    setForm({ ...defaults, ...settings, theme: normalizeTheme(settings.theme) });
    setPreviewMode(normalizeTheme(settings.theme).mode);
  }, [settings]);
  useEffect(() => { api.get('/api/pixels').then(setPixels).catch(() => setPixels([])); }, []);

  const images = useMemo(() => pixels.filter((pixel) => pixel.public_url && String(pixel.mime_type || '').startsWith('image/')), [pixels]);
  const videos = useMemo(() => pixels.filter((pixel) => pixel.public_url && String(pixel.mime_type || '').startsWith('video/')), [pixels]);

  const setTheme = (key, value) => setForm((current) => ({
    ...current, theme: { ...normalizeTheme(current.theme), [key]: value },
  }));
  const setPalette = (mode, key, value) => setForm((current) => {
    const nextTheme = normalizeTheme(current.theme);
    return { ...current, theme: { ...nextTheme, [mode]: { ...nextTheme[mode], [key]: value } } };
  });
  const save = async () => {
    try {
      const payload = { ...form, theme: normalizeTheme(form.theme) };
      const saved = await api.put('/settings', payload);
      setSettings(saved);
      setThemeMode(previewMode);
      setMessage('Branding saved.');
    } catch (error) {
      setMessage(error.message || 'Unable to save Branding.');
    }
  };
  const assetSelect = (label, value, onChange, options, empty = 'None') =>
    <label className="su-label">{label}
      <select className="su-select" value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{empty}</option>
        {options.map((pixel) => <option key={pixel.id} value={pixel.public_url}>{pixel.title}</option>)}
      </select>
    </label>;

  const theme = normalizeTheme(form.theme);
  const visibleModes = theme.enableReadingMode ? ['light', 'dark', 'reading'] : ['light', 'dark'];

  return <section>
    <div className="su-page-heading">
      <div><h1>Branding &amp; Appearance</h1><p>Customize this tenant’s dashboard, themes, backgrounds, and navigation.</p></div>
      <button className="su-btn primary" onClick={save}>Save Branding</button>
    </div>
    {message && <p role="status">{message}</p>}

    <section className="su-card su-brand-section">
      <h2>Brand</h2>
      <label className="su-label">Dashboard name<input className="su-input" value={form.app_name || ''} onChange={(event) => setForm({ ...form, app_name: event.target.value })} /></label>
      {assetSelect('Primary logo (from Pixels)', form.logoUrl, (value) => setForm({ ...form, logoUrl: value }), images, 'No logo selected')}
      <p className="su-help">The primary logo is the fallback. Choose different images below when the top bar, sidebar, or login screen need their own treatment.</p>
      <div className="su-grid cols-3">
        {assetSelect('Top bar logo', form.topbarLogoUrl, (value) => setForm({ ...form, topbarLogoUrl: value }), images, 'Use primary logo')}
        {assetSelect('Sidebar logo', form.sidebarLogoUrl, (value) => setForm({ ...form, sidebarLogoUrl: value }), images, 'Use primary logo')}
        {assetSelect('Login logo', form.loginLogoUrl, (value) => setForm({ ...form, loginLogoUrl: value }), images, 'Use primary logo')}
      </div>
      <div className="su-grid cols-2">
        <label className="su-toggle-field"><input type="checkbox" checked={form.showTopbarLogo !== false} onChange={(event) => setForm({ ...form, showTopbarLogo: event.target.checked })} /><span>Show top bar logo</span></label>
        <label className="su-toggle-field"><input type="checkbox" checked={form.showTopbarTitle !== false} onChange={(event) => setForm({ ...form, showTopbarTitle: event.target.checked })} /><span>Show top bar title</span></label>
        <label className="su-toggle-field"><input type="checkbox" checked={form.showSidebarLogo !== false} onChange={(event) => setForm({ ...form, showSidebarLogo: event.target.checked })} /><span>Show sidebar logo</span></label>
        <label className="su-toggle-field"><input type="checkbox" checked={form.showLoginLogo !== false} onChange={(event) => setForm({ ...form, showLoginLogo: event.target.checked })} /><span>Show login logo</span></label>
      </div>
      <div className="su-grid cols-2">
        {assetSelect('Loading image', form.loadingImageUrl, (value) => setForm({ ...form, loadingImageUrl: value }), images, 'Use default ServiceUp loading mark')}
        <label className="su-label">Mobile menu close symbol or text<input className="su-input" value={form.sidebarCloseContent || ''} maxLength="16" onChange={(event) => setForm({ ...form, sidebarCloseContent: event.target.value })} placeholder="✕" /></label>
      </div>
      <p className="su-help">The loading image is an intentional animated brand mark, not a missing image. Leave it blank for the default ServiceUp mark or select any Pixel.</p>
      {assetSelect('Favicon (from Pixels)', form.faviconUrl, (value) => setForm({ ...form, faviconUrl: value }), images, 'No favicon selected')}
      {assetSelect('App icon (from Pixels)', form.appIconUrl, (value) => setForm({ ...form, appIconUrl: value }), images, 'No app icon selected')}
      <div className="su-grid cols-2">
        <label className="su-label">Powered-by text<input className="su-input" value={form.poweredByText || ''} onChange={(event) => setForm({ ...form, poweredByText: event.target.value })} /></label>
        <label className="su-label">Powered-by URL<input className="su-input" value={form.poweredByUrl || ''} onChange={(event) => setForm({ ...form, poweredByUrl: event.target.value })} /></label>
      </div>
    </section>

    <section className="su-card su-brand-section">
      <h2>Theme modes</h2>
      <div className="su-grid cols-3">
        <label className="su-label">Default mode
          <select className="su-select" value={theme.mode} onChange={(event) => { setTheme('mode', event.target.value); setPreviewMode(event.target.value); }}>
            {visibleModes.map((mode) => <option value={mode} key={mode}>{mode[0].toUpperCase() + mode.slice(1)}</option>)}
          </select>
        </label>
        <label className="su-toggle-field"><input type="checkbox" checked={theme.allowUserToggle} onChange={(event) => setTheme('allowUserToggle', event.target.checked)} /><span>Let users switch modes</span></label>
        <label className="su-toggle-field"><input type="checkbox" checked={theme.enableReadingMode} onChange={(event) => { setTheme('enableReadingMode', event.target.checked); if (!event.target.checked && previewMode === 'reading') setPreviewMode('light'); }} /><span>Enable simplified Reading mode</span></label>
      </div>
      <p className="su-help">Reading mode uses a calm, high-contrast palette and automatically removes decorative image, video, and gradient backgrounds.</p>
      <div className="su-theme-tabs" role="tablist">
        {visibleModes.map((mode) => <button key={mode} type="button" className={'su-btn' + (previewMode === mode ? ' primary' : '')} onClick={() => { setPreviewMode(mode); setThemeMode(mode); }}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}
      </div>
    </section>

    {visibleModes.map((mode) => {
      if (mode !== previewMode) return null;
      const palette = theme[mode];
      return <section className="su-card su-brand-section" key={mode}>
        <h2>{mode[0].toUpperCase() + mode.slice(1)} palette</h2>
        <h3>Dashboard colors</h3>
        <ColorGrid palette={palette} fields={COLOR_FIELDS} onChange={(key, value) => setPalette(mode, key, value)} />
        <h3>Menu buttons</h3>
        <ColorGrid palette={palette} fields={MENU_FIELDS} onChange={(key, value) => setPalette(mode, key, value)} />
        <h3>Sidebar</h3>
        <ColorGrid palette={palette} fields={SIDEBAR_FIELDS} onChange={(key, value) => setPalette(mode, key, value)} />
        {mode !== 'reading' && <>
          {assetSelect('Sidebar background image (from Pixels)', palette.sidebarBackgroundImageUrl, (value) => setPalette(mode, 'sidebarBackgroundImageUrl', value), images, 'No sidebar background image')}
          <label className="su-label">Sidebar CSS gradient
            <input className="su-input" placeholder="linear-gradient(180deg, #172554, #0f766e)" value={palette.sidebarBackgroundGradient || ''} onChange={(event) => setPalette(mode, 'sidebarBackgroundGradient', event.target.value)} />
          </label>
        </>}
        <h3>Top bar</h3>
        <ColorGrid palette={palette} fields={TOPBAR_FIELDS} onChange={(key, value) => setPalette(mode, key, value)} />
        <h3>Delete and remove buttons</h3>
        <ColorGrid palette={palette} fields={ACTION_FIELDS} onChange={(key, value) => setPalette(mode, key, value)} />
        {mode !== 'reading' && <>
          <h3>Dashboard background</h3>
          <div className="su-grid cols-2">
            {assetSelect('Background image (from Pixels)', palette.backgroundImageUrl, (value) => setPalette(mode, 'backgroundImageUrl', value), images, 'No background image')}
            {assetSelect('Background video (from Pixels)', palette.backgroundVideoUrl, (value) => setPalette(mode, 'backgroundVideoUrl', value), videos, 'No background video')}
          </div>
          <label className="su-label">CSS gradient
            <input className="su-input" placeholder="linear-gradient(135deg, #0f172a, #164e63)" value={palette.backgroundGradient || ''} onChange={(event) => setPalette(mode, 'backgroundGradient', event.target.value)} />
          </label>
          <label className="su-label">Background overlay
            <span className="su-color-control">
              <input type="color" value={(palette.backgroundOverlay || '#000000').slice(0, 7)} onChange={(event) => setPalette(mode, 'backgroundOverlay', event.target.value + '66')} />
              <input className="su-input" placeholder="#00000066" value={palette.backgroundOverlay || ''} onChange={(event) => setPalette(mode, 'backgroundOverlay', event.target.value)} />
            </span>
          </label>
          <p className="su-help">Video appears behind the image and gradient. The overlay helps keep dashboard content readable.</p>
          <h3>Login page background</h3>
          <div className="su-grid cols-2">
            {assetSelect('Login background image (from Pixels)', palette.loginBackgroundImageUrl, (value) => setPalette(mode, 'loginBackgroundImageUrl', value), images, 'No login background image')}
            {assetSelect('Login background video (from Pixels)', palette.loginBackgroundVideoUrl, (value) => setPalette(mode, 'loginBackgroundVideoUrl', value), videos, 'No login background video')}
          </div>
          <label className="su-label">Login CSS gradient
            <input className="su-input" placeholder="linear-gradient(135deg, #172554, #0f766e)" value={palette.loginBackgroundGradient || ''} onChange={(event) => setPalette(mode, 'loginBackgroundGradient', event.target.value)} />
          </label>
          <label className="su-label">Login background overlay
            <span className="su-color-control">
              <input type="color" value={(palette.loginBackgroundOverlay || '#000000').slice(0, 7)} onChange={(event) => setPalette(mode, 'loginBackgroundOverlay', event.target.value + '66')} />
              <input className="su-input" placeholder="#00000066" value={palette.loginBackgroundOverlay || ''} onChange={(event) => setPalette(mode, 'loginBackgroundOverlay', event.target.value)} />
            </span>
          </label>
          <p className="su-help">The login background is independent from the standard authenticated ServiceUp dashboard background.</p>
        </>}
      </section>;
    })}

    <section className="su-card su-brand-section">
      <h2>Shape &amp; type</h2>
      <label className="su-label">Corner radius: {theme.radius}px<input style={{ width: '100%' }} type="range" min="0" max="24" value={theme.radius} onChange={(event) => setTheme('radius', Number(event.target.value))} /></label>
      <div className="su-grid cols-2">
        <label className="su-label">Heading font<input className="su-input" value={theme.headingFont} onChange={(event) => setTheme('headingFont', event.target.value)} /></label>
        <label className="su-label">Body font<input className="su-input" value={theme.bodyFont} onChange={(event) => setTheme('bodyFont', event.target.value)} /></label>
      </div>
    </section>

    <section className="su-card su-brand-section">
      <h2>Custom CSS</h2>
      <p className="su-help">Optional tenant-specific dashboard styling. Keep selectors scoped to <code>.su-layout</code> when possible so upgrades remain predictable.</p>
      <textarea className="su-textarea su-css-editor" spellCheck="false" placeholder={'.su-layout {\n  /* custom dashboard styles */\n}'} value={form.customCss || ''} onChange={(event) => setForm({ ...form, customCss: event.target.value })} />
    </section>
  </section>;
}

