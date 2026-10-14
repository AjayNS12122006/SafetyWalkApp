```javascript
const fs = require('fs');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');

const dataDir = path.join(__dirname, 'data');
const file = path.join(dataDir, 'db.json');

const defaultData = {
  users: [],
  contacts: [],
  walks: [],
  sosEvents: [],
  safetyReports: [],
};

fs.mkdirSync(dataDir, { recursive: true });

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

let initialized = false;

async function init() {
  if (initialized) return;

  // Ensure the data directory exists before any file operations.
  await fs.promises.mkdir(dataDir, { recursive: true });

  // Load existing data or initialize an empty database.
  await db.read();

  if (!db.data || typeof db.data !== 'object') {
    db.data = { ...defaultData };
  }

  // Ensure every required collection exists.
  for (const key of Object.keys(defaultData)) {
    if (!Array.isArray(db.data[key])) {
      db.data[key] = [];
    }
  }

  // Write the initial database file.
  await db.write();

  initialized = true;
}

// Users
const Users = {
  async create({ name, email, phone, passwordHash }) {
    await db.read();

    const user = {
      id: nanoid(),
      name,
      email,
      phone,
      passwordHash,
      createdAt: Date.now(),
    };

    db.data.users.push(user);
    await db.write();

    return user;
  },

  async findByEmail(email) {
    await db.read();

    return db.data.users.find(
      (user) => user.email === email
    ) || null;
  },

  async findById(id) {
    await db.read();

    return db.data.users.find(
      (user) => user.id === id
    ) || null;
  },

  async updateProfile(id, updates) {
    await db.read();

    const user = db.data.users.find(
      (item) => item.id === id
    );

    if (!user) return null;

    const {
      name,
      phone,
      bloodGroup,
      address,
      home,
      office,
    } = updates;

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
    if (address !== undefined) user.address = address;
    if (home !== undefined) user.home = home;
    if (office !== undefined) user.office = office;

    await db.write();

    return user;
  },
};

// Trusted contacts
const Contacts = {
  async list(userId) {
    await db.read();

    return db.data.contacts.filter(
      (contact) => contact.userId === userId
    );
  },

  async add(userId, { name, phone }) {
    await db.read();

    const contact = {
      id: nanoid(),
      userId,
      name,
      phone,
      createdAt: Date.now(),
    };

    db.data.contacts.push(contact);
    await db.write();

    return contact;
  },

  async remove(userId, contactId) {
    await db.read();

    db.data.contacts = db.data.contacts.filter(
      (contact) =>
        !(contact.id === contactId && contact.userId === userId)
    );

    await db.write();

    return Contacts.list(userId);
  },

  async findByIds(userId, contactIds) {
    await db.read();

    const ids = new Set(contactIds || []);

    return db.data.contacts.filter(
      (contact) =>
        contact.userId === userId && ids.has(contact.id)
    );
  },
};

// Safety walks
const Walks = {
  async create(
    userId,
    {
      destinationLabel,
      destLat,
      destLng,
      etaMinutes,
      contactIds,
    }
  ) {
    await db.read();

    const now = Date.now();

    const walk = {
      id: nanoid(),
      shareToken: nanoid(12),
      userId,
      destinationLabel,
      destLat,
      destLng,
      etaMinutes,
      contactIds: contactIds || [],
      status: 'active',
      startedAt: now,
      deadlineAt: now + etaMinutes * 60 * 1000,
      lastLocation: null,
      endedAt: null,
    };

    db.data.walks.push(walk);
    await db.write();

    return walk;
  },

  async find(walkId) {
    await db.read();

    return db.data.walks.find(
      (walk) => walk.id === walkId
    ) || null;
  },

  async findByShareToken(shareToken) {
    await db.read();

    return db.data.walks.find(
      (walk) => walk.shareToken === shareToken
    ) || null;
  },

  async listForUser(userId) {
    await db.read();

    return db.data.walks
      .filter((walk) => walk.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 50);
  },

  async updateLocation(walkId, location) {
    await db.read();

    const walk = db.data.walks.find(
      (item) => item.id === walkId
    );

    if (!walk) return null;

    walk.lastLocation = {
      ...location,
      at: Date.now(),
    };

    await db.write();

    return walk;
  },

  async setShareUrl(walkId, shareUrl) {
    await db.read();

    const walk = db.data.walks.find(
      (item) => item.id === walkId
    );

    if (!walk) return null;

    walk.shareUrl = shareUrl;
    await db.write();

    return walk;
  },

  async setStatus(walkId, status) {
    await db.read();

    const walk = db.data.walks.find(
      (item) => item.id === walkId
    );

    if (!walk) return null;

    walk.status = status;

    if (['arrived', 'sos_auto', 'sos_manual'].includes(status)) {
      walk.endedAt = Date.now();
    }

    await db.write();

    return walk;
  },
};

// SOS events
const SosEvents = {
  async create({ userId, walkId, reason, location }) {
    await db.read();

    const event = {
      id: nanoid(),
      userId,
      walkId: walkId || null,
      reason,
      location,
      createdAt: Date.now(),
    };

    db.data.sosEvents.push(event);
    await db.write();

    return event;
  },

  async listStandaloneForUser(userId) {
    await db.read();

    return db.data.sosEvents
      .filter(
        (event) =>
          event.userId === userId && !event.walkId
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  },
};

// Community safety reports
const SafetyReports = {
  async add(userId, { type, lat, lng, comment }) {
    await db.read();

    const report = {
      id: nanoid(),
      userId,
      type,
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

    return db.data.safetyReports.filter((report) => {
      const distance =
        Math.sqrt(
          Math.pow(report.lat - lat, 2) +
          Math.pow(report.lng - lng, 2)
        ) * 111;

      return distance <= radiusKm;
    });
  },
};

module.exports = {
  db,
  init,
  Users,
  Contacts,
  Walks,
  SosEvents,
  SafetyReports,
};
```