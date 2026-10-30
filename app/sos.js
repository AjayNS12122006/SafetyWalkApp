import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../lib/theme';
import { getLastSOS } from '../lib/sosState';
import { shareToWhatsApp, shareToWhatsAppNumber } from '../lib/whatsapp';

export default function SosScreen() {
  const insets = useSafeAreaInsets();
  // Whatever the last SOS (home screen or walk screen) recorded - message text,
  // maps link, and which trusted contacts it targeted. Free WhatsApp share
  // below re-uses this instead of needing a paid SMS gateway.
  const lastSOS = getLastSOS();
  const [isStrobeActive, setIsStrobeActive] = useState(true);
  const [isSirenActive, setIsSirenActive] = useState(true);
  // useRef so the animated value survives re-renders (it was re-created every render before)
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Real siren: a looping sweep tone bundled in assets/siren.wav.
  const player = useAudioPlayer(require('../assets/siren.wav'));

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      player.loop = true;
      player.volume = 1.0;
      if (isSirenActive) player.play();
      else player.pause();
    } catch { /* browser may block autoplay until the first tap - the Loud Siren button then works */ }
  }, [isSirenActive, player]);

  // Always silence the siren when leaving the screen ("I'm Safe" / back)
  useEffect(() => () => { try { player.pause(); } catch {} }, [player]);

  useEffect(() => {
    if (isStrobeActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        ])
      ).start();
    } else {
      flashAnim.setValue(0);
    }
  }, [isStrobeActive]);

  return (
    <View style={styles.container}>
      {isStrobeActive && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'white', opacity: flashAnim }
          ]}
        />
      )}

      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>🚨 SOS ACTIVE</Text>
          <Text style={styles.subtitle}>Emergency contacts have been notified</Text>
        </View>

        <View style={styles.center}>
           <View style={styles.pulseContainer}>
              <View style={styles.pulseCircle} />
              <Ionicons name="alert-circle" size={120} color={Colors.danger} />
           </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.btn, !isSirenActive && styles.btnOff]}
            onPress={() => setIsSirenActive(!isSirenActive)}
          >
            <Ionicons name={isSirenActive ? 'volume-high' : 'volume-mute'} size={24} color={isSirenActive ? Colors.bg : Colors.textMuted} />
            <Text style={[styles.btnText, !isSirenActive && styles.btnTextOff]}>Loud Siren</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, !isStrobeActive && styles.btnOff]}
            onPress={() => setIsStrobeActive(!isStrobeActive)}
          >
            <Ionicons name={isStrobeActive ? 'flashlight' : 'flashlight-outline'} size={24} color={isStrobeActive ? Colors.bg : Colors.textMuted} />
            <Text style={[styles.btnText, !isStrobeActive && styles.btnTextOff]}>Flash Strobe</Text>
          </TouchableOpacity>
        </View>

        {lastSOS && (
          <View style={styles.waSection}>
            <Text style={styles.waLabel}>Share via WhatsApp (free, no gateway needed)</Text>

            {lastSOS.contacts?.length > 0 && (
              <View style={styles.waContactRow}>
                {lastSOS.contacts.map((c) => (
                  <TouchableOpacity
                    key={c.id ?? c.phone}
                    style={styles.waContactBtn}
                    onPress={() => shareToWhatsAppNumber(c.phone, lastSOS.message)}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                    <Text style={styles.waContactText} numberOfLines={1}>{c.name || c.phone}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.waPickerBtn}
              onPress={() => shareToWhatsApp(lastSOS.message)}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              <Text style={styles.waPickerText}>Share to any WhatsApp contact</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>I'm Safe - Stop Alert</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  header: { alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: Colors.danger, letterSpacing: 2 },
  subtitle: { color: '#fff', fontSize: 16, marginTop: 10, textAlign: 'center', paddingHorizontal: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pulseContainer: {
    width: 200, height: 200, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.danger, opacity: 0.2,
  },
  controls: { width: '100%', paddingHorizontal: 30, gap: 15 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 18,
  },
  btnOff: { backgroundColor: '#333' },
  btnText: { color: Colors.bg, fontSize: 18, fontWeight: '800' },
  btnTextOff: { color: Colors.textMuted },
  cancelBtn: { paddingVertical: 20 },
  cancelBtnText: { color: Colors.textFaint, fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  waSection: { width: '100%', paddingHorizontal: 30, marginTop: 20, gap: 10 },
  waLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  waContactRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  waContactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f2418', borderColor: '#25D366', borderWidth: 1,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 14,
  },
  waContactText: { color: '#fff', fontSize: 14, fontWeight: '600', maxWidth: 120 },
  waPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderColor: '#25D366', borderWidth: 1, borderRadius: Radius.md, paddingVertical: 14,
  },
  waPickerText: { color: '#25D366', fontSize: 15, fontWeight: '700' },
});
