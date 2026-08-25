import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { colors } from '../../src/theme';
import { ProfileView } from '../../src/components/profile/ProfileView';

/**
 * The signed-in user's profile — their digital healthcare resume.
 *
 * Everything account-shaped that used to live here (Edit profile, Settings,
 * Help, Admin, Sign out, the version string) has moved out. All of it was
 * already reachable from `AppDrawer`, and mixing it in is precisely what made
 * this screen read as a settings page rather than a professional identity.
 * Privacy settings remain reachable from the header's overflow menu.
 *
 * Route stays `/(tabs)/profile` with `href: null` — the drawer, the desktop top
 * bar and `verify-email` all push here, and `mobileShell.test.tsx` asserts it.
 */
export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ProfileView />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
});
