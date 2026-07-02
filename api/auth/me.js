import { kv, getSessionEmail } from '../../lib/auth.js';

export default async function handler(req, res) {
  const email = await getSessionEmail(req);
  if (!email) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  const name = (await kv.get(`user:${email}:name`)) || email.split('@')[0];
  res.status(200).json({ email, name });
}
