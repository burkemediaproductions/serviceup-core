import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Widget remains dashboard-only', () => {
  assert.equal(fs.existsSync(path.join(root, 'api/routes/widgets.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'api/routes/publicWidgets.js')), false);
});
test('tenant migrations cover Profile and Pixels', () => {
  const migration = read('db/002_multitenancy.sql');
  assert.match(migration, /'pixels'/); assert.match(migration, /'organization_profiles'/);
});
test('public Profile explicitly filters private items', () => {
  assert.match(read('api/routes/profile.js'), /item\.is_public !== false/);
});
test('branding uses tenant settings and Pixels', () => {
  const page = read('dashboard/src/pages/Branding/index.jsx');
  assert.match(page, /api\.get\('\/api\/pixels/); assert.match(page, /api\.put\('\/settings'/);
});
test('BurkeMedia starter packs are valid and contain core models', () => {
  const crm = JSON.parse(read('api/gizmo-packs/burkemedia-crm.json'));
  const cms = JSON.parse(read('api/gizmo-packs/burkemedia-cms.json'));
  assert.deepEqual(crm.content_types.map((item) => item.slug), ['clients', 'contacts', 'leads', 'projects', 'tasks']);
  assert.deepEqual(cms.content_types.map((item) => item.slug), ['blog-posts', 'case-studies', 'services', 'testimonials']);
});
test('Activity and migration runner are present', () => {
  assert.match(read('db/006_activity_and_tasks.sql'), /activities\.manage/);
  assert.match(read('api/scripts/migrate.mjs'), /serviceup_migrations/);
});
