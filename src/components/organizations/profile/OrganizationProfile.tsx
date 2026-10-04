import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CoverArt } from '../../material';
import { TrustMark } from '../../TrustMark';
import { useSubmit } from '../../../hooks/useSubmit';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { colors, fonts, radius, spacing, typography, useBreakpoint, MIN_TOUCH_TARGET, isMaterial, isPremium, gloss } from '../../../theme';
import { Avatar } from '../../Avatar';
import { Button } from '../../Button';
import { Chip } from '../../Chip';
import { Sheet } from '../../Sheet';
import { ErrorBanner, ErrorState, LoadingState } from '../../States';
import { PageGrid } from '../../web';
import { JobCard } from '../../jobs/JobCard';
import { LocumCard } from '../../locum/LocumCard';
import { ProfileSection } from '../../profile/ProfileSection';
import { ProfileCompletion } from '../../profile/ProfileCompletion';
import { ConnectActions } from '../../network/ConnectActions';
import type { ProfileCompletionInfo } from '../../../types/profile';
import { mediaUri } from '../../../utils/media';
import { completionItems } from './completion';

export { completionItems };
import { shareOrCopy, webLink } from '../../../utils/share';
import * as orgApi from '../../../api/organizations';
import {
  ACCREDITATIONS, CLINIC_FACILITIES, CLINIC_SERVICES, CLINIC_SPECIALTIES, HOSPITAL_DEPARTMENTS,
  HOSPITAL_FACILITIES, HOSPITAL_SERVICES,
} from '../../../data/orgOptions';
import {
  ORG_OWNERSHIP_LABELS, ORG_TYPE_LABELS, WEEKDAYS,
  type OrgAffiliationRequest, type OrgOpeningHours, type OrgProfilePage, type Organization,
} from '../../../types/organizations';
import {
  BasicInfoSheet, ContactSheet, HoursSheet, JoinTeamSheet, TermsSheet, type OrgSheet,
} from './OrgEditSheets';

/**
 * A hospital's or clinic's profile: an institution, not a person.
 *
 * Built from the SAME pieces as a professional's profile, so the two read as
 * one product: the cover band and overlapping identity mark, the name and
 * meta lines, the compact icon-and-label actions, `ProfileSection` for every
 * section (teal overline, hairline rule, the same Add/Edit affordances and
 * empty states), `ProfileCompletion` and the rail groups. Only the content
 * differs: what this place is, what it offers, who works there, what it is
 * hiring for, and how to reach it. Nothing from the professional CV appears.
 *
 * Hospital and clinic differ where they really differ: a clinic is never shown
 * beds, teaching or hospital facilities, and leads with opening hours.
 */
