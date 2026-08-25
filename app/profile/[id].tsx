import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../src/theme';
import { ScreenHeader } from '../../src/components';
import { ProfileView } from '../../src/components/profile/ProfileView';

/**
 * Another professional's profile, read-only.
 *
 * This is what makes the privacy controls mean anything — until now nothing in
 * the app could render someone else's profile, so `search.tsx` deliberately
 * dead-ended person results at `/people`. The server decides what is visible;
 * `ProfileView` only renders what it is given, and `is_self` (which the server
 * sets) is what gates every edit affordance.
 */
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Profile" onBack={() => router.back()} />
      <ProfileView userId={String(id)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
});
