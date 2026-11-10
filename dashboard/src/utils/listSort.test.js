import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRows } from './listSort.js';

test('sortRows orders nested publication dates newest first and leaves blanks last', () => {
  const rows = [
    { title: 'No date', data: { published_at: '' } },
    { title: 'Older', data: { published_at: '2026-01-05' } },
    { title: 'Newer', data: { published_at: '2026-11-10' } },
  ];
  assert.deepEqual(
    sortRows(rows, { field: 'published_at', direction: 'desc' }).map((row) => row.title),
    ['Newer', 'Older', 'No date'],
  );
});

test('sortRows supports a secondary rule and natural text sorting', () => {
  const rows = [
    { title: 'Article 10', status: 'published' },
    { title: 'Article 2', status: 'published' },
    { title: 'Draft', status: 'draft' },
  ];
  assert.deepEqual(
    sortRows(rows, { field: 'status', direction: 'asc', secondaryField: 'title', secondaryDirection: 'asc' }).map((row) => row.title),
    ['Draft', 'Article 2', 'Article 10'],
  );
});

test('sortRows preserves API order when a view has no sort rule', () => {
  const rows = [{ title: 'B' }, { title: 'A' }];
  assert.deepEqual(sortRows(rows, null), rows);
});
