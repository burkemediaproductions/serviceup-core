const pending = new Map();

function buildHookForTenant(tenant = {}) {
  const direct = String(process.env.NETLIFY_BUILD_HOOK_URL || '').trim();
  if (direct) return direct;
  try {
    const hooks = JSON.parse(process.env.SERVICEUP_SITE_BUILD_HOOKS || '{}');
    return String(hooks[tenant.slug] || hooks[tenant.id] || '').trim();
  } catch (error) {
    console.warn('[site-publisher] SERVICEUP_SITE_BUILD_HOOKS is not valid JSON');
    return '';
  }
}

export async function triggerSiteRebuild({ tenant = {}, reasons = [], fetchImpl = fetch } = {}) {
  const hook = buildHookForTenant(tenant);
  if (!hook) return { configured: false, triggered: false };
  const response = await fetchImpl(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      trigger_title: `ServiceUp publish: ${tenant.slug || tenant.id || 'site'}`,
      serviceup: { tenant: tenant.slug || tenant.id || null, reasons },
    }),
  });
  if (!response.ok) throw new Error(`Netlify build hook returned ${response.status}`);
  return { configured: true, triggered: true };
}

export function scheduleSiteRebuild(tenant = {}, reason = 'content changed') {
  const hook = buildHookForTenant(tenant);
  if (!hook) return false;
  const key = tenant.slug || tenant.id || 'default';
  const current = pending.get(key) || { tenant, reasons: new Set(), timer: null };
  current.reasons.add(reason);
  if (!current.timer) {
    const delay = Math.max(1000, Number(process.env.SERVICEUP_PUBLISH_DELAY_MS) || 15000);
    current.timer = setTimeout(async () => {
      pending.delete(key);
      try {
        await triggerSiteRebuild({ tenant: current.tenant, reasons: [...current.reasons] });
        console.log(`[site-publisher] requested rebuild for ${key}`);
      } catch (error) {
        console.error(`[site-publisher] rebuild request failed for ${key}`, error?.message || error);
      }
    }, delay);
    current.timer.unref?.();
  }
  pending.set(key, current);
  return true;
}
