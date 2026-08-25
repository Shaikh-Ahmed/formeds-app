import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, fonts, compactAction } from '../../theme';
import { ProfileSection } from './ProfileSection';
import { VerifiedMark } from './VerifiedMark';
import { ProfileEntry, RegistrationData, Visibility } from '../../types/profile';
import { formatMonth, joinMeta, maskNumber } from './format';

interface Props {
  entries: ProfileEntry[];
  editable?: boolean;
  visibility?: Visibility;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onChangeVisibility?: () => void;
  last?: boolean;
}

/**
 * Medical Registration & Licences.
 *
 * The one place on the profile that gets a bordered panel. Everything else is
 * flat document, but a council registration IS a document of record and reading
 * like one is the point — this is the section that does the most work for
 * professional trust.
 */
export function RegistrationSection({
  entries, editable, visibility, onAdd, onEdit, onChangeVisibility, last,
}: Props) {
  return (
    <ProfileSection
      title="Medical registration"
      isEmpty={entries.length === 0}
      emptyTitle="Add your medical registration"
      emptyHint="Your council registration is the strongest trust signal on a healthcare profile. Registration numbers are masked by default."
      addLabel="Add"
      onAdd={onAdd}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-registration"
    >
      <View style={styles.stack}>
        {entries.map((entry) => (
          <RegistrationPanel
            key={entry.id}
            entry={entry}
            editable={editable}
            onEdit={onEdit}
          />
        ))}
      </View>
    </ProfileSection>
  );
}

function RegistrationPanel({
  entry, editable, onEdit,
}: {
  entry: ProfileEntry;
  editable?: boolean;
  onEdit?: (id: string) => void;
}) {
  const d = entry.data as RegistrationData;
  const [revealed, setRevealed] = useState(false);
  const verified = entry.verification_status === 'verified';

  return (
    <View style={[styles.panel, verified && styles.panelVerified]}>
      <View style={styles.panelHead}>
        <Ionicons
          name={verified ? 'shield-checkmark' : 'shield-outline'}
          size={20}
          color={verified ? colors.teal : colors.textMuted}
        />
        <View style={styles.panelTitleCol}>
          <Text style={styles.council}>{d.council}</Text>
          <Text style={styles.type}>
            {joinMeta(
              d.registration_type === 'rohini' ? 'Facility registration' : 'Medical registration',
              d.state,
            )}
          </Text>
        </View>
        {editable && onEdit ? (
          <Pressable
            onPress={() => onEdit(entry.id)}
            hitSlop={compactAction.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`Edit registration with ${d.council}`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="pencil" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.numberRow}>
        <Text style={styles.number}>
          {revealed ? d.registration_number : maskNumber(d.registration_number)}
        </Text>
        {/* Self-view only: revealing is for checking your own record, not for
            handing a viewer a way around the masking. */}
        {editable ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={compactAction.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide registration number' : 'Show registration number'}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.footRow}>
        <VerifiedMark status={entry.verification_status} showUnverified={editable} />
        {d.expiry_date ? (
          <Text style={styles.expiry}>{`Valid to ${formatMonth(d.expiry_date)}`}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelVerified: { borderColor: colors.tealLight, backgroundColor: colors.tealBg },

  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  panelTitleCol: { flex: 1 },
  council: { ...typography.body, fontFamily: fonts.body.semibold, color: colors.text },
  type: { ...typography.small, color: colors.textSecondary, marginTop: 1 },

  numberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  number: {
    ...typography.body,
    fontFamily: fonts.body.medium,
    color: colors.text,
    letterSpacing: 1.2,
  },

  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expiry: { ...typography.small, color: colors.textMuted },
  pressed: { opacity: 0.6 },
});
