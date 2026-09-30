// react-native-web's Alert.alert() is a no-op, so every confirmation dialog
// (Arrived safely?, Send SOS?, etc.) silently did nothing in the browser.
// This shim maps it onto window.alert / window.confirm on web only.
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }
    if (buttons.length === 1) {
      window.alert(text);
      buttons[0].onPress?.();
      return;
    }
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const confirmBtn = [...buttons].reverse().find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
    if (window.confirm(text)) confirmBtn?.onPress?.();
    else cancelBtn?.onPress?.();
  };
}
