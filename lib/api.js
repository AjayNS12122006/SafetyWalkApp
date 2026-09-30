import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from './config';

const TOKEN_KEY = '@safetywalk/token';
const USER_KEY = '@safetywalk/user';

export const api = axios.create({ baseURL: `${API_BASE_URL}/api`, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err?.response?.data?.error || err?.message || 'Network error. Is the backend running?';
    return Promise.reject(new Error(message));
  }
);

export async function saveSession(token, user) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function readCachedSession() {
  const [token, rawUser] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);
  if (!token || !rawUser) return null;
  return { token, user: JSON.parse(rawUser) };
}
