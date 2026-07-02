import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.toLowerCase().trim().endsWith('@wpi.edu')) {
    return res.status(400).json({ error: 'Please use a valid @wpi.edu email address.' });
  }
  const cleanEmail = email.toLowerCase().trim();

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await kv.set(`otp:${cleanEmail}`, code, { ex: 600 }); // 10 minute expiry

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email sending is not configured yet. Add RESEND_API_KEY in Vercel.' });
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Task Organizer <onboarding@resend.dev>',
        to: [cleanEmail],
        subject: 'Your Task Organizer login code',
        html: `<p>Your login code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`
      })
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('Resend error', errBody);
      return res.status(500).json({ error: 'Could not send the email. Please try again.' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not send the email. Please try again.' });
  }

  res.status(200).json({ ok: true });
}
