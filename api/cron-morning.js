import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const kv = Redis.fromEnv();
const SUB_KEY = 'push:subscription';
const LAST_KEY = 'notify:morningLastDate';

// Keep this list in sync with the VERSES array in index.html, so the
// morning push and the in-app verse of the day always match.
const VERSES = [
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13 (NKJV)" },
  { text: "For I know the thoughts that I think toward you, says the LORD, thoughts of peace and not of evil, to give you a future and a hope.", ref: "Jeremiah 29:11 (NKJV)" },
  { text: "Trust in the LORD with all your heart, and lean not on your own understanding; in all your ways acknowledge Him, and He shall direct your paths.", ref: "Proverbs 3:5-6 (NKJV)" },
  { text: "But those who wait on the LORD shall renew their strength; they shall mount up with wings like eagles, they shall run and not be weary, they shall walk and not faint.", ref: "Isaiah 40:31 (NKJV)" },
  { text: "Have I not commanded you? Be strong and of good courage; do not be afraid, nor be dismayed, for the LORD your God is with you wherever you go.", ref: "Joshua 1:9 (NKJV)" },
  { text: "God is our refuge and strength, a very present help in trouble.", ref: "Psalm 46:1 (NKJV)" },
  { text: "And we know that all things work together for good to those who love God, to those who are the called according to His purpose.", ref: "Romans 8:28 (NKJV)" },
  { text: "For God has not given us a spirit of fear, but of power and of love and of a sound mind.", ref: "2 Timothy 1:7 (NKJV)" },
  { text: "This is the day the LORD has made; we will rejoice and be glad in it.", ref: "Psalm 118:24 (NKJV)" },
  { text: "And whatever you do, do it heartily, as to the Lord and not to men.", ref: "Colossians 3:23 (NKJV)" },
  { text: "Cast your burden on the LORD, and He shall sustain you; He shall never permit the righteous to be moved.", ref: "Psalm 55:22 (NKJV)" },
  { text: "Be anxious for nothing, but in everything by prayer and supplication, with thanksgiving, let your requests be made known to God.", ref: "Philippians 4:6 (NKJV)" },
  { text: "The LORD is my light and my salvation; whom shall I fear? The LORD is the strength of my life; of whom shall I be afraid?", ref: "Psalm 27:1 (NKJV)" },
  { text: "Commit your works to the LORD, and your thoughts will be established.", ref: "Proverbs 16:3 (NKJV)" }
];

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
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

  const subscription = await kv.get(SUB_KEY);
  if (!subscription) {
    return res.status(200).json({ skipped: 'no push subscription yet' });
  }

  const today = todayStr();
  const last = await kv.get(LAST_KEY);
  if (last === today) {
    return res.status(200).json({ skipped: 'already sent this morning' });
  }

  const now = new Date();
  const verse = VERSES[dayOfYear(now) % VERSES.length];
  const body = `"${verse.text}" - ${verse.ref}`;

  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title: 'Good morning', body }));
  } catch (e) {
    console.error('morning push failed', e);
    return res.status(500).json({ error: e.message });
  }

  await kv.set(LAST_KEY, today);
  res.status(200).json({ sent: true });
}
