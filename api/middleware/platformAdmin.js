import dotenv from 'dotenv';

dotenv.config();

const PLATFORM_ADMINS = new Set(
  String(process.env.SERVICEUP_PLATFORM_ADMINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export default function platformAdmin(req, res, next) {
  const email = String(req.user?.email || '').toLowerCase();
  if (!email || !PLATFORM_ADMINS.has(email)) {
    return res.status(403).json({ error: 'Platform administrator access required' });
  }
  return next();
}
