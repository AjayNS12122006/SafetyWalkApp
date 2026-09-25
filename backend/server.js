require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { init, Walks } = require('./db');
const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const safetyRoutes = require('./routes/safety');
const sosRoutesFactory = require('./routes/sos');
const walksRoutesFactory = require('./routes/walks');

const PORT = process.env.PORT || 4000;

async function main() {
  await init();

  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  // ---- REST API ----
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/safety', safetyRoutes);
  app.use('/api/walks', walksRoutesFactory(io));
  app.use('/api/sos', sosRoutesFactory(io));

  // ---- Public live-tracking page (no login, no app required) ----
  // This is the link that gets texted to trusted contacts, so anyone can
  // open it in a browser and watch the walker's live location update in
  // real time - the "share to closed ones like WhatsApp" experience.
  const viewTemplate = fs.readFileSync(path.join(__dirname, 'public', 'view.html'), 'utf-8');
  app.get('/view/:token', async (req, res) => {
    const walk = await Walks.findByShareToken(req.params.token);
    if (!walk) return res.status(404).send('This SafetyWalk link is no longer active.');

    const startLat = walk.lastLocation?.latitude ?? walk.destLat;
    const startLng = walk.lastLocation?.longitude ?? walk.destLng;

    const html = viewTemplate
      .replaceAll('%%TOKEN%%', walk.shareToken)
      .replaceAll('%%LAT%%', startLat)
      .replaceAll('%%LNG%%', startLng)
      .replaceAll('%%DEST%%', walk.destinationLabel || 'their destination')
      .replaceAll('%%NAME%%', 'Your contact');

    res.send(html);
  });

  // ---- Realtime: viewers (contacts) join a walk's room to watch it live ----
  io.on('connection', (socket) => {
    socket.on('join', ({ shareToken }) => {
      if (shareToken) socket.join(`walk:${shareToken}`);
    });

    // The walker's own app also joins a personal room so the server can
    // push them an 'sos:auto' nudge if the ETA timer expires.
    socket.on('identify', ({ userId }) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });

  server.listen(PORT, () => {
    console.log(`SafetyWalk backend listening on http://localhost:${PORT}`);
  });
}

main();
