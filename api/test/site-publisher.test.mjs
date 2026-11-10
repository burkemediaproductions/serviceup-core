import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerSiteRebuild } from '../lib/sitePublisher.js';

test('site publisher remains inert when no build hook is configured', async () => {
  const previousDirect = process.env.NETLIFY_BUILD_HOOK_URL;
  const previousMap = process.env.SERVICEUP_SITE_BUILD_HOOKS;
  delete process.env.NETLIFY_BUILD_HOOK_URL;
  delete process.env.SERVICEUP_SITE_BUILD_HOOKS;
  try {
    assert.deepEqual(await triggerSiteRebuild({ tenant: { slug: 'asas' } }), { configured:false, triggered:false });
  } finally {
    if (previousDirect === undefined) delete process.env.NETLIFY_BUILD_HOOK_URL; else process.env.NETLIFY_BUILD_HOOK_URL = previousDirect;
    if (previousMap === undefined) delete process.env.SERVICEUP_SITE_BUILD_HOOKS; else process.env.SERVICEUP_SITE_BUILD_HOOKS = previousMap;
  }
});

test('site publisher posts to the hook configured for a tenant', async () => {
  const previous = process.env.SERVICEUP_SITE_BUILD_HOOKS;
  delete process.env.NETLIFY_BUILD_HOOK_URL;
  process.env.SERVICEUP_SITE_BUILD_HOOKS = JSON.stringify({ asas: 'https://example.test/build' });
  let request;
  try {
    const result = await triggerSiteRebuild({
      tenant: { slug: 'asas' },
      reasons: ['updated article/example'],
      fetchImpl: async (url, options) => { request = { url, options }; return { ok:true, status:200 }; },
    });
    assert.deepEqual(result, { configured:true, triggered:true });
    assert.equal(request.url, 'https://example.test/build');
    assert.equal(request.options.method, 'POST');
    assert.match(request.options.body, /updated article\/example/);
  } finally {
    if (previous === undefined) delete process.env.SERVICEUP_SITE_BUILD_HOOKS; else process.env.SERVICEUP_SITE_BUILD_HOOKS = previous;
  }
});
