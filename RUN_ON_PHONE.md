# Getting SafetyWalk onto a phone

There are two different things "run on my phone" can mean. Pick one.

## Option A — Fastest: Expo Go (no build, ~2 minutes)

Good for testing on your own phone while developing. Not a real installable
app icon-on-homescreen experience for other people.

1. Install the **Expo Go** app from the Play Store / App Store on your phone.
2. On your computer, find your LAN IP (Windows: `ipconfig`, Mac/Linux:
   `ifconfig` or `ip a`) — the one under your Wi-Fi adapter, e.g. `192.168.1.23`.
3. Put that IP in `.env` at the project root:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:4000
   ```
4. Start the backend: `cd backend && npm install && npm start`
5. Start the app: `cd .. && npx expo start` (not `--web`)
6. Scan the QR code with the Expo Go app. **Your phone and computer must be
   on the same Wi-Fi network** — this will not work over mobile data or a
   guest network that isolates devices.

## Option B — A real installable APK (EAS Build)

This produces an actual `.apk` you can send to a phone and tap to install,
with its own home-screen icon — no Expo Go needed. This has to run through
Expo's cloud build service, using **your own free Expo account** — it can't
be done from inside this chat, since it needs your login and takes several
minutes on Expo's servers.

1. Create a free account at https://expo.dev if you don't have one.
2. `npm install -g eas-cli`
3. `cd` into the project root (not `backend/`) and run `eas login`.
4. `eas build:configure` — links this project to your Expo account (creates
   a project ID; `eas.json` with build profiles is already set up for you).
5. **Before building**, decide where the backend will live, since this gets
   baked into the APK at build time:
   - Same Wi-Fi only, for your own testing → keep `EXPO_PUBLIC_API_BASE_URL`
     as your computer's LAN IP in `.env`. Your computer must be running the
     backend and on the same network as the phone every time you use the app.
   - To actually hand this APK to someone else / use it away from home →
     deploy `backend/` somewhere reachable over the internet (Render,
     Railway, Fly.io, a VPS — anywhere that can run a Node process and stay
     on) and set `EXPO_PUBLIC_API_BASE_URL` to that public URL instead.
6. Build: `eas build --platform android --profile preview`
   This uploads the project, builds in the cloud, and gives you a link to
   download the `.apk` when it's done (a few minutes).
7. Download the `.apk` on the phone (or scan the QR code EAS prints) and
   tap it to install. Android will warn about installing from an unknown
   source the first time — that's expected for an APK not from the Play
   Store; allow it.

### Notes
- `EXPO_PUBLIC_*` env vars are compiled into the JS bundle at build time.
  Changing `.env` after building does nothing to an APK you already built —
  rebuild to pick up changes.
- iOS works the same way (`--platform ios`) but needs an Apple Developer
  account ($99/yr) to install on a physical device outside Expo Go/TestFlight.
- The ORS API key already in `.env` is a free-tier key with a daily quota —
  fine for personal use/demo, but don't publish this APK publicly with that
  key baked in if you expect real traffic; get your own key at
  openrouteservice.org if this goes beyond personal testing.
