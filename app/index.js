import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getSession } from '../lib/storage';
import { Colors } from '../lib/theme';

export default function Splash() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      setSession(s);
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={44} color={Colors.accent} />
        </View>
        <Text style={styles.title}>SafetyWalk</Text>
        <Text style={styles.subtitle}>Walk with someone, always.</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 32 }} />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)/home' : '/login'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.bgAlt,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
});
