import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Button, ErrorBanner, ErrorState, FormInput, LoadingState, SelectField } from '../../src/components';
import { colors, radius, spacing, typography } from '../../src/theme';
import {
  normalizeUrl, validateEmail, validateGstin, validateOptionalMobile, validatePan, validatePincode, validateUrl,
} from '../../src/utils/validation';
import { OTHER_CITY, STATE_NAMES, citiesForState, isCustomCity } from '../../src/data/indiaLocations';
import {
  Card, MultiChips, Notice, RecruiterScreen, RecruiterStatusPill, VerifiedRecruiterBadge, formatDate, recruiterStyles,
} from '../../src/components/recruiters/RecruiterUI';
import {
  deleteRecruiterDocument, fetchRecruiterAccount, fetchRecruiterEvents, submitRecruiterReview,
  updateRecruiterAccount, uploadRecruiterDocument,
} from '../../src/api/recruiters';
import {
  DOC_LABELS, STATUS_META, missingLabel,
  type PlacementType, type RecruiterAccount, type RecruiterDocType, type StatusEvent,
} from '../../src/types/recruiters';

const BUSINESS_TYPES: Record<string, string> = {
  proprietorship: 'Sole proprietorship', partnership: 'Partnership', llp: 'LLP',
  private_limited: 'Private limited company', public_limited: 'Public limited company', other: 'Other',
};
const PLACEMENTS: { value: PlacementType; label: string }[] = [
  { value: 'permanent', label: 'Permanent' }, { value: 'contract', label: 'Contract' },
  { value: 'locum', label: 'Locum' }, { value: 'temporary', label: 'Temporary' },
  { value: 'telemedicine', label: 'Telemedicine' },
];
const TEXT_FIELDS = [
  'company_name', 'legal_name', 'registration_number', 'gstin', 'pan', 'website', 'address', 'city', 'state',
  'pincode', 'rep_name', 'rep_designation', 'rep_phone', 'rep_email', 'about',
] as const;
type TextField = typeof TEXT_FIELDS[number];
const LEGAL = new Set(['legal_name', 'business_type', 'registration_number', 'gstin', 'pan']);
const MAX_BYTES = 10 * 1024 * 1024;
// The server's column caps, enforced while typing.
const MAX: Partial<Record<TextField, number>> = {
  company_name: 140, legal_name: 160, registration_number: 60, gstin: 15, pan: 10, website: 200, address: 400,
  city: 80, state: 80, pincode: 6, rep_name: 120, rep_designation: 120, rep_phone: 16, rep_email: 200,
};

const splitList = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

/**
 * Business, legal and representative details, documents, and submission.
 * Doubles as the recruiter profile once approved (legal fields then lock).
 */
