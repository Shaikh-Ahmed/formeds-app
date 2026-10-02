import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ComingSoon, BooksCatalog, ResearchCatalog } from '../../src/components';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { PageGrid, ProfileRail } from '../../src/components/web';
import { colors, spacing, radius, typography, useBreakpoint, gloss, fonts, elevation, isPremium } from '../../src/theme';
import { Platform } from 'react-native';

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
    title: 'Medical Reference E-Books',
    description: 'A curated library of reference texts and clinical handbooks, readable inside the app.',
    bullets: ['Specialty-filtered catalogue', 'Continue reading shelf', 'Bookmarks and highlights'],
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
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('books');
  const active = TABS.find(t => t.key === activeTab)!;
  const { isMobile } = useBreakpoint();

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <PageGrid left={<ProfileRail />} testID="learning-grid">
      <View style={[styles.wideTitleWrap, isMobile && styles.titleWrapMobile]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.wideTitle} accessibilityRole="header">Learning Hub</Text>
            <Text style={styles.wideSubtitle}>
              Reference texts, accredited CME and peer-reviewed research, in one place.
            </Text>
          </View>
          {user?.is_admin && (
            <TouchableOpacity
              style={styles.adminHeaderUploadBtn}
              onPress={() => router.push(`/admin/upload?tab=${activeTab === 'research' ? 'research' : 'books'}` as any)}
              accessibilityRole="button"
              accessibilityLabel="Upload Content"
              testID="learning-header-upload-btn"
            >
              <Ionicons name="cloud-upload" size={16} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.adminHeaderUploadBtnText}>
                {activeTab === 'books' ? 'Upload Book' : activeTab === 'research' ? 'Upload Research Paper' : 'Upload Content'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.tabBar, !isMobile && styles.tabBarWide, isPremium && styles.cBar, isPremium && isMobile && styles.cBarMobile]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            testID={`tab-${t.key}`}
            style={[styles.tab, activeTab === t.key && styles.tabActive, isPremium && styles.cTab, isPremium && activeTab === t.key && styles.cTabActive]}
            onPress={() => setActiveTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === t.key }}
            accessibilityLabel={t.key === 'books' ? t.label : `${t.label} — coming soon`}
          >
            <Ionicons name={t.icon} size={16} color={activeTab === t.key ? (isPremium ? colors.teal : colors.textOnDark) : colors.textSubtle} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive, isPremium && styles.cTabText, isPremium && activeTab === t.key && styles.cTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'books' ? (
        <View style={styles.booksWrapper}>
          <BooksCatalog />
        </View>
      ) : activeTab === 'research' ? (
        <View style={styles.booksWrapper}>
          <ResearchCatalog />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <ComingSoon
            testID={`coming-soon-${active.key}`}
            icon={active.icon}
            title={active.title}
            description={active.description}
            bullets={active.bullets}
          />

          <Text style={styles.footnote}>
            {active.label} arrives in a later phase. Stay tuned for updates.
          </Text>
        </ScrollView>
      )}
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
    ...gloss.glass,
  },
  tabActive: { backgroundColor: colors.action, ...gloss.fill },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSubtle },
  tabTextActive: { color: colors.textOnDark },
  // Premium: the shared tonal segmented control (slate track, white thumb).
  cBar: { backgroundColor: colors.bgMuted, borderColor: colors.bgMuted, padding: 4, gap: 4, borderRadius: radius.pill },
  cBarMobile: { marginHorizontal: spacing.lg, marginVertical: spacing.xs },
  cTab: { backgroundColor: 'transparent', borderRadius: radius.pill, paddingVertical: 9 },
  cTabActive: {
    backgroundColor: colors.white,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 3px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.06)' } as object) : elevation.subtle),
  },
  cTabText: { fontFamily: fonts.body.semibold, fontWeight: undefined },
  cTabTextActive: { color: colors.teal, fontFamily: fonts.body.bold },
  body: { padding: spacing.lg, paddingBottom: 100 },
  footnote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    lineHeight: 18,
  },
  booksWrapper: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: 0,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  adminHeaderUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  adminHeaderUploadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});