// -----------------------------------------------------------------------
// Twilio SMS gateway. This is what makes SOS "zero-tap" for real: instead
// of just telling the walker's phone to open its SMS composer (which
// needs a live, unlocked phone), the SERVER sends the text directly to
// every trusted contact the moment an SOS fires.
//
// Configure via env vars (see backend/.env.example):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER   (a Twilio number, E.164 format e.g. +15551234567)
//
// If these aren't set, sendSOSText() no-ops and logs a warning instead of
// throwing - so local/dev usage keeps working without a Twilio account,
// and the client-side SMS/WhatsApp composer in lib/sos.js remains a
// working fallback either way.
// -----------------------------------------------------------------------

const { ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER } = {
  ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
};

let client = null;
let attemptedInit = false;

function getClient() {
  if (attemptedInit) return client;
  attemptedInit = true;
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    console.warn(
      '[twilio] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER not set - ' +
        'server-side SOS texts are disabled. The app still falls back to the ' +
        "walker's own SMS/WhatsApp composer for manual SOS."
    );
    return null;
  }
  try {
    // Lazy require so a missing `twilio` package doesn't crash the whole
    // server if someone hasn't run `npm install` yet after this feature landed.
    const twilio = require('twilio');
    client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  } catch (err) {
    console.warn('[twilio] failed to load twilio SDK - is it installed? (`npm install` in backend/)', err.message);
    client = null;
  }
  return client;
}

// Sends one text to each phone number. Best-effort per-recipient: one bad
// number shouldn't stop the rest from going out. Returns a summary the
// caller can log/inspect but never throws.
async function sendSOSText(numbers, body) {
  const c = getClient();
  const results = [];
  if (!c) {
    return numbers.map((to) => ({ to, ok: false, error: 'twilio_not_configured' }));
  }
  for (const to of numbers) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const msg = await c.messages.create({ to, from: FROM_NUMBER, body });
      results.push({ to, ok: true, sid: msg.sid });
    } catch (err) {
      results.push({ to, ok: false, error: err.message });
      console.error(`[twilio] failed to send SOS text to ${to}:`, err.message);
    }
  }
  return results;
}

function isConfigured() {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && FROM_NUMBER);
}

module.exports = { sendSOSText, isConfigured };
