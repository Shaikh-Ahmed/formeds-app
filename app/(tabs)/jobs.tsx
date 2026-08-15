import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';
import { ErrorBanner, KycNotice } from '../../src/components';
import { PageGrid, ProfileRail, Hoverable } from '../../src/components/web';
import { colors, spacing, radius, typography, useBreakpoint } from '../../src/theme';

export default function JobsScreen() {
  const { user, token, isKycApproved } = useAuth();
  const { isMobile, isDesktop } = useBreakpoint();
  const isHospital = user?.role === 'hospital';
  // Two-up on desktop: a job card is mostly short labelled rows, so a single
  // 1100px-wide column would leave most of each card empty.
  const numColumns = isDesktop ? 2 : 1;
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'permanent' | 'locum'>('permanent');
  const [permanentJobs, setPermanentJobs] = useState<any[]>([]);
  const [locumShifts, setLocumShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [myPostings, setMyPostings] = useState<any>({ permanent: [], locum: [] });

  const loadJobs = useCallback(async () => {
    try {
      if (isHospital) {
        const data = await apiFetch('/api/jobs/my-postings', token);
        setMyPostings(data);
      } else {
        const [perm, loc] = await Promise.all([
          apiFetch('/api/jobs/permanent', token),
          apiFetch('/api/jobs/locum', token),
        ]);
        setPermanentJobs(perm);
        setLocumShifts(loc);
      }
    } catch (e) { console.log('Jobs error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, isHospital]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // `alert()` is a web-only API — on native it is undefined and the failure was
  // swallowed silently. Surface errors through the shared ErrorBanner instead.
  const handleApply = async (jobId: string) => {
    setActionError(null);
    try {
      await apiFetch(`/api/jobs/permanent/${jobId}/apply`, token, { method: 'POST' });
      setPermanentJobs(prev => prev.map(j => j.id === jobId ? { ...j, applied: true } : j));
    } catch (e: any) { setActionError(e?.message || 'Could not submit your application.'); }
  };

  const handleAcceptShift = async (shiftId: string) => {
    setActionError(null);
    try {
      await apiFetch(`/api/jobs/locum/${shiftId}/accept`, token, { method: 'POST' });
      setLocumShifts(prev => prev.map(s => s.id === shiftId ? { ...s, accepted: true } : s));
    } catch (e: any) { setActionError(e?.message || 'Could not accept this shift.'); }
  };

  const renderJobCard = ({ item }: any) => (
    <View testID={`job-card-${item.id}`} style={[styles.card, !isMobile && styles.cardWide]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}><Ionicons name="briefcase" size={20} color="#1A3A5C" /></View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle}>{item.hospital_name || user?.name}</Text>
        </View>
        {item.job_type && <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{item.job_type}</Text></View>}
      </View>
      <View style={styles.cardDetails}>
        <View style={styles.detailItem}><Ionicons name="location-outline" size={16} color="#64748B" /><Text style={styles.detailText}>{item.location}</Text></View>
        <View style={styles.detailItem}><Ionicons name="medical-outline" size={16} color="#64748B" /><Text style={styles.detailText}>{item.specialty}</Text></View>
        {item.salary_min > 0 && <View style={styles.detailItem}><Ionicons name="cash-outline" size={16} color="#64748B" /><Text style={styles.detailText}>Rs. {(item.salary_min/1000).toFixed(0)}K - {(item.salary_max/1000).toFixed(0)}K/mo</Text></View>}
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      {!isHospital && (
        <TouchableOpacity testID={`apply-btn-${item.id}`} style={[styles.applyBtn, item.applied && styles.appliedBtn]} onPress={() => handleApply(item.id)} disabled={item.applied}>
          <Ionicons name={item.applied ? "checkmark-circle" : "paper-plane"} size={18} color="#FFF" />
          <Text style={styles.applyText}>{item.applied ? 'Applied' : 'Quick Apply'}</Text>
        </TouchableOpacity>
      )}
      {isHospital && <View style={styles.statsRow}><Ionicons name="people-outline" size={16} color="#1A3A5C" /><Text style={styles.statsText}>{item.applicant_count || 0} applicants</Text></View>}
    </View>
  );

  const renderLocumCard = ({ item }: any) => (
    <View testID={`locum-card-${item.id}`} style={[styles.card, !isMobile && styles.cardWide]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, item.urgency && { backgroundColor: '#FEF2F2' }]}>
          <Ionicons name={item.urgency ? "alert-circle" : "time"} size={20} color={item.urgency ? "#E84545" : "#1A3A5C"} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle}>{item.specialty} Shift</Text>
          <Text style={styles.cardSubtitle}>{item.hospital_name || user?.name}</Text>
        </View>
        {item.urgency && <View style={[styles.typeBadge, { backgroundColor: '#FEF2F2' }]}><Text style={[styles.typeBadgeText, { color: '#E84545' }]}>Urgent</Text></View>}
      </View>
      <View style={styles.cardDetails}>
        <View style={styles.detailItem}><Ionicons name="calendar-outline" size={16} color="#64748B" /><Text style={styles.detailText}>{item.shift_date}</Text></View>
        <View style={styles.detailItem}><Ionicons name="time-outline" size={16} color="#64748B" /><Text style={styles.detailText}>{item.shift_time} ({item.duration})</Text></View>
        <View style={styles.detailItem}><Ionicons name="cash-outline" size={16} color="#64748B" /><Text style={styles.detailText}>Rs. {item.pay}/shift</Text></View>
      </View>
      {!isHospital && (
        <TouchableOpacity testID={`accept-shift-${item.id}`} style={[styles.applyBtn, { backgroundColor: '#0F766E' }, (item.accepted || item.status === 'filled') && styles.appliedBtn]} onPress={() => handleAcceptShift(item.id)} disabled={item.accepted || item.status === 'filled'}>
          <Ionicons name={item.accepted ? "checkmark-circle" : "hand-left"} size={18} color="#FFF" />
          <Text style={styles.applyText}>{item.accepted ? 'Accepted' : item.status === 'filled' ? 'Filled' : 'Accept Shift'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const jobs = isHospital ? (activeTab === 'permanent' ? myPostings.permanent : myPostings.locum) : (activeTab === 'permanent' ? permanentJobs : locumShifts);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* No right rail here: the two-up card grid needs the width more than a
          contextual sidebar would use it. */}
      <PageGrid left={<ProfileRail />} fluid testID="jobs-grid">
        {/* The page title scrolls with the content at every width rather than
            sitting in a fixed bar. On a phone the persistent top bar is
            already ~56px of chrome; a second fixed title bar under it would
            cost a card's worth of feed on every screen. */}
        <View style={[styles.wideTitleRow, isMobile && styles.titleRowMobile]}>
          <View style={styles.wideTitleText}>
            <Text style={styles.wideTitle} accessibilityRole="header">
              {isHospital ? 'My Postings' : 'Jobs & Locum Shifts'}
            </Text>
            <Text style={styles.wideSubtitle}>
              {isHospital
                ? 'Roles and shifts your organisation has published.'
                : 'Permanent roles and single shifts open to your specialty.'}
            </Text>
          </View>
          {isHospital && (
            <Hoverable
              testID="add-job-btn"
              onPress={() => setShowForm(true)}
              disabled={!isKycApproved}
              accessibilityLabel="Post a new job"
              accessibilityState={{ disabled: !isKycApproved }}
              style={[styles.widePostBtn, !isKycApproved && styles.addBtnDisabled]}
              hoverStyle={styles.widePostBtnHover}
            >
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.widePostBtnText}>
                {isMobile ? 'Post' : `Post a ${activeTab === 'permanent' ? 'job' : 'shift'}`}
              </Text>
            </Hoverable>
          )}
        </View>

        <View style={[styles.tabBar, !isMobile && styles.tabBarWide]}>
          <TouchableOpacity testID="tab-permanent" style={[styles.tab, activeTab === 'permanent' && styles.tabActive]} onPress={() => setActiveTab('permanent')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'permanent' }}>
            <Text style={[styles.tabText, activeTab === 'permanent' && styles.tabTextActive]}>Permanent</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tab-locum" style={[styles.tab, activeTab === 'locum' && styles.tabActive]} onPress={() => setActiveTab('locum')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'locum' }}>
            <Text style={[styles.tabText, activeTab === 'locum' && styles.tabTextActive]}>Locum Shifts</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.noticeWrap, !isMobile && styles.noticeWrapWide]}>
          <KycNotice action={isHospital ? 'post jobs and shifts' : 'apply for jobs and shifts'} />
          <ErrorBanner message={actionError} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View>
        ) : (
          <FlatList
            // React Native cannot change numColumns on an existing list, so the
            // column count is part of the key and remounts on resize.
            key={`jobs-${numColumns}`}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
            data={jobs}
            renderItem={activeTab === 'permanent' ? renderJobCard : renderLocumCard}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={[styles.list, !isMobile && styles.listWide]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(); }} tintColor={colors.navy} />}
            ListEmptyComponent={<View style={styles.center}><Ionicons name="briefcase-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No {activeTab === 'permanent' ? 'jobs' : 'shifts'} found</Text></View>}
          />
        )}
      </PageGrid>

      {isHospital && <JobFormModal visible={showForm} onClose={() => setShowForm(false)} token={token} activeTab={activeTab} onCreated={() => { setShowForm(false); loadJobs(); }} />}
    </SafeAreaView>
  );
}

