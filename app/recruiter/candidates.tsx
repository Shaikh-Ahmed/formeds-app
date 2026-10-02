import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrustMark } from '../../src/components/TrustMark';
import { useSubmit } from '../../src/hooks/useSubmit';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Avatar, Button, EmptyState, ErrorBanner, FormInput, LoadingState, SelectField, Sheet } from '../../src/components';
import { ChoiceChips } from '../../src/components/locum/ChoiceChips';
import { colors, fonts, radius, spacing, typography, useBreakpoint } from '../../src/theme';
import {
  Card, Notice, RecruiterLockedNotice, RecruiterScreen, recruiterStyles,
} from '../../src/components/recruiters/RecruiterUI';
import {
  fetchCities, fetchSentInvitations, searchCandidates, sendInvitation, type CandidateQuery,
} from '../../src/api/recruiters';
import { fetchMyPostings } from '../../src/api/jobs';
import { fetchMyLocums } from '../../src/api/locum';
import { formatShiftDay } from '../../src/components/locum/LocumMeta';
import type { Candidate, CandidatePage } from '../../src/types/recruiters';

type Availability = 'any' | 'jobs' | 'locum';
const RADII = ['10', '25', '50', '100', '250'] as const;
interface Opening { key: string; label: string; job_id?: string; locum_id?: string }

/**
 * Consent-based candidate search. Only professionals who switched on
 * Recruiter Discovery appear; each shows their public card and an approximate
 * distance. Contact is by invitation only -- the professional decides whether
 * to apply.
 */
