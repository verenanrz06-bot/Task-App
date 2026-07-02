import { kv, getSessionEmail } from '../lib/auth.js';

export default async function handler(req, res) {
  const email = await getSessionEmail(req);
  if (!email) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  const dataKey = `user:${email}:data`;

  if (req.method === 'GET') {
    const data = await kv.get(dataKey);
    return res.status(200).json(data || null);
  }

  if (req.method === 'POST') {
    try {
      await kv.set(dataKey, req.body);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
}
