import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(apiRoot, '..');
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') return [];
      return walk(resolved);
    }
    return entry.name.endsWith('.js') ? [resolved] : [];
  });
}

for (const file of walk(apiRoot)) {
  const relative = path.relative(apiRoot, file);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('new pg.Pool') && relative !== 'dbPool.js') {
    failures.push(`${relative}: creates a database pool outside dbPool.js`);
  }
  if (/req\.user\?\.role\s*\|\|\s*['"]ADMIN['"]/.test(source)) {
    failures.push(`${relative}: grants an ADMIN fallback when role context is missing`);
  }
}

const migration = read('db/002_multitenancy.sql');
for (const table of [
  'content_types',
  'entries',
  'pixels',
  'organization_profiles',
  'entry_list_views',
  'entry_editor_views',
  'dashboard_layouts',
  'gadgets',
  'gizmos',
]) {
  if (!migration.includes(`'${table}'`)) {
    failures.push(`002_multitenancy.sql: ${table} is missing from tenant coverage`);
  }
}

for (const retiredPath of ['routes/widgets.js', 'routes/publicWidgets.js']) {
  if (fs.existsSync(path.join(apiRoot, retiredPath))) {
    failures.push(`${retiredPath}: frontend widgets must not return to the API`);
  }
}

if (!read('db/003_dashboard_widgets_only.sql').includes('legacy_frontend_widgets')) {
  failures.push('003_dashboard_widgets_only.sql: missing safe legacy widget preservation');
}

if (!read('db/004_pixels_media_library.sql').includes("'pixels.manage'")) {
  failures.push('004_pixels_media_library.sql: missing Pixels permission and media migration');
}

if (!read('db/005_organization_profile.sql').includes("'profile.manage'")) {
  failures.push('005_organization_profile.sql: missing Profile permission and tenant migration');
}

for (const required of [
  'force row level security',
  'serviceup_api',
  'tenant_users',
  'tenant_domains',
  'tenant_integrations',
]) {
  if (!migration.toLowerCase().includes(required)) {
    failures.push(`002_multitenancy.sql: missing ${required}`);
  }
}

if (failures.length) {
  console.error('ServiceUp tenant audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('ServiceUp tenant architecture audit: OK');
