import { kv } from '@vercel/kv';

// Single-user app: everything lives under one fixed key.
const DATA_KEY = 'app:data';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await kv.get(DATA_KEY);
    return res.status(200).json(data || null);
  }

  if (req.method === 'POST') {
    try {
      await kv.set(DATA_KEY, req.body);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
}
