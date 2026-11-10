// api/lib/fieldUtils.js
import validator from 'validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizeEmail(s) {
  const v = (s == null) ? '' : String(s).trim().toLowerCase();
  return validator.isEmail(v) ? v : '';
}

export function normalizePhoneE164(raw, def='US') {
  const p = parsePhoneNumberFromString(String(raw || ''), def);
  return p && p.isValid() ? p.number : '';
}

export function normalizeUrl(raw) {
  if (!raw) return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const url = normalizeUrl(raw.url ?? raw.href ?? '');
    if (!url || typeof url !== 'string') return '';
    const type = raw.type === 'content' ? 'content' : 'custom';
    const target = raw.target === '_blank' ? '_blank' : '_self';
    if (type === 'custom') return { type, url, target };
    const sourceKind = raw.source_kind === 'taxonomy' ? 'taxonomy' : 'content_type';
    return {
      type,
      source_kind: sourceKind,
      source_id: String(raw.source_id || ''),
      source_slug: String(raw.source_slug || ''),
      item_id: String(raw.item_id || ''),
      item_slug: String(raw.item_slug || ''),
      url,
      target,
    };
  }
  const s = String(raw).trim();

  // Site-local links, page anchors, and query links must remain relative so
  // they continue to work across previews, staging, and production domains.
  if (/^(?:\/|\.\/|\.\.\/|#|\?)/.test(s)) return s;

  // These schemes are useful in buttons and panel fields. Reject every other
  // explicit scheme (javascript:, data:, etc.).
  if (/^(?:mailto|tel):/i.test(s)) return s;
  if (/^[a-z][a-z\d+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return '';

  // Keep convenient domain-only input, while treating path-like input as a
  // relative link rather than inventing an external hostname.
  if (!/^https?:\/\//i.test(s)) {
    if (/^[^\s/]+\.[^\s/]+(?:[/?#].*)?$/i.test(s)) return normalizeUrl(`https://${s}`);
    return s;
  }

  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
    return u.toString();
  } catch {
    return '';
  }
}

export function normalizeAddress(addr = {}, def='US') {
  return {
    line1: (addr.line1 || '').trim(),
    line2: (addr.line2 || '').trim(),
    locality: (addr.locality || '').trim(),
    admin1: { code: (addr.admin1?.code || '').trim().toUpperCase(), name: (addr.admin1?.name || '').trim() },
    postal: (addr.postal || '').trim(),
    country: { code: (addr.country?.code || def).trim().toUpperCase(), name: (addr.country?.name || '').trim() },
    geo: addr.geo || null
  };
}
