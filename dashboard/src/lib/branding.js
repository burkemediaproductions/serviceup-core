const CACHE_PREFIX = 'serviceup.settings';
const MODE_PREFIX = 'serviceup.theme-mode';

export const DEFAULT_THEME = {
  mode: 'light',
  allowUserToggle: true,
  enableReadingMode: true,
  radius: 10,
  headingFont: 'system-ui',
  bodyFont: 'system-ui',
  light: {
    primary: '#0f766e', secondary: '#f97316', accent: '#2563eb',
    bg: '#f7f8fa', surface: '#ffffff', text: '#1f2937', border: '#d8dee6',
    menuButtonBg: '#f6f7f8', menuButtonText: '#1f2937',
    menuButtonHoverBg: '#e8edf2', menuButtonActiveBg: '#0f766e', menuButtonActiveText: '#ffffff',
    danger: '#b42318', dangerText: '#ffffff',
    sidebarBg: '#ffffff', sidebarText: '#1f2937', sidebarButtonBg: '#f6f7f8', sidebarButtonText: '#1f2937',
    sidebarButtonActiveBg: '#0f766e', sidebarButtonActiveText: '#ffffff', sidebarBackgroundImageUrl: '', sidebarBackgroundGradient: '',
    topbarBg: '#ffffff', topbarText: '#1f2937', topbarButtonBg: '#f6f7f8', topbarButtonText: '#1f2937',
    backgroundGradient: '', backgroundImageUrl: '', backgroundVideoUrl: '', backgroundOverlay: '#00000000',
    loginBackgroundGradient: '', loginBackgroundImageUrl: '', loginBackgroundVideoUrl: '', loginBackgroundOverlay: '#00000000',
  },
  dark: {
    primary: '#5eead4', secondary: '#fb923c', accent: '#75a7ff',
    bg: '#0b0b0b', surface: '#121212', text: '#f7f7f7', border: '#2a2a2a',
    menuButtonBg: '#1a1a1a', menuButtonText: '#f7f7f7',
    menuButtonHoverBg: '#252525', menuButtonActiveBg: '#0f766e', menuButtonActiveText: '#ffffff',
    danger: '#ef4444', dangerText: '#ffffff',
    sidebarBg: '#121212', sidebarText: '#f7f7f7', sidebarButtonBg: '#1a1a1a', sidebarButtonText: '#f7f7f7',
    sidebarButtonActiveBg: '#0f766e', sidebarButtonActiveText: '#ffffff', sidebarBackgroundImageUrl: '', sidebarBackgroundGradient: '',
    topbarBg: '#121212', topbarText: '#f7f7f7', topbarButtonBg: '#1a1a1a', topbarButtonText: '#f7f7f7',
    backgroundGradient: '', backgroundImageUrl: '', backgroundVideoUrl: '', backgroundOverlay: '#00000000',
    loginBackgroundGradient: '', loginBackgroundImageUrl: '', loginBackgroundVideoUrl: '', loginBackgroundOverlay: '#00000000',
  },
  reading: {
    primary: '#5f4934', secondary: '#8a6847', accent: '#315f72',
    bg: '#f4efe4', surface: '#fffdf7', text: '#29251f', border: '#d8cebd',
    menuButtonBg: '#eee6d8', menuButtonText: '#29251f',
    menuButtonHoverBg: '#e3d8c6', menuButtonActiveBg: '#5f4934', menuButtonActiveText: '#fffdf7',
    danger: '#9b3a2b', dangerText: '#ffffff',
    sidebarBg: '#fffdf7', sidebarText: '#29251f', sidebarButtonBg: '#eee6d8', sidebarButtonText: '#29251f',
    sidebarButtonActiveBg: '#5f4934', sidebarButtonActiveText: '#fffdf7', sidebarBackgroundImageUrl: '', sidebarBackgroundGradient: '',
    topbarBg: '#fffdf7', topbarText: '#29251f', topbarButtonBg: '#eee6d8', topbarButtonText: '#29251f',
    backgroundGradient: '', backgroundImageUrl: '', backgroundVideoUrl: '', backgroundOverlay: '#00000000',
    loginBackgroundGradient: '', loginBackgroundImageUrl: '', loginBackgroundVideoUrl: '', loginBackgroundOverlay: '#00000000',
  },
};

