import { api, clearSession, readCachedSession, saveSession } from './api';
import { identify } from './socket';

// -----------------------------------------------------------------------
// Same exported function names as before, so login.js / register.js /
// home.js / contacts.js / walk.js don't need to change how they call
// these - only what happens inside them changed (real backend instead of
// on-device-only AsyncStorage).
// -----------------------------------------------------------------------

export async function registerUser({ name, email, phone, password }) {
  const { data } = await api.post('/auth/register', { name, email, phone, password });
  await saveSession(data.token, data.user);
  identify(data.user.id);
  return data.user;
}

export async function loginUser(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  await saveSession(data.token, data.user);
  identify(data.user.id);
  return data.user;
}

export async function logoutUser() {
  await clearSession();
}

export async function getSession() {
  const cached = await readCachedSession();
  if (!cached) return null;
  identify(cached.user.id);
  return cached.user;
}

// ---------------------------- Contacts ------------------------------------

export async function getContacts() {
  const { data } = await api.get('/contacts');
  return data.contacts;
}

export async function addContact(_email, contact) {
  const { data } = await api.post('/contacts', contact);
  return data.contact;
}

export async function removeContact(_email, contactId) {
  const { data } = await api.delete(`/contacts/${contactId}`);
  return data.contacts;
}

// ------------------------- Profile update ----------------------------------

export async function updateProfile(updates) {
  const { data } = await api.put('/auth/profile', updates);
  // Refresh the cached user so Profile screen reflects the change immediately
  const cached = await readCachedSession();
  if (cached) {
    await saveSession(cached.token, { ...cached.user, ...data.user });
  }
  return data.user;
}

// --------------------------- Walk history ----------------------------------

export async function getHistory() {
  const { data } = await api.get('/walks/history');
  return data.walks;
}
