import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Avatar, RoleBadge, CaseCard } from '../src/components';
import { PageColumn } from '../src/components/web';
import { colors, spacing, radius, typography, fonts, MIN_TOUCH_TARGET, getRoleMeta } from '../src/theme';
import type { CaseThread } from '../src/types/cases';

type Scope = 'all' | 'people' | 'cases' | 'jobs';

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'cases', label: 'Cases' },
  { key: 'jobs', label: 'Jobs' },
];

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

interface PersonResult {
  id: string;
  name: string;
  role: string;
  professional_role?: string;
  specialty?: string;
  specialty_focus?: string;
  city?: string;
  state?: string;
  location?: string;
  avatar?: string;
  verified?: boolean;
}

/**
 * Universal search.
 *
 * Scope is bounded by what the API can actually answer:
 *   People — /api/users/search?q=       free text over name
 *   Cases  — /api/cases/?q=             free text over title and body
 *   Jobs   — /api/jobs/permanent?specialty=  the only text filter jobs exposes
 *
 * Feed posts have no search endpoint at all, so there is no Posts tab. An
 * empty tab that always returns nothing would read as a broken search rather
 * than an absent feature.
 */
export default function SearchScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [cases, setCases] = useState<CaseThread[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  const trimmed = query.trim();
  const active = trimmed.length >= MIN_QUERY;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const runSearch = useCallback(
    async (q: string, signal: { cancelled: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const [p, c, j] = await Promise.all([
          apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`, token).catch(() => []),
          apiFetch(`/api/cases/?q=${encodeURIComponent(q)}&limit=10`, token).catch(() => []),
          // Jobs has no free-text param; specialty is the closest thing it
          // exposes, so a query only matches when it names a specialty.
          apiFetch(`/api/jobs/permanent?specialty=${encodeURIComponent(q)}`, token).catch(() => []),
        ]);
        if (signal.cancelled) return;
        setPeople(Array.isArray(p) ? p : []);
        setCases(Array.isArray(c) ? c : []);
        setJobs(Array.isArray(j) ? j : (j?.items ?? []));
      } catch (e: any) {
        if (!signal.cancelled) setError(e?.message || 'Search failed. Check your connection.');
      } finally {
        if (!signal.cancelled) setLoading(false);
      }
    },
    [token],
  );

  // Debounced so a five-letter query fires one request, not five.
  useEffect(() => {
    if (!active) {
      setPeople([]); setCases([]); setJobs([]); setLoading(false);
      return;
    }
    const signal = { cancelled: false };
    const t = setTimeout(() => runSearch(trimmed, signal), DEBOUNCE_MS);
    return () => { signal.cancelled = true; clearTimeout(t); };
  }, [trimmed, active, runSearch]);

  const counts = useMemo(
    () => ({ all: people.length + cases.length + jobs.length, people: people.length, cases: cases.length, jobs: jobs.length }),
    [people, cases, jobs],
  );

  const showPeople = (scope === 'all' || scope === 'people') && people.length > 0;
  const showCases = (scope === 'all' || scope === 'cases') && cases.length > 0;
  const showJobs = (scope === 'all' || scope === 'jobs') && jobs.length > 0;
  const nothing = active && !loading && !error && counts[scope] === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={720} testID="search-column">
        <View style={styles.header}>
          <Pressable
            testID="search-back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community'))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.navy} />
          </Pressable>

          <View style={styles.field}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              ref={inputRef}
              testID="search-input"
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search people, cases, jobs"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search ForMeds"
            />
            {query.length > 0 && (
              <Pressable
                testID="search-clear"
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.chipRow}>
          {SCOPES.map(s => {
            const selected = scope === s.key;
            return (
              <Pressable
                key={s.key}
                testID={`search-scope-${s.key}`}
                onPress={() => setScope(s.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={active ? `${s.label}, ${counts[s.key]} results` : s.label}
                style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {s.label}
                  {active && counts[s.key] > 0 ? ` · ${counts[s.key]}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {!active ? (
            <Prompt />
          ) : loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.navy} />
              <Text style={styles.centerText}>Searching…</Text>
            </View>
          ) : error ? (
            <View style={styles.center} accessibilityRole="alert">
              <Ionicons name="cloud-offline-outline" size={44} color={colors.red} />
              <Text style={styles.centerTitle}>Couldn&apos;t search</Text>
              <Text style={styles.centerText}>{error}</Text>
            </View>
          ) : nothing ? (
            <NoResults query={trimmed} scope={scope} />
          ) : (
            <>
              {showPeople && (
                <Section title="People" count={people.length}>
                  {people.slice(0, scope === 'all' ? 4 : undefined).map(p => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      onPress={() => router.push({ pathname: '/profile/[id]', params: { id: p.id } } as any)}
                    />
                  ))}
                </Section>
              )}

              {showCases && (
                <Section title="Cases" count={cases.length}>
                  {cases.slice(0, scope === 'all' ? 3 : undefined).map(c => (
                    <CaseCard
                      key={c.id}
                      item={c}
                      onPress={() => router.push({ pathname: '/case/[id]', params: { id: c.id } } as any)}
                    />
                  ))}
                </Section>
              )}

              {showJobs && (
                <Section title="Jobs" count={jobs.length} note="Matched by specialty">
                  {jobs.slice(0, scope === 'all' ? 3 : undefined).map(j => (
                    <JobRow key={j.id} job={j} onPress={() => router.push('/(tabs)/jobs')} />
                  ))}
                </Section>
              )}
            </>
          )}
        </ScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

/** Pre-query state — explains the scope instead of showing a blank screen. */
function Prompt() {
  return (
    <View style={styles.prompt}>
      <View style={styles.promptIcon}>
        <Ionicons name="search" size={26} color={colors.navy} />
      </View>
      <Text style={styles.promptTitle}>Search ForMeds</Text>
      <Text style={styles.promptBody}>
        Find colleagues by name, clinical cases by title or content, and job
        openings by specialty.
      </Text>
      <View style={styles.promptList}>
        <PromptRow icon="people-outline" label="People" hint="Search by name" />
        <PromptRow icon="help-buoy-outline" label="Cases" hint="Search titles and discussion" />
        <PromptRow icon="briefcase-outline" label="Jobs" hint="Search by specialty" />
      </View>
    </View>
  );
}

function PromptRow({ icon, label, hint }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string }) {
  return (
    <View style={styles.promptRow}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={styles.promptLabel}>{label}</Text>
      <Text style={styles.promptHint}>{hint}</Text>
    </View>
  );
}

/** Never a bare "0 results" — always says what to try next. */
function NoResults({ query, scope }: { query: string; scope: Scope }) {
  const suggestions: Record<Scope, string> = {
    all: 'Try a colleague’s full name, a clinical term, or a specialty like “Cardiology”.',
    people: 'People are matched on their full name. Try a first or last name on its own.',
    cases: 'Cases are matched on title and body. Try a broader clinical term.',
    jobs: 'Jobs are matched by specialty only. Try “Cardiology”, “Radiology” or “Emergency Medicine”.',
  };

  return (
    <View style={styles.center}>
      <Ionicons name="search-outline" size={44} color={colors.textMuted} />
      <Text style={styles.centerTitle}>No matches for “{query}”</Text>
      <Text style={styles.centerText}>{suggestions[scope]}</Text>
    </View>
  );
}

function Section({
  title,
  count,
  note,
  children,
}: {
  title: string;
  count: number;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function PersonRow({ person, onPress }: { person: PersonResult; onPress: () => void }) {
  const meta = getRoleMeta(person.role);
  const sub =
    person.professional_role || person.specialty || person.specialty_focus || meta.longLabel;
  const place = person.location || [person.city, person.state].filter(Boolean).join(', ');

  return (
    <Pressable
      testID={`search-person-${person.id}`}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${person.name}, ${sub}${place ? `, ${place}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Avatar name={person.name} role={person.role} uri={person.avatar} size={44} />
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{person.name}</Text>
          {person.verified ? (
            <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
          ) : null}
        </View>
        <Text style={styles.cardSub} numberOfLines={1}>{sub}</Text>
        {place ? <Text style={styles.cardMeta} numberOfLines={1}>{place}</Text> : null}
      </View>
      <RoleBadge role={person.role} />
    </Pressable>
  );
}

function JobRow({ job, onPress }: { job: any; onPress: () => void }) {
  return (
    <Pressable
      testID={`search-job-${job.id}`}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${job.title}, ${job.specialty}, ${job.location}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.jobIcon}>
        <Ionicons name="briefcase" size={20} color={colors.navy} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{job.title}</Text>
        <Text style={styles.cardSub} numberOfLines={1}>{job.hospital_name || job.specialty}</Text>
        {job.location ? <Text style={styles.cardMeta} numberOfLines={1}>{job.location}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    // Suppresses the browser's default outline on web so the shared
    // :focus-visible ring in app/+html.tsx is the only focus treatment.
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },

  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...typography.caption, fontFamily: fonts.body.semibold, color: colors.textSecondary },
  chipTextActive: { color: colors.white },

  body: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  section: { marginBottom: spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.text },
  sectionCount: { ...typography.small, color: colors.textSecondary },
  sectionNote: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  sectionBody: { marginTop: spacing.md, gap: spacing.md },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: MIN_TOUCH_TARGET + 16,
  },
  cardPressed: { backgroundColor: colors.bgMuted },
  cardBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTitle: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  cardMeta: { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  jobIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: { alignItems: 'center', paddingTop: spacing.xxxl + 24, paddingHorizontal: spacing.xl, gap: spacing.sm },
  centerTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginTop: spacing.sm },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  prompt: { paddingTop: spacing.xl, alignItems: 'center' },
  promptIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTitle: { ...typography.h3, color: colors.text, marginTop: spacing.lg },
  promptBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  promptList: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  promptLabel: { ...typography.bodyStrong, color: colors.text },
  promptHint: { ...typography.caption, color: colors.textSecondary, flex: 1, textAlign: 'right' },
});
