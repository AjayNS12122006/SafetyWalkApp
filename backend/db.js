
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

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

let initialized = false;
let initPromise = null;

// Initialize the database safely.
async function init() {
  if (initialized) return;

  // Prevent multiple simultaneous initializations.
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await fs.promises.mkdir(dataDir, { recursive: true });

    await db.read();

    if (!db.data || typeof db.data !== 'object') {
      db.data = { ...defaultData };
    }

    // Ensure all required collections exist.
    for (const key of Object.keys(defaultData)) {
      if (!Array.isArray(db.data[key])) {
        db.data[key] = [];
      }
    }

    // Make sure the directory exists immediately before writing.
    await fs.promises.mkdir(dataDir, { recursive: true });
    await db.write();

    initialized = true;
  })();

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

// Read the latest database data before operations.
async function ensureReady() {
  await init();

  // Refresh data from disk before each operation.
  await db.read();

  if (!db.data || typeof db.data !== 'object') {
    db.data = { ...defaultData };
  }

  for (const key of Object.keys(defaultData)) {
    if (!Array.isArray(db.data[key])) {
      db.data[key] = [];
    }
  }
}

// Users
const Users = {
  async create({ name, email, phone, passwordHash }) {
    await ensureReady();

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
    await ensureReady();

    return (
      db.data.users.find(
        (user) => user.email === email
      ) || null
    );
  },

  async findById(id) {
    await ensureReady();

    return (
      db.data.users.find(
        (user) => user.id === id
      ) || null
    );
  },

  async updateProfile(id, updates) {
    await ensureReady();

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
    await ensureReady();

    return db.data.contacts.filter(
      (contact) => contact.userId === userId
    );
  },

  async add(userId, { name, phone }) {
    await ensureReady();

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
    await ensureReady();

    db.data.contacts = db.data.contacts.filter(
      (contact) =>
        !(
          contact.id === contactId &&
          contact.userId === userId
        )
    );

    await db.write();

    return db.data.contacts.filter(
      (contact) => contact.userId === userId
    );
  },

  async findByIds(userId, contactIds) {
    await ensureReady();

    const ids = new Set(contactIds || []);

    return db.data.contacts.filter(
      (contact) =>
        contact.userId === userId &&
        ids.has(contact.id)
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
    await ensureReady();

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
    await ensureReady();

    return (
      db.data.walks.find(
        (walk) => walk.id === walkId
      ) || null
    );
  },

  async findByShareToken(shareToken) {
    await ensureReady();

    return (
      db.data.walks.find(
        (walk) => walk.shareToken === shareToken
      ) || null
    );
  },

  async listForUser(userId) {
    await ensureReady();

    return db.data.walks
      .filter((walk) => walk.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 50);
  },

  async updateLocation(walkId, location) {
    await ensureReady();

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
    await ensureReady();

    const walk = db.data.walks.find(
      (item) => item.id === walkId
    );

    if (!walk) return null;

    walk.shareUrl = shareUrl;
    await db.write();

    return walk;
  },

  async setStatus(walkId, status) {
    await ensureReady();

    const walk = db.data.walks.find(
      (item) => item.id === walkId
    );

    if (!walk) return null;

    walk.status = status;

    if (
      ['arrived', 'sos_auto', 'sos_manual'].includes(status)
    ) {
      walk.endedAt = Date.now();
    }

    await db.write();

    return walk;
  },
};

// SOS events
const SosEvents = {
  async create({ userId, walkId, reason, location }) {
    await ensureReady();

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
    await ensureReady();

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
    await ensureReady();

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
    await ensureReady();

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
