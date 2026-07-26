import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

interface KycRequest {
  id: string;
  registration_type: string;
  registration_number: string;
  state_council?: string;
  provider_hint?: string;
  document_path?: string;
  applicant_name?: string;
  applicant_email?: string;
  applicant_role?: string;
  created_at: string;
}

export default function AdminKycScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<KycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/kyc/pending', token);
      setItems(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load KYC requests');
    } finally { setLoading(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const viewDoc = async (id: string) => {
    try {
      const { url } = await apiFetch(`/api/admin/kyc/${id}/document`, token);
      if (url) Linking.openURL(url); else Alert.alert('No document', 'This request has no attached document.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open document');
    }
  };

  const approve = async (id: string) => {
    try {
      await apiFetch(`/api/admin/kyc/${id}/approve`, token, { method: 'POST' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not approve');
    }
  };

  const submitReject = async () => {
    if (!rejecting || !reason.trim()) return;
    try {
      await apiFetch(`/api/admin/kyc/${rejecting}/reject`, token, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      setItems((prev) => prev.filter((i) => i.id !== rejecting));
      setRejecting(null); setReason('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not reject');
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyText}>Admin access required</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}><Text style={styles.backLinkText}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#1A3A5C" /></TouchableOpacity>
        <Text style={styles.headerTitle}>KYC Review</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1A3A5C" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="checkmark-done-outline" size={48} color="#94A3B8" /><Text style={styles.emptyText}>No pending requests</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.applicant_name || 'Unknown'} <Text style={styles.role}>· {item.applicant_role}</Text></Text>
              <Text style={styles.meta}>{item.applicant_email}</Text>
              <Text style={styles.meta}>{item.registration_type.toUpperCase()}: {item.registration_number}{item.state_council ? ` · ${item.state_council}` : ''}</Text>
              {item.provider_hint ? <Text style={styles.hint}>Auto-check: {item.provider_hint}</Text> : null}
              <View style={styles.actions}>
                {item.document_path ? (
                  <TouchableOpacity style={[styles.btn, styles.viewBtn]} onPress={() => viewDoc(item.id)}><Ionicons name="document-text-outline" size={16} color="#1A3A5C" /><Text style={styles.viewText}>Document</Text></TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => setRejecting(item.id)}><Text style={styles.rejectText}>Reject</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => approve(item.id)}><Text style={styles.approveText}>Approve</Text></TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reason for rejection</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. Document unreadable" value={reason} onChangeText={setReason} multiline />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setRejecting(null); setReason(''); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={submitReject}><Text style={styles.rejectText}>Confirm reject</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { color: '#64748B', fontSize: 15 },
  backLink: { marginTop: 12 },
  backLinkText: { color: '#1A3A5C', fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  role: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  meta: { fontSize: 13, color: '#64748B', marginTop: 2 },
  hint: { fontSize: 12, color: '#0F766E', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  viewBtn: { backgroundColor: '#F1F5F9' },
  viewText: { color: '#1A3A5C', fontWeight: '600', fontSize: 13 },
  rejectBtn: { backgroundColor: '#FEF2F2' },
  rejectText: { color: '#E84545', fontWeight: '700', fontSize: 13 },
  approveBtn: { backgroundColor: '#0F766E', marginLeft: 'auto' },
  approveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  modalInput: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 15 },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  cancelText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
});
