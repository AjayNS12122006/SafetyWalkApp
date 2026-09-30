const express = require('express');
const { Contacts } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  res.json({ contacts: await Contacts.list(req.user.sub) });
});

router.post('/', async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required.' });
  const contact = await Contacts.add(req.user.sub, { name: name.trim(), phone: phone.trim() });
  res.status(201).json({ contact });
});

router.delete('/:id', async (req, res) => {
  const contacts = await Contacts.remove(req.user.sub, req.params.id);
  res.json({ contacts });
});

module.exports = router;
