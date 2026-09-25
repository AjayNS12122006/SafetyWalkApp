const express = require('express');
const { Walks, SosEvents, Contacts } = require('../db');
const { requireAuth } = require('../auth');

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
    res.status(201).json({ walk, shareUrl });
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
    res.json({ ok: true });
  });

  // Walk / SOS history for the logged-in user
  router.get('/history', async (req, res) => {
    res.json({ walks: await Walks.listForUser(req.user.sub) });
  });

  return router;
};
