import { Linking, Platform } from 'react-native';

// -----------------------------------------------------------------------
// Opening wa.me / whatsapp://send WITHOUT a phone number opens WhatsApp's
// own "choose a chat" screen, pre-filled with the message - the user picks
// any of THEIR saved WhatsApp contacts or groups right there. That's the
// real "share to the contacts you saved in WhatsApp" behavior, and it
// works whether or not that contact is also a SafetyWalk trusted contact.
// -----------------------------------------------------------------------

export async function shareToWhatsApp(message) {
  const encoded = encodeURIComponent(message);
  const appUrl = `whatsapp://send?text=${encoded}`;
  const webUrl = `https://wa.me/?text=${encoded}`;

  try {
    const canOpenApp = Platform.OS !== 'web' && (await Linking.canOpenURL(appUrl));
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
    return true;
  } catch {
    return false;
  }
}

// Sends the SAME message directly to one specific contact's WhatsApp
// number (skips the picker) - used when sharing to trusted contacts you
// already have saved with a phone number in SafetyWalk.
export async function shareToWhatsAppNumber(phone, message) {
  const digits = String(phone).replace(/[^\d+]/g, '');
  const encoded = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${digits}&text=${encoded}`;
  const webUrl = `https://wa.me/${digits.replace('+', '')}?text=${encoded}`;

  try {
    const canOpenApp = Platform.OS !== 'web' && (await Linking.canOpenURL(appUrl));
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
    return true;
  } catch {
    return false;
  }
}
