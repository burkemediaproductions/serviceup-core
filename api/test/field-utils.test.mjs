import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../lib/fieldUtils.js';

test('normalizeUrl preserves supported internal and action links', () => {
  assert.equal(normalizeUrl('/about/'), '/about/');
  assert.equal(normalizeUrl('../resources/file.pdf'), '../resources/file.pdf');
  assert.equal(normalizeUrl('#learn-more'), '#learn-more');
  assert.equal(normalizeUrl('?view=grid'), '?view=grid');
  assert.equal(normalizeUrl('mailto:hello@example.com'), 'mailto:hello@example.com');
  assert.equal(normalizeUrl('tel:+17605551234'), 'tel:+17605551234');
});

test('normalizeUrl accepts external links and convenient domain input', () => {
  assert.equal(normalizeUrl('https://Example.com/about'), 'https://example.com/about');
  assert.equal(normalizeUrl('example.com/about'), 'https://example.com/about');
});

test('normalizeUrl rejects unsafe or malformed explicit schemes', () => {
  assert.equal(normalizeUrl('javascript:alert(1)'), '');
  assert.equal(normalizeUrl('data:text/html,test'), '');
  assert.equal(normalizeUrl('https://'), '');
});
