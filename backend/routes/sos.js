const express = require('express');
const { SosEvents, Contacts, Users } = require('../db');
const { requireAuth } = require('../auth');
const { sendSOSText } = require('../lib/twilio');

function mapsLink(location) {
  if (!location) return '';
  return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
}

module.exports = function sosRouter(io) {
  const router = express.Router();
  router.use(requireAuth);

  router.post('/', async (req, res) => {
    const { latitude, longitude, reason } = req.body || {};
    const location = latitude != null ? { latitude, longitude } : null;
    const event = await SosEvents.create({
      userId: req.user.sub,
      walkId: null,
      reason: reason || 'Manual SOS',
      location,
    });
    io.to(`user:${req.user.sub}`).emit('sos:ack', { id: event.id });
    res.status(201).json({ event });

    // Standalone SOS (not tied to an active walk) - there's no per-walk
    // contact list here, so text every trusted contact the user has saved.
    // This runs after the response is sent; the client doesn't wait on it.
    try {
      const [contacts, user] = await Promise.all([
        Contacts.list(req.user.sub),
        Users.findById(req.user.sub),
      ]);
      const numbers = contacts.map((c) => c.phone).filter(Boolean);
      if (numbers.length > 0) {
        const body =
          `SOS ALERT from ${user?.name || 'a SafetyWalk user'}.\n` +
          `${(reason || 'Manual SOS')}.\n` +
          `${location ? `Live location: ${mapsLink(location)}` : 'Location unavailable.'}`;
        await sendSOSText(numbers, body.trim());
      }
    } catch (err) {
      console.error('[sos] failed to text trusted contacts:', err.message);
    }
  });

  return router;
};
