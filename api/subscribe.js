import { kv, getSessionEmail } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const email = await getSessionEmail(req);
  if (!email) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  try {
    await kv.set(`user:${email}:subscription`, req.body);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
