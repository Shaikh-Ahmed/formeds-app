import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, MIN_TOUCH_TARGET } from '../../theme';
import { Avatar } from '../Avatar';
import { Profile } from '../../types/profile';
import { absoluteMediaUrl } from '../../api/profile';

interface Props {
  profile: Profile;
  editable?: boolean;
  isMobile: boolean;
  onEditCover?: () => void;
  onEditAvatar?: () => void;
  onOverflow?: () => void;
}

/**
 * Cover band with the avatar overlapping it.
 *
 * The default cover is a flat navy field, deliberately: the brief rules out
 * forcing a medical stock photo on everyone, and a gradient would fight the
 * Swiss/high-contrast direction the brand already commits to. A user's own
 * upload replaces it.
 */
export function ProfileHeader({
  profile, editable, isMobile, onEditCover, onEditAvatar, onOverflow,
}: Props) {
  const cover = absoluteMediaUrl(profile.cover_photo);
  const avatarSize = isMobile ? 96 : 120;

  return (
    <View testID="profile-header">
      <View style={[styles.cover, isMobile ? styles.coverMobile : styles.coverWide]}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`${profile.name || 'Profile'} cover photo`}
          />
        ) : null}

        <View style={styles.coverActions}>
          {editable && onEditCover ? (
            <CoverButton
              icon="camera-outline"
              label={cover ? 'Change cover photo' : 'Add cover photo'}
              onPress={onEditCover}
              testID="profile-cover-edit"
            />
          ) : null}
          {onOverflow ? (
            <CoverButton
              icon="ellipsis-horizontal"
              label="More profile actions"
              onPress={onOverflow}
              testID="profile-overflow"
            />
          ) : null}
        </View>
      </View>

      <View style={[styles.avatarRow, isMobile ? styles.avatarRowMobile : styles.avatarRowWide]}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarRing, { borderRadius: (avatarSize + 8) / 2 }]}>
            <Avatar
              name={profile.name}
              role={profile.role}
              uri={absoluteMediaUrl(profile.avatar)}
              size={avatarSize}
            />
          </View>

          {profile.account_verified ? (
            <View
              style={styles.verifiedTick}
              accessible
              accessibilityLabel="Verified healthcare professional"
            >
              <Ionicons name="checkmark" size={13} color={colors.white} />
            </View>
          ) : null}

          {editable && onEditAvatar ? (
            <Pressable
              onPress={onEditAvatar}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              testID="profile-avatar-edit"
              style={({ pressed }) => [
                styles.avatarEdit,
                profile.account_verified && styles.avatarEditShifted,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="camera" size={14} color={colors.white} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * A cover-overlay control.
 *
 * Painted as a near-opaque white disc rather than a bare glyph: the button sits
 * on top of an arbitrary user-uploaded photo, and an unscrimmed icon there has
 * no guaranteed contrast against whatever is underneath it.
 */
function CoverButton({
  icon, label, onPress, testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.coverBtn, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={colors.navy} />
    </Pressable>
  );
}

/** Kept in sync with `avatarRow` negative margins. */
const AVATAR_OVERLAP = 48;

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.navy, width: '100%', overflow: 'hidden' },
  coverMobile: { height: 140 },
  // No radius: on desktop the cover sits inside the sheet, which clips it.
  coverWide: { height: 168 },

  coverActions: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  coverBtn: {
    width: MIN_TOUCH_TARGET - 4,
    height: MIN_TOUCH_TARGET - 4,
    borderRadius: 999,
    // Near-opaque so contrast holds over any uploaded image.
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },

  avatarRow: { marginTop: -AVATAR_OVERLAP },
  avatarRowMobile: { paddingHorizontal: spacing.lg },
  avatarRowWide: { paddingHorizontal: spacing.xxl },
  avatarWrap: { alignSelf: 'flex-start' },
  avatarRing: {
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.white,
  },

  verifiedTick: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEdit: {
    position: 'absolute',
    left: 0,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.navy,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Nothing to shift horizontally — the tick sits right, the camera left — but
  // keeping the hook makes the pairing explicit if either moves.
  avatarEditShifted: {},

});
