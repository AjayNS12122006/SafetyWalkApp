import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../lib/theme';

export default function SosScreen() {
  const insets = useSafeAreaInsets();
  const [isStrobeActive, setIsStrobeActive] = useState(true);
  const [isSirenActive, setIsSirenActive] = useState(true);
  const flashAnim = new Animated.Value(0);

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
});
