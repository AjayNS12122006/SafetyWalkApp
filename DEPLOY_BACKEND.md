# Making SafetyWalk work with no wired/LAN connection

Right now the app only works when your phone and the computer running
`backend/` are on the same Wi-Fi (or plugged in with a matching IP). To make
it work anywhere — mobile data, different city, doesn't matter — the
backend has to live on a server that's on 24/7, not your laptop.

This is a real deployment step outside this chat: it needs your own account
on a hosting provider. Below is the fastest free option.

## 1. Deploy the backend to Render (free tier, ~10 minutes)

1. Push this project to a GitHub repo (Render deploys from GitHub).
2. Go to https://render.com, sign up free, click **New +** → **Web Service**,
   connect your repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
4. Add environment variables (Render dashboard → Environment):
   ```
   JWT_SECRET=<any long random string>
   TWILIO_ACCOUNT_SID=   (optional, only if you set up Twilio)
   TWILIO_AUTH_TOKEN=
   TWILIO_FROM_NUMBER=
   ```
5. Deploy. Render gives you a public URL like
   `https://safetywalk-backend.onrender.com`.
6. Check it works: open `https://safetywalk-backend.onrender.com/api/health`
   in a browser — it should show `{"ok":true}`.

**Important limitation of Render's free tier:** the disk is *not*
persistent. Every redeploy (and periodically on the free plan) wipes
`backend/data/db.json` — so accounts, contacts and history reset. Fine for
testing; not fine for real use. Two ways around it, in order of effort:
- Easiest: Render's **Persistent Disk** add-on ($1/mo on paid plans) mounted
  at `backend/data` — nothing in the code changes.
- Better long-term (this was flagged as a known gap from the start): swap
  `lowdb` for a real hosted database — Render, Railway, and Supabase all
  offer a free Postgres instance. This needs rewriting `backend/db.js`
  only; every route file stays the same, since it's the isolated
  data-access layer by design.

Railway and Fly.io work the same way if you'd rather use those instead —
same three steps: root directory, build command, start command, and env
vars.

## 2. Point the app at the deployed backend

In `.env` at the project root:
```
EXPO_PUBLIC_API_BASE_URL=https://safetywalk-backend.onrender.com
```
(no port number needed — Render serves on 443/https)

## 3. Rebuild the app

`EXPO_PUBLIC_*` values are baked in at build time, so:
```
npx eas build --platform android --profile preview
```
The resulting APK now talks to your deployed backend from anywhere — no
Wi-Fi matching, no USB, no laptop needing to stay on.

## What doesn't need any of this

Testing in a **web browser on the same machine as the backend** already
works over `localhost` with zero network setup — that's unaffected either
way.
