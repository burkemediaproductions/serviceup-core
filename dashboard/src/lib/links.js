const SAFE_SCHEME = /^(?:https?|mailto|tel):/i;
const RELATIVE_LINK = /^(?:\/|\.\/|\.\.\/|#|\?)/;
const EXPLICIT_SCHEME = /^[a-z][a-z\d+.-]*:/i;

export function normalizeLink(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (RELATIVE_LINK.test(value) || /^(?:mailto|tel):/i.test(value)) return value;
  if (EXPLICIT_SCHEME.test(value) && !/^https?:\/\//i.test(value)) return '';
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return SAFE_SCHEME.test(url.protocol) ? value : '';
    } catch {
      return '';
    }
  }
  if (/^[^\s/]+\.[^\s/]+(?:[/?#].*)?$/i.test(value)) return `https://${value}`;
  return value;
}

export function isSafeLink(raw) {
  return normalizeLink(raw) !== '';
}

export function isExternalLink(raw) {
  return /^https?:\/\//i.test(String(raw ?? '').trim());
}
