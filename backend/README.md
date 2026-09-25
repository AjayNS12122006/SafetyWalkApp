# SafetyWalk Backend

A real backend for the SafetyWalk app: auth, trusted contacts, live-tracked
walks, and server-enforced auto-SOS — plus a public live-location page
contacts can open in any browser (no app install needed), the same way a
WhatsApp live-location link works.

## Stack
- **Express** — REST API
- **Socket.IO** — real-time location + SOS broadcast
- **lowdb** (JSON file on disk, `data/db.json`) — zero-setup database. The
  storage logic all lives in `db.js`, so swapping to Postgres/MySQL later
  only means rewriting that one file.
- **JWT + bcrypt** — auth

## Run it

```bash
cd backend
npm install
cp .env.example .env    # edit JWT_SECRET for anything beyond local testing
npm start
```

The server listens on `http://localhost:4000` (`/api/health` should return `{"ok":true}`).

## Point the app at it
Open `../lib/config.js` and set `API_HOST` to **your computer's LAN IP**
(not `localhost` — on a phone, `localhost` means the phone itself). Your
phone and computer need to be on the same Wi-Fi network.

## API overview

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create an account |
| POST | `/api/auth/login` | – | Get a JWT |
| GET | `/api/contacts` | ✔ | List trusted contacts |
| POST | `/api/contacts` | ✔ | Add a trusted contact |
| DELETE | `/api/contacts/:id` | ✔ | Remove a contact |
| POST | `/api/walks/start` | ✔ | Start a Safety Walk (returns `shareUrl`) |
| POST | `/api/walks/:id/location` | ✔ | Push a live location update |
| POST | `/api/walks/:id/arrive` | ✔ | Confirm safe arrival, cancels auto-SOS |
| POST | `/api/walks/:id/sos` | ✔ | Manual SOS during a walk |
| POST | `/api/sos` | ✔ | Standalone SOS (not tied to a walk) |
| GET | `/api/walks/history` | ✔ | Past walks |
| GET | `/view/:shareToken` | – | Public live-map page for contacts |

## How auto-SOS actually works
When a walk starts, the **server** (not the phone) schedules a timer for
the chosen ETA. If `/walks/:id/arrive` isn't called before that timer
fires, the server marks the walk `sos_auto`, logs an SOS event, and
broadcasts it to everyone with the share link open — this happens even if
the walker's phone loses signal or the app gets closed, which a purely
client-side timer can't guarantee.

## Known limitations (by design, for an MVP)
- SMS is sent by opening the phone's native SMS composer (`Linking.openURL('sms:...')`),
  which still needs the user to tap "send" once. For alerts that go out with
  zero taps even from a locked/backgrounded phone, wire in a provider like
  Twilio inside `routes/walks.js` / `routes/sos.js`.
- `lowdb` is a single JSON file — great for development, not for concurrent
  production traffic. Swap `db.js` for a real database when you're ready to
  ship.
