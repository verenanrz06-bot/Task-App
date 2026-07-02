# Bloom - hosted version with push notifications

This is Bloom (formerly "Task Organizer"), restructured so it can run on a
real server. That unlocks two things a plain HTML file couldn't do:

1. **Installable on your phone as a real PWA** (not just a browser shortcut).
2. **Actual background push notifications** - a daily summary of what's due
   or overdue, delivered even when the app isn't open.

This is currently set up as a single-user app (just for you). Your data
(classes, tasks, habits, inbox) is stored locally in the browser *and*
synced to a small server-side store, so a daily cron job can check your due
dates and send you a notification, and so your data can follow you between
your phone and computer.

## What's in this folder

```
index.html          the app itself
manifest.json         PWA metadata (name, icons, colors)
sw.js                 service worker (handles push notifications)
icon-192.png           app icon
icon-512.png           app icon
icon-192-maskable.png   app icon (safe-zone version for circular crops)
icon-512-maskable.png   app icon (safe-zone version for circular crops)
api/                  serverless functions
  sync.js              saves/loads your data
  subscribe.js          saves your push subscription
  cron-notify.js        runs daily, sends your notification if needed
package.json          dependencies (@upstash/redis, web-push)
vercel.json            the cron schedule
.env.example           the environment variables you need to set
```

Everything the browser needs to load directly (the HTML, manifest, service
worker, icons) sits at the top level of the project, not inside a `public/`
subfolder. Vercel only auto-serves a `public/` folder as your site root for
certain framework presets - since this project has no build step, keeping
those files at the root is what makes `https://your-app.vercel.app/`
actually find `index.html` instead of returning a 404.

**Note:** if you're updating an existing deployment that previously had
sign-in, delete the `api/auth` folder and the `lib` folder from your GitHub
repo if they're still there - they're no longer used.

## Deploy it (about 10 minutes, all free)

**1. Create accounts (skip any you already have)**
- [github.com](https://github.com) - free
- [vercel.com](https://vercel.com) - free, sign up with your GitHub account (easiest)

**2. Get this folder onto GitHub**
- Create a new empty repository on GitHub.
- Upload this whole folder's contents into it, keeping `index.html`,
  `manifest.json`, `sw.js`, and the icons at the top level of the repo
  (not inside a subfolder), with `api/` alongside them.

**3. Import the project into Vercel**
- In Vercel, click "Add New" -> "Project" -> pick the GitHub repo you just
  created -> Deploy. No configuration needed at this step.

**4. Add a database (Upstash Redis, via the Vercel Marketplace)**
- Vercel retired its native "KV" storage option, so the key-value store
  now comes from the Marketplace instead. In your project, go to the
  **Storage** tab -> **Browse Marketplace** (or **Connect Store**) ->
  search for **Upstash** -> choose **Upstash for Redis** -> follow the
  prompts to create a free database and connect it to this project. This
  automatically adds the `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` environment variables for you.

**5. Add the notification keys**
- Still in the Vercel project, go to **Settings -> Environment Variables**
  and add these three (values are in `.env.example` in this folder,
  already generated and matched to the app's code):
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (an email, e.g. `mailto:you@example.com`)

**6. Redeploy**
- Go to the **Deployments** tab and redeploy the latest deployment so it
  picks up the new environment variables and the database connection.

**7. Open it on your phone**
- Visit your Vercel URL in Safari (iPhone) or Chrome (Android).
- Share -> **Add to Home Screen**. Open it from the home screen icon.
- Tap **Enable Notifications** on the Today tab and allow the permission
  prompt.

## How the notification actually works

Once a day (scheduled in `vercel.json`, currently 13:00 UTC - adjust the
cron expression there if you want a different time), `/api/cron-notify`
runs automatically, checks your synced data for anything due today or
overdue, and - if there's anything - sends one push notification like
"2 due today · 1 overdue - you've got this." It only sends once per
calendar day, and rotates in a gentle encouragement line whenever
something's overdue rather than just reading off cold numbers.

There are now three separate scheduled jobs, all in `vercel.json`:
- `/api/cron-morning` (11:00 UTC) - sends that day's Bible verse.
- `/api/cron-notify` (13:00 UTC) - the due/overdue digest, plus a callout
  whenever a habit hits a streak milestone (3, 7, 14, 21, 30, 50, 60, 100,
  150, 200, or 365 days).
- `/api/cron-weekly` (23:00 UTC on Sundays) - a no-pressure weekly
  check-in: what's still open, with permission to reschedule or let it go.

Vercel's free Hobby plan allows up to 5 cron jobs per project, each capped
at running once a day - three jobs at once-daily frequency fits
comfortably within that.

## Keeping your data in sync

Every time you add/edit/complete something in the app, it saves locally
*and* pushes a copy to the server automatically in the background. Open the
app on another device and it pulls the latest server copy on load.

## If you ever want multiple people to use this

This version is deliberately single-user again. If you want to reopen it up
to other people later (e.g. other WPI students), that requires adding real
accounts back in - login codes emailed via a verified sending domain (not
Resend's shared test address, which can only email your own inbox), and
separating each person's data in the database. That's a bigger project than
what's here now; ask if you want to pick it back up.

## If you want your own VAPID keys instead of the provided ones

Run `npx web-push generate-vapid-keys`, then update `VAPID_PUBLIC_KEY` and
`VAPID_PRIVATE_KEY` in Vercel's environment variables *and* replace the
`VAPID_PUBLIC_KEY` constant near the bottom of `index.html` with the new
public key (both places must match).