export default function FindTalentScreen() {
  const { token, isKycApproved } = useAuth();
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const params = useLocalSearchParams<{ job?: string; locum?: string; title?: string }>();

  const [q, setQ] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [role, setRole] = useState('');
  const [experience, setExperience] = useState('');
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState<typeof RADII[number]>('50');
  const [availability, setAvailability] = useState<Availability>(params.locum ? 'locum' : 'any');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [page, setPage] = useState<CandidatePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openings, setOpenings] = useState<Opening[]>([]);
  const [inviting, setInviting] = useState<Candidate | null>(null);
  const [opening, setOpening] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const guard = useSubmit();
  const [inviteError, setInviteError] = useState<string | null>(null);
  // professional id -> the openings they've already been invited to. Loaded
  // from the server so it survives a reload; the server refuses a second
  // invitation to the same opening in any case.
  const [invited, setInvited] = useState<Record<string, string[]>>({});

  const activeFilters = [specialty.trim(), role.trim(), experience, city, availability !== 'any' ? availability : '']
    .filter(Boolean).length;

  const search = useCallback(async (pageNo = 1) => {
    if (!token || !isKycApproved) return;
    setLoading(true); setError(null);
    const query: CandidateQuery = {
      q: q.trim(), specialty: specialty.trim(), role: role.trim(),
      experience_min: Number(experience) || undefined, availability, page: pageNo,
      ...(city ? { city, radius_km: Number(radius) } : {}),
    };
    try {
      const res = await searchCandidates(token, query);
      setPage(prev => (pageNo > 1 && prev ? { ...res, items: [...prev.items, ...res.items] } : res));
    } catch (e: any) {
      setError(e?.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [token, isKycApproved, q, specialty, role, experience, availability, city, radius]);

  useEffect(() => {
    if (!token || !isKycApproved) return;
    fetchCities(token).then(setCities).catch(() => {});
    Promise.all([fetchMyPostings(token).catch(() => []), fetchMyLocums(token).catch(() => [])]).then(([jobs, locums]) => {
      const list: Opening[] = [
        ...jobs.filter(j => j.status === 'active').map(j => ({
          key: `job:${j.id}`, label: [j.title, j.city].filter(Boolean).join(' · '), job_id: j.id,
        })),
        ...locums.filter(l => l.status === 'open').map(l => ({
          key: `locum:${l.id}`, label: `${l.specialty} locum · ${formatShiftDay(l.shift_date)}`, locum_id: l.id,
        })),
      ];
      // The picker works on labels, so two openings must never share one.
      const seen: Record<string, number> = {};
      setOpenings(list.map(o => {
        seen[o.label] = (seen[o.label] || 0) + 1;
        return seen[o.label] > 1 ? { ...o, label: `${o.label} (${seen[o.label]})` } : o;
      }));
    });
    fetchSentInvitations(token).then(sent => {
      const map: Record<string, string[]> = {};
      sent.forEach(inv => {
        const pid = inv.professional?.id;
        if (pid) map[pid] = [...(map[pid] || []), `${inv.target.kind}:${inv.target.id}`];
      });
      setInvited(map);
    }).catch(() => {});
    search(1);
    // Run once on entry; later searches are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isKycApproved]);

  // Openings this person can still be invited to: not already invited, and
  // of a kind they said they're open to (the server enforces the same).
  const openFor = useCallback((c: Candidate) => openings.filter(o =>
    !(invited[c.id] || []).includes(o.key) && (o.job_id ? c.open_to_jobs : c.available_for_locum)),
  [openings, invited]);
  const choices = useMemo(() => (inviting ? openFor(inviting) : []), [inviting, openFor]);

  const openInvite = (c: Candidate) => {
    const available = openFor(c);
    setInviting(c);
    setInviteError(null);
    setMessage('');
    const preset = params.job ? `job:${params.job}` : params.locum ? `locum:${params.locum}` : '';
    setOpening(available.find(o => o.key === preset)?.key ?? available[0]?.key ?? '');
  };

  const send = () => guard.run(key => sendOnce(key), { who: inviting?.id, opening, message });

  const sendOnce = async (key: string) => {
    if (!token || !inviting) return;
    const target = choices.find(o => o.key === opening);
    if (!target) { setInviteError('Choose an opening to invite them to.'); return; }
    setSending(true); setInviteError(null);
    try {
      await sendInvitation(token, {
        professional_id: inviting.id, job_id: target.job_id, locum_id: target.locum_id, message: message.trim(),
      }, key);
      setInvited(prev => ({ ...prev, [inviting.id]: [...(prev[inviting.id] || []), target.key] }));
      setInviting(null);
    } catch (e: any) {
      setInviteError(e?.message || 'Could not send the invitation.');
    } finally {
      setSending(false);
    }
  };

  if (!isKycApproved) {
    return (
      <RecruiterScreen title="Find talent" active="talent">
        <RecruiterLockedNotice feature="Candidate search and invitations" />
      </RecruiterScreen>
    );
  }

  const filterFields = (
    <>
      <View style={styles.twoCol}>
        <View style={styles.col}>
          <FormInput maxLength={100} label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="e.g. Cardiology"
            testID="candidate-specialty" />
        </View>
        <View style={styles.col}>
          <FormInput maxLength={80} label="Role" value={role} onChangeText={setRole} placeholder="e.g. Staff nurse" testID="candidate-role" />
        </View>
      </View>
      <View style={styles.twoCol}>
        <View style={styles.col}>
          <FormInput label="Min. years of experience" value={experience} keyboardType="number-pad"
            onChangeText={t => setExperience(t.replace(/\D/g, '').slice(0, 2))} placeholder="Any" testID="candidate-exp" />
        </View>
        <View style={styles.col}>
          <SelectField label="Near city" value={city} onChange={setCity} options={['', ...cities]}
            placeholder="Anywhere" searchPlaceholder="Search cities" testID="candidate-city" />
        </View>
      </View>
      {city ? (
        <ChoiceChips label="Within" value={radius} onChange={v => v && setRadius(v)}
          choices={RADII.map(r => ({ value: r, label: `${r} km` }))} testID="candidate-radius" />
      ) : null}
      <ChoiceChips label="Open to" value={availability} onChange={v => v && setAvailability(v)} testID="candidate-availability"
        choices={[{ value: 'any', label: 'Any' }, { value: 'jobs', label: 'Jobs' }, { value: 'locum', label: 'Locum' }]} />
    </>
  );

  const clearFilters = () => {
    setSpecialty(''); setRole(''); setExperience(''); setCity(''); setAvailability('any');
  };

  return (
    <RecruiterScreen title="Find talent" subtitle="Verified professionals who chose to be discoverable by recruiters." active="talent" testID="recruiter-candidates">
      {params.title ? (
        <Notice tone="neutral" title={`Inviting to: ${params.title}`}
          body="Choose professionals below; you can change the opening in the invitation." />
      ) : null}
      <Card>
        <FormInput maxLength={80} label="Name, role or keyword" icon="search-outline" value={q} onChangeText={setQ}
          placeholder="e.g. anaesthetist" returnKeyType="search" onSubmitEditing={() => search(1)}
          testID="candidate-q" />
        {isMobile ? (
          <View style={styles.mobileBar}>
            <Pressable onPress={() => setFiltersOpen(true)} accessibilityRole="button" testID="candidate-filters"
              accessibilityLabel={activeFilters ? `Filters, ${activeFilters} applied` : 'Filters'}
              style={({ pressed }) => [styles.filterBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="options-outline" size={18} color={colors.navy} />
              <Text style={styles.filterText}>Filters</Text>
              {activeFilters ? <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilters}</Text></View> : null}
            </Pressable>
            <Button label="Search" onPress={() => search(1)} loading={loading && !page?.items.length}
              style={styles.searchBtn} testID="candidate-search" />
          </View>
        ) : (
          <>
            {filterFields}
            <Button label="Search" onPress={() => search(1)} loading={loading && !page?.items.length} testID="candidate-search" />
          </>
        )}
      </Card>

      <ErrorBanner message={error} />

      {!page ? <LoadingState /> : page.items.length === 0 ? (
        <EmptyState icon="people-outline" title="No matching professionals"
          hint="Try a wider radius or fewer filters. Professionals appear here only after opting in." />
      ) : (
        <>
          <Text style={recruiterStyles.muted} testID="candidate-total">
            {page.total} professional{page.total === 1 ? '' : 's'} found
          </Text>
          {!openings.length ? (
            <Notice tone="neutral" title="Post an opening to start inviting"
              body="Invitations are always to a specific job or locum shift. Post one, then come back here." />
          ) : null}
          {page.items.map(c => {
            const left = openFor(c).length;
            const done = (invited[c.id] || []).length > 0 && left === 0;
            const nothingFits = !done && left === 0 && openings.length > 0;
            return (
              <View key={c.id} style={styles.cand} testID={`candidate-${c.id}`}>
                <Pressable onPress={() => router.push(`/profile/${c.id}` as any)} accessibilityRole="link"
                  accessibilityLabel={`View ${c.name}'s profile`} style={styles.candMain}>
                  <Avatar name={c.name} uri={c.avatar} size={48} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={recruiterStyles.row}>
                      <Text style={[recruiterStyles.strong, { flexShrink: 1 }]} numberOfLines={1}>{c.name}</Text>
                      {c.account_verified ? <TrustMark size={14} classicIcon="checkmark-circle" label="Verified professional" /> : null}
                    </View>
                    <Text style={recruiterStyles.muted} numberOfLines={1}>
                      {[c.professional_role, c.specialty].filter(Boolean).join(' · ') || 'Healthcare professional'}
                    </Text>
                    <Text style={recruiterStyles.muted} numberOfLines={1}>
                      <Ionicons name="location-outline" size={12} /> {c.city || 'City not shared'}
                      {c.distance_label ? ` · ${c.distance_label}` : ''}
                      {c.years_experience ? ` · ${c.years_experience} yrs` : ''}
                    </Text>
                    <View style={[recruiterStyles.row, { marginTop: 4 }]}>
                      {c.open_to_jobs ? <Tag label="Open to jobs" /> : null}
                      {c.available_for_locum ? <Tag label="Available for locum" /> : null}
                    </View>
                  </View>
                </Pressable>
                <Button label={done ? '✓ Invited' : 'Invite'} variant={done ? 'outline' : 'secondary'}
                  onPress={() => openInvite(c)} style={styles.inviteBtn} testID={`candidate-invite-${c.id}`}
                  disabled={done || nothingFits || !openings.length} />
                {nothingFits ? (
                  <Text style={[recruiterStyles.muted, styles.fullRow]}>
                    {c.open_to_jobs ? 'Open to jobs only — you have no active jobs.' : 'Open to locum only — you have no open shifts.'}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {page.has_more ? (
            <Button label="Load more" variant="outline" onPress={() => search(page.page + 1)} loading={loading} />
          ) : null}
        </>
      )}

      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" testID="candidate-filter-sheet"
        footer={(
          <View style={styles.sheetFooter}>
            <Button label="Clear" variant="outline" onPress={clearFilters} style={styles.sheetBtn} />
            <Button label="Show results" onPress={() => { setFiltersOpen(false); search(1); }} style={styles.sheetBtn}
              testID="candidate-filters-apply" />
          </View>
        )}>
        <View style={{ padding: spacing.lg }}>{filterFields}</View>
      </Sheet>

      <Sheet visible={!!inviting} onClose={() => setInviting(null)} title={`Invite ${inviting?.name ?? ''}`}
        footer={(
          <View style={styles.sheetFooter}>
            <Button label="Send invitation" onPress={send} loading={sending} style={styles.sheetBtn} testID="invite-send" />
          </View>
        )}>
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={inviteError} />
          <SelectField label="Opening" value={choices.find(o => o.key === opening)?.label ?? ''}
            options={choices.map(o => o.label)} placeholder="Choose a job or shift" testID="invite-opening"
            onChange={label => setOpening(choices.find(o => o.label === label)?.key ?? '')} />
          <FormInput label="Personal note (optional)" value={message} onChangeText={setMessage} rows={4} multiline
            maxLength={1000} placeholder="Why you think they'd be a good fit" testID="invite-message" />
          <Text style={recruiterStyles.muted}>
            They&apos;ll see your agency and this opening, and can apply if interested. Invitations expire after 14 days.
          </Text>
        </View>
      </Sheet>
    </RecruiterScreen>
  );
}

function Tag({ label }: { label: string }) {
  return <View style={styles.tag}><Text style={styles.tagText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  twoCol: { flexDirection: 'row', columnGap: spacing.md, flexWrap: 'wrap' },
  col: { flexGrow: 1, flexBasis: 200 },
  mobileBar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  filterText: { fontSize: 15, fontFamily: fonts.body.semibold, color: colors.navy },
  filterCount: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 5,
  },
  filterCountText: { color: colors.white, fontSize: 12, fontFamily: fonts.body.bold },
  searchBtn: { flex: 1 },
  sheetFooter: { flexDirection: 'row', gap: spacing.sm },
  sheetBtn: { flex: 1 },
  cand: {
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md,
  },
  candMain: { flexDirection: 'row', gap: spacing.md, flexGrow: 1, flexBasis: 240, minWidth: 0 },
  inviteBtn: { flexGrow: 0, minWidth: 120 },
  fullRow: { flexBasis: '100%' },
  tag: { backgroundColor: colors.tealBg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  tagText: { ...typography.small, color: colors.teal },
});
