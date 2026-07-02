import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const kv = Redis.fromEnv();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  // Optional shared-secret check, useful if you ping this route from an
  // external scheduler (e.g. cron-job.org) instead of Vercel Cron.
  if (process.env.CRON_SECRET) {
    const provided = req.query.secret || req.headers['x-cron-secret'];
    if (provided !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID keys are not configured in environment variables.' });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const today = todayStr();
  const users = (await kv.smembers('users')) || [];
  const results = [];

  for (const email of users) {
    try {
      const data = await kv.get(`user:${email}:data`);
      const subscription = await kv.get(`user:${email}:subscription`);
      if (!data || !subscription) {
        results.push({ email, skipped: 'no synced data or push subscription yet' });
        continue;
      }

      const lastNotified = await kv.get(`notify:${email}:lastDate`);
      if (lastNotified === today) {
        results.push({ email, skipped: 'already sent a notification today' });
        continue;
      }

      const items = [];
      (data.classes || []).forEach((c) => (c.tasks || []).forEach((t) => items.push(t)));
      (data.tasks || []).forEach((t) => items.push(t));

      const overdue = items.filter((t) => !t.done && t.due && t.due < today).length;
      const dueToday = items.filter((t) => !t.done && t.due === today).length;

      if (overdue === 0 && dueToday === 0) {
        await kv.set(`notify:${email}:lastDate`, today);
        results.push({ email, skipped: 'nothing due or overdue' });
        continue;
      }

      const parts = [];
      if (dueToday) parts.push(`${dueToday} due today`);
      if (overdue) parts.push(`${overdue} overdue`);
      const body = parts.join(' · ');

      await webpush.sendNotification(subscription, JSON.stringify({ title: 'Task Organizer', body }));
      await kv.set(`notify:${email}:lastDate`, today);
      results.push({ email, sent: true, body });
    } catch (e) {
      console.error('cron error for', email, e);
      results.push({ email, error: e.message });
    }
  }

  res.status(200).json({ userCount: users.length, results });
}