export function OrganizationProfile({ orgId }: { orgId: string }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const { isMobile, isDesktop } = useBreakpoint();
  const [page, setPage] = useState<OrgProfilePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OrgSheet | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [requests, setRequests] = useState<OrgAffiliationRequest[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPage(await orgApi.fetchOrgProfile(token, orgId));
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load this profile.');
    }
  }, [token, orgId]);
  useEffect(() => { load(); }, [load]);

  const org = page?.organization;
  const editable = !!org?.can_edit;

  const loadRequests = useCallback(async () => {
    if (!token || !editable) return;
    try { setRequests(await orgApi.fetchAffiliations(token, orgId)); } catch { setRequests([]); }
  }, [token, editable, orgId]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const save = async (patch: Record<string, unknown>) => {
    if (!token) return;
    setSaving(true); setSaveError(null);
    try {
      await orgApi.updateOrganization(token, orgId, patch);
      setSheet(null);
      await load();
    } catch (e) {
      setSaveError(e);
    } finally { setSaving(false); }
  };

  const pick = async (target: 'logo' | 'cover' | 'photo') => {
    if (!token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setActionError('Photo access is needed to add a picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: target !== 'photo',
      aspect: target === 'logo' ? [1, 1] : target === 'cover' ? [3, 1] : undefined, quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    // A picked image uploads once, keyed, so a retry never adds it twice.
    await guard.run(key => uploadOnce(target, uri, key), { target, uri });
  };

  const uploadOnce = async (target: 'logo' | 'cover' | 'photo', uri: string, key: string) => {
    if (!token) return;
    setActionError(null);
    try {
      if (target === 'logo') await orgApi.uploadOrgLogo(token, orgId, uri);
      else if (target === 'cover') await orgApi.uploadOrgCover(token, orgId, uri);
      else await orgApi.addOrgPhoto(token, orgId, uri, '', key);
      await load();
    } catch (e: any) {
      setActionError(e?.message || 'Could not upload that image.');
    }
  };

  // One action at a time: a second tap on Join, Approve or Remove while one is
  // in flight does nothing.
  const guard = useSubmit();
  const act = (fn: (key: string) => Promise<unknown>, done: string, fallback: string) => guard.run(async key => {
    setActionError(null); setNotice(null);
    try { await fn(key); setNotice(done); await Promise.all([load(), loadRequests()]); } catch (e: any) {
      setActionError(e?.message || fallback);
    }
  });

  const completionInfo = useMemo(() => {
    if (!org) return undefined;
    const items = completionItems(org);
    const done = items.filter(i => i.done).length;
    return {
      percent: Math.round((done / items.length) * 100),
      suggestions: items.filter(i => !i.done).slice(0, 3).map(i => ({ key: i.key, label: i.prompt })),
    };
  }, [org]);

  if (error && !page) return <ErrorState message={error} onRetry={load} />;
  if (!page || !org) return <LoadingState label="Loading profile…" />;

  const isHospital = org.org_type === 'hospital';
  const typeLabel = org.subtype || ORG_TYPE_LABELS[org.org_type] || (isHospital ? 'Hospital' : 'Clinic');
  const place = [org.city, org.state].filter(Boolean).join(', ');
  const isProfessional = user?.role === 'healthcare_professional';
  const pending = requests.filter(r => r.status === 'requested');

  const openTerms = (field: TermsField, title: string, suggestions: string[]) =>
    setSheet({ kind: 'terms', field, title, suggestions });

  // Completion suggestions open the exact place to fill in.
  const onSuggestion = (key: string) => {
    if (key === 'logo') pick('logo');
    else if (key === 'photos') pick('photo');
    else if (key === 'hours') setSheet({ kind: 'hours' });
    else if (key === 'contact' || key === 'location' || key === 'website') setSheet({ kind: 'contact' });
    else if (key === 'specialties') openTerms('specialties', isHospital ? 'Departments & specialties' : 'Specialties',
      isHospital ? HOSPITAL_DEPARTMENTS : CLINIC_SPECIALTIES);
    else if (key === 'services') openTerms('services', 'Services', isHospital ? HOSPITAL_SERVICES : CLINIC_SERVICES);
    else if (key === 'facilities') openTerms('facilities', 'Facilities', isHospital ? HOSPITAL_FACILITIES : CLINIC_FACILITIES);
    else setSheet({ kind: 'basic' });
  };

  // ── Header: cover, identity mark, name, meta, actions ────────────────────
  const logoSize = isMobile ? 96 : 120;
  const header = (
    <View testID="org-header">
      <View style={[styles.cover, isMobile ? styles.coverMobile : styles.coverWide]}>
        {/* Material: an architectural gradient cover until the organisation uploads one. */}
        {(isMaterial || isPremium) && !org.cover_photo ? <CoverArt variant="organization" /> : null}
        {org.cover_photo ? (
          <Image source={{ uri: mediaUri(org.cover_photo) }} style={StyleSheet.absoluteFill} resizeMode="cover"
            accessibilityLabel={`${org.name} cover photo`} />
        ) : null}
        {editable ? (
          <View style={styles.coverActions}>
            <CoverButton icon="camera-outline" label={org.cover_photo ? 'Change cover photo' : 'Add cover photo'}
              onPress={() => pick('cover')} testID="org-cover-upload" />
            {org.cover_photo ? (
              <CoverButton icon="trash-outline" label="Remove cover photo"
                onPress={() => act(() => orgApi.removeOrgCover(token!, orgId), 'Cover removed.', 'Could not remove the cover.')} />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.logoRow, isMobile ? styles.padMobile : styles.padWide]}>
        <View style={styles.logoWrap}>
          <View style={styles.logoRing}>
            <OrgLogo org={org} size={logoSize} />
          </View>
          {org.verified ? (
            <View style={styles.verifiedTick} accessible accessibilityLabel="Verified healthcare organisation">
              <Ionicons name="checkmark" size={13} color={colors.white} />
            </View>
          ) : null}
          {editable ? (
            <Pressable onPress={() => pick('logo')} accessibilityRole="button" accessibilityLabel="Change logo"
              testID="org-logo-upload" style={({ pressed }) => [styles.logoEdit, pressed && styles.pressed]}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.identity, isMobile ? styles.padMobile : styles.padWide]} testID="org-identity">
        <Text style={[styles.name, isMobile && styles.nameMobile]} accessibilityRole="header" testID="org-name-heading">
          {org.name}
        </Text>
        {org.headline ? (
          <Text style={styles.headline}>{org.headline}</Text>
        ) : editable ? (
          <Pressable onPress={() => setSheet({ kind: 'basic' })} accessibilityRole="button"
            accessibilityLabel="Add a tagline">
            <Text style={styles.headlinePlaceholder}>Add a tagline</Text>
          </Pressable>
        ) : null}
        <Text style={styles.meta}>{[typeLabel, place].filter(Boolean).join(' · ')}</Text>
        {org.founded_year ? <Text style={styles.metaMuted}>Established {org.founded_year}</Text> : null}

        {org.verified ? (
          <View style={styles.verifiedRow}>
            <TrustMark size={15} classicIcon="shield-checkmark" />
            <Text style={styles.verifiedText}>Verified healthcare organisation</Text>
          </View>
        ) : org.verification_status === 'pending' ? (
          <View style={styles.verifiedRow}>
            <Ionicons name="time-outline" size={15} color={colors.warning} />
            <Text style={[styles.verifiedText, { color: colors.warning }]}>Verification in review</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {editable ? (
            <Action label="Edit profile" icon="create-outline" primary testID="org-edit"
              onPress={() => { setSaveError(null); setSheet({ kind: 'basic' }); }} />
          ) : (
            <>
              {/* Messaging needs a connection, so a visitor connects first;
                  Message appears once the hospital or clinic accepts. */}
              {user && org.account_user_id && !page.is_account ? (
                <ConnectActions userId={org.account_user_id} name={org.name} testID="org-connect" />
              ) : null}
              <Action label="Contact" icon="call-outline" testID="org-contact" onPress={() => setContactOpen(true)} />
            </>
          )}
          <Action label="Share" icon="share-outline" testID="org-share"
            // The profile belongs to the account, so the link is the account's.
            onPress={() => shareOrCopy({
              url: webLink(org.account_user_id ? `/profile/${org.account_user_id}` : `/org/${org.id}`), title: org.name,
            }).then(o => o === 'copied' && setNotice('Profile link copied.'))} />
        </View>
      </View>
    </View>
  );

  // ── Sections (the narrative column) ──────────────────────────────────────
  const terms = (
    field: TermsField, title: string, suggestions: string[], emptyTitle: string, emptyHint: string,
    tone: 'teal' | 'navy' | 'neutral' = 'teal',
  ) => {
    const items = ((org as any)[field] as string[] | undefined) || [];
    return (
      <ProfileSection key={field} title={title} testID={`org-section-${field}`} editable={editable} singular
        isEmpty={!items.length} emptyTitle={emptyTitle} emptyHint={emptyHint}
        onAdd={() => openTerms(field, title, suggestions)} addLabel={`Add ${title.toLowerCase()}`}>
        <View style={styles.chips}>{items.map(t => <Chip key={t} label={t} tone={tone} />)}</View>
      </ProfileSection>
    );
  };

  const hasHours = !!(org.open_24x7 || org.opening_hours?.length || org.emergency_24x7 || org.ambulance);
  const hours = (
    <ProfileSection title={isHospital ? 'Hours & emergency' : 'Opening hours'} testID="org-section-hours" singular
      editable={editable} isEmpty={!hasHours} onAdd={() => setSheet({ kind: 'hours' })}
      addLabel={isHospital ? 'Add hours' : 'Add opening hours'}
      emptyTitle={isHospital ? 'When are you open?' : 'When can patients visit?'}
      emptyHint={isHospital ? 'Outpatient hours, and whether you run a 24/7 emergency department.'
        : 'Your consulting hours for each day.'}>
      <View style={styles.facts}>
        {org.open_24x7 ? <Fact label={isHospital ? 'Outpatient services' : 'Open'} value="24/7" />
          : formatHours(org.opening_hours || []).map(h => <Fact key={h.days} label={h.days} value={h.time} />)}
      </View>
      {org.emergency_24x7 ? (
        <View style={styles.emergency}>
          <Ionicons name="medkit" size={18} color={colors.redText} />
          <View style={styles.flex}>
            <Text style={styles.emergencyTitle}>Emergency services · 24/7</Text>
            {org.emergency_phone ? (
              <Text style={styles.link} onPress={() => Linking.openURL(`tel:${org.emergency_phone}`)}>
                {org.emergency_phone}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {org.ambulance ? <Fact label="Ambulance" value="Available" /> : null}
    </ProfileSection>
  );

  const about = (
    <ProfileSection title="About" testID="org-section-about" singular editable={editable} isEmpty={!org.about}
      onAdd={() => setSheet({ kind: 'basic' })} addLabel="Add about"
      emptyTitle={`Tell professionals about ${isHospital ? 'your hospital' : 'your clinic'}`}
      emptyHint="What you do, who you serve, your mission and history.">
      <Text style={styles.prose}>{org.about}</Text>
    </ProfileSection>
  );

  const team = (
    <ProfileSection title="Our medical team" testID="org-section-team" editable={editable}
      isEmpty={!page.team.length && !isProfessional}
      emptyTitle="Show who works here"
      emptyHint="Professionals who work here can ask to join from your profile; you confirm each one."
      onAdd={() => setTeamOpen(true)} actionIcon="people-outline"
      addLabel={pending.length ? `Review ${pending.length} request${pending.length === 1 ? '' : 's'}` : 'Manage'}>
      {page.team.length ? (
        <View style={styles.team}>
          {page.team.slice(0, 8).map(m => (
            <Pressable key={m.affiliation_id} onPress={() => router.push(`/profile/${m.id}` as any)}
              accessibilityRole="link" style={({ pressed }) => [styles.member, pressed && styles.pressed]}
              testID={`org-member-${m.id}`}>
              <Avatar name={m.name} uri={m.avatar} size={44} />
              <View style={styles.flex}>
                <View style={styles.inline}>
                  <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                  {m.account_verified ? (
                    <TrustMark size={14} classicIcon="checkmark-circle" label="Verified professional" />
                  ) : null}
                </View>
                <Text style={styles.muted} numberOfLines={1}>
                  {[m.title || m.professional_role, m.department || m.specialty].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : <Text style={styles.muted}>No team members listed yet.</Text>}
      {isProfessional && !editable ? (
        <View style={styles.sectionAction}>
          {page.my_affiliation?.status === 'approved' ? (
            <Action label="Leave this team" icon="exit-outline" testID="org-leave"
              onPress={() => act(() => orgApi.removeAffiliation(token!, orgId, page.my_affiliation!.id),
                'You have left the team.', 'Could not leave the team.')} />
          ) : page.my_affiliation?.status === 'requested' ? (
            <Text style={styles.muted}>Your request to join is waiting for {org.name}.</Text>
          ) : (
            <Action label="I work here" icon="person-add-outline" testID="org-join" onPress={() => setJoinOpen(true)} />
          )}
        </View>
      ) : null}
    </ProfileSection>
  );

  const jobs = (
    <ProfileSection title={`Open positions${page.job_total ? ` · ${page.job_total}` : ''}`} testID="org-section-jobs"
      editable={editable} isEmpty={!page.job_total} onAdd={() => router.push('/jobs/new' as any)} addLabel="Post a job"
      emptyTitle="No open positions" emptyHint="Jobs you post appear here for professionals to find.">
      <View style={styles.list}>
        {page.jobs.map(job => <JobCard key={job.id} item={job} onPress={() => router.push(`/jobs/${job.id}` as any)} />)}
      </View>
    </ProfileSection>
  );

  const locums = (
    <ProfileSection title={`Locum opportunities${page.locum_total ? ` · ${page.locum_total}` : ''}`}
      testID="org-section-locums" editable={editable} isEmpty={!page.locum_total}
      onAdd={() => router.push('/jobs/locum/new' as any)} addLabel="Post a locum"
      emptyTitle="No live locum shifts" emptyHint="Locum shifts you post appear here while they are open.">
      <View style={styles.list}>
        {page.locums.map(l => (
          <LocumCard key={l.id} item={l} compact onPress={() => router.push(`/jobs/locum/${l.id}` as any)} />
        ))}
      </View>
    </ProfileSection>
  );

  const photos = (
    <ProfileSection title="Photos" testID="org-section-photos" editable={editable} isEmpty={!org.photos?.length}
      onAdd={(org.photos?.length ?? 0) < 12 ? () => pick('photo') : undefined} addLabel="Add photo"
      emptyTitle="Show your premises" emptyHint="Entrance, reception, wards, consultation rooms, laboratory.">
      <View style={styles.gallery}>
        {(org.photos || []).map(p => (
          <View key={p.id} style={styles.photo}>
            <Pressable onPress={() => setViewing(mediaUri(p.url) || null)} accessibilityRole="imagebutton"
              accessibilityLabel={p.caption || 'Photo'} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: mediaUri(p.url) }} style={styles.photoImg} resizeMode="cover" />
            </Pressable>
            {editable ? (
              <Pressable onPress={() => act(() => orgApi.removeOrgPhoto(token!, orgId, p.id), 'Photo removed.',
                'Could not remove the photo.')} accessibilityRole="button" accessibilityLabel="Remove photo"
                style={styles.photoRemove} hitSlop={6}>
                <Ionicons name="close" size={14} color={colors.white} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </ProfileSection>
  );

  const address = [org.address_line, [org.city, org.state].filter(Boolean).join(', '), org.pincode, org.country]
    .filter(Boolean).join('\n');
  const location = (
    <ProfileSection title="Location" testID="org-section-location" singular editable={editable}
      isEmpty={!org.address_line && !org.city} onAdd={() => setSheet({ kind: 'contact' })} addLabel="Add address"
      emptyTitle="Where are you?" emptyHint="Your address, so professionals can find you.">
      <Text style={styles.prose}>{address}</Text>
      <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${
        encodeURIComponent(`${org.name}, ${address.replace(/\n/g, ', ')}`)}`)} accessibilityRole="link"
        style={[styles.inline, styles.mapLink]}>
        <Ionicons name="map-outline" size={16} color={colors.navy} />
        <Text style={styles.link}>View on map</Text>
      </Pressable>
    </ProfileSection>
  );

  const hasContact = !!(org.public_phone || org.public_email || org.website || org.links?.length);
  const contact = (
    <ProfileSection title="Contact" testID="org-section-contact" singular editable={editable} isEmpty={!hasContact}
      onAdd={() => setSheet({ kind: 'contact' })} addLabel="Add contact details" last
      emptyTitle="How can professionals reach you?" emptyHint="A phone number, email and website.">
      <ContactRows org={org} />
    </ProfileSection>
  );

  const narrative = (
    <>
      {about}
      {isHospital
        ? terms('specialties', 'Departments & specialties', HOSPITAL_DEPARTMENTS, 'Which departments do you run?',
          'Cardiology, Neurology, Orthopaedics…')
        : terms('specialties', 'Specialties', CLINIC_SPECIALTIES, 'What do you specialise in?',
          'General practice, Dermatology, Dental…')}
      {terms('services', 'Services', isHospital ? HOSPITAL_SERVICES : CLINIC_SERVICES, 'What do you offer?',
        isHospital ? 'Emergency care, outpatient, inpatient, diagnostics…' : 'Consultation, diagnostics, vaccination…',
        'navy')}
      {!isHospital ? hours : null}
      {terms('facilities', 'Facilities', isHospital ? HOSPITAL_FACILITIES : CLINIC_FACILITIES, 'What facilities do you have?',
        isHospital ? 'ICU, operation theatres, blood bank…' : 'Consultation rooms, laboratory, pharmacy…', 'neutral')}
      {isHospital ? hours : null}
      {team}
      {jobs}
      {locums}
      {isHospital ? terms('research_focus', 'Research & academics', [], 'Research and academic work',
        'Research focus areas, clinical trials and academic affiliations.', 'navy') : null}
      {isHospital ? terms('academic_programs', 'Training & education',
        ['Residency programmes', 'Fellowship programmes', 'Internships', 'CME programmes', 'Nursing training'],
        'Training programmes', 'Residency, fellowship, internship and CME programmes.', 'navy') : null}
      {photos}
      {location}
      {contact}
    </>
  );

  // ── Rail ─────────────────────────────────────────────────────────────────
  const details = (
    <ProfileSection title={isHospital ? 'Hospital details' : 'Clinic details'} testID="org-details" last>
      <View style={styles.facts}>
        <Fact label="Type" value={typeLabel} />
        {org.founded_year ? <Fact label="Established" value={String(org.founded_year)} /> : null}
        {isHospital && org.bed_count ? <Fact label="Beds" value={org.bed_count.toLocaleString('en-IN')} /> : null}
        {org.ownership ? <Fact label="Ownership" value={ORG_OWNERSHIP_LABELS[org.ownership as keyof typeof ORG_OWNERSHIP_LABELS]} /> : null}
        {org.emergency_24x7 ? <Fact label="Emergency" value="24/7" /> : null}
        {isHospital && org.teaching ? <Fact label="Teaching hospital" value="Yes" /> : null}
        {!isHospital && org.specialties?.length ? <Fact label="Specialties" value={org.specialties.slice(0, 3).join(', ')} /> : null}
        {place ? <Fact label="Location" value={place} /> : null}
      </View>
    </ProfileSection>
  );
  const hiring = (
    <ProfileSection title="Hiring" testID="org-hiring" last>
      <View style={styles.facts}>
        <Fact label="Open positions" value={String(page.job_total)} />
        <Fact label="Locum opportunities" value={String(page.locum_total)} />
      </View>
    </ProfileSection>
  );
  const verification = (
    <ProfileSection title="Verification" testID="org-verification" last editable={editable}
      onAdd={() => openTerms('accreditations', 'Accreditations', ACCREDITATIONS)}
      addLabel={org.accreditations?.length ? 'Edit' : 'Add accreditation'}
      actionIcon={org.accreditations?.length ? 'pencil' : 'add'}>
      {org.verified ? (
        <View style={styles.inline}>
          <TrustMark size={16} classicIcon="shield-checkmark" />
          <Text style={styles.verifiedText}>Verified healthcare organisation</Text>
        </View>
      ) : (
        <Text style={styles.muted}>
          {org.verification_status === 'pending' ? 'Verification is in review.' : 'Not verified yet.'}
        </Text>
      )}
      {org.accreditations?.length ? (
        <View style={[styles.chips, styles.gapTop]}>
          {org.accreditations.map(a => <Chip key={a} label={a} tone="navy" icon="ribbon-outline" />)}
        </View>
      ) : null}
      {editable && !org.verified ? (
        <Pressable onPress={() => router.push('/kyc' as any)} accessibilityRole="link" testID="org-get-verified"
          style={[styles.inline, styles.gapTop]}>
          <Text style={styles.link}>{org.verification_status === 'pending' ? 'View your review' : 'Get verified'}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.navy} />
        </Pressable>
      ) : null}
    </ProfileSection>
  );
  const completion = editable ? (
    <ProfileCompletion completion={completionInfo as unknown as ProfileCompletionInfo}
      onSuggestion={s => onSuggestion(String(s.key))} />
  ) : null;

  const banners = (
    <>
      <ErrorBanner message={actionError} />
      {notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
    </>
  );

  const sheets = (
    <>
      <BasicInfoSheet org={org} open={sheet?.kind === 'basic'} onClose={() => setSheet(null)} onSave={save}
        saving={saving} error={saveError} />
      <ContactSheet org={org} open={sheet?.kind === 'contact'} onClose={() => setSheet(null)} onSave={save}
        saving={saving} error={saveError} />
      <HoursSheet org={org} open={sheet?.kind === 'hours'} onClose={() => setSheet(null)} onSave={save}
        saving={saving} error={saveError} />
      <TermsSheet org={org} sheet={sheet?.kind === 'terms' ? sheet : null} onClose={() => setSheet(null)}
        onSave={save} saving={saving} error={saveError} />
      <JoinTeamSheet open={joinOpen} orgName={org.name} onClose={() => setJoinOpen(false)} saving={saving}
        error={actionError}
        onSubmit={async (title, dept) => {
          setSaving(true);
          await act(key => orgApi.requestAffiliation(token!, orgId, title, dept, key), `Request sent to ${org.name}.`,
            'Could not send your request.');
          setSaving(false); setJoinOpen(false);
        }} />
      <Sheet visible={teamOpen} onClose={() => setTeamOpen(false)} title="Medical team" testID="org-team-sheet">
        <View style={styles.modalBody}>
          <Text style={styles.muted}>
            Confirm the professionals who work here. Only confirmed members appear on your profile. This gives them no
            access to your account, jobs or applicants.
          </Text>
          {requests.length === 0 ? <Text style={styles.muted}>No requests yet.</Text> : requests.map(r => (
            <View key={r.id} style={styles.requestRow} testID={`org-request-${r.id}`}>
              <Avatar name={r.professional?.name} uri={r.professional?.avatar} size={40} />
              <View style={styles.flex}>
                <Text style={styles.memberName}>{r.professional?.name ?? 'Professional'}</Text>
                <Text style={styles.muted}>{[r.title, r.department].filter(Boolean).join(' · ') || '—'}</Text>
              </View>
              {r.status === 'requested' ? (
                <>
                  <Button label="Decline" variant="outline"
                    onPress={() => act(() => orgApi.decideAffiliation(token!, orgId, r.id, 'decline'), 'Declined.',
                      'Could not decline.')} />
                  <Button label="Confirm" variant="secondary" testID={`org-approve-${r.id}`}
                    onPress={() => act(() => orgApi.decideAffiliation(token!, orgId, r.id, 'approve'),
                      'Added to your medical team.', 'Could not confirm.')} />
                </>
              ) : (
                <Button label="Remove" variant="outline"
                  onPress={() => act(() => orgApi.removeAffiliation(token!, orgId, r.id), 'Removed from the team.',
                    'Could not remove.')} />
              )}
            </View>
          ))}
        </View>
      </Sheet>
      <Sheet visible={contactOpen} onClose={() => setContactOpen(false)} title={`Contact ${org.name}`}
        testID="org-contact-sheet-view">
        <View style={styles.modalBody}>
          <ContactRows org={org} />
          {!hasContact ? <Text style={styles.muted}>{org.name} has not added public contact details yet.</Text> : null}
        </View>
      </Sheet>
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)} accessibilityRole="button"
          accessibilityLabel="Close photo">
          {viewing ? <Image source={{ uri: viewing }} style={styles.viewerImg} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </>
  );

  // Same frame as ProfileView: a white sheet on the grey canvas with the rail
  // beside it on desktop; on tablet the rail modules stack under the sheet;
  // on a phone, one full-bleed column.
  if (!isMobile) {
    return (
      <View style={styles.root}>
        <PageGrid fluid testID="org-profile-grid" right={isDesktop ? (
          <>
            {completion}
            <RailGroup>{details}</RailGroup>
            <RailGroup>{hiring}</RailGroup>
            <RailGroup>{verification}</RailGroup>
          </>
        ) : undefined}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sheet}>
              {header}
              <View style={styles.sheetBody}>{banners}{narrative}</View>
            </View>
            {!isDesktop ? (
              <>
                {completion ? <View style={styles.tabletBlock}>{completion}</View> : null}
                <View style={styles.sheet}>
                  <View style={styles.sheetBody}>{details}{hiring}{verification}</View>
                </View>
              </>
            ) : null}
          </ScrollView>
        </PageGrid>
        {sheets}
      </View>
    );
  }
  return (
    <View style={styles.rootMobile}>
      <ScrollView contentContainerStyle={styles.scrollMobile} showsVerticalScrollIndicator={false}>
        {header}
        <View style={styles.bodyMobile}>
          {banners}
          {completion ? <View style={styles.gapTop}>{completion}</View> : null}
          {narrative}
          <View style={styles.rule} />
          {details}
          {hiring}
          {verification}
        </View>
      </ScrollView>
      {sheets}
    </View>
  );
}

type TermsField = 'specialties' | 'services' | 'facilities' | 'accreditations' | 'research_focus' | 'academic_programs';

// ── Pieces (styled as their ProfileHeader / ProfessionalIdentity twins) ─────

function CoverButton({ icon, label, onPress, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed }) => [styles.coverBtn, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={colors.navy} />
    </Pressable>
  );
}

function Action({ label, icon, onPress, primary, testID }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; primary?: boolean; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed }) => [styles.action, primary ? styles.actionPrimary : styles.actionSecondary,
        pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={primary ? colors.white : colors.navy} />
      <Text style={[styles.actionText, primary ? styles.actionTextPrimary : styles.actionTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function RailGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.railGroup}>{children}</View>;
}

function OrgLogo({ org, size }: { org: Organization; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = mediaUri(org.logo);
  const box = { width: size, height: size, borderRadius: radius.lg };
  return (
    <View style={[styles.logo, box]}>
      {src && !failed ? (
        <Image source={{ uri: src }} style={box} resizeMode="cover" onError={() => setFailed(true)}
          accessibilityLabel={`${org.name} logo`} />
      ) : (
        <Ionicons name={org.org_type === 'hospital' ? 'business' : 'medkit'} size={size * 0.42} color={colors.white} />
      )}
    </View>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function ContactRows({ org }: { org: Organization }) {
  const rows: { icon: keyof typeof Ionicons.glyphMap; text: string; href: string }[] = [];
  if (org.public_phone) rows.push({ icon: 'call-outline', text: org.public_phone, href: `tel:${org.public_phone}` });
  if (org.public_email) rows.push({ icon: 'mail-outline', text: org.public_email, href: `mailto:${org.public_email}` });
  if (org.website) rows.push({ icon: 'globe-outline', text: org.website.replace(/^https?:\/\//, ''), href: org.website });
  for (const l of org.links || []) rows.push({ icon: 'link-outline', text: l.label, href: l.url });
  return (
    <>
      {rows.map(r => (
        <Pressable key={r.href} onPress={() => Linking.openURL(r.href).catch(() => {})} accessibilityRole="link"
          accessibilityLabel={r.text} style={styles.contactRow}>
          <Ionicons name={r.icon} size={18} color={colors.textSecondary} />
          <Text style={styles.link} numberOfLines={1}>{r.text}</Text>
        </Pressable>
      ))}
    </>
  );
}

function fmt(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Consecutive days with the same hours collapse: "Mon–Sat 9:00 AM – 7:00 PM". */
export function formatHours(hours: OrgOpeningHours[]): { days: string; time: string }[] {
  const sorted = [...hours].sort((a, b) => a.day - b.day);
  const out: { from: number; to: number; open: string; close: string }[] = [];
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && last.to === h.day - 1 && last.open === h.open && last.close === h.close) last.to = h.day;
    else out.push({ from: h.day, to: h.day, open: h.open, close: h.close });
  }
  const short = (d: number) => WEEKDAYS[d].slice(0, 3);
  return out.map(g => ({
    days: g.from === g.to ? WEEKDAYS[g.from] : `${short(g.from)}–${short(g.to)}`,
    time: `${fmt(g.open)} – ${fmt(g.close)}`,
  }));
}

/** Kept equal to ProfileHeader's AVATAR_OVERLAP. */
const LOGO_OVERLAP = 48;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  // Frame -- identical to ProfileView.
  root: { flex: 1, backgroundColor: colors.bg },
  rootMobile: { flex: 1, backgroundColor: colors.white },
  sheetScrollContent: { paddingVertical: spacing.xxl, gap: spacing.xl, paddingBottom: 64, alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: 760, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  sheetBody: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.sm },
  tabletBlock: { width: '100%', maxWidth: 760 },
  scrollMobile: { paddingBottom: 120 },
  bodyMobile: { paddingHorizontal: spacing.lg },
  railGroup: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xs,
  },
  rule: { height: 1, backgroundColor: colors.borderLight, marginTop: spacing.xxl },
  gapTop: { marginTop: spacing.md },

  // Header -- identical to ProfileHeader.
  cover: { backgroundColor: colors.navy, width: '100%', overflow: 'hidden' },
  coverMobile: { height: 140 },
  coverWide: { height: 168 },
  coverActions: { position: 'absolute', top: spacing.md, right: spacing.md, flexDirection: 'row', gap: spacing.sm },
  coverBtn: {
    width: MIN_TOUCH_TARGET - 4, height: MIN_TOUCH_TARGET - 4, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  logoRow: { marginTop: -LOGO_OVERLAP },
  padMobile: { paddingHorizontal: spacing.lg },
  padWide: { paddingHorizontal: spacing.xxl },
  logoWrap: { alignSelf: 'flex-start' },
  logoRing: { borderWidth: 4, borderColor: colors.white, backgroundColor: colors.white, borderRadius: radius.lg + 4 },
  // The logo IS the identity mark: square-cornered, where a person's is round.
  logo: { backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  verifiedTick: {
    position: 'absolute', right: -4, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.teal, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  logoEdit: {
    position: 'absolute', left: -4, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryFill,
    borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },

  // Identity -- identical to ProfessionalIdentity.
  identity: { paddingTop: spacing.md, gap: 2 },
  name: { ...typography.h1, color: colors.text },
  nameMobile: { fontSize: 24 },
  headline: { ...typography.body, fontFamily: fonts.body.medium, color: colors.text, lineHeight: 21, marginTop: spacing.xs },
  headlinePlaceholder: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, textDecorationLine: 'underline' },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  metaMuted: { ...typography.caption, color: colors.textMuted },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1, marginTop: spacing.md },
  verifiedText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.teal },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  action: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2,
    minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1,
  },
  actionPrimary: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  actionSecondary: { backgroundColor: colors.white, borderColor: colors.border },
  actionText: { ...typography.caption, fontFamily: fonts.body.semibold },
  actionTextPrimary: { color: colors.white },
  actionTextSecondary: { color: colors.navy },

  // Section content.
  prose: { ...typography.body, color: colors.textSecondary, lineHeight: 23 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  list: { gap: spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, flexWrap: 'wrap' },
  muted: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  link: { ...typography.caption, color: colors.navy, fontFamily: fonts.body.semibold },
  mapLink: { marginTop: spacing.sm },
  sectionAction: { marginTop: spacing.md, alignItems: 'flex-start' },
  facts: { gap: 2 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 5 },
  factLabel: { ...typography.caption, color: colors.textSecondary },
  factValue: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.text, textAlign: 'right', flexShrink: 1 },

  team: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  member: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexBasis: 260, flexGrow: 1,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg,
  },
  memberName: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },

  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 150, height: 110, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bgMuted },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: 'rgba(8,12,20,0.9)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '92%', height: '80%' },

  emergency: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.redBg,
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  emergencyTitle: { ...typography.bodyStrong, color: colors.redText },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_TARGET - 8 },

  modalBody: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.tealBg,
    borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg,
  },
  noticeText: { ...typography.label, color: colors.teal, flex: 1 },
});
