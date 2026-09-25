const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');

const file = path.join(__dirname, 'data', 'db.json');
const adapter = new JSONFile(file);
const defaultData = { users: [], contacts: [], walks: [], sosEvents: [], safetyReports: [] };
const db = new Low(adapter, defaultData);

async function init() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
}

// -----------------------------------------------------------------------
// NOTE ON PRODUCTION MIGRATION
// This uses lowdb (a JSON file on disk) so the backend runs anywhere with
// zero native build steps. The functions below are the ONLY place that
// touches storage, so swapping to Postgres/MySQL later just means
// rewriting this one file (db.js) - routes/sockets never touch the file
// directly.
// -----------------------------------------------------------------------

const Users = {
  async create({ name, email, phone, passwordHash }) {
    await db.read();
    const user = { id: nanoid(), name, email, phone, passwordHash, createdAt: Date.now() };
    db.data.users.push(user);
    await db.write();
    return user;
  },
  async findByEmail(email) {
    await db.read();
    return db.data.users.find((u) => u.email === email) || null;
  },
  async findById(id) {
    await db.read();
    return db.data.users.find((u) => u.id === id) || null;
  },
  async updateProfile(id, updates) {
    await db.read();
    const user = db.data.users.find((u) => u.id === id);
    if (user) {
      const { name, phone, bloodGroup, address, home, office } = updates;
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
      if (address !== undefined) user.address = address;
      if (home !== undefined) user.home = home;
      if (office !== undefined) user.office = office;
      await db.write();
    }
    return user;
  },
};

const Contacts = {
  async list(userId) {
    await db.read();
    return db.data.contacts.filter((c) => c.userId === userId);
  },
  async add(userId, { name, phone }) {
    await db.read();
    const contact = { id: nanoid(), userId, name, phone, createdAt: Date.now() };
    db.data.contacts.push(contact);
    await db.write();
    return contact;
  },
  async remove(userId, contactId) {
    await db.read();
    db.data.contacts = db.data.contacts.filter((c) => !(c.id === contactId && c.userId === userId));
    await db.write();
    return Contacts.list(userId);
  },
};

const Walks = {
  async create(userId, { destinationLabel, destLat, destLng, etaMinutes, contactIds }) {
    await db.read();
    const walk = {
      id: nanoid(),
      shareToken: nanoid(12),
      userId,
      destinationLabel,
      destLat,
      destLng,
      etaMinutes,
      contactIds,
      status: 'active', // active | arrived | sos_auto | sos_manual
      startedAt: Date.now(),
      deadlineAt: Date.now() + etaMinutes * 60 * 1000,
      lastLocation: null,
      endedAt: null,
    };
    db.data.walks.push(walk);
    await db.write();
    return walk;
  },
  async find(walkId) {
    await db.read();
    return db.data.walks.find((w) => w.id === walkId) || null;
  },
  async findByShareToken(shareToken) {
    await db.read();
    return db.data.walks.find((w) => w.shareToken === shareToken) || null;
  },
  async listForUser(userId) {
    await db.read();
    return db.data.walks
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 50);
  },
  async updateLocation(walkId, location) {
    await db.read();
    const walk = db.data.walks.find((w) => w.id === walkId);
    if (walk) {
      walk.lastLocation = { ...location, at: Date.now() };
      await db.write();
    }
    return walk;
  },
  async setStatus(walkId, status) {
    await db.read();
    const walk = db.data.walks.find((w) => w.id === walkId);
    if (walk) {
      walk.status = status;
      walk.endedAt = ['arrived', 'sos_auto', 'sos_manual'].includes(status) ? Date.now() : walk.endedAt;
      await db.write();
    }
    return walk;
  },
};

const SosEvents = {
  async create({ userId, walkId, reason, location }) {
    await db.read();
    const event = { id: nanoid(), userId, walkId: walkId || null, reason, location, createdAt: Date.now() };
    db.data.sosEvents.push(event);
    await db.write();
    return event;
  },
};

const SafetyReports = {
  async add(userId, { type, lat, lng, comment }) {
    await db.read();
    const report = {
      id: nanoid(),
      userId,
      type, // 'safe' | 'avoid'
      lat,
      lng,
      comment,
      createdAt: Date.now(),
    };
    db.data.safetyReports.push(report);
    await db.write();
    return report;
  },
  async listNearby(lat, lng, radiusKm = 5) {
    await db.read();
    // Simple filter for the demo (ideally use a spatial index like PostGIS)
    return db.data.safetyReports.filter((r) => {
      const dist = Math.sqrt(Math.pow(r.lat - lat, 2) + Math.pow(r.lng - lng, 2)) * 111;
      return dist <= radiusKm;
    });
  },
};

module.exports = { db, init, Users, Contacts, Walks, SosEvents, SafetyReports };