export default function RecruiterAccountScreen() {
  const { token, refreshUser } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState<RecruiterAccount | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [placements, setPlacements] = useState<PlacementType[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Shown next to whatever caused it -- this page is long, and a banner at
  // the top is off-screen when Submit fails at the bottom.
  const [error, setErrorState] = useState<{ at: 'save' | 'docs' | 'submit'; message: string } | null>(null);
  const setError = (message: string | null | undefined, at: 'save' | 'docs' | 'submit' = 'save') =>
    setErrorState(message ? { at, message } : null);
  const errorAt = (at: 'save' | 'docs' | 'submit') => (error?.at === at ? error.message : null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cityOther, setCityOther] = useState(false);

  const hydrate = (a: RecruiterAccount) => {
    setAccount(a);
    const next: Record<string, string> = {};
    TEXT_FIELDS.forEach(f => { next[f] = (a as any)[f] || ''; });
    next.business_type = a.business_type || '';
    next.specialties = (a.specialties || []).join(', ');
    next.regions = (a.regions || []).join(', ');
    next.categories = (a.categories || []).join(', ');
    setForm(next);
    setPlacements(a.placement_types || []);
  };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [a, ev] = await Promise.all([fetchRecruiterAccount(token), fetchRecruiterEvents(token)]);
      hydrate(a);
      setEvents(ev);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load your account.');
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (saved) { const t = setTimeout(() => setSaved(false), 2500); return () => clearTimeout(t); } }, [saved]);

  if (!account && loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!account) return <LoadingState />;

  const status = account.status;
  const editable = status !== 'UNDER_REVIEW' && status !== 'SUSPENDED';
  const approved = status === 'APPROVED';
  const docsEditable = account.can_submit;
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const fieldEditable = (k: string) => editable && !(approved && LEGAL.has(k));

  // Format checks, field by field, with the server's own wording. Required
  // fields are only enforced at submission: the form is saved in stages.
  const formatErrors = (f: Record<string, string>): Record<string, string> => {
    const out: Record<string, string | null> = {
      gstin: validateGstin(f.gstin || ''),
      pan: validatePan(f.pan || ''),
      pincode: validatePincode(f.pincode || ''),
      website: validateUrl(f.website || ''),
      rep_phone: validateOptionalMobile(f.rep_phone || ''),
      rep_email: f.rep_email ? validateEmail(f.rep_email) : null,
      company_name: (f.company_name || '').trim().length < 2 ? 'Company name is required.' : null,
    };
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as Record<string, string>;
  };
  const save = async (): Promise<boolean> => {
    if (!token) return false;
    const problems = formatErrors(form);
    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      setError(Object.keys(problems).length === 1 ? Object.values(problems)[0] : 'Please fix the highlighted fields.');
      return false;
    }
    setBusy('save'); setError(null);
    try {
      const patch: Record<string, unknown> = {};
      TEXT_FIELDS.forEach(f => { if (fieldEditable(f)) patch[f] = f === 'rep_email' && !form[f] ? null : form[f]; });
      if (fieldEditable('website') && form.website) patch.website = normalizeUrl(form.website);
      if (fieldEditable('business_type') && form.business_type) patch.business_type = form.business_type;
      patch.specialties = splitList(form.specialties || '');
      patch.regions = splitList(form.regions || '');
      patch.categories = splitList(form.categories || '');
      patch.placement_types = placements;
      hydrate(await updateRecruiterAccount(token, patch as any));
      setSaved(true);
      return true;
    } catch (e: any) {
      setError(e?.message || 'Could not save your details.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const upload = async (docType: RecruiterDocType) => {
    if (!token) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_BYTES) { setError('That file is larger than 10MB.', 'docs'); return; }
    setBusy(docType); setError(null);
    try {
      // setAccount, not hydrate: refreshing the form from the server here
      // would wipe anything typed but not yet saved.
      setAccount(await uploadRecruiterDocument(token, docType, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType }));
    } catch (e: any) {
      setError(e?.message || 'Could not upload the document.', 'docs');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    setBusy(id);
    try { setAccount(await deleteRecruiterDocument(token, id)); } catch (e: any) {
      setError(e?.message || 'Could not remove the document.', 'docs');
    } finally { setBusy(null); }
  };

  const submit = async () => {
    if (!token) return;
    if (!(await save())) { setErrorState(prev => (prev ? { ...prev, at: 'submit' } : prev)); return; }
    setSaved(false);
    setBusy('submit'); setError(null);
    try {
      hydrate(await submitRecruiterReview(token));
      setEvents(await fetchRecruiterEvents(token));
      refreshUser();
    } catch (e: any) {
      const missing: string[] = e?.data?.detail?.missing ?? [];
      setError(missing.length ? `Still needed: ${missing.map(missingLabel).join(', ')}` : e?.message || 'Could not submit.',
        'submit');
    } finally {
      setBusy(null);
    }
  };

  const input = (k: TextField, label: string, props: Record<string, any> = {}) => (
    <FormInput testID={`recruiter-field-${k}`} label={label} value={form[k] || ''}
      onChangeText={v => { set(k)(v); if (fieldErrors[k]) setFieldErrors(({ [k]: _, ...rest }) => rest); }}
      editable={fieldEditable(k)} error={fieldErrors[k]} maxLength={MAX[k]} {...props} />
  );
  const cities = citiesForState(form.state);
  const cityAsText = cityOther || !cities.length || (!!form.city && isCustomCity(form.state, form.city));

  const docTypes: RecruiterDocType[] = ['business_registration', 'representative_id', 'gst_certificate',
    'pan_card', 'authorization_letter', 'other'];

  return (
    <RecruiterScreen title="Account & verification" subtitle="Your agency details, documents and verification status." active="account" testID="recruiter-account">
      <Card>
        <View style={recruiterStyles.row}>
          <Text style={styles.heading}>Verification status</Text>
          {approved ? <VerifiedRecruiterBadge /> : <RecruiterStatusPill status={status} />}
        </View>
        {account.status_reason && !approved ? (
          <Text style={[recruiterStyles.muted, { marginTop: spacing.sm }]} testID="recruiter-status-reason">
            Note from our team: {account.status_reason}
          </Text>
        ) : null}
        {approved ? (
          <Text style={[recruiterStyles.muted, { marginTop: spacing.sm }]}>
            Legal details are verified and locked. Contact support@formeds.in to change them.
          </Text>
        ) : null}
      </Card>

      {status === 'UNDER_REVIEW' ? (
        <Notice tone="warning" title="Under review" body="Your details are locked while our team reviews them." />
      ) : null}

      <Card title="Business details">
        {input('company_name', 'Trading / agency name *')}
        {input('legal_name', 'Registered legal name *')}
        <SelectField label="Business type *" value={BUSINESS_TYPES[form.business_type] || ''}
          options={Object.values(BUSINESS_TYPES)} placeholder="Choose"
          disabled={!fieldEditable('business_type')} testID="recruiter-field-business_type"
          onChange={label => set('business_type')(Object.keys(BUSINESS_TYPES).find(k => BUSINESS_TYPES[k] === label) || '')} />
        {input('registration_number', 'Registration / CIN number *', { autoCapitalize: 'characters' })}
        {input('gstin', 'GSTIN', { autoCapitalize: 'characters', placeholder: '27ABCDE1234F1Z5' })}
        {input('pan', 'Company PAN', { autoCapitalize: 'characters', placeholder: 'ABCDE1234F' })}
        {input('website', 'Website', { autoCapitalize: 'none', keyboardType: 'url', placeholder: 'careplus.in' })}
        {input('address', 'Registered address *', { rows: 2, multiline: true })}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <SelectField label="State *" value={form.state || ''} options={STATE_NAMES} placeholder="Choose a state"
              disabled={!fieldEditable('state')} testID="recruiter-field-state"
              onChange={v => { setForm(f => ({ ...f, state: v, city: citiesForState(v).includes(f.city) ? f.city : '' })); setCityOther(false); }} />
          </View>
          <View style={styles.col}>
            {cityAsText ? input('city', 'City *') : (
              <SelectField label="City *" value={form.city || ''} options={[...cities, OTHER_CITY]} placeholder="Choose a city"
                searchPlaceholder="Search cities" disabled={!fieldEditable('city')} testID="recruiter-field-city-select"
                onChange={v => { if (v === OTHER_CITY) { setCityOther(true); set('city')(''); } else set('city')(v); }} />
            )}
          </View>
        </View>
        {input('pincode', 'PIN code', {
          keyboardType: 'number-pad', inputMode: 'numeric',
          onChangeText: (v: string) => { set('pincode')(v.replace(/\D/g, '').slice(0, 6)); setFieldErrors(({ pincode: _, ...rest }) => rest); },
        })}
      </Card>

      <Card title="Authorised representative">
        {input('rep_name', 'Full name *')}
        {input('rep_designation', 'Designation')}
        {input('rep_phone', 'Mobile *', { keyboardType: 'phone-pad', placeholder: '10-digit mobile number' })}
        {input('rep_email', 'Email *', { autoCapitalize: 'none', keyboardType: 'email-address' })}
      </Card>

      <Card title="What you recruit for" subtitle="Shown on your public recruiter profile.">
        <MultiChips label="Placement types" options={PLACEMENTS} value={placements}
          onChange={v => editable && setPlacements(v)} testID="recruiter-placements" />
        <FormInput maxLength={600} label="Specialties (comma separated)" value={form.specialties || ''} onChangeText={set('specialties')}
          editable={editable} placeholder="e.g. Cardiology, Emergency Medicine" testID="recruiter-field-specialties" />
        <FormInput maxLength={600} label="Professional categories" value={form.categories || ''} onChangeText={set('categories')}
          editable={editable} placeholder="e.g. Doctors, Nurses, Allied health" />
        <FormInput maxLength={600} label="Regions served" value={form.regions || ''} onChangeText={set('regions')}
          editable={editable} placeholder="e.g. Maharashtra, Karnataka" />
        {input('about', 'About your agency', { rows: 3, multiline: true, maxLength: 2000 })}
      </Card>

      {editable ? (
        <View>
          <ErrorBanner message={errorAt('save')} />
          <Button label="Save details" variant="outline" onPress={save} loading={busy === 'save'} testID="recruiter-save" />
          {saved ? <Text style={styles.saved} accessibilityLiveRegion="polite">Details saved</Text> : null}
        </View>
      ) : null}

      <Card title="Documents" subtitle="PDF, JPG or PNG, up to 10MB. Only our verification team can see them.">
        <ErrorBanner message={errorAt('docs')} />
        {docTypes.map(dt => {
          const have = account.documents.filter(d => d.doc_type === dt);
          const required = account.required_documents.includes(dt);
          return (
            <View key={dt} style={styles.docRow}>
              <Ionicons name={have.length ? 'document-attach' : 'document-outline'} size={20}
                color={have.length ? colors.teal : colors.textMuted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={recruiterStyles.strong}>{DOC_LABELS[dt]}{required ? ' *' : ''}</Text>
                {have.map(d => (
                  <View key={d.id} style={recruiterStyles.row}>
                    <Text style={recruiterStyles.muted}>Uploaded {formatDate(d.created_at)}</Text>
                    {docsEditable ? (
                      <Pressable onPress={() => remove(d.id)} accessibilityRole="button" testID={`doc-remove-${dt}`}
                        accessibilityLabel={`Remove ${DOC_LABELS[dt]}`} hitSlop={8}>
                        <Text style={styles.remove}>{busy === d.id ? 'Removing…' : 'Remove'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
              {docsEditable ? (
                <Pressable onPress={() => upload(dt)} accessibilityRole="button" testID={`doc-upload-${dt}`}
                  accessibilityLabel={`Upload ${DOC_LABELS[dt]}`} style={styles.uploadBtn}>
                  <Text style={recruiterStyles.link}>{busy === dt ? 'Uploading…' : have.length ? 'Add' : 'Upload'}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </Card>

      {account.can_submit ? (
        <Card>
          <ErrorBanner message={errorAt('submit')} />
          {account.missing.length ? (
            <Text style={[recruiterStyles.muted, { marginBottom: spacing.md }]} testID="recruiter-missing">
              Still needed: {account.missing.map(missingLabel).join(', ')}
            </Text>
          ) : (
            <Text style={[recruiterStyles.muted, { marginBottom: spacing.md }]}>
              Everything required is in place. Submit for review when you&apos;re ready.
            </Text>
          )}
          <Button label={status === 'PENDING' ? 'Submit for verification' : 'Resubmit for verification'}
            onPress={submit} loading={busy === 'submit'} testID="recruiter-submit" />
        </Card>
      ) : null}

      <Pressable onPress={() => router.push('/settings' as any)} accessibilityRole="link" testID="recruiter-settings"
        style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.8 }]}>
        <Ionicons name="settings-outline" size={18} color={colors.navy} />
        <Text style={[recruiterStyles.strong, { flex: 1 }]}>Sign-in email, password & account settings</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      {events.length ? (
        <Card title="Verification history">
          {events.map((e, i) => (
            <View key={i} style={styles.event}>
              <Text style={recruiterStyles.strong}>{STATUS_META[e.to_status]?.label ?? e.to_status}</Text>
              <Text style={recruiterStyles.muted}>{formatDate(e.created_at)}{e.reason ? ` · ${e.reason}` : ''}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </RecruiterScreen>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.h3, color: colors.navy, flex: 1 },
  saved: { ...typography.label, color: colors.teal, marginTop: spacing.sm, textAlign: 'center' },
  twoCol: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  col: { flexGrow: 1, flexBasis: 200 },
  docRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  uploadBtn: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  remove: { ...typography.small, color: colors.redText },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg,
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  event: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
});
