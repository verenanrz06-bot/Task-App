import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const kv = Redis.fromEnv();

const DATA_KEY = 'app:data';
const SUB_KEY = 'push:subscription';
const LAST_NOTIFIED_KEY = 'notify:lastDate';

const ENCOURAGEMENTS = [
  'You\'ve got this.',
  'One step at a time.',
  'Small progress still counts.',
  'You\'re doing better than you think.',
  'No shame in a late start - just start.'
];

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 60, 100, 150, 200, 365];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function habitDueOn(h, dateStr) {
  const weekday = new Date(dateStr + 'T12:00:00').getDay();
  return (h.days || []).includes(weekday);
}

function habitStreak(h, today) {
  let streak = 0;
  let d = new Date(today + 'T12:00:00');
  const completions = h.completions || {};
  if (!completions[today] && habitDueOn(h, today)) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3650; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    if (habitDueOn(h, dateStr)) {
      if (completions[dateStr]) streak++;
      else break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default async function handler(req, res) {
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

  // Check for freshly-hit habit streak milestones, celebrated once each.
  const celebrated = [];
  for (const h of data.habits || []) {
    const streak = habitStreak(h, today);
    if (STREAK_MILESTONES.includes(streak)) {
      const key = `notify:streakCelebrated:${h.id}:${streak}`;
      const already = await kv.get(key);
      if (!already) {
        celebrated.push(`${streak}-day streak on "${h.name}"`);
        await kv.set(key, true);
      }
    }
  }

  if (overdue === 0 && dueToday === 0 && celebrated.length === 0) {
    await kv.set(LAST_NOTIFIED_KEY, today);
    return res.status(200).json({ skipped: 'nothing due, overdue, or worth celebrating' });
  }

  const parts = [];
  if (dueToday) parts.push(`${dueToday} due today`);
  if (overdue) parts.push(`${overdue} overdue`);
  let body = parts.join(' · ');

  if (overdue > 0) {
    const line = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    body = body ? `${body} - ${line}` : line;
  }

  if (celebrated.length) {
    const streakLine = `${celebrated.join(', ')} - keep going!`;
    body = body ? `${body}. Also: ${streakLine}` : streakLine;
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: 'Bloom', body })
    );
  } catch (e) {
    console.error('push send failed', e);
    return res.status(500).json({ error: 'push send failed', detail: e.message });
  }

  await kv.set(LAST_NOTIFIED_KEY, today);
  res.status(200).json({ sent: true, body });
}