function tenantSuffix() {
  try {
    const configured = import.meta.env.VITE_SERVICEUP_TENANT;
    const tenant = JSON.parse(localStorage.getItem('serviceup.tenant') || 'null');
    return configured || tenant?.slug || tenant?.id || 'default';
  } catch {
    return 'default';
  }
}

function cacheKey() { return `${CACHE_PREFIX}.${tenantSuffix()}`; }
function modeKey() { return `${MODE_PREFIX}.${tenantSuffix()}`; }

export function normalizeTheme(input = {}) {
  const legacyPalette = {
    primary: input.primary, secondary: input.secondary, accent: input.accent,
    bg: input.bg, surface: input.surface, text: input.text, border: input.border,
  };
  const cleanLegacy = Object.fromEntries(Object.entries(legacyPalette).filter(([, value]) => value));
  return {
    ...DEFAULT_THEME,
    ...input,
    light: { ...DEFAULT_THEME.light, ...cleanLegacy, ...(input.light || {}) },
    dark: { ...DEFAULT_THEME.dark, ...(input.dark || {}) },
    reading: { ...DEFAULT_THEME.reading, ...(input.reading || {}) },
  };
}

export function getEnabledThemeModes(settings) {
  const theme = normalizeTheme(settings?.theme);
  const modes = ['light', 'dark'];
  if (theme.enableReadingMode) modes.push('reading');
  return modes;
}

export function readPreferredThemeMode(settings) {
  const enabled = getEnabledThemeModes(settings);
  try {
    const saved = localStorage.getItem(modeKey());
    if (enabled.includes(saved)) return saved;
  } catch { /* use tenant default */ }
  const requested = normalizeTheme(settings?.theme).mode;
  return enabled.includes(requested) ? requested : 'light';
}

export function savePreferredThemeMode(mode) {
  try { localStorage.setItem(modeKey(), mode); } catch { /* preference remains in memory */ }
}

export function readCachedSettings() {
  try { return JSON.parse(localStorage.getItem(cacheKey()) || 'null'); } catch { return null; }
}

export function cacheSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  try { localStorage.setItem(cacheKey(), JSON.stringify(settings)); } catch { /* live settings still work */ }
}

export async function preloadBrandImages(settings) {
  if (!settings || typeof Image === 'undefined') return;
  const theme = normalizeTheme(settings.theme);
  const urls = [settings.logoUrl, settings.topbarLogoUrl, settings.sidebarLogoUrl,
    settings.loginLogoUrl, settings.loadingImageUrl, settings.faviconUrl, settings.appIconUrl,
    theme.light.backgroundImageUrl, theme.dark.backgroundImageUrl,
    theme.light.sidebarBackgroundImageUrl, theme.dark.sidebarBackgroundImageUrl,
    theme.light.loginBackgroundImageUrl, theme.dark.loginBackgroundImageUrl].filter(Boolean);
  await Promise.all(urls.map((url) => new Promise((resolve) => {
    const image = new Image(); image.onload = resolve; image.onerror = resolve; image.src = url;
  })));
}

function setOrRemove(root, name, value) {
  if (value !== undefined && value !== null && value !== '') root.style.setProperty(name, value);
  else root.style.removeProperty(name);
}

