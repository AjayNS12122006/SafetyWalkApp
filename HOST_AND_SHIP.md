# SafetyWalk: full path to "a normal app"

"Normal app" = an APK/IPA anyone can install, that works on any network,
with a backend that's always on. Three parts: host the backend, point the
app at it, build the installable app. None of this can be done from inside
this chat — each step needs your own accounts — but here's the exact path.

---

## Part 1 — Host the backend (so it's always on, not your laptop)

### 1a. Put the project on GitHub
Render/Railway/Fly.io all deploy from a GitHub repo.
```
cd D:\SafetyWalkApp-main
git init
git add .
git commit -m "SafetyWalk"
```
Create a repo on github.com, then follow its "push an existing repo"
instructions.

### 1b. Deploy `backend/` to Render (free tier)
1. https://render.com → sign up free → **New +** → **Web Service** → connect
   your GitHub repo.
2. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
3. Environment variables (Render dashboard → Environment):
   ```
   JWT_SECRET=<any long random string>
   TWILIO_ACCOUNT_SID=       (optional)
   TWILIO_AUTH_TOKEN=        (optional)
   TWILIO_FROM_NUMBER=       (optional)
   ```
4. Deploy. You get a URL like `https://safetywalk-backend.onrender.com`.
5. Confirm it: open `https://safetywalk-backend.onrender.com/api/health` in
   a browser → should show `{"ok":true}`.

### 1c. Fix data loss (important before real use)
Render's free tier disk is NOT persistent — `backend/data/db.json` gets
wiped on redeploys and periodically otherwise. Your accounts/contacts/
history will disappear. Two fixes, pick one:
- **Quick:** Render's Persistent Disk add-on (~$1/mo on a paid plan),
  mounted at `backend/data`. No code changes.
- **Proper:** swap `lowdb` for a real database. Render/Railway/Supabase all
  offer a free Postgres instance. Only `backend/db.js` needs rewriting —
  every route file (`auth.js`, `walks.js`, `sos.js`, `contacts.js`,
  `safety.js`) stays untouched, since that isolation was the point of
  putting all storage logic in one file. Say the word and I'll do this
  rewrite for you.

If this is just for you and a couple of trusted contacts to test, you can
skip this and just accept the data resets occasionally — not worth the
setup for personal use.

---

## Part 2 — Point the app at the hosted backend

In `.env` at the project root:
```
EXPO_PUBLIC_API_BASE_URL=https://safetywalk-backend.onrender.com
```
No port number — Render serves HTTPS on 443 automatically.

---

## Part 3 — Build the installable app

### 3a. One-time setup
```
npm install -g eas-cli
cd D:\SafetyWalkApp-main
eas login
eas build:configure
```
`eas.json` (build profiles) is already in the project.

### 3b. Build the APK
```
eas build --platform android --profile preview
```
Takes a few minutes on Expo's servers. You get a download link and a QR
code for the finished `.apk`.

### 3c. Install it
Download the `.apk` on the phone (or scan the QR code) and tap to install.
Android will warn about "unknown sources" the first time — that's expected
and safe for your own APK; allow it.

At this point: the app has its own icon, opens standalone, works on mobile
data anywhere, and needs nothing running on your computer.

---

## Optional: publish it properly (Play Store / App Store)

Only worth it if you want other people to install it without you handing
them an APK file directly.

- **Android (Play Store):** needs a one-time $25 Google Play Developer
  account. Build with `eas build --platform android --profile production`
  (produces an `.aab`, not `.apk`), then `eas submit --platform android`.
  Expect a review of a few days to a couple weeks for a new developer account.
- **iOS (App Store):** needs a $99/year Apple Developer account. Same idea:
  `eas build --platform ios --profile production` then
  `eas submit --platform ios`. Apple's review is typically 1-3 days.

Neither is required to have a fully working, installable app — the Part 3
steps already produce that. Store publishing only matters if you want
"search and install from the store" distribution.

---

## Recap of what's already true vs. what needs your action

Already done (in the code, no action needed):
- Backend reads `process.env.PORT` and has CORS wide open — ready for any host
- `eas.json` build profiles are set up
- `app.json` has an Android package name / iOS bundle ID

Needs YOUR accounts (can't be done from this chat):
- A GitHub account to host the repo
- A Render (or similar) account to run the backend
- An Expo account to run `eas build`
- Optionally, Play Store / App Store developer accounts to publish
