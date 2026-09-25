const express = require('express');
const { SafetyReports } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

router.post('/report', async (req, res) => {
  const { type, lat, lng, comment } = req.body || {};
  if (!type || !lat || !lng) {
    return res.status(400).json({ error: 'type, lat, and lng are required.' });
  }
  const report = await SafetyReports.add(req.user.sub, { type, lat, lng, comment });
  res.status(201).json({ report });
});

router.get('/nearby', async (req, res) => {
  const { lat, lng, radius } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required.' });
  }
  const reports = await SafetyReports.listNearby(parseFloat(lat), parseFloat(lng), parseFloat(radius) || 5);
  res.json({ reports });
});

module.exports = router;
