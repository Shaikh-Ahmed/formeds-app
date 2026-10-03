import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { JobsScreen } from '../../../src/components/jobs/JobsScreen';
import { colors } from '../../../src/theme';

/** Internships open to students: the shared Jobs board, narrowed. */
export default function JobsInternshipsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <JobsScreen segment="internships" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg } });
