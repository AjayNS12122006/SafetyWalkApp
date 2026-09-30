const express = require('express');
const { Users } = require('../db');
const { hashPassword, comparePassword, signToken } = require('../auth');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    bloodGroup: user.bloodGroup || '',
    address: user.address || '',
    home: user.home || null,
    office: user.office || null,
  };
}

router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'name, email, phone and password are all required.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await Users.findByEmail(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = await hashPassword(password);
  const user = await Users.create({ name: name.trim(), email: normalizedEmail, phone: phone.trim(), passwordHash });

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

  const user = await Users.findByEmail(String(email).trim().toLowerCase());
  if (!user) return res.status(401).json({ error: 'Incorrect email or password.' });

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', require('../auth').requireAuth, async (req, res) => {
  const user = await Users.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

// Saves editable profile fields (name, phone, blood group, address, and
// home/office - each with an optional {label, lat, lng} so "Walk Me Home"
// can prefill a walk's destination with one tap).
router.put('/profile', require('../auth').requireAuth, async (req, res) => {
  const { name, phone, bloodGroup, address, home, office } = req.body || {};
  const user = await Users.updateProfile(req.user.sub, { name, phone, bloodGroup, address, home, office });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