export function applyBranding(settings, requestedMode) {
  if (!settings || typeof document === 'undefined') return 'light';
  const theme = normalizeTheme(settings.theme);
  const enabled = getEnabledThemeModes(settings);
  const mode = enabled.includes(requestedMode) ? requestedMode
    : enabled.includes(theme.mode) ? theme.mode : 'light';
  const palette = theme[mode] || theme.light;
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);

  const safeImage = palette.backgroundImageUrl
    ? `url("${String(palette.backgroundImageUrl).replace(/"/g, '%22')}")`
    : 'none';
  const safeSidebarImage = palette.sidebarBackgroundImageUrl
    ? `url("${String(palette.sidebarBackgroundImageUrl).replace(/"/g, '%22')}")`
    : 'none';
  const tokens = {
    '--su-primary': palette.primary, '--su-secondary': palette.secondary, '--su-accent': palette.accent,
    '--su-link': palette.accent, '--su-bg': palette.bg, '--su-surface': palette.surface,
    '--su-text': palette.text, '--su-border': palette.border,
    '--su-heading-font': theme.headingFont, '--su-body-font': theme.bodyFont,
    '--su-menu-bg': palette.menuButtonBg, '--su-menu-text': palette.menuButtonText,
    '--su-menu-hover-bg': palette.menuButtonHoverBg,
    '--su-menu-active-bg': palette.menuButtonActiveBg, '--su-menu-active-text': palette.menuButtonActiveText,
    '--su-danger': palette.danger, '--su-danger-text': palette.dangerText,
    '--su-sidebar-bg': palette.sidebarBg, '--su-sidebar-text': palette.sidebarText,
    '--su-sidebar-button-bg': palette.sidebarButtonBg, '--su-sidebar-button-text': palette.sidebarButtonText,
    '--su-sidebar-button-active-bg': palette.sidebarButtonActiveBg, '--su-sidebar-button-active-text': palette.sidebarButtonActiveText,
    '--su-sidebar-image': mode === 'reading' ? 'none' : safeSidebarImage,
    '--su-sidebar-gradient': mode === 'reading' ? 'none' : palette.sidebarBackgroundGradient,
    '--su-topbar-bg': palette.topbarBg, '--su-topbar-text': palette.topbarText,
    '--su-topbar-button-bg': palette.topbarButtonBg, '--su-topbar-button-text': palette.topbarButtonText,
    '--su-page-gradient': mode === 'reading' ? '' : palette.backgroundGradient,
    '--su-page-image': mode === 'reading' ? 'none' : safeImage,
    '--su-page-overlay': mode === 'reading' ? '#00000000' : palette.backgroundOverlay,
  };
  Object.entries(tokens).forEach(([name, value]) => setOrRemove(root, name, value));
  if (theme.radius != null) root.style.setProperty('--su-radius', `${theme.radius}px`);

  document.title = settings.appName || settings.app_name || settings.name || 'ServiceUp';
  const ensureLink = (rel, href) => {
    if (!href) return;
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) { link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
    link.href = href;
  };
  ensureLink('icon', settings.faviconUrl || '/assets/logo.svg');
  ensureLink('apple-touch-icon', settings.appIconUrl || '/assets/logo.svg');

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = palette.primary || '#000000';

  let style = document.getElementById('serviceup-custom-css');
  if (!style) { style = document.createElement('style'); style.id = 'serviceup-custom-css'; document.head.appendChild(style); }
  style.textContent = settings.customCss || '';
  return mode;
}

export function getThemeBackgroundVideo(settings, mode) {
  if (mode === 'reading') return '';
  return normalizeTheme(settings?.theme)[mode]?.backgroundVideoUrl || '';
}

export function getThemeBackground(settings, mode, surface = 'dashboard') {
  const palette = normalizeTheme(settings?.theme)[mode] || DEFAULT_THEME.light;
  const isLogin = surface === 'login';
  if (mode === 'reading') return { imageUrl: '', videoUrl: '', gradient: '', overlay: '#00000000' };
  return {
    imageUrl: palette[isLogin ? 'loginBackgroundImageUrl' : 'backgroundImageUrl'] || '',
    videoUrl: palette[isLogin ? 'loginBackgroundVideoUrl' : 'backgroundVideoUrl'] || '',
    gradient: palette[isLogin ? 'loginBackgroundGradient' : 'backgroundGradient'] || '',
    overlay: palette[isLogin ? 'loginBackgroundOverlay' : 'backgroundOverlay'] || '#00000000',
  };
}

