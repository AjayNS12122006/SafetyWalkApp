import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { loginUser } from '../lib/storage';
import { Colors, Radius, Shadow } from '../lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await loginUser(email, password);
     router.replace('/(tabs)/index');
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={40} color={Colors.accent} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to keep your circle in the loop.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={Colors.textFaint} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textFaint} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textFaint}
              secureTextEntry={!showPassword}
              style={styles.input}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.textFaint}
              />
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/register" replace>
            <Text style={styles.link}>Create one</Text>
          </Link>
        </View>

        <View style={styles.trustRow}>
          <Ionicons name="lock-closed" size={13} color={Colors.textFaint} />
          <Text style={styles.trustText}>Your location is only ever shared with people you choose.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 90,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.bgAlt,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  form: { width: '100%', marginTop: 32 },
  label: { color: Colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSoft,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  input: { flex: 1, color: Colors.text, fontSize: 15 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 12 },
  button: {
    marginTop: 26,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.glow(Colors.primary),
  },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', marginTop: 26, alignItems: 'center' },
  footerText: { color: Colors.textMuted, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 36,
    paddingHorizontal: 20,
  },
  trustText: { color: Colors.textFaint, fontSize: 12, flexShrink: 1, textAlign: 'center' },
});
