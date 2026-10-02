import React from 'react';
import { TrustMark } from '../../TrustMark';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET, gloss } from '../../../theme';
import { Avatar } from '../../Avatar';
import { Skeleton } from '../../Skeleton';
import { JobBadge } from '../JobMeta';
import { postedAgo } from '../../../utils/time';
import { APPLICATION_STATUS_META, type ApplicationStatusKey } from '../../../types/jobs';
import type { ApplicantCard, ApplicantPage, ApplicantSort } from '../../../types/applicants';

/**
 * The left pane of the applicant workspace: search, pipeline tabs, sort, and
 * the list itself. Everything is fetched a page at a time by the screen; this
 * component only renders what it is given and reports what the user asked for.
 */

export const TABS: (ApplicationStatusKey | 'all')[] = [
  'all', 'applied', 'reviewing', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn',
];

export const SORT_LABELS: Record<ApplicantSort, string> = {
  newest: 'Newest first', oldest: 'Oldest first', updated: 'Recently updated',
  experience: 'Most experience', name_asc: 'Name A–Z', name_desc: 'Name Z–A',
};

const TONE = { neutral: 'neutral', teal: 'teal', navy: 'navy', warning: 'warning', danger: 'danger' } as const;

export function StatusBadge({ status }: { status: ApplicationStatusKey }) {
  const meta = APPLICATION_STATUS_META[status];
  return <JobBadge label={meta.label} icon={meta.icon as any} tone={TONE[meta.tone]} />;
}

/** "Verified doctor", only when the platform's own KYC says so. */
export function verifiedLabel(card: { account_verified?: boolean; professional_role?: string } | null): string | null {
  if (!card?.account_verified) return null;
  const role = (card.professional_role || '').trim();
  return role ? `Verified ${role.toLowerCase()}` : 'Verified professional';
}

export function ApplicantList({
  page, loading, error, query, onQuery, status, onStatus, sort, onSort, onOpenFilters, filterCount,
  selectedId, onSelect, checked, onToggle, onLoadMore, loadingMore, onRetry,
}: {
  page: ApplicantPage | null;
  loading: boolean;
  error: string | null;
  query: string;
  onQuery: (q: string) => void;
  status: ApplicationStatusKey | 'all';
  onStatus: (s: ApplicationStatusKey | 'all') => void;
  sort: ApplicantSort;
  onSort: () => void;
  onOpenFilters: () => void;
  filterCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  checked: string[];
  onToggle: (id: string) => void;
  onLoadMore: () => void;
  loadingMore: boolean;
  onRetry: () => void;
}) {
  const counts = page?.counts;
  const totalAll = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <View style={styles.pane} testID="applicant-list">
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput value={query} onChangeText={onQuery} placeholder="Search applicants…" maxLength={100}
            placeholderTextColor={colors.textMuted} style={styles.searchInput} accessibilityLabel="Search applicants"
            returnKeyType="search" testID="applicant-search" />
          {query ? (
            <Pressable onPress={() => onQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onOpenFilters} accessibilityRole="button" testID="applicant-filters"
          accessibilityLabel={filterCount ? `Filters, ${filterCount} applied` : 'Filters'}
          style={({ pressed }) => [styles.iconBtn, filterCount ? styles.iconBtnOn : null, pressed && styles.pressed]}>
          <Ionicons name="options-outline" size={18} color={filterCount ? colors.white : colors.navy} />
          {filterCount ? <Text style={styles.iconBtnCount}>{filterCount}</Text> : null}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}
        contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {TABS.map(t => {
          const n = t === 'all' ? totalAll : counts?.[t] ?? 0;
          if (t !== 'all' && t !== status && !n) return null;
          const on = status === t;
          return (
            <Pressable key={t} onPress={() => onStatus(t)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              testID={`applicant-tab-${t}`} style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {t === 'all' ? 'All' : APPLICATION_STATUS_META[t].label}
              </Text>
              <Text style={[styles.tabCount, on && styles.tabTextOn]}>{n}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.metaRow}>
        <Text style={styles.metaText} testID="applicant-total">
          {page ? `${page.total} applicant${page.total === 1 ? '' : 's'}${page.total !== page.all_total ? ` of ${page.all_total}` : ''}` : ' '}
        </Text>
        <Pressable onPress={onSort} accessibilityRole="button" accessibilityLabel={`Sort: ${SORT_LABELS[sort]}`}
          style={styles.sortBtn} testID="applicant-sort">
          <Ionicons name="swap-vertical" size={15} color={colors.navy} />
          <Text style={styles.sortText}>{SORT_LABELS[sort]}</Text>
        </Pressable>
      </View>

      {error && !page ? (
        <View style={styles.message}>
          <Text style={styles.messageTitle}>Unable to load applicants.</Text>
          <Text style={styles.messageBody}>Please try again.</Text>
          <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}><Text style={styles.sortText}>Retry</Text></Pressable>
        </View>
      ) : loading && !page ? (
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={styles.skel}><Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, gap: 6 }}><Skeleton width="60%" height={14} /><Skeleton width="85%" height={12} /></View>
            </View>
          ))}
        </View>
      ) : page && page.items.length === 0 ? (
        <View style={styles.message} testID="applicant-empty">
          {page.all_total === 0 ? (
            <>
              <Ionicons name="people-outline" size={32} color={colors.textMuted} />
              <Text style={styles.messageTitle}>No applicants yet.</Text>
              <Text style={styles.messageBody}>Applications will appear here when professionals apply.</Text>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={32} color={colors.textMuted} />
              <Text style={styles.messageTitle}>No applicants found.</Text>
              <Text style={styles.messageBody}>Try changing your search or filters.</Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={page?.items ?? []}
          keyExtractor={a => a.id}
          renderItem={({ item }) => (
            <Row card={item} selected={item.id === selectedId} checked={checked.includes(item.id)}
              onPress={() => onSelect(item.id)} onToggle={() => onToggle(item.id)} />
          )}
          ListFooterComponent={page?.has_more ? (
            <Pressable onPress={onLoadMore} accessibilityRole="button" style={styles.more} testID="applicant-more">
              {loadingMore ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.sortText}>Load more</Text>}
            </Pressable>
          ) : null}
        />
      )}
    </View>
  );
}

