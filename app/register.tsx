import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const ROLES: Record<string, { label: string; icon: string; color: string }> = {
  healthcare_professional: { label: 'Healthcare Professional', icon: 'medkit', color: '#0F766E' },
  hospital: { label: 'Hospital', icon: 'business', color: '#1A3A5C' },
  clinic: { label: 'Clinic', icon: 'fitness', color: '#0F766E' },
};

export default function RegisterScreen() {
  const { role: paramRole } = useLocalSearchParams<{ role: string }>();
  const [role, setRole] = useState(paramRole || 'healthcare_professional');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [professionalRole, setProfessionalRole] = useState('Doctor');
  const [specialty, setSpecialty] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('');
  const [hospitalType, setHospitalType] = useState('Private');
  const [location, setLocation] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [specialtyFocus, setSpecialtyFocus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  // LOVs
  const [lovs, setLovs] = useState<any>({ states: [], cities: {}, specialties: [], hospital_types: [], professional_roles: [] });
  const [pickerModal, setPickerModal] = useState<{ visible: boolean; title: string; options: string[]; onSelect: (v: string) => void }>({ visible: false, title: '', options: [], onSelect: () => {} });

  useEffect(() => {
    apiFetch('/api/lovs').then(setLovs).catch(() => {
      setLovs({
        states: ['Andhra Pradesh', 'Delhi', 'Gujarat', 'Karnataka', 'Kerala', 'Maharashtra', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal'],
        cities: {
          'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur'],
          'Delhi': ['New Delhi', 'Gurgaon', 'Noida', 'Faridabad'],
          'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
          'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Mangalore'],
          'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode'],
          'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
          'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur'],
          'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
          'Telangana': ['Hyderabad', 'Warangal'],
          'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi'],
          'West Bengal': ['Kolkata', 'Siliguri', 'Asansol']
        },
        specialties: ['Anesthesiology', 'Cardiology', 'Dermatology', 'Emergency Medicine', 'General Medicine', 'Neurology', 'Obstetrics & Gynecology', 'Oncology', 'Ophthalmology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery'],
        hospital_types: ['Private', 'Government', 'Trust/NGO', 'Corporate'],
        professional_roles: ['Doctor', 'Nurse', 'Pharmacist', 'Lab Technician', 'Allied Health Worker', 'Hospital Administrator']
      });
    });
  }, []);

  const openPicker = (title: string, options: string[], onSelect: (v: string) => void) => {
    setPickerModal({ visible: true, title, options, onSelect });
  };

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Please fill in required fields'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      const data: any = { email, password, name, role };
      if (role === 'healthcare_professional') {
        data.professional_role = professionalRole;
        data.specialty = specialty;
        data.registration_number = regNumber;
        data.state = state;
        data.city = city;
        data.years_experience = parseInt(experience) || 0;
      } else if (role === 'hospital') {
        data.hospital_type = hospitalType;
        data.location = location;
        data.license_number = licenseNumber;
        data.contact_person = contactPerson;
      } else {
        data.specialty_focus = specialtyFocus;
        data.location = location;
        data.registration_number = regNumber;
      }
      await register(data);
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const roleInfo = ROLES[role] || ROLES.healthcare_professional;
  const citiesForState = lovs.cities?.[state] || [];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="register-back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A3A5C" />
          </TouchableOpacity>

          <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '15' }]}>
            <Ionicons name={roleInfo.icon as any} size={20} color={roleInfo.color} />
            <Text style={[styles.roleBadgeText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
          </View>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join ForMeds healthcare platform</Text>

          {error ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={18} color="#E84545" /><Text style={styles.errorText}>{error}</Text></View> : null}

          <InputField testID="register-name-input" label="Full Name *" icon="person-outline" value={name} onChangeText={setName} placeholder={role === 'hospital' ? 'Hospital Name' : role === 'clinic' ? 'Clinic Name' : 'Dr. Full Name'} />
          <InputField testID="register-email-input" label="Email *" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <InputField testID="register-password-input" label="Password *" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Min 8 characters" secureTextEntry />

          {role === 'healthcare_professional' && (
            <>
              <Text style={styles.sectionTitle}>Professional Details</Text>
              <View style={styles.chipRow}>
                {(lovs.professional_roles?.length ? lovs.professional_roles.slice(0, 3) : ['Doctor', 'Nurse', 'Allied Health']).map((r: string) => (
                  <TouchableOpacity key={r} testID={`role-chip-${r.toLowerCase().replace(/\s/g, '-')}`} style={[styles.chip, professionalRole === r && styles.chipActive]} onPress={() => setProfessionalRole(r)}>
                    <Text style={[styles.chipText, professionalRole === r && styles.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <PickerField testID="register-specialty-picker" label="Specialty" icon="medkit-outline" value={specialty} placeholder="Select Specialty" onPress={() => openPicker('Select Specialty', lovs.specialties || [], (v) => setSpecialty(v))} />
              <InputField testID="register-regnumber-input" label="Registration Number" icon="document-text-outline" value={regNumber} onChangeText={setRegNumber} placeholder="Medical registration #" />
              <PickerField testID="register-state-picker" label="State" icon="location-outline" value={state} placeholder="Select State" onPress={() => openPicker('Select State', lovs.states || [], (v) => { setState(v); setCity(''); })} />
              <PickerField testID="register-city-picker" label="City" icon="navigate-outline" value={city} placeholder={state ? "Select City" : "Select state first"} onPress={() => { if (citiesForState.length > 0) openPicker('Select City', citiesForState, (v) => setCity(v)); }} />
              <InputField testID="register-experience-input" label="Years of Experience" icon="time-outline" value={experience} onChangeText={setExperience} placeholder="0" keyboardType="numeric" />
            </>
          )}

          {role === 'hospital' && (
            <>
              <Text style={styles.sectionTitle}>Hospital Details</Text>
              <PickerField label="Hospital Type" icon="business-outline" value={hospitalType} placeholder="Select Type" onPress={() => openPicker('Hospital Type', lovs.hospital_types || ['Private', 'Government', 'Trust/NGO'], (v) => setHospitalType(v))} />
              <PickerField label="State" icon="location-outline" value={state} placeholder="Select State" onPress={() => openPicker('Select State', lovs.states || [], (v) => { setState(v); setCity(''); setLocation(''); })} />
              <PickerField label="City" icon="navigate-outline" value={city} placeholder={state ? "Select City" : "Select state first"} onPress={() => { if (citiesForState.length > 0) openPicker('Select City', citiesForState, (v) => { setCity(v); setLocation(`${v}, ${state}`); }); }} />
              <InputField label="License Number" icon="document-text-outline" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="Hospital license #" />
              <InputField label="Contact Person" icon="person-outline" value={contactPerson} onChangeText={setContactPerson} placeholder="Admin contact name" />
            </>
          )}

          {role === 'clinic' && (
            <>
              <Text style={styles.sectionTitle}>Clinic Details</Text>
              <PickerField label="Specialty Focus" icon="medkit-outline" value={specialtyFocus} placeholder="Select Specialty" onPress={() => openPicker('Specialty Focus', lovs.specialties || [], (v) => setSpecialtyFocus(v))} />
              <PickerField label="State" icon="location-outline" value={state} placeholder="Select State" onPress={() => openPicker('Select State', lovs.states || [], (v) => { setState(v); setCity(''); setLocation(''); })} />
              <PickerField label="City" icon="navigate-outline" value={city} placeholder={state ? "Select City" : "Select state first"} onPress={() => { if (citiesForState.length > 0) openPicker('Select City', citiesForState, (v) => { setCity(v); setLocation(`${v}, ${state}`); }); }} />
              <InputField label="Registration Number" icon="document-text-outline" value={regNumber} onChangeText={setRegNumber} placeholder="Clinic registration #" />
            </>
          )}

          <TouchableOpacity testID="register-submit-btn" style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>Already registered? <Text style={styles.linkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Picker Modal */}
      <Modal visible={pickerModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerModal.title}</Text>
              <TouchableOpacity onPress={() => setPickerModal(prev => ({ ...prev, visible: false }))}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
            </View>
            <FlatList
              data={pickerModal.options}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity testID={`picker-option-${item}`} style={styles.pickerItem} onPress={() => { pickerModal.onSelect(item); setPickerModal(prev => ({ ...prev, visible: false })); }}>
                  <Text style={styles.pickerItemText}>{item}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InputField({ label, icon, testID, ...props }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={20} color="#94A3B8" style={styles.inputIcon} />
        <TextInput testID={testID} style={styles.input} placeholderTextColor="#94A3B8" autoCapitalize="none" {...props} />
      </View>
    </View>
  );
}

function PickerField({ label, icon, value, placeholder, onPress, testID }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity testID={testID} style={styles.inputWrap} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name={icon} size={20} color="#94A3B8" style={styles.inputIcon} />
        <Text style={[styles.pickerText, !value && styles.placeholderText]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 60 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
  roleBadgeText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#E84545', fontSize: 14, marginLeft: 8, flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A3A5C', marginTop: 12, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#1A3A5C', borderColor: '#1A3A5C' },
  chipText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0F172A' },
  pickerText: { flex: 1, fontSize: 16, color: '#0F172A' },
  placeholderText: { color: '#94A3B8' },
  submitBtn: { backgroundColor: '#1A3A5C', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 20 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 15, color: '#64748B' },
  linkBold: { fontWeight: '700', color: '#1A3A5C' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  pickerList: { maxHeight: 400 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pickerItemText: { fontSize: 16, color: '#0F172A' },
});
