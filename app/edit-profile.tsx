import React, { useState } from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Button, FormInput, SelectField, ScreenHeader, ErrorBanner } from '../src/components';
import { STATE_NAMES, citiesForState, isCustomCity, OTHER_CITY } from '../src/data/indiaLocations';
import { colors, spacing, typography } from '../src/theme';
import { PageColumn } from '../src/components/web';

export default function EditProfileScreen() {
  const { user, token, refreshUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? '');
  const [specialty, setSpecialty] = useState(user?.specialty ?? '');
  const [professionalRole, setProfessionalRole] = useState(user?.professional_role ?? '');
  const [state, setState] = useState(user?.state ?? '');
  // A stored city outside its state's list predates these pickers, or was
  // typed through "Other". Either way it re-opens as "Other" with the text
  // intact, rather than showing an empty field over saved data.
  const storedCityIsCustom = isCustomCity(user?.state ?? '', user?.city ?? '');
  const [citySelection, setCitySelection] = useState(
    storedCityIsCustom ? OTHER_CITY : (user?.city ?? ''),
  );
  const [cityOther, setCityOther] = useState(storedCityIsCustom ? (user?.city ?? '') : '');
  const [experience, setExperience] = useState(user?.years_experience != null ? String(user.years_experience) : '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [contactPerson, setContactPerson] = useState(user?.contact_person ?? '');
  const [specialtyFocus, setSpecialtyFocus] = useState(user?.specialty_focus ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityOptions = [...citiesForState(state), OTHER_CITY];
  const cityIsOther = citySelection === OTHER_CITY;
  const cityValue = cityIsOther ? cityOther : citySelection;

  const changeState = (next: string) => {
    setState(next);
    // A city picked under the old state is almost never in the new one, so drop
    // it rather than save "Mumbai, Kerala". A typed "Other" city survives: the
    // member entered it deliberately and it stays visible right below.
    if (!cityIsOther && !citiesForState(next).includes(citySelection)) setCitySelection('');
  };

  const isProfessional = user?.role === 'healthcare_professional';
  const isHospital = user?.role === 'hospital';
  const isClinic = user?.role === 'clinic';

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload: Record<string, any> = { name: name.trim() };
      if (isProfessional) {
        payload.professional_role = professionalRole.trim();
        payload.specialty = specialty.trim();
        payload.city = cityValue.trim();
        payload.state = state.trim();
        const years = parseInt(experience, 10);
        if (!Number.isNaN(years)) payload.years_experience = years;
      } else if (isHospital) {
        payload.location = location.trim();
        payload.contact_person = contactPerson.trim();
      } else if (isClinic) {
        payload.specialty_focus = specialtyFocus.trim();
        payload.location = location.trim();
      }
      // Passing `null` here sent no Authorization header, so every save 401'd.
      await apiFetch('/api/profile/update', token, { method: 'PUT', body: JSON.stringify(payload) });
      await refreshUser();
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={640} testID="edit-profile-column">
      <ScreenHeader title="Edit Profile" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error} />

          <FormInput label="Full name" icon="person-outline" value={name} onChangeText={setName} placeholder="Your name" testID="edit-name" />

          {isProfessional && (
            <>
              <FormInput label="Professional role" icon="medkit-outline" value={professionalRole} onChangeText={setProfessionalRole} placeholder="Doctor, Nurse, Allied Health" />
              <FormInput label="Specialty" icon="medical-outline" value={specialty} onChangeText={setSpecialty} placeholder="e.g. Cardiology" />
              {/* State first: it is what narrows the city list, and a city
                  picker with nothing in it reads as broken. */}
              <SelectField
                testID="edit-state"
                label="State"
                icon="map-outline"
                value={state}
                onChange={changeState}
                options={STATE_NAMES}
                placeholder="Select your state"
                title="State or union territory"
                searchPlaceholder="Search states…"
              />
              <SelectField
                testID="edit-city"
                label="City"
                icon="location-outline"
                value={citySelection}
                onChange={setCitySelection}
                options={cityOptions}
                placeholder="Select your city"
                disabled={!state}
                disabledHint="Choose a state first"
                searchPlaceholder="Search cities…"
              />
              {cityIsOther ? (
                <FormInput
                  testID="edit-city-other"
                  label="City name"
                  icon="create-outline"
                  value={cityOther}
                  onChangeText={setCityOther}
                  placeholder="Type your city or town"
                  maxLength={80}
                />
              ) : null}
              <FormInput label="Years of experience" icon="time-outline" value={experience} onChangeText={setExperience} placeholder="e.g. 8" keyboardType="number-pad" />
            </>
          )}

          {isHospital && (
            <>
              <FormInput label="Location" icon="location-outline" value={location} onChangeText={setLocation} placeholder="City / address" />
              <FormInput label="Contact person" icon="person-outline" value={contactPerson} onChangeText={setContactPerson} placeholder="Who should applicants reach?" />
            </>
          )}

          {isClinic && (
            <>
              <FormInput label="Specialty focus" icon="medical-outline" value={specialtyFocus} onChangeText={setSpecialtyFocus} placeholder="e.g. Dermatology" />
              <FormInput label="Location" icon="location-outline" value={location} onChangeText={setLocation} placeholder="City / address" />
            </>
          )}

          <Text style={styles.note}>
            Your email and verification status can&apos;t be changed here. Contact support if they need updating.
          </Text>

          <Button label="Save changes" onPress={save} loading={saving} testID="edit-save" />
        </ScrollView>
      </KeyboardAvoidingView>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.xxxl + 16 },
  note: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xl },
});
