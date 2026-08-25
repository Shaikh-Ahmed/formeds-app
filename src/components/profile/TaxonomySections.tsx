import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, fonts } from '../../theme';
import { Chip } from '../Chip';
import { ProfileSection } from './ProfileSection';
import {
  SKILL_CATEGORY_LABELS,
  SkillCategory,
  Skills,
  Visibility,
} from '../../types/profile';

/**
 * Chip-based sections: specializations, skills and interests.
 *
 * Chips rather than cards, per the brief — these are label sets, and a card per
 * skill would bury a dozen one-word facts in a dozen borders.
 */

interface ChipSectionProps {
  editable?: boolean;
  visibility?: Visibility;
  onEdit?: () => void;
  onChangeVisibility?: () => void;
  last?: boolean;
}

export function SpecializationSection({
  primary, expertise, editable, visibility, onEdit, onChangeVisibility, last,
}: ChipSectionProps & { primary?: string; expertise?: string[] }) {
  const areas = expertise || [];
  return (
    <ProfileSection
      title="Specializations"
      isEmpty={!primary && areas.length === 0}
      emptyTitle="Add your specializations"
      emptyHint="Your primary specialty and the areas you focus on within it."
      addLabel="Add specializations"
      singular
      onAdd={onEdit}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-specializations"
    >
      <View style={styles.stack}>
        {primary ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Primary</Text>
            <View style={styles.chips}>
              <Chip label={primary} tone="navy" />
            </View>
          </View>
        ) : null}
        {areas.length ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Areas of expertise</Text>
            <View style={styles.chips}>
              {areas.map((area) => (
                <Chip key={area} label={area} tone="teal" />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </ProfileSection>
  );
}

export function SkillsSection({
  skills, editable, visibility, onEdit, onChangeVisibility, last,
}: ChipSectionProps & { skills?: Skills }) {
  const categories = (Object.keys(SKILL_CATEGORY_LABELS) as SkillCategory[])
    .map((key) => ({ key, items: skills?.[key] || [] }))
    .filter((group) => group.items.length > 0);

  return (
    <ProfileSection
      title="Skills & expertise"
      isEmpty={categories.length === 0}
      emptyTitle="List your skills"
      emptyHint="Clinical, procedural, professional and research skills — the things a colleague would ask you about."
      addLabel="Add skills"
      singular
      onAdd={onEdit}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-skills"
    >
      <View style={styles.stack}>
        {categories.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={styles.groupLabel}>{SKILL_CATEGORY_LABELS[group.key]}</Text>
            <View style={styles.chips}>
              {group.items.map((skill) => (
                <Chip key={skill} label={skill} tone="neutral" />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ProfileSection>
  );
}

export function InterestsSection({
  interests, editable, visibility, onEdit, onChangeVisibility, last,
}: ChipSectionProps & { interests?: string[] }) {
  const items = interests || [];
  return (
    <ProfileSection
      title="Professional interests"
      isEmpty={items.length === 0}
      emptyTitle="Add your interests"
      emptyHint="Research areas, medical education, public health, healthcare technology — these shape what ForMeds recommends to you."
      addLabel="Add interests"
      singular
      onAdd={onEdit}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-interests"
    >
      <View style={styles.chips}>
        {items.map((interest) => (
          <Chip key={interest} label={interest} tone="neutral" />
        ))}
      </View>
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupLabel: {
    ...typography.small,
    fontFamily: fonts.body.semibold,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
