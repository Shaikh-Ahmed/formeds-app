import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, fonts, useBreakpoint, MIN_TOUCH_TARGET } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { LoadingState, ErrorState } from '../States';
import { PageGrid } from '../web';
import {
  EntryKind, Profile, ProfileEntry, SectionKey, Visibility,
  VISIBILITY_LABELS, Skills, ProfessionalLinks,
} from '../../types/profile';
import * as profileApi from '../../api/profile';
import { openBlob } from '../../utils/download';
import { ProfileHeader } from './ProfileHeader';
import { ProfessionalIdentity } from './ProfessionalIdentity';
import { AboutSection } from './AboutSection';
import { ExperienceSection, EducationSection, credentialsFrom } from './CareerSections';
import { RegistrationSection } from './RegistrationSection';
import { EntryListSection, rowBuilders } from './EntryListSection';
import { SpecializationSection, SkillsSection, InterestsSection } from './TaxonomySections';
import { AvailabilitySection, MentorshipSection, ProfessionalLinksSection } from './EngagementSections';
import { ProfileCompletion } from './ProfileCompletion';
import { EntrySheet } from './EntrySheet';
import { SCALAR_FORMS, ScalarFormKey } from './entryForms';

interface Props {
  /** Omit for the signed-in user's own profile. */
  userId?: string;
}

type EntrySheetState = { kind: EntryKind; entry?: ProfileEntry } | null;
type ScalarSheetState = ScalarFormKey | null;

const VISIBILITY_OPTIONS: Visibility[] = [
  'everyone', 'verified_professionals', 'employers', 'only_me',
];

