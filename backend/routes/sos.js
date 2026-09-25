const express = require('express');
const { SosEvents } = require('../db');
const { requireAuth } = require('../auth');

module.exports = function sosRouter(io) {
  const router = express.Router();
  router.use(requireAuth);

  router.post('/', async (req, res) => {
    const { latitude, longitude, reason } = req.body || {};
    const event = await SosEvents.create({
      userId: req.user.sub,
      walkId: null,
      reason: reason || 'Manual SOS',
      location: latitude != null ? { latitude, longitude } : null,
    });
    io.to(`user:${req.user.sub}`).emit('sos:ack', { id: event.id });
    res.status(201).json({ event });
  });

  return router;
};
