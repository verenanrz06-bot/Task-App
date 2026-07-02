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
index.html          the organizer, same one you've been using
manifest.json        PWA metadata (name, icons, colors)
sw.js                service worker (handles push notifications)
icon-192.png          app icon
icon-512.png          app icon
icon-192-maskable.png  app icon (safe-zone version for circular crops)
icon-512-maskable.png  app icon (safe-zone version for circular crops)
api/                 serverless functions
  sync.js             saves/loads the signed-in user's data
  subscribe.js         saves the signed-in user's push subscription
  cron-notify.js       runs daily, notifies every user who needs it
  auth/
    request-code.js     emails a 6-digit login code to a @wpi.edu address
    verify-code.js       checks the code, creates a signed-in session
    me.js                 tells the client who's currently signed in
    logout.js             clears the session
lib/
  auth.js             shared helpers: database client, session lookup
package.json         dependencies (@upstash/redis, web-push)
vercel.json           the cron schedule
.env.example          the environment variables you need to set
```

Everything the browser needs to load directly (the HTML, manifest, service
worker, icons) sits at the top level of the project, not inside a `public/`
subfolder. Vercel only auto-serves a `public/` folder as your site root for
certain framework presets - since this project has no build step, keeping
those files at the root is what makes `https://your-app.vercel.app/`
actually find `index.html` instead of returning a 404.

## Deploy it (about 10 minutes, all free)

**1. Create accounts (skip any you already have)**
- [github.com](https://github.com) - free
- [vercel.com](https://vercel.com) - free, sign up with your GitHub account (easiest)

**2. Get this folder onto GitHub**
- Create a new empty repository on GitHub (e.g. `task-organizer`).
- Upload this whole `task-organizer-app` folder's contents into it. The
  easiest way if you're not familiar with git: on the new repo's GitHub
  page, use "uploading an existing file" and drag in everything from this
  folder (keeping the `api/` folder structure intact - `index.html`,
  `manifest.json`, `sw.js`, and the icons should all sit at the top level
  of the repo, not inside a subfolder).

**3. Import the project into Vercel**
- In Vercel, click "Add New" -> "Project" -> pick the GitHub repo you just
  created -> Deploy. Vercel will detect it automatically; no configuration
  needed at this step.

**4. Add a database (Upstash Redis, via the Vercel Marketplace)**
- Vercel retired its native "KV" storage option, so the key-value store
  now comes from the Marketplace instead. In your project, go to the
  **Storage** tab -> **Browse Marketplace** (or **Connect Store**) ->
  search for **Upstash** -> choose **Upstash for Redis** -> follow the
  prompts to create a free database and connect it to this project. This
  automatically adds the `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` environment variables for you - nothing to
  copy by hand. (Direct link: vercel.com/marketplace/upstash)

**5. Add the notification and login keys**
- Still in the Vercel project, go to **Settings -> Environment Variables**
  and add these (values for the VAPID ones are in `.env.example` in this
  folder, already generated and matched to the app's code):
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (an email, e.g. `mailto:you@example.com`)
  - `RESEND_API_KEY` - sign up free at [resend.com](https://resend.com)
    (no credit card, 100 emails/day / 3,000/month free), create an API
    key, paste it here. This is what actually emails people their login
    codes.

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

## Accounts (WPI email + login code)

Anyone with a `@wpi.edu` email can now use this app - it's no longer just
for one person. Here's how it works:

1. On first visit, someone enters their WPI email and their first name.
2. A 6-digit code gets emailed to them (via Resend) and expires in 10
   minutes.
3. Once verified, they get a signed-in session (a secure cookie, good for
   30 days) and their own private space in the database - completely
   separate from everyone else's classes, tasks, habits, and inbox.
4. The daily notification cron job loops through every signed-up user and
   sends each of them their own summary, only if they've enabled
   notifications and have something due or overdue.

Non-`@wpi.edu` addresses are rejected before a code is even sent. There's
no way for one user to see another user's data - each person's data lives
under their own key in the database, and every API route checks who's
signed in before reading or writing anything.

**A note on the sender email:** codes are sent from Resend's shared test
address (`onboarding@resend.dev`), which works immediately with no setup
but may occasionally land in spam, especially the first time a given inbox
receives from it. If this becomes a real rollout, verifying your own domain
with Resend (still free) will make delivery more reliable and let you send
from something like `login@yourdomain.com` instead.

## Keeping your data in sync

Every time you add/edit/complete something in the app, it saves locally
*and* pushes a copy to the server automatically in the background, scoped
to your signed-in account. Open the app on another device and sign in with
the same email, and it pulls your latest data automatically.

## If you want your own VAPID keys instead of the provided ones

Run `npx web-push generate-vapid-keys`, then update `VAPID_PUBLIC_KEY` and
`VAPID_PRIVATE_KEY` in Vercel's environment variables *and* replace the
`VAPID_PUBLIC_KEY` constant near the bottom of `index.html` with the
new public key (both places must match).
