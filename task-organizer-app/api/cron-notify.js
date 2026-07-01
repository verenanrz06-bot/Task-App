import { kv } from '@vercel/kv';
import webpush from 'web-push';

const DATA_KEY = 'app:data';
const SUB_KEY = 'push:subscription';
const LAST_NOTIFIED_KEY = 'notify:lastDate';

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

  const data = await kv.get(DATA_KEY);
  const subscription = await kv.get(SUB_KEY);

  if (!data || !subscription) {
    return res.status(200).json({ skipped: 'no synced data or push subscription yet' });
  }

  const today = todayStr();
  const lastNotified = await kv.get(LAST_NOTIFIED_KEY);
  if (lastNotified === today) {
    return res.status(200).json({ skipped: 'already sent a notification today' });
  }

  const items = [];
  (data.classes || []).forEach((c) => (c.tasks || []).forEach((t) => items.push(t)));
  (data.tasks || []).forEach((t) => items.push(t));

  const overdue = items.filter((t) => !t.done && t.due && t.due < today).length;
  const dueToday = items.filter((t) => !t.done && t.due === today).length;

  if (overdue === 0 && dueToday === 0) {
    await kv.set(LAST_NOTIFIED_KEY, today);
    return res.status(200).json({ skipped: 'nothing due or overdue' });
  }

  const parts = [];
  if (dueToday) parts.push(`${dueToday} due today`);
  if (overdue) parts.push(`${overdue} overdue`);
  const body = parts.join(' · ');

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: 'Task Organizer', body })
    );
  } catch (e) {
    console.error('push send failed', e);
    return res.status(500).json({ error: 'push send failed', detail: e.message });
  }

  await kv.set(LAST_NOTIFIED_KEY, today);
  res.status(200).json({ sent: true, body });
}
