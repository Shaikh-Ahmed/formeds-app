import React, { useState } from 'react';
import { FormScrollView } from '../src/components/FormScrollView';
import { focusFirstInvalid } from '../src/hooks/useFormErrors';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Button, FormInput, NumberField, SelectField, ScreenHeader, ErrorBanner } from '../src/components';
import { validateInteger } from '../src/utils/validation';
import { ResumeCard } from '../src/components/jobs/ResumeCard';
import { STATE_NAMES, citiesForState, isCustomCity, OTHER_CITY } from '../src/data/indiaLocations';
import { OTHER_SPECIALTY, PROFESSIONAL_ROLES, SPECIALTY_OPTIONS, SPECIALTIES } from '../src/data/specialties';
import { colors, spacing, typography } from '../src/theme';
import { PageColumn } from '../src/components/web';
import {
  StudentEducationFields, validateEducation, type StudentEducation, type EducationField,
} from '../src/components/students/StudentEducationFields';

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

  const [experienceError, setExperienceError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const isProfessional = user?.role === 'healthcare_professional';
  const isHospital = user?.role === 'hospital';
  const isClinic = user?.role === 'clinic';
  const isStudent = user?.role === 'student';
  const [education, setEducation] = useState<StudentEducation>({
    course: user?.student_course ?? '',
    institution: user?.student_institution ?? '',
    university: user?.student_university ?? '',
    current_year: user?.student_year ? String(user.student_year) : '',
    graduation_year: user?.graduation_year ? String(user.graduation_year) : '',
  });
  const [educationErrors, setEducationErrors] = useState<Partial<Record<EducationField, string>>>({});

  const save = async () => {
    const nameProblem = name.trim() ? null : 'Name is required.';
    const expError = isProfessional ? validateInteger(experience, 'Years of experience', { max: 80 }) : null;
    const eduStarted = isStudent && Object.values(education).some(v => String(v).trim());
    const eduProblems = eduStarted ? validateEducation(education) : {};
    setNameError(nameProblem);
    setExperienceError(expError);
    setEducationErrors(eduProblems);
    // Each problem is shown under its own field; nothing is sent.
    if (nameProblem || expError || Object.keys(eduProblems).length) { setError(null); focusFirstInvalid(); return; }
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const payload: Record<string, any> = { name: name.trim() };
      if (isProfessional) {
        payload.professional_role = professionalRole.trim();
        payload.specialty = specialty.trim();
        payload.city = cityValue.trim();
        payload.state = state.trim();
        if (experience) payload.years_experience = Number(experience);
      } else if (isStudent) {
        payload.city = cityValue.trim();
        payload.state = state.trim();
      } else if (isHospital) {
        payload.location = location.trim();
        payload.contact_person = contactPerson.trim();
      } else if (isClinic) {
        payload.specialty_focus = specialtyFocus.trim();
        payload.location = location.trim();
      }
      // Passing `null` here sent no Authorization header, so every save 401'd.
      await apiFetch('/api/profile/update', token, { method: 'PUT', body: JSON.stringify(payload) });
      if (eduStarted) {
        // Education is validated as a whole record by PATCH /profile/me.
        await apiFetch('/api/profile/me', token, { method: 'PATCH', body: JSON.stringify({
          student_course: education.course,
          student_institution: education.institution.trim(),
          student_university: education.university.trim(),
          student_year: Number(education.current_year),
          graduation_year: Number(education.graduation_year),
        }) });
      }
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
        <FormScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error} />

          <FormInput label="Full name" icon="person-outline" value={name} onChangeText={v => { setName(v); setNameError(null); }} placeholder="Your name" maxLength={120}
            error={nameError ?? undefined} testID="edit-name" />

          {isStudent && (
            <>
              <Text style={styles.sectionLabel}>Education</Text>
              <StudentEducationFields
                value={education}
                onChange={(field, v) => {
                  setEducation(e => ({ ...e, [field]: v }));
                  setEducationErrors(e => ({ ...e, [field]: undefined }));
                }}
                errors={educationErrors}
                testIDPrefix="edit-student"
              />
            </>
          )}

          {isProfessional && (
            <>
              <Text style={styles.sectionLabel}>Resume</Text>
              <ResumeCard />
              <ListOrOther label="Professional role" icon="medkit-outline" value={professionalRole}
                onChange={setProfessionalRole} known={PROFESSIONAL_ROLES} maxLength={80} testID="edit-role" />
              <ListOrOther label="Specialty" icon="medical-outline" value={specialty}
                onChange={setSpecialty} known={SPECIALTIES} options={SPECIALTY_OPTIONS} maxLength={120} testID="edit-specialty" />
            </>
          )}

          {(isProfessional || isStudent) && (
            <>
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
            </>
          )}

          {isProfessional && (
            <NumberField label="Years of experience" suffix="years" value={experience} maxDigits={2}
              onChangeText={v => { setExperience(v); setExperienceError(null); }} placeholder="e.g. 8"
              error={experienceError} testID="edit-experience" />
          )}

          {isHospital && (
            <>
              <FormInput label="Location" icon="location-outline" value={location} onChangeText={setLocation} placeholder="City / address" maxLength={200} />
              <FormInput label="Contact person" icon="person-outline" value={contactPerson} onChangeText={setContactPerson} placeholder="Who should applicants reach?" maxLength={120} />
            </>
          )}

          {isClinic && (
            <>
              <FormInput label="Specialty focus" icon="medical-outline" value={specialtyFocus} onChangeText={setSpecialtyFocus} placeholder="e.g. Dermatology" maxLength={120} />
              <FormInput label="Location" icon="location-outline" value={location} onChangeText={setLocation} placeholder="City / address" maxLength={200} />
            </>
          )}

          <Text style={styles.note}>
            Your email and verification status can&apos;t be changed here. Contact support if they need updating.
          </Text>

          <Button label="Save changes" loadingLabel="Saving…" onPress={save} loading={saving} testID="edit-save" />
        </FormScrollView>
      </KeyboardAvoidingView>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.xxxl + 16 },
  note: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xl },
});

/**
 * A value from a known list, with "Other" for anything the list lacks. A
 * stored value outside the list re-opens as Other with its text intact.
 */
function ListOrOther({ label, icon, value, onChange, known, options, maxLength, testID }: {
  label: string; icon: React.ComponentProps<typeof FormInput>['icon']; value: string; onChange: (v: string) => void;
  known: string[]; options?: string[]; maxLength: number; testID?: string;
}) {
  const [other, setOther] = useState(!!value && !known.includes(value));
  return (
    <>
      <SelectField label={label} icon={icon} value={other ? OTHER_SPECIALTY : value}
        options={options ?? [...known, OTHER_SPECIALTY]} placeholder={`Choose your ${label.toLowerCase()}`}
        searchPlaceholder="Search…" testID={testID}
        onChange={v => { if (v === OTHER_SPECIALTY) { setOther(true); onChange(''); } else { setOther(false); onChange(v); } }} />
      {other ? (
        <FormInput label={`${label} (type it)`} icon="create-outline" value={value} onChangeText={onChange}
          maxLength={maxLength} testID={testID ? `${testID}-other` : undefined} />
      ) : null}
    </>
  );
}
