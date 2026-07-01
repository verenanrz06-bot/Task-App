# Task Organizer - hosted version with push notifications

This is your task/class organizer, restructured so it can run on a real
server. That unlocks two things the plain HTML file couldn't do:

1. **Installable on your phone as a real PWA** (not just a browser shortcut).
2. **Actual background push notifications** - a daily summary of what's due
   or overdue, delivered even when the app isn't open.

Your data (classes, tasks, categories) is stored the same way as before in
each browser's local storage, but now it also syncs to a small server-side
store so a cron job can check your due dates and send you a notification.

## What's in this folder

```
public/            the app itself (served as static files)
  index.html        the organizer, same one you've been using
  manifest.json      PWA metadata (name, icons, colors)
  sw.js              service worker (handles push notifications)
  icon-192.png       app icon
  icon-512.png       app icon
api/                serverless functions
  sync.js            saves/loads your data to the server
  subscribe.js        saves your phone's push subscription
  cron-notify.js      runs on a schedule, sends the notification
package.json        dependencies (@vercel/kv, web-push)
vercel.json          the cron schedule
.env.example         the environment variables you need to set
```

## Deploy it (about 10 minutes, all free)

**1. Create accounts (skip any you already have)**
- [github.com](https://github.com) - free
- [vercel.com](https://vercel.com) - free, sign up with your GitHub account (easiest)

**2. Get this folder onto GitHub**
- Create a new empty repository on GitHub (e.g. `task-organizer`).
- Upload this whole `task-organizer-app` folder's contents into it. The
  easiest way if you're not familiar with git: on the new repo's GitHub
  page, use "uploading an existing file" and drag in everything from this
  folder (keeping the `public/` and `api/` folder structure intact).

**3. Import the project into Vercel**
- In Vercel, click "Add New" -> "Project" -> pick the GitHub repo you just
  created -> Deploy. Vercel will detect it automatically; no configuration
  needed at this step.

**4. Add a database (Vercel KV)**
- In your new Vercel project, go to the **Storage** tab -> **Create
  Database** -> choose **KV** -> create it, then **Connect** it to this
  project. This automatically adds the `KV_REST_API_URL` /
  `KV_REST_API_TOKEN` environment variables for you - nothing to copy by
  hand.

**5. Add the notification keys**
- Still in the Vercel project, go to **Settings -> Environment Variables**
  and add these three (values are in `.env.example` in this folder,
  already generated and matched to the app's code):
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (an email, e.g. `mailto:you@example.com`)

**6. Redeploy**
- Go to the **Deployments** tab and redeploy the latest deployment (so it
  picks up the new environment variables and the database connection).

**7. Open it on your phone**
- Visit your new Vercel URL (something like `task-organizer-xyz.vercel.app`)
  in Safari (iPhone) or Chrome (Android).
- Share -> **Add to Home Screen**. Open it from the home screen icon.
- Tap **Enable Notifications** on the Home tab and allow the permission
  prompt. That's it - you're subscribed.

## How the notification actually works

Once a day (scheduled in `vercel.json`, currently 13:00 UTC - adjust the
cron expression there if you want a different time, keeping in mind
Vercel's schedule times are in UTC), `/api/cron-notify` runs automatically,
checks your synced data for anything due today or overdue, and - if there's
anything - sends one push notification like "2 due today - 1 overdue." It
only sends once per calendar day, so you won't get spammed.

Note: Vercel's free Hobby plan limits Cron Jobs to running once a day per
job, which is exactly what this needs, so you're fine on the free tier.

## Keeping your data in sync

Every time you add/edit/complete something in the app, it saves locally
*and* pushes a copy to the server automatically in the background. When you
open the app on another device, it pulls the latest server copy on load.
Because there's no login system, treat the URL as private - anyone with the
link could see your data. If you want it locked down, the simplest option
is turning on Vercel's built-in **Deployment Protection / Password
Protection** in the project settings.

## If you want your own VAPID keys instead of the provided ones

Run `npx web-push generate-vapid-keys`, then update `VAPID_PUBLIC_KEY` and
`VAPID_PRIVATE_KEY` in Vercel's environment variables *and* replace the
`VAPID_PUBLIC_KEY` constant near the bottom of `public/index.html` with the
new public key (both places must match).