function Row({ card, selected, checked, onPress, onToggle }: {
  card: ApplicantCard; selected: boolean; checked: boolean; onPress: () => void; onToggle: () => void;
}) {
  const a = card.applicant;
  const line = [a?.professional_role, a?.specialty].filter(Boolean).join(' · ');
  const where = [a?.city, a?.years_experience ? `${a.years_experience} yrs experience` : null].filter(Boolean).join(' · ');
  const verified = verifiedLabel(a);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={`${a?.name ?? 'Applicant'}, ${APPLICATION_STATUS_META[card.status].label}`}
      testID={`applicant-row-${card.id}`}
      style={({ pressed, hovered }: any) => [styles.row, selected && styles.rowOn, hovered && !selected && styles.rowHover,
        pressed && styles.pressed]}>
      {selected ? <View style={styles.rowBar} /> : null}
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={6}
        accessibilityLabel={`Select ${a?.name ?? 'applicant'}`} style={styles.checkbox} testID={`applicant-check-${card.id}`}>
        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? colors.navy : colors.textMuted} />
      </Pressable>
      <Avatar name={a?.name} uri={a?.avatar} role={a?.role} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>{a?.name ?? 'Applicant'}</Text>
        {verified ? (
          <View style={styles.verified}>
            <TrustMark size={13} classicIcon="checkmark-circle" />
            <Text style={styles.verifiedText}>{verified}</Text>
          </View>
        ) : null}
        {line ? <Text style={styles.sub} numberOfLines={1}>{line}</Text> : null}
        {a?.headline ? <Text style={styles.muted} numberOfLines={1}>{a.headline}</Text> : null}
        {where ? <Text style={styles.muted} numberOfLines={1}>{where}</Text> : null}
        <View style={styles.rowFoot}>
          <StatusBadge status={card.status} />
          <Text style={styles.muted}>Applied {postedAgo(card.created_at).replace(/^Posted /i, '')}</Text>
          {card.has_resume ? <Ionicons name="document-text-outline" size={14} color={colors.textSecondary}
            accessibilityLabel="Resume attached" /> : null}
          {card.screening?.preferences ? (
            <Ionicons name={card.screening.unmet ? 'alert-circle-outline' : 'checkmark-done-outline'} size={14}
              color={card.screening.unmet ? colors.warning : colors.teal}
              accessibilityLabel={card.screening.unmet ? 'Some screening preferences not met' : 'Meets screening preferences'} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, backgroundColor: colors.white },
  pressed: { opacity: 0.85 },
  searchRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.sm },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.bgMuted,
  },
  searchInput: { flex: 1, minWidth: 0, ...typography.body, color: colors.text, ...({ outlineStyle: 'none' } as object) },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: MIN_TOUCH_TARGET, minHeight: 44, justifyContent: 'center',
    paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  iconBtnOn: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  iconBtnCount: { ...typography.small, fontFamily: fonts.body.bold, color: colors.white },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.sm },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  tabOn: { backgroundColor: colors.action, ...gloss.fill, borderColor: colors.action },
  tabText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  tabCount: { ...typography.small, color: colors.textMuted },
  tabTextOn: { color: colors.white },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  metaText: { ...typography.caption, color: colors.textSecondary },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  sortText: { ...typography.label, color: colors.navy },
  row: {
    flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.md, paddingLeft: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  rowOn: { backgroundColor: colors.bg },
  rowHover: { backgroundColor: colors.bg },
  rowBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.primaryFill },
  checkbox: { width: 28, alignItems: 'center', paddingTop: 12 },
  name: { ...typography.bodyStrong, color: colors.text },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { ...typography.small, fontFamily: fonts.body.semibold, color: colors.teal },
  sub: { ...typography.caption, color: colors.text },
  muted: { ...typography.small, color: colors.textSecondary },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  skel: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  message: { alignItems: 'center', gap: spacing.xs, padding: spacing.xxl },
  messageTitle: { ...typography.bodyStrong, color: colors.text, textAlign: 'center' },
  messageBody: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  retry: { marginTop: spacing.sm, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.lg },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
});
