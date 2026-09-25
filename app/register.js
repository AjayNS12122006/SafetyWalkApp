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

import { addContact, registerUser } from '../lib/storage';
import { Colors, Radius, Shadow } from '../lib/theme';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const session = await registerUser({ name, email, phone, password });

      // If they added a first trusted contact during sign-up, save it now
      // so their home screen isn't empty on first launch.
      if (contactName.trim() && contactPhone.trim()) {
        await addContact(session.email, { name: contactName.trim(), phone: contactPhone.trim() });
      }

      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={36} color={Colors.accent} />
        </View>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>It takes a minute — your safety net matters.</Text>

        <View style={styles.form}>
          <Field icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} />
          <Field
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            icon="call-outline"
            placeholder="Your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Field
            icon="lock-closed-outline"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Field
            icon="lock-closed-outline"
            placeholder="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          <View style={styles.sectionDivider}>
            <Ionicons name="people-outline" size={16} color={Colors.accent} />
            <Text style={styles.sectionLabel}>Add your first trusted contact (optional)</Text>
          </View>
          <Field
            icon="person-add-outline"
            placeholder="Contact name"
            value={contactName}
            onChangeText={setContactName}
          />
          <Field
            icon="call-outline"
            placeholder="Contact phone number"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/login" replace>
            <Text style={styles.link}>Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, ...props }) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={Colors.textFaint} />
      <TextInput placeholderTextColor={Colors.textFaint} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 48,
    alignItems: 'center',
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.bgAlt,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: Colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  form: { width: '100%', marginTop: 26, gap: 12 },
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
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 2,
  },
  sectionLabel: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 13 },
  button: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.glow(Colors.primary),
  },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', marginTop: 22, alignItems: 'center' },
  footerText: { color: Colors.textMuted, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
