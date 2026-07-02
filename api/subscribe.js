import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const cookies = parseCookies(req);
  const token = cookies.session;
  const email = token ? await kv.get(`session:${token}`) : null;
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
