// api/lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL;
// Prefer Supabase's current server-only secret key. The legacy service-role
// variable remains supported so existing installations can upgrade safely.
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  console.warn(
    '[supabaseAdmin] Missing SUPABASE_URL or SUPABASE_SECRET_KEY – Supabase sync will be disabled.'
  );
}

export const supabaseAdmin =
  url && secretKey
    ? createClient(url, secretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
