import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import { api } from './api';
import { findNearbyPolice } from './ors';
import { shareToWhatsApp, shareToWhatsAppNumber } from './whatsapp';

// Builds a Google Maps link from coordinates so contacts can tap straight
// into live directions to the user.
export function mapsLink(latitude, longitude) {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission was not granted.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

// Opens the device's native SMS composer and/or WhatsApp, pre-filled with an
// SOS message, a live-location link, and (when reachable) the nearest police
// station - addressed to every trusted contact.
// NOTE: these all require one tap from the user to actually send - a
// production build would instead push this through a backend (Twilio,
// FCM, etc.) so the alert sends with zero taps, even from a locked phone.
export async function sendSOS({ contacts, userName, reason = 'SOS', channel = 'both' }) {
  const location = await getCurrentLocation();
  const link = mapsLink(location.latitude, location.longitude);

  let policeLine = '';
  try {
    const nearby = await findNearbyPolice(location, 2000);
    if (nearby[0]) {
      policeLine = `\nNearest police station: ${nearby[0].name} (${mapsLink(nearby[0].latitude, nearby[0].longitude)})`;
    }
  } catch {
    // Non-fatal - SOS still goes out without this extra line.
  }

  const message =
    `${reason.toUpperCase()} ALERT from ${userName || 'SafetyWalk user'}.\n` +
    `I may need help. My live location: ${link}${policeLine}`;

  const numbers = contacts.map((c) => c.phone).filter(Boolean);
  if (numbers.length === 0) {
    throw new Error('No trusted contacts with a phone number are saved yet.');
  }

  if (channel === 'sms' || channel === 'both') {
    const separator = Platform.OS === 'ios' ? '&' : ';';
    const smsUrl = `sms:${numbers.join(separator)}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(
      message
    )}`;
    if (await Linking.canOpenURL(smsUrl)) await Linking.openURL(smsUrl);
  }

  if (channel === 'whatsapp' || channel === 'both') {
    // Send straight to each trusted contact's WhatsApp number, one after
    // another (WhatsApp only lets one chat compose open at a time).
    for (const number of numbers) {
      await shareToWhatsAppNumber(number, message); // eslint-disable-line no-await-in-loop
    }
  }

  // Best-effort: also log this SOS on the backend so it shows up for
  // support/audit purposes, even if the SMS/WhatsApp composer gets dismissed.
  try {
    await api.post('/sos', { latitude: location.latitude, longitude: location.longitude, reason });
  } catch {
    // Non-fatal - the message itself is the primary delivery path.
  }

  return { location, link, message, numbers };
}

// Opens WhatsApp's own "choose a chat" picker with the live-location
// message pre-filled, for sharing to ANY saved WhatsApp contact/group -
// not just the ones added as SafetyWalk trusted contacts.
export async function shareLiveLocationOnWhatsApp({ userName, etaMinutes, shareUrl }) {
  const message =
    `${userName || 'A SafetyWalk user'} is sharing their live location` +
    (etaMinutes ? ` and expects to arrive in ${etaMinutes} min.\n` : '.\n') +
    `Watch live: ${shareUrl}`;
  return shareToWhatsApp(message);
}

export async function callContact(phone) {
  await Linking.openURL(`tel:${phone}`);
}
