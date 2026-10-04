import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, typography, isRefined, isPremium } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The ForMeds trust mark: how an ALREADY-verified person or organisation is
 * shown. It never decides who is verified -- callers render it only where the
 * data says so (account_verified, employer_verified, org.verified).
 *
 * ForMeds Premium uses one shape everywhere -- a teal shield with a check --
 * for professionals and organisations alike, so trust reads as one language.
 * Classic keeps whichever icon that screen has always shown (`classicIcon`),
 * so switching themes changes nothing in Classic.
 */
export function TrustMark({
  size = 14,
  label = 'Verified',
  classicIcon = 'checkmark-circle',
  text,
  testID,
}: {
  size?: number;
  /** Spoken by screen readers: the claim the mark makes. */
  label?: string;
  /** The icon Classic has always used at this spot. */
  classicIcon?: IconName;
  /** Optional words beside the mark ("Verified organisation"). */
  text?: string;
  testID?: string;
}) {
  const icon: IconName = isRefined ? 'shield-checkmark' : classicIcon;
  // Premium: the verified tick -- a filled teal disc with a white check and a
  // soft halo of its own colour, the same mark beside every verified name.
  if (isPremium) {
    const seal = (
      <View style={[styles.seal, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="checkmark" size={Math.round(size * 0.72)} color={colors.white} />
      </View>
    );
    if (!text) return <View accessible accessibilityLabel={label} testID={testID}>{seal}</View>;
    return (
      <View style={styles.row} accessible accessibilityLabel={label} testID={testID}>
        {seal}
        <Text style={styles.text}>{text}</Text>
      </View>
    );
  }
  if (!text) {
    return <Ionicons name={icon} size={size} color={colors.verified} accessibilityLabel={label} testID={testID} />;
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={label} testID={testID}>
      <Ionicons name={icon} size={size} color={colors.verified} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.verified },
  seal: {
    backgroundColor: colors.verified, alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 2px #FFFFFF, 0 0 6px rgba(13,148,136,0.45)' } as object) : {}),
  },
});
