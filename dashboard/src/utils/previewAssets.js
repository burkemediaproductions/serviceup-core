// Tenant-scoped public preview resolution. Never interpret arbitrary schemes as image URLs.
export function previewAssetUrl(raw, publicSiteOrigin = '') {
  const source = typeof raw === 'string' ? raw : raw?.publicUrl || raw?.public_url || raw?.url || raw?.src || '';
  if (typeof source !== 'string' || !source.trim()) return '';
  const path = source.trim();
  if (/^https:\/\/[^\s]+$/i.test(path)) return path;
  if (!/^\/(?!\/)[a-zA-Z0-9/_\-.%]+$/.test(path)) return '';
  const origin = String(publicSiteOrigin || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+$/i.test(origin)) return '';
  return origin + path;
}
