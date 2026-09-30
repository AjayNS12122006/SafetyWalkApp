import { Platform } from 'react-native';

// -----------------------------------------------------------------------
// Where the app finds the backend.
//
// Preferred: set EXPO_PUBLIC_API_BASE_URL in your .env, e.g.
//   EXPO_PUBLIC_API_BASE_URL=http://192.168.29.28:4000
// or, once you've deployed the backend somewhere reachable from the
// phone (Render, Railway, a VPS, etc.):
//   EXPO_PUBLIC_API_BASE_URL=https://your-backend.example.com
//
// This is read at BUILD time for a standalone APK/IPA (EXPO_PUBLIC_* vars
// get baked into the JS bundle), so if you change it, rebuild the app -
// editing this file after building an APK has no effect on that APK.
//
// Fallback if the env var isn't set: localhost on web (same machine as
// the backend), or the LAN_IP below on native. LAN_IP only works if the
// phone and the computer running the backend are on the same Wi-Fi - it
// will NOT work for a phone on mobile data or a different network, and
// it will NOT work for anyone you share the APK with unless you swap in
// their machine's IP or (better) a real deployed URL.
// -----------------------------------------------------------------------
const LAN_IP = '192.168.29.28';

const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

// Private/loopback addresses only make sense for a phone on the same Wi-Fi.
const isPrivateUrl =
  !!envUrl && /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(envUrl);

function resolveBaseUrl() {
  if (Platform.OS === 'web') {
    // In the browser: use a real deployed URL if one is set, otherwise talk
    // to whatever host is serving the page (localhost on your PC). This
    // avoids a stale LAN IP in .env hanging web requests.
    if (envUrl && !isPrivateUrl) return envUrl;
    const host =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : 'localhost';
    return `http://${host}:4000`;
  }
  return envUrl || `http://${LAN_IP}:4000`;
}

export const API_BASE_URL = resolveBaseUrl();
