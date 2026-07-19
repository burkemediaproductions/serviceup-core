import dotenv from 'dotenv';

dotenv.config();

const ZERO_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export const SERVICEUP_MODE =
  String(process.env.SERVICEUP_MODE || 'dedicated').toLowerCase() === 'shared'
    ? 'shared'
    : 'dedicated';

export const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || ZERO_TENANT_ID;

export const IS_SHARED = SERVICEUP_MODE === 'shared';
export const IS_DEDICATED = !IS_SHARED;
export const SERVICEUP_DB_ROLE =
  process.env.SERVICEUP_DB_ROLE || 'serviceup_api';

export function publicDeploymentInfo() {
  return {
    mode: SERVICEUP_MODE,
    dedicated: IS_DEDICATED,
  };
}