export function ProfileView({ userId }: Props) {
  const { token, user, refreshUser } = useAuth();
  const { isMobile, isDesktop } = useBreakpoint();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [entrySheet, setEntrySheet] = useState<EntrySheetState>(null);
  const [scalarSheet, setScalarSheet] = useState<ScalarSheetState>(null);
  const [privacyFor, setPrivacyFor] = useState<SectionKey | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);

  const editable = !!profile?.is_self;

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const data = userId
        ? await profileApi.fetchProfile(token, userId)
        : await profileApi.fetchMyProfile(token);
      setProfile(data);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => { load(); }, [load]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveEntry = async (data: Record<string, any>) => {
    if (!token || !entrySheet) return;
    setSaving(true);
    setSheetError(null);
    try {
      if (entrySheet.entry) {
        await profileApi.updateEntry(token, entrySheet.entry.id, { data });
      } else {
        await profileApi.createEntry(token, entrySheet.kind, data);
      }
      setEntrySheet(null);
      await load();
    } catch (e: any) {
      setSheetError(e?.message || 'Could not save. Please check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const downloadResume = async () => {
    if (!token || resumeBusy) return;
    setResumeBusy(true);
    try {
      const blob = await profileApi.fetchMyResume(token);
      const filename = `${(profile?.name || 'resume').trim().replace(/\s+/g, '-')}-resume.pdf`;
      await openBlob(blob, filename);
    } catch (e: any) {
      setComingSoon(e?.message || 'Could not download your resume. Please try again.');
    } finally {
      setResumeBusy(false);
    }
  };

  const removeEntry = async () => {
    if (!token || !entrySheet?.entry) return;
    setSaving(true);
    try {
      await profileApi.deleteEntry(token, entrySheet.entry.id);
      setEntrySheet(null);
      await load();
    } catch (e: any) {
      setSheetError(e?.message || 'Could not delete this entry.');
    } finally {
      setSaving(false);
    }
  };

  const saveScalar = async (values: Record<string, any>) => {
    if (!token || !scalarSheet) return;
    setSaving(true);
    setSheetError(null);
    try {
      await profileApi.patchProfile(token, toPatch(scalarSheet, values));
      setScalarSheet(null);
      await load();
      // The drawer, top bar and every author byline read from AuthContext.
      if (!userId) await refreshUser();
    } catch (e: any) {
      setSheetError(e?.message || 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const changeVisibility = async (level: Visibility) => {
    if (!token || !privacyFor) return;
    const section = privacyFor;
    setPrivacyFor(null);
    try {
      if (isEntryKind(section)) {
        await profileApi.setSectionVisibility(token, section, level);
      } else {
        await profileApi.patchProfile(token, {
          section_visibility: { ...(profile?.section_visibility || {}), [section]: level },
        });
      }
      await load();
    } catch {
      setLoadError('Could not update visibility.');
    }
  };

  const pickImage = async (target: 'avatar' | 'cover') => {
    if (!token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLoadError('Photo access is needed to change your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Square for the avatar; a wide crop for the cover band.
      aspect: target === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    try {
      if (target === 'avatar') await profileApi.uploadAvatar(token, result.assets[0].uri);
      else await profileApi.uploadCover(token, result.assets[0].uri);
      await load();
      if (target === 'avatar') await refreshUser();
    } catch (e: any) {
      setLoadError(e?.message || 'Could not upload that image.');
    }
  };

  const share = async () => {
    if (!profile) return;
    const url = `https://formeds.in/profile/${profile.id}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(url);
        setComingSoon('Profile link copied to your clipboard.');
        return;
      }
      await Share.share({ message: `${profile.name} on ForMeds — ${url}`, url });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingState label="Loading profile…" />;
  if (loadError && !profile) return <ErrorState message={loadError} onRetry={load} />;
  if (!profile) return <ErrorState message="Profile not found." onRetry={load} />;

  const entries = profile.entries || {};
  const at = (kind: EntryKind) => entries[kind] || [];
  const vis = (section: SectionKey) => profile.section_visibility?.[section];
  const openPrivacy = editable ? (section: SectionKey) => () => setPrivacyFor(section) : undefined;

  // A group is hideable only for a visitor; the owner still needs its
  // empty states as prompts.
  const noCredentials = at('registration').length === 0 && at('certification').length === 0;
  const noExpertise =
    !profile.primary_specialization && !profile.specialty &&
    !(profile.areas_of_expertise || []).length &&
    !Object.values(profile.skills || {}).some((v) => (v || []).length) &&
    !(profile.professional_interests || []).length;
  const noEngagement =
    !(profile.availability?.open_to || []).length && !profile.availability?.note &&
    !profile.mentorship?.available_as_mentor && !profile.mentorship?.looking_for_mentor &&
    !(profile.mentorship?.topics || []).length &&
    !Object.values(profile.professional_links || {}).some(Boolean);

  const header = (
    <>
      <ProfileHeader
        profile={profile}
        editable={editable}
        isMobile={isMobile}
        onEditCover={() => pickImage('cover')}
        onEditAvatar={() => pickImage('avatar')}
        onOverflow={() => setOverflowOpen(true)}
      />
      <ProfessionalIdentity
        profile={profile}
        credentials={credentialsFrom(at('education'))}
        editable={editable}
        isMobile={isMobile}
        onEdit={() => setScalarSheet('identity')}
        onShare={share}
      />
    </>
  );

  const completion = editable ? (
    <ProfileCompletion
      completion={profile.completion}
      onSuggestion={(s) => onSuggestion(s.key, setScalarSheet, setEntrySheet, pickImage)}
    />
  ) : null;

  // The narrative half of the CV — read top to bottom.
  const narrative = (
    <>
      <AboutSection
        about={profile.about}
        editable={editable}
        visibility={vis('about')}
        onEdit={() => setScalarSheet('about')}
        onChangeVisibility={openPrivacy?.('about')}
      />
      <ExperienceSection
        entries={at('experience')}
        editable={editable}
        visibility={vis('experience')}
        onAdd={() => setEntrySheet({ kind: 'experience' })}
        onEdit={(id) => setEntrySheet({ kind: 'experience', entry: findEntry(at('experience'), id) })}
        onChangeVisibility={openPrivacy?.('experience')}
      />
      <EducationSection
        entries={at('education')}
        editable={editable}
        visibility={vis('education')}
        onAdd={() => setEntrySheet({ kind: 'education' })}
        onEdit={(id) => setEntrySheet({ kind: 'education', entry: findEntry(at('education'), id) })}
        onChangeVisibility={openPrivacy?.('education')}
      />
      <EntryListSection
        title="Publications & research"
        rows={at('publication').map(rowBuilders.publication)}
        numbered
        editable={editable}
        emptyTitle="Add your publications"
        emptyHint="Papers, journal articles and clinical studies. Optional, but it is what turns a profile into an academic one."
        addLabel="Add publication"
        visibility={vis('publication')}
        onAdd={() => setEntrySheet({ kind: 'publication' })}
        onEdit={(id) => setEntrySheet({ kind: 'publication', entry: findEntry(at('publication'), id) })}
        onChangeVisibility={openPrivacy?.('publication')}
        testID="section-publications"
      />
      <EntryListSection
        title="Awards & achievements"
        rows={at('award').map(rowBuilders.award)}
        editable={editable}
        emptyTitle="Recognise your achievements"
        emptyHint="Awards, honours and distinctions from your training or practice."
        addLabel="Add award"
        visibility={vis('award')}
        onAdd={() => setEntrySheet({ kind: 'award' })}
        onEdit={(id) => setEntrySheet({ kind: 'award', entry: findEntry(at('award'), id) })}
        onChangeVisibility={openPrivacy?.('award')}
        testID="section-awards"
      />
      <EntryListSection
        title="Conferences & CME"
        rows={at('conference').map(rowBuilders.conference)}
        editable={editable}
        emptyTitle="Track your continuing education"
        emptyHint="Conferences attended or presented at, and CME courses with their credits."
        addLabel="Add conference"
        visibility={vis('conference')}
        onAdd={() => setEntrySheet({ kind: 'conference' })}
        onEdit={(id) => setEntrySheet({ kind: 'conference', entry: findEntry(at('conference'), id) })}
        onChangeVisibility={openPrivacy?.('conference')}
        testID="section-conferences"
        last
      />
    </>
  );

  // Credentials — what a hospital or recruiter verifies.
  const credentials = (
    <>
      <RegistrationSection
        entries={at('registration')}
        editable={editable}
        visibility={vis('registration')}
        onAdd={() => setEntrySheet({ kind: 'registration' })}
        onEdit={(id) => setEntrySheet({ kind: 'registration', entry: findEntry(at('registration'), id) })}
        onChangeVisibility={openPrivacy?.('registration')}
      />
      <EntryListSection
        title="Certifications"
        rows={at('certification').map(rowBuilders.certification)}
        editable={editable}
        emptyTitle="Add your certifications"
        emptyHint="ACLS, BLS, PALS and other credentials, with their issuing body and expiry."
        addLabel="Add"
        visibility={vis('certification')}
        onAdd={() => setEntrySheet({ kind: 'certification' })}
        onEdit={(id) => setEntrySheet({ kind: 'certification', entry: findEntry(at('certification'), id) })}
        onChangeVisibility={openPrivacy?.('certification')}
        testID="section-certifications"
        last
      />
    </>
  );

  // Expertise — the scannable label sets.
  const expertise = (
    <>
      <SpecializationSection
        primary={profile.primary_specialization || profile.specialty}
        expertise={profile.areas_of_expertise}
        editable={editable}
        visibility={vis('expertise')}
        onEdit={() => setScalarSheet('specializations')}
        onChangeVisibility={openPrivacy?.('expertise')}
      />
      <SkillsSection
        skills={profile.skills}
        editable={editable}
        visibility={vis('skills')}
        onEdit={() => setScalarSheet('skills')}
        onChangeVisibility={openPrivacy?.('skills')}
      />
      <InterestsSection
        interests={profile.professional_interests}
        editable={editable}
        visibility={vis('interests')}
        onEdit={() => setScalarSheet('interests')}
        onChangeVisibility={openPrivacy?.('interests')}
        last
      />
    </>
  );

  // How to work with this person.
  const engagement = (
    <>
      <AvailabilitySection
        availability={profile.availability}
        editable={editable}
        visibility={vis('availability')}
        onEdit={() => setScalarSheet('availability')}
        onChangeVisibility={openPrivacy?.('availability')}
      />
      <MentorshipSection
        mentorship={profile.mentorship}
        editable={editable}
        visibility={vis('mentorship')}
        onEdit={() => setScalarSheet('mentorship')}
        onChangeVisibility={openPrivacy?.('mentorship')}
      />
      <ProfessionalLinksSection
        links={profile.professional_links}
        editable={editable}
        visibility={vis('links')}
        onEdit={() => setScalarSheet('links')}
        onChangeVisibility={openPrivacy?.('links')}
        last
      />
    </>
  );

  // One instance set, shared by both layout branches.
  const sheets = (
    <>
      <EntrySheet
        visible={!!entrySheet}
        kind={entrySheet?.kind ?? null}
        initial={entrySheet?.entry?.data as Record<string, any> | undefined}
        saving={saving}
        error={sheetError}
        onSave={saveEntry}
        onDelete={entrySheet?.entry ? removeEntry : undefined}
        onClose={() => { setEntrySheet(null); setSheetError(null); }}
      />

      <EntrySheet
        visible={!!scalarSheet}
        kind={null}
        form={scalarSheet ? SCALAR_FORMS[scalarSheet] : undefined}
        initial={scalarSheet ? fromProfile(scalarSheet, profile!) : undefined}
        saving={saving}
        error={sheetError}
        onSave={saveScalar}
        onClose={() => { setScalarSheet(null); setSheetError(null); }}
      />

      <ActionSheet
        visible={!!privacyFor}
        title="Who can see this?"
        onClose={() => setPrivacyFor(null)}
        options={VISIBILITY_OPTIONS.map((level) => ({
          label: VISIBILITY_LABELS[level],
          selected: privacyFor ? (vis(privacyFor) ?? 'everyone') === level : false,
          onPress: () => changeVisibility(level),
        }))}
      />

      <ActionSheet
        visible={overflowOpen}
        title="Profile"
        onClose={() => setOverflowOpen(false)}
        options={[
          { label: 'Share profile', icon: 'share-outline', onPress: () => { setOverflowOpen(false); share(); } },
          // Only ever your own — this calls the self endpoint, which has no
          // notion of "whoever's profile is currently on screen". Someone
          // else's resume is reachable only through their job application,
          // by whoever they applied to.
          ...(editable
            ? [{
                label: resumeBusy ? 'Preparing resume…' : 'Download resume',
                icon: 'download-outline' as const,
                onPress: () => { setOverflowOpen(false); downloadResume(); },
              }]
            : []),
          // Restores the entry point this screen lost when its Account/Admin
          // menu moved to the drawer: the drawer is unreachable above 768px,
          // so an admin had no route to the review queue on desktop.
          ...(user?.is_admin
            ? [{
                label: 'KYC review queue',
                icon: 'shield-checkmark-outline' as const,
                onPress: () => { setOverflowOpen(false); router.push('/admin/kyc' as any); },
              }]
            : []),
          ...(editable
            ? [{
                label: 'Privacy settings',
                icon: 'lock-closed-outline' as const,
                onPress: () => { setOverflowOpen(false); router.push('/settings'); },
              }]
            : []),
        ]}
      />

      <ActionSheet
        visible={!!comingSoon}
        title="ForMeds"
        message={comingSoon || undefined}
        onClose={() => setComingSoon(null)}
        options={[{ label: 'Got it', onPress: () => setComingSoon(null) }]}
      />
    </>
  );

  /**
   * Desktop: the profile is a white sheet on the grey canvas, with a rail of
   * grouped modules beside it.
   *
   * Structure matters more than styling here. `app/+html.tsx` pins the document
   * body, so on web there is no page scroll — `PageGrid` has to be the flex
   * root and each column scrolls itself. Wrapping it in an outer ScrollView (as
   * this file previously did) gives `flex: 1` an unbounded height to resolve
   * against, and the rails collapse.
   *
   * The header lives INSIDE the centre column rather than spanning the viewport:
   * a full-bleed cover on a 2560px monitor above 1128px of content leaves the
   * avatar stranded at the far edge, unattached to the profile it belongs to.
   */
  if (!isMobile) {
    return (
      <View style={styles.root}>
        <PageGrid
          right={isDesktop ? (
            <>
              {completion}
              <RailGroup empty={!editable && noCredentials}>{credentials}</RailGroup>
              <RailGroup empty={!editable && noExpertise}>{expertise}</RailGroup>
              <RailGroup empty={!editable && noEngagement}>{engagement}</RailGroup>
            </>
          ) : undefined}
          fluid
          testID="profile-grid"
        >
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
            testID="profile-scroll"
          >
            <View style={styles.sheet}>
              {header}
              <View style={styles.sheetBody}>{narrative}</View>
            </View>

            {/* Tablet keeps every section, stacked under the sheet — PageGrid
                withholds the right rail below 1128px, so anything that lived
                only there would silently vanish. */}
            {!isDesktop ? (
              <>
                {completion ? <View style={styles.tabletCompletion}>{completion}</View> : null}
                <View style={styles.sheet}>
                  <View style={styles.sheetBody}>
                    {credentials}
                    {expertise}
                    {engagement}
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>
        </PageGrid>
        {sheets}
      </View>
    );
  }

  // Mobile is unchanged: one column, one scroll, full-bleed.
  return (
    <View style={styles.rootMobile}>
      <ScrollView
        contentContainerStyle={styles.scrollMobile}
        showsVerticalScrollIndicator={false}
        testID="profile-scroll"
      >
        {header}
        <View style={styles.columnMobile}>
          {completion ? <View style={styles.completionSlotMobile}>{completion}</View> : null}
          {narrative}
          {credentials}
          {expertise}
          {engagement}
        </View>
      </ScrollView>
      {sheets}
    </View>
  );
}

/**
 * A rail module — related sections sharing one card.
 *
 * `empty` has to be passed in rather than inferred: the children are elements
 * that decide to render null at render time, so there is no way to count them
 * from here. Without it a visitor sees a bare bordered rectangle where the
 * group's sections would have been.
 */
function RailGroup({ empty, children }: { empty?: boolean; children: React.ReactNode }) {
  if (empty) return null;
  return <View style={styles.railGroup}>{children}</View>;
}

function findEntry(entries: ProfileEntry[], id: string) {
  return entries.find((e) => e.id === id);
}

function isEntryKind(section: SectionKey): section is EntryKind {
  return ['experience', 'education', 'certification', 'award', 'publication', 'conference', 'registration']
    .includes(section);
}

/** Completion suggestion → the sheet that resolves it. */
function onSuggestion(
  key: string,
  openScalar: (k: ScalarFormKey) => void,
  openEntry: (s: EntrySheetState) => void,
  pick: (t: 'avatar' | 'cover') => void,
) {
  if (key === 'avatar') return pick('avatar');
  if (key === 'headline') return openScalar('identity');
  if (key === 'about') return openScalar('about');
  if (key === 'expertise') return openScalar('specializations');
  if (key === 'skills') return openScalar('skills');
  if (isEntryKind(key as SectionKey)) return openEntry({ kind: key as EntryKind });
}

/** Sheet values → the PATCH body shape. */
function toPatch(key: ScalarFormKey, v: Record<string, any>): Record<string, any> {
  switch (key) {
    case 'skills':
      return {
        skills: {
          clinical: v.clinical || [],
          technical: v.technical || [],
          professional: v.professional || [],
          research: v.research || [],
        } as Skills,
      };
    case 'availability':
      return { availability: { open_to: v.open_to || [], note: v.note || '' } };
    case 'mentorship':
      return {
        mentorship: {
          available_as_mentor: !!v.available_as_mentor,
          looking_for_mentor: !!v.looking_for_mentor,
          topics: v.topics || [],
        },
      };
    case 'links':
      return { professional_links: v as ProfessionalLinks };
    default:
      return v;
  }
}

/** The inverse of `toPatch`, so a sheet opens pre-filled. */
function fromProfile(key: ScalarFormKey, p: Profile): Record<string, any> {
  switch (key) {
    case 'identity':
      return {
        name: p.name, headline: p.headline, current_organization: p.current_organization,
        city: p.city, state: p.state, preferred_location: p.preferred_location,
        years_experience: p.years_experience,
      };
    case 'about':
      return { about: p.about };
    case 'specializations':
      return {
        primary_specialization: p.primary_specialization,
        areas_of_expertise: p.areas_of_expertise,
      };
    case 'skills':
      return { ...(p.skills || {}) };
    case 'interests':
      return { professional_interests: p.professional_interests };
    case 'availability':
      return { ...(p.availability || {}) };
    case 'mentorship':
      return { ...(p.mentorship || {}) };
    case 'links':
      return { ...(p.professional_links || {}) };
    default:
      return {};
  }
}

/** A minimal bottom action list — privacy picker, overflow menu, notices. */
export function ActionSheet({
  visible, title, message, options, onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  options: {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    badge?: string;
    selected?: boolean;
    onPress: () => void;
  }[];
  onClose: () => void;
}) {
  const { isMobile } = useBreakpoint();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose} accessibilityViewIsModal>
      <View style={[sheetStyles.scrim, !isMobile && sheetStyles.scrimCentred]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[sheetStyles.shell, isMobile ? sheetStyles.shellMobile : sheetStyles.shellWide]}>
          <Text style={sheetStyles.title} accessibilityRole="header">{title}</Text>
          {message ? <Text style={sheetStyles.message}>{message}</Text> : null}
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              onPress={opt.onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: opt.selected }}
              accessibilityLabel={opt.label}
              style={({ pressed }) => [sheetStyles.row, pressed && sheetStyles.pressed]}
            >
              {opt.icon ? <Ionicons name={opt.icon} size={18} color={colors.textSecondary} /> : null}
              <Text style={sheetStyles.rowText}>{opt.label}</Text>
              {opt.badge ? (
                <View style={sheetStyles.badge}><Text style={sheetStyles.badgeText}>{opt.badge}</Text></View>
              ) : null}
              {opt.selected ? <Ionicons name="checkmark" size={18} color={colors.teal} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rootMobile: { flex: 1, backgroundColor: colors.white },
  scrollMobile: { paddingBottom: 120 },
  columnMobile: { paddingHorizontal: spacing.lg },
  completionSlotMobile: { paddingTop: spacing.xxl },

  // Desktop / tablet.
  root: { flex: 1, backgroundColor: colors.bg },
  sheetScroll: { flex: 1 },
  sheetScrollContent: {
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
    paddingBottom: 64,
    // Centres the sheet in whatever the column gives us — with the right
    // rail at desktop, and across the full width at tablet.
    alignItems: 'center',
  },
  /** The CV itself: a white page on the grey canvas. */
  sheet: {
    width: '100%',
    maxWidth: 760,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    // Clips the cover into the sheet's top corners.
    overflow: 'hidden',
  },
  sheetBody: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.sm },
  tabletCompletion: { marginBottom: 0 },

  railGroup: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    // The final section in each group carries `last`, which already pays the
    // bottom padding; adding a full step here doubles it.
    paddingBottom: spacing.xs,
  },
});

const sheetStyles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,12,20,0.5)', justifyContent: 'flex-end' },
  scrimCentred: { justifyContent: 'center', alignItems: 'center' },
  shell: { backgroundColor: colors.white, padding: spacing.xl, gap: spacing.xs },
  shellMobile: { borderTopLeftRadius: radius.xl + 6, borderTopRightRadius: radius.xl + 6 },
  shellWide: { width: '100%', maxWidth: 420, borderRadius: radius.xl },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  message: { ...typography.caption, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET, paddingVertical: spacing.sm,
  },
  rowText: { ...typography.body, color: colors.text, flex: 1 },
  badge: {
    backgroundColor: colors.warningBg, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  badgeText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.warning },
  pressed: { opacity: 0.6 },
});

export { findEntry, isEntryKind, onSuggestion, toPatch, fromProfile, VISIBILITY_OPTIONS };
