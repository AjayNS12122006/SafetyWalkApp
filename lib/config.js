import { Platform } from 'react-native';

// On web (browser on the same machine as the backend) localhost works fine.
// On a physical phone or emulator you need your computer's LAN IP instead:
//   Run `ipconfig` on Windows → look for "IPv4 Address" under your Wi-Fi adapter
//   Your current LAN IP is: 192.168.29.28
//
// Android emulator (not a real phone): use 10.0.2.2
const LAN_IP = '192.168.29.28';

const host = Platform.OS === 'web' ? 'localhost' : LAN_IP;

export const API_BASE_URL = `http://${host}:4000`;
