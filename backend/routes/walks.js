const express = require('express');
const { Walks, SosEvents, Contacts, Users } = require('../db');
const { requireAuth } = require('../auth');
const { sendSOSText } = require('../lib/twilio');

function mapsLink(location) {
  if (!location) return '';
  return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
}

// Builds the text and fires it to every contact the walker picked for this
// walk, via Twilio - so the alert goes out from the server, with zero taps
// required on the walker's phone (works even if it's locked or dead).
async function textTrustedContacts(walk, { reason, location }) {
  const [contacts, user] = await Promise.all([
    Contacts.findByIds(walk.userId, walk.contactIds),
    Users.findById(walk.userId),
  ]);
  const numbers = contacts.map((c) => c.phone).filter(Boolean);
  if (numbers.length === 0) return;

  const body =
    `${reason.toUpperCase ? reason.toUpperCase() : reason} - SafetyWalk alert from ${user?.name || 'a SafetyWalk user'}.\n` +
    `${location ? `Live location: ${mapsLink(location)}\n` : ''}` +
    `${walk.shareUrl ? `Watch live: ${walk.shareUrl}` : ''}`;

  await sendSOSText(numbers, body.trim());
}

// In-memory map of walkId -> { main: Timer, warning: Timer }. This is what makes auto-SOS fire
// even if the walker never opens the app again before the deadline -
// the SERVER (not the phone) is the source of truth for the countdown.
const timers = new Map();

module.exports = function walksRouter(io) {
  const router = express.Router();

  function roomFor(shareToken) {
    return `walk:${shareToken}`;
  }

  async function sendWarning(walk) {
    const fresh = await Walks.find(walk.id);
    if (!fresh || fresh.status !== 'active') return;
    io.to(`user:${walk.userId}`).emit('sos:warning', {
      walkId: walk.id,
      secondsLeft: Math.round((fresh.deadlineAt - Date.now()) / 1000)
    });
  }

  async function fireAutoSOS(walk) {
    const fresh = await Walks.find(walk.id);
    if (!fresh || fresh.status !== 'active') return; // already arrived / cancelled

    await Walks.setStatus(walk.id, 'sos_auto');
    const event = await SosEvents.create({
      userId: walk.userId,
      walkId: walk.id,
      reason: "Didn't check in before the expected arrival time",
      location: fresh.lastLocation,
    });

    io.to(roomFor(walk.shareToken)).emit('sos', {
      reason: event.reason,
      location: fresh.lastLocation,
      at: event.createdAt,
    });
    // Also nudge the walker's own device (if still connected) so it can
    // fire the native SMS composer as a redundant delivery channel.
    io.to(`user:${walk.userId}`).emit('sos:auto', { walkId: walk.id });

    // Primary delivery path: the server texts every trusted contact
    // directly via Twilio, so this alert doesn't depend on the walker's
    // phone being on, unlocked, or even in the room's socket anymore.
    await textTrustedContacts(fresh, { reason: event.reason, location: fresh.lastLocation });
  }

  router.use(requireAuth);

  // Start a new safety walk
  router.post('/start', async (req, res) => {
    const { destinationLabel, destLat, destLng, etaMinutes, contactIds } = req.body || {};
    if (!destLat || !destLng || !etaMinutes) {
      return res.status(400).json({ error: 'destLat, destLng and etaMinutes are required.' });
    }
    const walk = await Walks.create(req.user.sub, {
      destinationLabel: destinationLabel || 'Selected destination',
      destLat,
      destLng,
      etaMinutes,
      contactIds: contactIds || [],
    });

    const mainTimer = setTimeout(() => fireAutoSOS(walk), etaMinutes * 60 * 1000);
    // Send warning 2-5 minutes before (capped at 30% of total time for short walks)
    const warnMinutes = Math.min(2, Math.max(0.5, etaMinutes * 0.3));
    const warningTimer = setTimeout(() => sendWarning(walk), (etaMinutes - warnMinutes) * 60 * 1000);

    timers.set(walk.id, { main: mainTimer, warning: warningTimer });

    const shareUrl = `${req.protocol}://${req.get('host')}/view/${walk.shareToken}`;
    await Walks.setShareUrl(walk.id, shareUrl);

    res.status(201).json({ walk: { ...walk, shareUrl }, shareUrl });
  });

  // Walker's phone streams periodic location updates while the walk is active
  router.post('/:id/location', async (req, res) => {
    const { latitude, longitude } = req.body || {};
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required.' });
    }
    const walk = await Walks.find(req.params.id);
    if (!walk || walk.userId !== req.user.sub) return res.status(404).json({ error: 'Walk not found.' });

    const updated = await Walks.updateLocation(walk.id, { latitude, longitude });
    io.to(roomFor(walk.shareToken)).emit('location', { latitude, longitude, at: Date.now() });
    res.json({ walk: updated });
  });

  function clearTimers(walkId) {
    const t = timers.get(walkId);
    if (t) {
      clearTimeout(t.main);
      clearTimeout(t.warning);
      timers.delete(walkId);
    }
  }

  // Walker confirms they reached the destination safely -> cancels auto-SOS
  router.post('/:id/arrive', async (req, res) => {
    const walk = await Walks.find(req.params.id);
    if (!walk || walk.userId !== req.user.sub) return res.status(404).json({ error: 'Walk not found.' });

    clearTimers(walk.id);
    const updated = await Walks.setStatus(walk.id, 'arrived');
    io.to(roomFor(walk.shareToken)).emit('arrived', { at: Date.now() });
    res.json({ walk: updated });
  });

  // Walker's own manual SOS button
  router.post('/:id/sos', async (req, res) => {
    const walk = await Walks.find(req.params.id);
    if (!walk || walk.userId !== req.user.sub) return res.status(404).json({ error: 'Walk not found.' });

    clearTimers(walk.id);
    await Walks.setStatus(walk.id, 'sos_manual');
    const event = await SosEvents.create({
      userId: walk.userId,
      walkId: walk.id,
      reason: 'Manual SOS',
      location: walk.lastLocation,
    });
    io.to(roomFor(walk.shareToken)).emit('sos', { reason: event.reason, location: walk.lastLocation, at: event.createdAt });

    await textTrustedContacts(walk, { reason: event.reason, location: walk.lastLocation });

    res.json({ ok: true });
  });

  // Walk / SOS history for the logged-in user. Merges in standalone SOS
  // events (ones fired outside of an active walk, e.g. from the home
  // screen's SOS button) so they show up in History too, not just
  // walk-tied statuses.
  router.get('/history', async (req, res) => {
    const [walks, standaloneSos] = await Promise.all([
      Walks.listForUser(req.user.sub),
      SosEvents.listStandaloneForUser(req.user.sub),
    ]);

    const sosItems = standaloneSos.map((event) => ({
      id: event.id,
      kind: 'sos', // distinguishes standalone SOS from a full walk record in the UI
      destinationLabel: 'Standalone SOS',
      status: 'sos_manual',
      startedAt: event.createdAt,
      endedAt: event.createdAt,
      etaMinutes: null,
      lastLocation: event.location,
      reason: event.reason,
    }));

    const walkItems = walks.map((w) => ({ ...w, kind: 'walk' }));

    const merged = [...walkItems, ...sosItems].sort((a, b) => b.startedAt - a.startedAt);

    res.json({ walks: merged });
  });

  return router;
};
