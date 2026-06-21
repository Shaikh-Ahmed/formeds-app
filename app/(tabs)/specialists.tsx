import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

export default function SpecialistsScreen() {
  const { user, token } = useAuth();
  const isClinic = user?.role === 'clinic';
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadListings = useCallback(async () => {
    try {
      const data = isClinic
        ? await apiFetch('/api/specialists/my-listings', token)
        : await apiFetch('/api/specialists', token);
      setListings(data);
    } catch (e) { console.log('Specialists error:', e); }
    finally { setLoading(false); }
  }, [token, isClinic]);

  useEffect(() => { loadListings(); }, [loadListings]);

  const handleOptIn = async (listingId: string) => {
    try {
      await apiFetch(`/api/specialists/${listingId}/optin`, token, { method: 'POST' });
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, opted_in: true } : l));
    } catch (e: any) { alert(e.message); }
  };

  const renderListing = ({ item }: any) => (
    <View testID={`specialist-card-${item.id}`} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}><Ionicons name="people" size={22} color="#0F766E" /></View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle}>{item.specialty} Specialist</Text>
          <Text style={styles.cardSubtitle}>{item.clinic_name || user?.name}</Text>
        </View>
      </View>
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}><Ionicons name="calendar-outline" size={16} color="#64748B" /><Text style={styles.detailText}>{item.schedule}</Text></View>
        <View style={styles.detailItem}><Ionicons name="location-outline" size={16} color="#64748B" /><Text style={styles.detailText}>{item.location}</Text></View>
        <View style={styles.detailItem}><Ionicons name="cash-outline" size={16} color="#64748B" /><Text style={styles.detailText}>{item.compensation}</Text></View>
      </View>
      {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
      {!isClinic && (
        <TouchableOpacity testID={`optin-btn-${item.id}`} style={[styles.optinBtn, item.opted_in && styles.optedBtn]} onPress={() => handleOptIn(item.id)} disabled={item.opted_in}>
          <Ionicons name={item.opted_in ? "checkmark-circle" : "hand-right"} size={18} color="#FFF" />
          <Text style={styles.optinText}>{item.opted_in ? 'Opted In' : 'Opt In'}</Text>
        </TouchableOpacity>
      )}
      {isClinic && <View style={styles.statsRow}><Ionicons name="people-outline" size={16} color="#0F766E" /><Text style={styles.statsText}>{item.optin_count || 0} professionals opted in</Text></View>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isClinic ? 'My Listings' : 'Specialist Access'}</Text>
        {isClinic && <TouchableOpacity testID="add-listing-btn" style={styles.addBtn} onPress={() => setShowForm(true)}><Ionicons name="add" size={24} color="#FFF" /></TouchableOpacity>}
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1A3A5C" /></View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListing}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="people-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No listings available</Text></View>}
        />
      )}
      {isClinic && <SpecialistFormModal visible={showForm} onClose={() => setShowForm(false)} token={token} onCreated={() => { setShowForm(false); loadListings(); }} />}
    </SafeAreaView>
  );
}

function SpecialistFormModal({ visible, onClose, token, onCreated }: any) {
  const [specialty, setSpecialty] = useState('');
  const [schedule, setSchedule] = useState('');
  const [location, setLocation] = useState('');
  const [compensation, setCompensation] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await apiFetch('/api/specialists', token, { method: 'POST', body: JSON.stringify({ specialty, schedule, location, compensation, description }) });
      onCreated();
    } catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post Specialist Listing</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <FormInput label="Specialty Needed" value={specialty} onChangeText={setSpecialty} placeholder="e.g. Cardiology" />
            <FormInput label="Schedule" value={schedule} onChangeText={setSchedule} placeholder="e.g. Every Tuesday, 10 AM - 4 PM" />
            <FormInput label="Location" value={location} onChangeText={setLocation} placeholder="Clinic location" />
            <FormInput label="Compensation" value={compensation} onChangeText={setCompensation} placeholder="e.g. Rs. 5000/visit" />
            <FormInput label="Description" value={description} onChangeText={setDescription} placeholder="Additional details..." multiline />
            <TouchableOpacity testID="submit-listing-btn" style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Post Listing</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormInput({ label, ...props }: any) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput style={[styles.formInput, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]} placeholderTextColor="#94A3B8" {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardMeta: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  detailsGrid: { gap: 8, marginBottom: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: '#64748B' },
  cardDesc: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
  optinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0F766E', borderRadius: 12, paddingVertical: 12 },
  optedBtn: { backgroundColor: '#94A3B8' },
  optinText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statsText: { fontSize: 13, color: '#0F766E', fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  modalScroll: { padding: 20 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  formInput: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A' },
  submitBtn: { backgroundColor: '#0F766E', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 40 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
