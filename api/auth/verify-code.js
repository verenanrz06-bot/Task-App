import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code, name } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Missing email or code.' });
  }
  const cleanEmail = String(email).toLowerCase().trim();

  const stored = await kv.get(`otp:${cleanEmail}`);
  if (!stored || String(stored) !== String(code).trim()) {
    return res.status(400).json({ error: 'That code is invalid or expired.' });
  }
  await kv.del(`otp:${cleanEmail}`);
  await kv.sadd('users', cleanEmail);

  let displayName = (name || '').trim();
  if (!displayName) {
    const existing = await kv.get(`user:${cleanEmail}:name`);
    displayName = existing || cleanEmail.split('@')[0];
  }
  await kv.set(`user:${cleanEmail}:name`, displayName);

  const token = crypto.randomBytes(24).toString('hex');
  await kv.set(`session:${token}`, cleanEmail, { ex: 60 * 60 * 24 * 30 }); // 30 days

  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
  );
  res.status(200).json({ ok: true, email: cleanEmail, name: displayName });
}
