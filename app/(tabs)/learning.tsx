import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ComingSoon } from '../../src/components';
import { PageGrid, ProfileRail } from '../../src/components/web';
import { colors, spacing, radius, typography, useBreakpoint } from '../../src/theme';

type TabKey = 'books' | 'cme' | 'research';

const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  bullets: string[];
}[] = [
  {
    key: 'books',
    label: 'Books',
    icon: 'book-outline',
    title: 'Medical books are coming soon',
    description: 'A curated library of reference texts and clinical handbooks, readable inside the app.',
    bullets: ['Specialty-filtered catalogue', 'Offline reading', 'Bookmarks and highlights'],
  },
  {
    key: 'cme',
    label: 'CME',
    icon: 'school-outline',
    title: 'CME courses are coming soon',
    description: 'Accredited lessons with end-of-module quizzes and automatic credit tracking.',
    bullets: ['Video and written modules', 'Quizzes with instant scoring', 'Downloadable credit certificates'],
  },
  {
    key: 'research',
    label: 'Research',
    icon: 'flask-outline',
    title: 'Research is coming soon',
    description: 'Search peer-reviewed literature and follow the papers that matter to your specialty.',
    bullets: ['Full-text paper search', 'Open-access and citation signals', 'Save papers to your library'],
  },
];

export default function LearningScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('books');
  const active = TABS.find(t => t.key === activeTab)!;
  const { isMobile } = useBreakpoint();

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid left={<ProfileRail />} testID="learning-grid">
      <View style={[styles.wideTitleWrap, isMobile && styles.titleWrapMobile]}>
        <Text style={styles.wideTitle} accessibilityRole="header">Learning Hub</Text>
        <Text style={styles.wideSubtitle}>
          Reference texts, accredited CME and peer-reviewed research, in one place.
        </Text>
      </View>

      <View style={[styles.tabBar, !isMobile && styles.tabBarWide]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            testID={`tab-${t.key}`}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === t.key }}
            accessibilityLabel={`${t.label} — coming soon`}
          >
            <Ionicons name={t.icon} size={16} color={activeTab === t.key ? colors.textOnDark : '#64748B'} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <ComingSoon
          testID={`coming-soon-${active.key}`}
          icon={active.icon}
          title={active.title}
          description={active.description}
          bullets={active.bullets}
        />

        <Text style={styles.footnote}>
          Books, CME and Research all arrive in a later phase. Nothing to do here yet.
        </Text>
      </ScrollView>
      </PageGrid>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wideTitleWrap: { paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  titleWrapMobile: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  wideTitle: { ...typography.h2, color: colors.text },
  wideSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  tabBarWide: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
  },
  tabActive: { backgroundColor: colors.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: colors.textOnDark },
  body: { padding: spacing.lg, paddingBottom: 100 },
  footnote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    lineHeight: 18,
  },
});
