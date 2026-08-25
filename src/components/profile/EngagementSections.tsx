import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, fonts } from '../../theme';
import { Chip } from '../Chip';
import { ProfileSection } from './ProfileSection';
import {
  Availability,
  LINK_META,
  LinkKey,
  Mentorship,
  OPEN_TO_LABELS,
  ProfessionalLinks,
  Visibility,
} from '../../types/profile';

interface Base {
  editable?: boolean;
  visibility?: Visibility;
  onEdit?: () => void;
  onChangeVisibility?: () => void;
  last?: boolean;
}

/** A status line with a state dot — used by availability and mentorship. */
function StatusRow({ active, label, hint }: { active: boolean; label: string; hint?: string }) {
  return (
    <View style={styles.statusRow} accessible accessibilityLabel={`${label}: ${active ? 'yes' : 'no'}`}>
      <View style={[styles.dot, active ? styles.dotOn : styles.dotOff]} />
      <View style={styles.statusCol}>
        <Text style={[styles.statusLabel, !active && styles.statusLabelOff]}>{label}</Text>
        {hint ? <Text style={styles.statusHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export function AvailabilitySection({
  availability, editable, visibility, onEdit, onChangeVisibility, last,
}: Base & { availability?: Availability }) {
  const openTo = availability?.open_to || [];
  return (
    <ProfileSection
      title="Availability"
      isEmpty={openTo.length === 0 && !availability?.note}
      emptyTitle="Tell employers what you're open to"
      emptyHint="Locum shifts, telemedicine, consulting or teaching. Visible to hospitals and clinics by default, not to your colleagues."
      addLabel="Set availability"
      singular
      onAdd={onEdit}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-availability"
    >
      <View style={styles.stack}>
        <View style={styles.chips}>
          {openTo.map((option) => (
            <Chip key={option} label={OPEN_TO_LABELS[option]} tone="teal" icon="checkmark" />
          ))}
        </View>
        {availability?.note ? <Text style={styles.note}>{availability.note}</Text> : null}
      </View>
    </ProfileSection>
  );
}

export function MentorshipSection({
  mentorship, editable, visibility, onEdit, onChangeVisibility, last,
}: Base & { mentorship?: Mentorship }) {
  const isMentor = !!mentorship?.available_as_mentor;
  const wantsMentor = !!mentorship?.looking_for_mentor;
  const topics = mentorship?.topics || [];

  return (
    <ProfileSection
      title="Mentorship"
      isEmpty={!isMentor && !wantsMentor && topics.length === 0}
      emptyTitle="Offer or seek mentorship"
      emptyHint="Career guidance, residency and specialty selection, research or clinical practice."
      addLabel="Set mentorship"
      singular
      onAdd={onEdit}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-mentorship"
    >
      <View style={styles.stack}>
        {isMentor ? <StatusRow active label="Available as a mentor" /> : null}
        {wantsMentor ? <StatusRow active label="Looking for a mentor" /> : null}
        {topics.length ? (
          <View style={styles.chips}>
            {topics.map((topic) => (
              <Chip key={topic} label={topic} tone="neutral" />
            ))}
          </View>
        ) : null}
      </View>
    </ProfileSection>
  );
}

/**
 * Professional links.
 *
 * Deliberately recessive — small outline pills, no brand colours, placed last.
 * The brief is explicit that this section must not become visually dominant,
 * and a row of coloured social buttons is exactly the social-media styling the
 * profile is meant to avoid.
 */
export function ProfessionalLinksSection({
  links, editable, visibility, onEdit, onChangeVisibility, last,
}: Base & { links?: ProfessionalLinks }) {
  const entries = (Object.keys(LINK_META) as LinkKey[])
    .map((key) => ({ key, url: links?.[key] }))
    .filter((l) => !!l.url);

  return (
    <ProfileSection
      title="Professional links"
      isEmpty={entries.length === 0}
      emptyTitle="Link your professional profiles"
      emptyHint="LinkedIn, ORCID, ResearchGate or Google Scholar."
      addLabel="Add links"
      singular
      onAdd={onEdit}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-links"
    >
      <View style={styles.chips}>
        {entries.map(({ key, url }) => (
          <Pressable
            key={key}
            onPress={() => Linking.openURL(url!)}
            accessibilityRole="link"
            accessibilityLabel={`Open ${LINK_META[key].label} profile`}
            style={({ pressed }) => [styles.linkPill, pressed && styles.pressed]}
          >
            <Ionicons
              name={LINK_META[key].icon as any}
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.linkText}>{LINK_META[key].label}</Text>
          </Pressable>
        ))}
      </View>
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },

  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  dotOn: { backgroundColor: colors.teal },
  dotOff: { backgroundColor: colors.border },
  statusCol: { flex: 1 },
  statusLabel: { ...typography.body, fontFamily: fonts.body.medium, color: colors.text },
  statusLabelOff: { color: colors.textMuted },
  statusHint: { ...typography.small, color: colors.textMuted, marginTop: 1 },

  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  linkText: { ...typography.caption, fontFamily: fonts.body.medium, color: colors.textSecondary },
  pressed: { opacity: 0.6 },
});
