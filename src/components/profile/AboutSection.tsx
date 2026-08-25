import React from 'react';
import { StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';
import { ProfileSection } from './ProfileSection';
import { ExpandableText } from '../ExpandableText';
import { Visibility } from '../../types/profile';

interface Props {
  about?: string;
  editable?: boolean;
  visibility?: Visibility;
  onEdit?: () => void;
  onChangeVisibility?: () => void;
  last?: boolean;
}

/**
 * The professional summary.
 *
 * Clamped to four lines with a "…more" affordance via the existing
 * `ExpandableText`, which already solves overflow detection on both native
 * (onTextLayout) and web (scrollHeight), including the re-measure after async
 * fonts land — which now actually happens, since the app loads real fonts.
 */
export function AboutSection({
  about, editable, visibility, onEdit, onChangeVisibility, last,
}: Props) {
  return (
    <ProfileSection
      title="About"
      isEmpty={!about}
      emptyTitle="Write a professional summary"
      emptyHint="Two or three sentences on your clinical focus, experience and the settings you have worked in."
      addLabel="Add summary"
      singular
      onAdd={onEdit}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-about"
    >
      <ExpandableText
        text={about || ''}
        numberOfLines={4}
        style={styles.text}
        testID="profile-about-text"
      />
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  // maxWidth, not width: on mobile the column is narrower than this and the
  // cap simply does not apply. On desktop it holds the line to ~72ch.
  text: { ...typography.body, color: colors.textSecondary, lineHeight: 22, maxWidth: 620 },
});
