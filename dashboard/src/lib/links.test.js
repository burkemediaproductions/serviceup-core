import test from 'node:test';
import assert from 'node:assert/strict';
import { isExternalLink, isSafeLink, normalizeLink } from './links.js';

test('normalizeLink supports links used by pages and panels', () => {
  for (const link of ['/about/', './child', '../parent', '#section', '?tab=one', 'mailto:a@b.com', 'tel:+17605551234']) {
    assert.equal(normalizeLink(link), link);
    assert.equal(isSafeLink(link), true);
  }
  assert.equal(normalizeLink('example.com/path'), 'https://example.com/path');
  assert.equal(isExternalLink('/about/'), false);
  assert.equal(isExternalLink('https://example.com'), true);
});

test('normalizeLink rejects unsafe schemes', () => {
  assert.equal(normalizeLink('javascript:alert(1)'), '');
  assert.equal(normalizeLink('data:text/html,test'), '');
  assert.equal(isSafeLink('javascript:alert(1)'), false);
});
