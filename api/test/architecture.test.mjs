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
test('trusted API role can read global identity and tenant lookup tables', () => {
  const migration = read('db/007_api_identity_rls.sql');
  assert.match(migration, /create policy serviceup_api_access on public\.users/i);
  assert.match(migration, /create policy serviceup_api_access on public\.tenants/i);
});
test('administrator seed repairs passwords and links Supabase Auth', () => {
  const seed = read('api/seed.js');
  assert.match(seed, /password_hash = excluded\.password_hash/);
  assert.match(seed, /supabaseAdmin\.auth\.admin\.createUser/);
  assert.match(seed, /supabase_id = coalesce/);
});
test('dashboard login synchronizes live auth context before navigation', () => {
  const loginPage = read('dashboard/src/pages/Login.jsx');
  const app = read('dashboard/src/App.jsx');
  assert.match(loginPage, /const \{ login \} = useAuth\(\)/);
  assert.match(loginPage, /login\(res\.token, res\.user\)/);
  assert.match(app, /const \{ user, token, loadingAuth \} = useAuth\(\)/);
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
test('new Entry Views remain in create mode until first save', () => {
  const page = read('dashboard/src/pages/Settings/EntryViews.jsx');
  assert.match(page, /viewSlugFromRoute === "__new__"/);
  assert.match(page, /entry-views\/\$\{selectedTypeId\}\/__new__/);
  assert.match(page, /if \(!selectedTypeId \|\| isCreatingView\) return/);
});
test('Menus have a tenant-scoped API and persistent migration', () => {
  const app = read('api/index.js');
  const page = read('dashboard/src/pages/Menus/index.jsx');
  const migration = read('db/008_menus.sql');
  assert.match(app, /app\.use\('\/api\/menus', authMiddleware, menusRouter\)/);
  assert.match(page, /api\.post\('\/api\/menus'/);
  assert.match(migration, /create table if not exists public\.menus/i);
  assert.match(migration, /create policy tenant_isolation on public\.menus/i);
});
test('Menus can be selected, edited, reordered, saved, and deleted', () => {
  const page = read('dashboard/src/pages/Menus/index.jsx');
  const route = read('api/routes/menus.js');
  assert.match(page, /function selectMenu/);
  assert.match(page, /function moveItem/);
  assert.match(page, /Save Menu/);
  assert.match(route, /router\.put\('\/:id'/);
  assert.match(route, /router\.delete\('\/:id'/);
});
test('branding is cached and applied before the dashboard first paint', () => {
  const context = read('dashboard/src/context/SettingsContext.jsx');
  const main = read('dashboard/src/main.jsx');
  const branding = read('dashboard/src/lib/branding.js');
  assert.match(context, /if \(loading && !settings\) return null/);
  assert.match(context, /preloadBrandImages\(data\)/);
  assert.match(main, /applyBranding\(readCachedSettings\(\)\)/);
  assert.match(branding, /localStorage\.setItem\(cacheKey\(\)/);
});
test('branding supports tenant palettes, reading mode, backgrounds, menu colors, and custom CSS', () => {
  const page = read('dashboard/src/pages/Branding/index.jsx');
  const branding = read('dashboard/src/lib/branding.js');
  const topbar = read('dashboard/src/components/Topbar.jsx');
  assert.match(branding, /allowUserToggle/);
  assert.match(branding, /enableReadingMode/);
  assert.match(branding, /menuButtonActiveBg/);
  assert.match(branding, /dangerText/);
  assert.match(page, /Delete and remove buttons/);
  assert.match(branding, /backgroundVideoUrl/);
  assert.match(branding, /loginBackgroundVideoUrl/);
  assert.match(branding, /serviceup-custom-css/);
  assert.match(page, /Custom CSS/);
  assert.match(page, /Background video \(from Pixels\)/);
  assert.match(page, /Login background video \(from Pixels\)/);
  assert.match(read('dashboard/src/pages/Login.jsx'), /getThemeBackground\(settings, themeMode, 'login'\)/);
  assert.match(topbar, /cycleThemeMode/);
});
test('dashboard polish includes branded chrome, reorderable navigation, and stable role-aware views', () => {
  const settings = read('dashboard/src/pages/Settings/index.jsx');
  const editor = read('dashboard/src/pages/Content/Editor.jsx');
  const list = read('dashboard/src/pages/Content/TypeList.jsx');
  assert.match(read('dashboard/src/components/Topbar.jsx'), /su-brand-logo--topbar/);
  assert.match(read('dashboard/src/components/Sidebar.jsx'), /su-brand-logo--sidebar/);
  assert.match(read('dashboard/src/pages/Login.jsx'), /su-brand-logo--login/);
  assert.match(read('dashboard/src/components/Topbar.jsx'), /topbarLogoUrl/);
  assert.match(read('dashboard/src/components/Sidebar.jsx'), /sidebarLogoUrl/);
  assert.match(read('dashboard/src/components/LoadingPanel.jsx'), /su-loading-mark-ring/);
  assert.match(settings, /moveSidebarItem/);
  assert.match(settings, /moveTopbarItem/);
  assert.match(settings, /showEntryViewSwitcher/);
  assert.match(settings, /showListViewSwitcher/);
  assert.match(editor, /editorViews\.length > 1/);
  assert.match(editor, /Loading editor/);
  assert.doesNotMatch(editor, /Powered by QuickBuilder/);
  assert.match(list, /listViews\.length > 1/);
  assert.match(list, /<LoadingPanel label="Loading entries…"/);
  assert.match(read('dashboard/src/pages/Settings/EntryViews.jsx'), /Toggle preview/);
  assert.match(editor, /coreCfg\.layout !== "toggle" \|\| previewOpen/);
  assert.match(editor, /su-entry-json/);
  assert.match(editor, /const \{ user \} = useAuth\(\)/);
  assert.match(editor, /String\(user\?\.role \|\| "VIEWER"\)\.toUpperCase\(\)/);
  assert.match(settings, /Branding & Appearance/);
  assert.match(settings, /Show JSON for/);
  assert.match(read('dashboard/src/pages/Dashboards/index.jsx'), /const canCustomize = currentRole === "ADMIN"/);
  assert.match(read('dashboard/src/pages/Dashboards/index.jsx'), /canCustomize && <section className="su-dashboard-add"/);
  assert.match(read('dashboard/src/pages/Dashboards/index.jsx'), /\{\{name\}\}/);
  assert.match(read('dashboard/src/pages/Dashboards/index.jsx'), /\{\{date\}\}/);
  assert.match(read('dashboard/src/pages/Dashboards/index.jsx'), /name_first/);
  assert.match(read('dashboard/src/pages/Dashboards/index.jsx'), /user_name/);
  assert.match(settings, /Dashboard message/);
  assert.match(read('dashboard/src/hooks/useDashboard.js'), /Welcome to ServiceUp/);
  assert.match(editor, /Back to editor/);
  assert.match(editor, /Preview entry/);
  assert.match(read('dashboard/src/pages/Users/index.jsx'), /su-user-name-actions/);
});
test('signed-in non-admin roles can read assigned Entry and List Views', () => {
  const app = read('api/index.js');
  const entryViews = read('api/routes/entryViews.js');
  const listViews = read('api/routes/listViews.js');
  assert.match(app, /app\.use\('\/api', authMiddleware, entryViewsRouter\)/);
  assert.match(app, /app\.use\('\/api', authMiddleware, listViewsRouter\)/);
  assert.doesNotMatch(
    entryViews,
    /'\/content-types\/:id\/editor-views',\s*checkPermission\('manage_content_types'\)/
  );
  assert.doesNotMatch(
    listViews,
    /'\/content-types\/:id\/list-views',\s*checkPermission\('manage_content_types'\)/
  );
  assert.match(entryViews, /'\/content-types\/:id\/editor-view',\s*checkPermission\('manage_content_types'\)/);
  assert.match(listViews, /'\/content-types\/:id\/list-view',\s*checkPermission\('manage_content_types'\)/);
});
test('navigation settings offer Content Types and saved List Views', () => {
  const page = read('dashboard/src/pages/Settings/index.jsx');
  assert.match(page, /contentPageOptions/);
  assert.match(page, /\/admin\/content\/\$\{slug\}\/view\/\$\{view\.slug\}/);
  assert.match(page, /pageOptions\.map/);
});
test('successful ServiceUp login synchronizes Supabase Storage identity', () => {
  const app = read('api/index.js');
  const seed = read('api/seed.js');
  const login = read('dashboard/src/pages/Login.jsx');
  assert.match(app, /syncSupabaseStorageIdentity/);
  assert.match(app, /updateUserById\(supabaseId/);
  assert.match(seed, /updateUserById\(supabaseId/);
  assert.match(login, /supabase\.auth\.signInWithPassword/);
  assert.match(app, /name: user\.name \|\| ''/);
});
test('users have a permission-free self-service My Profile page', () => {
  const usersRoute = read('api/routes/users.js');
  const profile = read('dashboard/src/pages/MyProfile/index.jsx');
  const app = read('dashboard/src/App.jsx');
  assert.match(usersRoute, /router\.get\('\/me'/);
  assert.match(usersRoute, /router\.patch\('\/me'/);
  assert.match(profile, /Save My Profile/);
  assert.match(app, /\/admin\/my-profile/);
  assert.match(read('dashboard/src/context/AuthContext.jsx'), /api\.get\('\/api\/users\/me'\)/);
});
test('chrome branding supports edge-to-edge topbar and sidebar appearance', () => {
  const branding = read('dashboard/src/lib/branding.js');
  const page = read('dashboard/src/pages/Branding/index.jsx');
  const css = read('dashboard/src/styles/theme.css');
  assert.match(branding, /sidebarBackgroundImageUrl/);
  assert.match(branding, /topbarButtonBg/);
  assert.match(page, /Sidebar CSS gradient/);
  assert.match(page, /Top bar background/);
  assert.match(css, /grid-template-columns: 260px 1fr/);
  assert.match(css, /margin: 0/);
});
test('Panels provide template-aware page composition without frontend Widgets', () => {
  const input = read('dashboard/src/components/FieldInput.jsx');
  const builder = read('dashboard/src/pages/ContentTypes/QuickBuilder.jsx');
  const website = JSON.parse(read('api/gizmo-packs/website-basic.json'));
  assert.match(input, /function PanelsField/);
  assert.match(input, /Page template/);
  assert.match(builder, /Panels \(page sections\)/);
  assert.match(builder, /function PanelsConfigBuilder/);
  assert.match(builder, /\+ Add Panel Type/);
  assert.match(builder, /\+ Add Page Template/);
  assert.match(builder, /Advanced JSON/);
  const pageType = website.content_types.find((item) => item.slug === 'page');
  assert.equal(pageType.fields.some((field) => field.type === 'panels'), true);
});