function JobFormModal({ visible, onClose, token, activeTab, onCreated }: any) {
  const { isMobile } = useBreakpoint();
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [description, setDescription] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftTime, setShiftTime] = useState('');
  const [duration, setDuration] = useState('');
  const [pay, setPay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (activeTab === 'permanent') {
        await apiFetch('/api/jobs/permanent', token, { method: 'POST', body: JSON.stringify({ title, specialty, location, salary_min: parseInt(salaryMin) || 0, salary_max: parseInt(salaryMax) || 0, description }) });
      } else {
        await apiFetch('/api/jobs/locum', token, { method: 'POST', body: JSON.stringify({ shift_date: shiftDate, shift_time: shiftTime, duration, specialty, pay: parseInt(pay) || 0 }) });
      }
      onCreated();
    } catch (e: any) { setSubmitError(e?.message || 'Could not save this posting.'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType={isMobile ? 'slide' : 'fade'} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modalOverlay, !isMobile && styles.modalOverlayWide]}
      >
        <View style={[styles.modalContent, !isMobile && styles.modalContentWide]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} accessibilityRole="header">{activeTab === 'permanent' ? 'Post Job' : 'Post Shift'}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <ErrorBanner message={submitError} />
            {activeTab === 'permanent' ? (
              <>
                <FormInput label="Job Title" value={title} onChangeText={setTitle} placeholder="e.g. Senior Cardiologist" />
                <FormInput label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="e.g. Cardiology" />
                <FormInput label="Location" value={location} onChangeText={setLocation} placeholder="City, State" />
                <FormInput label="Min Salary (Rs./mo)" value={salaryMin} onChangeText={setSalaryMin} placeholder="e.g. 200000" keyboardType="numeric" />
                <FormInput label="Max Salary (Rs./mo)" value={salaryMax} onChangeText={setSalaryMax} placeholder="e.g. 350000" keyboardType="numeric" />
                <FormInput label="Description" value={description} onChangeText={setDescription} placeholder="Job description..." multiline />
              </>
            ) : (
              <>
                <FormInput label="Shift Date" value={shiftDate} onChangeText={setShiftDate} placeholder="YYYY-MM-DD" />
                <FormInput label="Shift Time" value={shiftTime} onChangeText={setShiftTime} placeholder="e.g. 08:00 AM - 08:00 PM" />
                <FormInput label="Duration" value={duration} onChangeText={setDuration} placeholder="e.g. 12 hours" />
                <FormInput label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="e.g. Emergency Medicine" />
                <FormInput label="Pay (Rs./shift)" value={pay} onChangeText={setPay} placeholder="e.g. 8000" keyboardType="numeric" />
              </>
            )}
            <TouchableOpacity testID="submit-job-btn" style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Post {activeTab === 'permanent' ? 'Job' : 'Shift'}</Text>}
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
  addBtnDisabled: { opacity: 0.4 },
  noticeWrap: { paddingHorizontal: 16 },
  noticeWrapWide: { paddingHorizontal: 0 },

  // Desktop page heading. The TopBar shows where you are in the app; this
  // says what the page is and what it's for, which the mobile header had no
  // room to do.
  wideTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  titleRowMobile: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  wideTitleText: { flex: 1 },
  wideTitle: { ...typography.h2, color: colors.text },
  wideSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  widePostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  widePostBtnHover: { backgroundColor: colors.navyLight },
  widePostBtnText: { ...typography.label, color: colors.white },

  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tabBarWide: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  tabActive: { backgroundColor: '#1A3A5C' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  list: { padding: 16, paddingBottom: 100 },
  listWide: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: spacing.xxxl },
  columnWrapper: { gap: spacing.lg },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  // flex:1 lets two cards share a row evenly; without it each sizes to its own
  // content and the grid looks ragged.
  cardWide: { flex: 1, marginBottom: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardMeta: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F0FDF4' },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: '#0F766E' },
  cardDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 13, color: '#64748B' },
  cardDesc: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A3A5C', borderRadius: 12, paddingVertical: 12 },
  appliedBtn: { backgroundColor: '#94A3B8' },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statsText: { fontSize: 13, color: '#1A3A5C', fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  // A sheet sliding up from the bottom edge is a phone gesture. On desktop the
  // same form becomes a centred dialog, which is what a pointer user expects.
  modalOverlayWide: { justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalContentWide: {
    borderRadius: radius.xl + 4,
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  modalClose: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  modalScroll: { padding: 20 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  formInput: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A' },
  submitBtn: { backgroundColor: '#1A3A5C', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 40 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
