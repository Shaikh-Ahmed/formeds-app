import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, fonts, compactAction } from '../../theme';
import { ProfileSection } from './ProfileSection';
import { VerifiedMark } from './VerifiedMark';
import { ProfileEntry, Visibility } from '../../types/profile';
import { formatMonth, joinMeta } from './format';

export interface CredentialRow {
  id: string;
  /** Optional leading index, used by Publications for its numbered list. */
  index?: number;
  title: string;
  subtitle?: string;
  meta?: string;
  link?: string;
  status: ProfileEntry['verification_status'];
}

interface Props {
  title: string;
  rows: CredentialRow[];
  editable?: boolean;
  emptyTitle: string;
  emptyHint: string;
  addLabel: string;
  visibility?: Visibility;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onChangeVisibility?: () => void;
  numbered?: boolean;
  maxVisible?: number;
  last?: boolean;
  testID?: string;
}

/**
 * Compact two-line credential list — certifications, awards, publications,
 * conferences.
 *
 * Deliberately NOT the timeline: those four are collections, not a progression,
 * and giving them the career rail would flatten the one device that signals
 * career movement. Deliberately not cards either — see `ProfileSection`.
 */
export function EntryListSection({
  title, rows, editable, emptyTitle, emptyHint, addLabel,
  visibility, onAdd, onEdit, onChangeVisibility, numbered, maxVisible = 4, last, testID,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, rows.length - maxVisible);
  const visible = expanded ? rows : rows.slice(0, maxVisible);

  return (
    <ProfileSection
      title={title}
      isEmpty={rows.length === 0}
      emptyTitle={emptyTitle}
      emptyHint={emptyHint}
      addLabel={addLabel}
      onAdd={onAdd}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID={testID}
    >
      <View style={styles.list}>
        {visible.map((row, i) => (
          <View key={row.id} style={styles.row}>
            {numbered ? <Text style={styles.index}>{`${i + 1}.`}</Text> : null}
            <View style={styles.rowBody}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{row.title}</Text>
                <VerifiedMark status={row.status} compact />
                {editable && onEdit ? (
                  <Pressable
                    onPress={() => onEdit(row.id)}
                    hitSlop={compactAction.hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${row.title}`}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Ionicons name="pencil" size={14} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {row.subtitle ? <Text style={styles.subtitle}>{row.subtitle}</Text> : null}
              {row.meta ? <Text style={styles.meta}>{row.meta}</Text> : null}
              {row.link ? (
                <Pressable
                  onPress={() => Linking.openURL(row.link!)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${row.title}`}
                  style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
                >
                  <Ionicons name="open-outline" size={13} color={colors.navy} />
                  <Text style={styles.linkText}>View credential</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {hidden ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Show fewer' : `Show all ${rows.length}`}
          style={({ pressed }) => [styles.expander, pressed && styles.pressed]}
        >
          <Text style={styles.expanderText}>
            {expanded ? 'Show less' : `Show all ${rows.length}`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.navy} />
        </Pressable>
      ) : null}
    </ProfileSection>
  );
}

/** Shared row builders, so each section stays a thin mapping. */
export const rowBuilders = {
  certification: (e: ProfileEntry): CredentialRow => {
    const d = e.data as any;
    return {
      id: e.id,
      title: d.name,
      subtitle: d.issuer,
      meta: joinMeta(
        d.issue_date ? `Issued ${formatMonth(d.issue_date)}` : '',
        d.does_not_expire ? 'No expiry' : d.expiry_date ? `Expires ${formatMonth(d.expiry_date)}` : '',
        d.credential_id ? `ID ${d.credential_id}` : '',
      ),
      link: d.credential_url,
      status: e.verification_status,
    };
  },
  award: (e: ProfileEntry): CredentialRow => {
    const d = e.data as any;
    return {
      id: e.id,
      title: d.title,
      subtitle: joinMeta(d.issuer, formatMonth(d.date)),
      meta: d.description,
      status: e.verification_status,
    };
  },
  publication: (e: ProfileEntry): CredentialRow => {
    const d = e.data as any;
    return {
      id: e.id,
      title: d.title,
      subtitle: joinMeta(d.journal, formatMonth(d.publication_date)),
      meta: (d.authors || []).length ? (d.authors as string[]).join(', ') : d.doi,
      link: d.url,
      status: e.verification_status,
    };
  },
  conference: (e: ProfileEntry): CredentialRow => {
    const d = e.data as any;
    return {
      id: e.id,
      title: d.name,
      subtitle: joinMeta(d.title, d.location),
      meta: joinMeta(
        formatMonth(d.date),
        d.cme_credits ? `${d.cme_credits} CME credits` : '',
      ),
      status: e.verification_status,
    };
  },
};

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  index: { ...typography.caption, color: colors.textMuted, minWidth: 18, lineHeight: 20 },
  rowBody: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  // flex:1 pushes the edit affordance to the right edge, so it lines up with
  // the timeline rows rather than floating mid-sentence.
  title: {
    ...typography.body,
    fontFamily: fonts.body.semibold,
    color: colors.text,
    flex: 1,
  },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, minHeight: 28 },
  linkText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.navy },
  expander: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, minHeight: 32 },
  expanderText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.navy },
  pressed: { opacity: 0.6 },
});
