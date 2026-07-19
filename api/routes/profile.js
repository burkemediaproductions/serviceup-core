import { Router } from 'express';
import auth from '../middleware/auth.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();
const arrayFields = ['phone_numbers', 'email_addresses', 'addresses', 'websites', 'social_profiles'];

const emptyProfile = () => ({
  display_name: '', legal_name: '', legal_name_public: false, description: '',
  phone_numbers: [], email_addresses: [], addresses: [], websites: [], social_profiles: [],
});

function normalizeItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

async function loadProfile(db) {
  const { rows } = await db.query(
    `select id, display_name, legal_name, legal_name_public, description,
            phone_numbers, email_addresses, addresses, websites, social_profiles,
            created_at, updated_at
       from organization_profiles limit 1`,
  );
  return rows[0] || emptyProfile();
}

function publicProfile(profile) {
  const result = {
    display_name: profile.display_name || '',
    description: profile.description || '',
    phone_numbers: normalizeItems(profile.phone_numbers).filter((item) => item.is_public !== false),
    email_addresses: normalizeItems(profile.email_addresses).filter((item) => item.is_public !== false),
    addresses: normalizeItems(profile.addresses).filter((item) => item.is_public !== false),
    websites: normalizeItems(profile.websites).filter((item) => item.is_public !== false),
    social_profiles: normalizeItems(profile.social_profiles).filter((item) => item.is_public !== false),
    updated_at: profile.updated_at || null,
  };
  if (profile.legal_name_public && profile.legal_name) result.legal_name = profile.legal_name;
  return result;
}

function schemaOrg(profile) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: profile.display_name || undefined,
    legalName: profile.legal_name || undefined,
    description: profile.description || undefined,
    url: profile.websites.find((item) => item.is_primary)?.url || profile.websites[0]?.url || undefined,
    telephone: profile.phone_numbers.find((item) => item.is_primary)?.value || profile.phone_numbers[0]?.value || undefined,
    email: profile.email_addresses.find((item) => item.is_primary)?.value || profile.email_addresses[0]?.value || undefined,
    sameAs: profile.social_profiles.map((item) => item.url).filter(Boolean),
    address: profile.addresses.map((item) => ({
      '@type': 'PostalAddress', streetAddress: item.street || undefined,
      addressLocality: item.city || undefined, addressRegion: item.region || undefined,
      postalCode: item.postal_code || undefined, addressCountry: item.country || undefined,
    })),
  };
}

router.get('/public/organization-profile', async (req, res) => {
  try {
    const profile = publicProfile(await loadProfile(req.db));
    return res.json({ profile, schema: schemaOrg(profile) });
  } catch (error) {
    console.error('[GET /api/public/organization-profile]', error);
    return res.status(500).json({ error: 'Failed to load organization profile' });
  }
});

router.get('/profile', auth, checkPermission('profile.manage'), async (req, res) => {
  try {
    return res.json(await loadProfile(req.db));
  } catch (error) {
    console.error('[GET /api/profile]', error);
    return res.status(500).json({ error: 'Failed to load Profile' });
  }
});

router.put('/profile', auth, checkPermission('profile.manage'), async (req, res) => {
  const body = req.body || {};
  const values = Object.fromEntries(arrayFields.map((field) => [field, normalizeItems(body[field])]));
  try {
    const { rows } = await req.db.query(
      `insert into organization_profiles
         (tenant_id, display_name, legal_name, legal_name_public, description,
          phone_numbers, email_addresses, addresses, websites, social_profiles)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (tenant_id) do update set
         display_name = excluded.display_name, legal_name = excluded.legal_name,
         legal_name_public = excluded.legal_name_public, description = excluded.description,
         phone_numbers = excluded.phone_numbers, email_addresses = excluded.email_addresses,
         addresses = excluded.addresses, websites = excluded.websites,
         social_profiles = excluded.social_profiles, updated_at = now()
       returning *`,
      [
        req.tenantId, String(body.display_name || '').trim(), String(body.legal_name || '').trim() || null,
        body.legal_name_public === true, String(body.description || '').trim() || null,
        values.phone_numbers, values.email_addresses, values.addresses,
        values.websites, values.social_profiles,
      ],
    );
    return res.json(rows[0]);
  } catch (error) {
    console.error('[PUT /api/profile]', error);
    return res.status(500).json({ error: 'Failed to save Profile' });
  }
});

export default router;
