import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocumScreen } from '../../../../src/components/locum/LocumScreen';
import { colors } from '../../../../src/theme';

export default function LocumDiscoverScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <LocumScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg } });
