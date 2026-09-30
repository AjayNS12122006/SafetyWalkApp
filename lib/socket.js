import { io } from 'socket.io-client';
import { API_BASE_URL } from './config';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, { transports: ['websocket'], autoConnect: true });
  }
  return socket;
}

// Lets the server know which user this device belongs to, so it can push
// this device an 'sos:auto' nudge if a walk's ETA timer expires - a second,
// redundant delivery path alongside the server-side auto-SOS broadcast to
// the contacts' live-view page.
export function identify(userId) {
  if (!userId) return;
  getSocket().emit('identify', { userId });
}

export function joinWalk(shareToken) {
  if (!shareToken) return;
  getSocket().emit('join', { shareToken });
}
