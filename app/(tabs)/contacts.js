import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addContact, getContacts, getSession, removeContact } from '../../lib/storage';
import { Colors, Radius, Shadow } from '../../lib/theme';

const RELATION_OPTIONS = ['Family', 'Friend', 'Partner', 'Colleague', 'Other'];

export default function Contacts() {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState([]);
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const session = await getSession();
    if (!session) { router.replace('/login'); return; }
    setContacts(await getContacts());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing info', 'A name and phone number are both required.');
      return;
    }
    setAdding(true);
    try {
      await addContact(null, { name: name.trim(), phone: phone.trim(), relation: relation.trim() });
      setName(''); setPhone(''); setRelation('');
      setShowForm(false);
      Keyboard.dismiss();
      await load();
    } catch (e) {
      Alert.alert('Could not add contact', e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (contact) => {
    Alert.alert(
      `Remove ${contact.name}?`,
      'They will no longer receive your SOS alerts or safety walk shares.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContact(null, contact.id);
              await load();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const callContact = (phone) => Linking.openURL(`tel:${phone}`);
  const smsContact  = (phone) => Linking.openURL(`sms:${phone}`);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.title}>Trusted Contacts</Text>
          <Text style={styles.sub}>
            {contacts.length === 0
              ? 'Add people who should get your alerts'
              : `${contacts.length} contact${contacts.length > 1 ? 's' : ''} will receive your alerts`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, showForm && styles.addBtnCancel]}
          onPress={() => setShowForm((v) => !v)}
        >
          <Ionicons name={showForm ? 'close' : 'person-add'} size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Add form */}
      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>New contact</Text>
          <View style={styles.inputRow}>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <Ionicons name="person-outline" size={16} color={Colors.textFaint} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={Colors.textFaint}
                style={styles.input}
              />
            </View>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <Ionicons name="call-outline" size={16} color={Colors.textFaint} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={Colors.textFaint}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
          </View>

          {/* Relation chips */}
          <View style={styles.relationRow}>
            {RELATION_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.relationChip, relation === r && styles.relationChipOn]}
                onPress={() => setRelation(relation === r ? '' : r)}
              >
                <Text style={[styles.relationText, relation === r && styles.relationTextOn]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, adding && { opacity: 0.65 }]}
            onPress={handleAdd}
            disabled={adding}
          >
            <Ionicons name="checkmark" size={18} color={Colors.bg} />
            <Text style={styles.saveBtnText}>{adding ? 'Saving…' : 'Add Contact'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          contacts.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={36} color={Colors.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptyDesc}>
              Add the people you trust most. They'll get your location and SOS alerts.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.emptyBtnText}>Add your first contact</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.contactCard}>
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: avatarColor(item.name) }]}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.contactName}>{item.name}</Text>
                {item.relation && (
                  <View style={styles.relationBadge}>
                    <Text style={styles.relationBadgeText}>{item.relation}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.contactPhone}>{item.phone}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => callContact(item.phone)}>
                <Ionicons name="call-outline" size={18} color={Colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => smsContact(item.phone)}>
                <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemove(item)}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

// Deterministic color from name
function avatarColor(name) {
  const palette = [Colors.primary, Colors.accent, Colors.warning, '#8B5CF6', '#EC4899'];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return palette[sum % palette.length];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  sub:   { color: Colors.textMuted, fontSize: 13, marginTop: 3 },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow(Colors.primary),
  },
  addBtnCancel: { backgroundColor: Colors.bgSoft },

  // Form
  form: {
    margin: 16, backgroundColor: Colors.bgAlt,
    borderRadius: Radius.lg, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  formTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgSoft,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 46,
  },
  input: { flex: 1, color: Colors.text, fontSize: 14 },
  relationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  relationChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.pill, backgroundColor: Colors.bgSoft,
    borderWidth: 1, borderColor: Colors.border,
  },
  relationChipOn:  { backgroundColor: Colors.accent, borderColor: Colors.accent },
  relationText:    { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  relationTextOn:  { color: Colors.bg },
  saveBtn: {
    flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md, height: 48,
    ...Shadow.glow(Colors.primary),
  },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  // List
  list:       { padding: 16, gap: 10, paddingBottom: 30 },
  listEmpty:  { flex: 1, justifyContent: 'center' },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgAlt,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { color: Colors.white, fontWeight: '800', fontSize: 17 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactName:  { color: Colors.text, fontSize: 15, fontWeight: '700' },
  contactPhone: { color: Colors.textFaint, fontSize: 12, marginTop: 2 },
  relationBadge: {
    backgroundColor: 'rgba(56,225,198,0.12)',
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.accent,
  },
  relationBadgeText: { color: Colors.accent, fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 12 },
  emptyIcon:  {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.bgAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  emptyDesc:  { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 24, paddingVertical: 12,
    marginTop: 4,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
