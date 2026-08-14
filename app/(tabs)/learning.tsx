import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ComingSoon } from '../../src/components';
import { colors, spacing, radius, typography } from '../../src/theme';

/**
 * Learning Hub — Books, CME and Research all ship in a later phase.
 * The tabs stay visible so the roadmap is legible, but each renders a
 * coming-soon panel. The working Research implementation (PubMed via
 * GET /api/learning/research) is preserved at the bottom of this file;
 * see "DISABLED — Research implementation" for how to switch it back on.
 */

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.headerTitle}>Learning Hub</Text></View>

      <View style={styles.tabBar}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h1, fontSize: 24, color: colors.text },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 6,
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

// ─────────────────────────────────────────────────────────────────────────────
// DISABLED — Research implementation (re-enable in a later phase)
//
// This worked against GET /api/learning/research, which is STILL LIVE in
// backend/routes/learning.py — the endpoint was not removed, only the UI that
// consumed it. Verify with: curl $BACKEND/api/learning/research
//
// To switch Research back on:
//   1. Restore these imports at the top of the file:
//        import React, { useState, useEffect, useCallback } from 'react';
//        import { ..., FlatList, RefreshControl, Linking } from 'react-native';
//        import { useAuth } from '../../src/context/AuthContext';
//        import { apiFetch } from '../../src/utils/api';
//        import { ComingSoon, LoadingState, ErrorState } from '../../src/components';
//   2. Uncomment the state, loader, renderers and styles below.
//   3. In the body, branch on the active tab:
//        {activeTab === 'research' ? renderResearch() : <ScrollView …><ComingSoon …/></ScrollView>}
//   4. Drop the "— coming soon" suffix from the Research tab's accessibilityLabel
//      and consider defaulting useState<TabKey> to 'research'.
//
// Note: the backend still serves a fixed set of PMIDs (PUBMED_IDS in
// routes/learning.py). Free-text search (OpenAlex) is the unbuilt part.
//
// interface Article {
//   id: string;
//   title: string;
//   abstract: string;
//   /** Comma-joined by the backend — see parse_pubmed_xml in routes/learning.py. */
//   authors: string;
//   date: string;
//   url: string;
// }
//
// const { token } = useAuth();
// const [articles, setArticles] = useState<Article[]>([]);
// const [loading, setLoading] = useState(true);
// const [refreshing, setRefreshing] = useState(false);
// const [error, setError] = useState<string | null>(null);
//
// const loadResearch = useCallback(async () => {
//   setError(null);
//   try {
//     setArticles(await apiFetch('/api/learning/research', token));
//   } catch (e: any) {
//     setError(e?.message || 'Could not reach the research service.');
//   } finally {
//     setLoading(false);
//     setRefreshing(false);
//   }
// }, [token]);
//
// useEffect(() => { loadResearch(); }, [loadResearch]);
//
// const renderArticle = ({ item }: { item: Article }) => {
//   const authors = item.authors ? item.authors.split(', ') : [];
//   return (
//     <TouchableOpacity
//       testID={`research-card-${item.id}`}
//       style={styles.card}
//       onPress={() => item.url && Linking.openURL(item.url)}
//       disabled={!item.url}
//       accessibilityRole="link"
//       accessibilityLabel={`Open on PubMed: ${item.title}`}
//     >
//       <View style={styles.cardHeader}>
//         <View style={styles.cardIcon}><Ionicons name="document-text" size={20} color={colors.navy} /></View>
//         <View style={styles.sourceBadge}><Text style={styles.sourceText}>PubMed</Text></View>
//         {item.date ? <Text style={styles.date}>{item.date}</Text> : null}
//       </View>
//       <Text style={styles.cardTitle}>{item.title}</Text>
//       {authors.length > 0 && (
//         <Text style={styles.authors}>
//           {authors.slice(0, 3).join(', ')}{authors.length > 3 ? ` +${authors.length - 3} more` : ''}
//         </Text>
//       )}
//       <Text style={styles.abstract} numberOfLines={4}>{item.abstract}</Text>
//       <View style={styles.cardFooter}>
//         <Ionicons name="open-outline" size={14} color={colors.textMuted} />
//         <Text style={styles.footerText}>Read on PubMed</Text>
//       </View>
//     </TouchableOpacity>
//   );
// };
//
// const renderResearch = () => {
//   if (loading) return <LoadingState label="Loading research…" />;
//   if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); loadResearch(); }} />;
//   return (
//     <FlatList
//       data={articles}
//       renderItem={renderArticle}
//       keyExtractor={item => item.id}
//       contentContainerStyle={styles.list}
//       refreshControl={
//         <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadResearch(); }} tintColor={colors.navy} />
//       }
//       ListEmptyComponent={
//         <View style={styles.center}>
//           <Ionicons name="flask-outline" size={48} color={colors.textMuted} />
//           <Text style={styles.emptyText}>No articles available right now</Text>
//         </View>
//       }
//     />
//   );
// };
//
// ── styles used by the above (merge back into StyleSheet.create) ──
// list: { padding: spacing.lg, paddingBottom: 100 },
// card: {
//   backgroundColor: colors.card,
//   borderRadius: radius.xl + 2,
//   padding: spacing.lg,
//   marginBottom: spacing.md,
//   borderWidth: 1,
//   borderColor: colors.border,
//   borderLeftWidth: 4,
//   borderLeftColor: colors.navy,
// },
// cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md - 2 },
// cardIcon: {
//   width: 36,
//   height: 36,
//   borderRadius: radius.md,
//   backgroundColor: colors.bgMuted,
//   alignItems: 'center',
//   justifyContent: 'center',
// },
// sourceBadge: {
//   backgroundColor: colors.tealBg,
//   paddingHorizontal: spacing.sm + 2,
//   paddingVertical: spacing.xs,
//   borderRadius: radius.sm,
// },
// sourceText: { fontSize: 11, fontWeight: '700', color: colors.teal },
// date: { ...typography.small, color: colors.textMuted, marginLeft: 'auto' },
// cardTitle: { ...typography.h3, fontSize: 16, color: colors.text, lineHeight: 22, marginBottom: 6 },
// authors: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
// abstract: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md - 2 },
// cardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
// footerText: { ...typography.small, color: colors.textMuted, fontWeight: '600' },
// center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
// emptyText: { ...typography.body, fontSize: 16, color: colors.textMuted, marginTop: spacing.md },
// ─────────────────────────────────────────────────────────────────────────────
