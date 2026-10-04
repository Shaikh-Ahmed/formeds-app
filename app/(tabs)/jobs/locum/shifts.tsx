import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, spacing } from '../../../../src/theme';
import { ChoiceChips } from '../../../../src/components/locum/ChoiceChips';
import { PageGrid } from '../../../../src/components/web';
import { LocumNav } from '../../../../src/components/locum/LocumNav';
import { ProfessionalShifts } from '../../../../src/components/locum/shifts/ProfessionalShifts';
import { HospitalShifts } from '../../../../src/components/locum/shifts/HospitalShifts';

/**
 * Shifts: Locum after selection. A professional sees their own shifts,
 * requests and reliability; anyone who posts locums sees the attendance board
 * for the shifts they manage. A professional can post cover for their own
 * list too, so they can switch to that board.
 */
export default function LocumShiftsScreen() {
  const { user } = useAuth();
  const professional = user?.role === 'healthcare_professional';
  const [view, setView] = useState<'mine' | 'posted'>('mine');
  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid fluid testID="locum-shifts-grid">
        <LocumNav active="shifts" />
        {professional ? (
          <View style={styles.switch}>
            <ChoiceChips value={view} onChange={v => v && setView(v)} testID="shifts-view"
              choices={[{ value: 'mine', label: 'Working' }, { value: 'posted', label: 'Posted by me' }]} />
          </View>
        ) : null}
        {professional && view === 'mine' ? <ProfessionalShifts /> : <HospitalShifts />}
      </PageGrid>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  switch: { paddingHorizontal: spacing.lg },
});
