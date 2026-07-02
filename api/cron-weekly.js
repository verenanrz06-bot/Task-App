import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const kv = Redis.fromEnv();
const DATA_KEY = 'app:data';
const SUB_KEY = 'push:subscription';
const LAST_KEY = 'notify:weeklyLastDate';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const provided = req.query.secret || req.headers['x-cron-secret'];
    if (provided !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID keys are not configured.' });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const data = await kv.get(DATA_KEY);
  const subscription = await kv.get(SUB_KEY);
  if (!data || !subscription) {
    return res.status(200).json({ skipped: 'no synced data or push subscription yet' });
  }

  const today = todayStr();
  const last = await kv.get(LAST_KEY);
  if (last === today) {
    return res.status(200).json({ skipped: 'already sent this week' });
  }

  const items = [];
  (data.classes || []).forEach((c) => (c.tasks || []).forEach((t) => items.push(t)));
  (data.tasks || []).forEach((t) => items.push(t));
  const stillOpen = items.filter((t) => !t.done).length;

  const body =
    stillOpen === 0
      ? "Nothing hanging over you this week. Well done — rest easy."
      : `${stillOpen} thing${stillOpen === 1 ? '' : 's'} still open. No pressure - reschedule what needs it, let go of what doesn't, and start fresh next week.`;

  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title: 'Weekly check-in', body }));
  } catch (e) {
    console.error('weekly push failed', e);
    return res.status(500).json({ error: e.message });
  }

  await kv.set(LAST_KEY, today);
  res.status(200).json({ sent: true, stillOpen });
}
