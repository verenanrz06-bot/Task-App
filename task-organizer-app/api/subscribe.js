import { kv } from '@vercel/kv';

// Single-user app: one push subscription stored under a fixed key.
const SUB_KEY = 'push:subscription';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await kv.set(SUB_KEY, req.body);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
