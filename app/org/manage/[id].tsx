import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../../../src/theme';
import { PageColumn } from '../../../src/components/web';
import {
  Avatar, Button, EmptyState, ErrorBanner, ErrorState, FormInput, LoadingState, Sheet,
} from '../../../src/components';
import { OrgForm } from '../../../src/components/organizations/OrgForm';
import { OrgVerifiedBadge } from '../../../src/components/organizations/OrgVerifiedBadge';
import {
  fetchOrgMembers, fetchOrganization, inviteMember, removeMember,
  setMemberRole, submitOrgKyc, updateOrganization,
} from '../../../src/api/organizations';
import { shareLink } from '../../../src/utils/share';
import { API_URL } from '../../../src/utils/api';
import {
  ORG_ROLE_HINTS, ORG_ROLE_LABELS, type OrgMember, type OrgRole, type Organization,
} from '../../../src/types/organizations';

type Tab = 'details' | 'people' | 'verification';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'details', label: 'Details', icon: 'business-outline' },
  { key: 'people', label: 'People', icon: 'people-outline' },
  { key: 'verification', label: 'Verification', icon: 'shield-checkmark-outline' },
];

const ROLES: OrgRole[] = ['recruiter', 'admin', 'owner'];

// Mirrors services/files.py MAX_DOCUMENT_BYTES.
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * Managing an organisation: what it is, who can act for it, and whether it has
 * been reviewed.
 *
 * The three tabs are separated because they answer to different permissions —
 * a recruiter sees the page but edits nothing, an admin edits details and
 * people, only an owner can submit for verification or appoint another owner.
 * The server enforces all of that; this screen simply avoids offering controls
 * that would come back 403.
 */
export default function ManageOrganizationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('details');
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('recruiter');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [regNumber, setRegNumber] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) { setLoading(false); return; }
    setError(null);
    try {
      const [o, m] = await Promise.all([
        fetchOrganization(token, id),
        fetchOrgMembers(token, id).catch(() => []),
      ]);
      setOrg(o);
      setMembers(m);
    } catch (e: any) {
      setError(e?.message || 'Could not load this organisation.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (payload: Record<string, unknown>) => {
    if (!token || !id) return;
    setSaving(true);
    setActionError(null);
    try {
      setOrg(await updateOrganization(token, id, payload));
    } catch (e: any) {
      setActionError(e?.message || 'Could not save these changes.');
    } finally {
      setSaving(false);
    }
  }, [token, id]);

  const sendInvite = useCallback(async () => {
    if (!token || !id) return;
    setInviting(true);
    setActionError(null);
    try {
      const res = await inviteMember(token, id, inviteEmail.trim(), inviteRole);
      // The token comes back to the INVITER, who shares the link. It never
      // appears in the members list, because anyone holding it can join.
      setInviteLink(`${API_URL.replace(/\/$/, '')}/org/invite/${res.invite_token}`);
      setInviteEmail('');
      await load();
    } catch (e: any) {
      setActionError(e?.message || 'Could not send that invitation.');
    } finally {
      setInviting(false);
    }
  }, [token, id, inviteEmail, inviteRole, load]);

  const changeRole = useCallback(async (member: OrgMember, role: OrgRole) => {
    if (!token || !id) return;
    setActionError(null);
    const previous = members;
    setMembers(prev => prev.map(m => (m.id === member.id ? { ...m, role } : m)));
    try {
      await setMemberRole(token, id, member.id, role);
    } catch (e: any) {
      setMembers(previous);
      setActionError(e?.message || 'Could not change that role.');
    }
  }, [token, id, members]);

  const drop = useCallback(async (member: OrgMember) => {
    if (!token || !id) return;
    setActionError(null);
    const previous = members;
    setMembers(prev => prev.filter(m => m.id !== member.id));
    try {
      await removeMember(token, id, member.id);
    } catch (e: any) {
      setMembers(previous);
      setActionError(e?.message || 'Could not remove that person.');
    }
  }, [token, id, members]);

  /**
   * Uses the photo library, exactly as the personal KYC screen does. The server
   * also accepts a PDF, but adding expo-document-picker for that would be a new
   * dependency for a path a phone camera already covers — a photograph of a
   * certificate is what people actually submit.
   */
  const pickAndSubmitDocument = useCallback(async () => {
    if (!token || !id) return;
    setActionError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setActionError('Photo access is needed to attach the certificate. Enable it in Settings.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const asset = picked.assets[0];
    // Caught here rather than after a slow upload that fails at the far end.
    if (asset.fileSize && asset.fileSize > MAX_DOCUMENT_BYTES) {
      setActionError('That file is larger than 10MB. Please attach a smaller photo.');
      return;
    }

    setSubmittingKyc(true);
    try {
      await submitOrgKyc(token, id, {
        uri: asset.uri,
        registrationNumber: regNumber.trim(),
      });
      await load();
    } catch (e: any) {
      setActionError(e?.message || 'Could not submit the document.');
    } finally {
      setSubmittingKyc(false);
    }
  }, [token, id, regNumber, load]);

  if (loading) return <LoadingState label="Loading organisation…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!org) return null;

  const isOwner = org.my_role === 'owner';
  const canEdit = !!org.can_edit;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn testID="org-manage-column">
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace(`/org/${org.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel="Back to the organisation page"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>{org.name}</Text>
            <Text style={styles.headerSub}>
              {org.my_role ? ORG_ROLE_LABELS[org.my_role] : 'Member'}
            </Text>
          </View>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map(t => (
            <Pressable
              key={t.key}
              testID={`org-tab-${t.key}`}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              accessibilityLabel={t.label}
              style={({ pressed }) => [
                styles.tab, tab === t.key && styles.tabOn, pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={tab === t.key ? colors.white : colors.textSecondary}
              />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.notice}><ErrorBanner message={actionError} /></View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {tab === 'details' ? (
            canEdit ? (
              <OrgForm
                initial={org}
                submitLabel="Save changes"
                submitting={saving}
                onSubmit={save}
              />
            ) : (
              <EmptyState
                icon="lock-closed-outline"
                title="View only"
                hint="Editing the organisation needs the admin or owner role."
              />
            )
          ) : null}

          {tab === 'people' ? (
            <View style={styles.section}>
              {canEdit ? (
                <Button
                  label="Invite someone"
                  onPress={() => { setInviteLink(null); setInviteOpen(true); }}
                  testID="org-invite-open"
                />
              ) : null}

              {members.map(m => (
                <View key={m.id} style={styles.memberCard} testID={`org-member-${m.id}`}>
                  <Avatar name={m.name} uri={m.avatar || undefined} size={40} />
                  <View style={styles.memberText}>
                    <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                    <Text style={styles.memberMeta} numberOfLines={1}>
                      {ORG_ROLE_LABELS[m.role]}
                      {m.status === 'invited' ? ' · invitation pending' : ''}
                    </Text>
                  </View>
                  {canEdit ? (
                    <View style={styles.memberActions}>
                      {ROLES.filter(r => r !== m.role && (r !== 'owner' || isOwner)).map(r => (
                        <Pressable
                          key={r}
                          testID={`org-role-${m.id}-${r}`}
                          onPress={() => changeRole(m, r)}
                          accessibilityRole="button"
                          accessibilityLabel={`Make ${m.name} ${ORG_ROLE_LABELS[r]}`}
                          style={({ pressed }) => [styles.roleBtn, pressed && styles.pressed]}
                        >
                          <Text style={styles.roleBtnText}>{ORG_ROLE_LABELS[r]}</Text>
                        </Pressable>
                      ))}
                      <Pressable
                        testID={`org-remove-${m.id}`}
                        onPress={() => drop(m)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${m.name}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                      >
                        <Ionicons name="close" size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'verification' ? (
            <View style={styles.section}>
              <OrgVerifiedBadge status={org.verification_status} />

              {org.verification_status === 'verified' ? (
                <Text style={styles.prose}>
                  This organisation has been reviewed. The badge appears on your page
                  and on every role you post.
                </Text>
              ) : org.verification_status === 'pending' ? (
                <Text style={styles.prose}>
                  Your document is with our reviewers. This usually takes a couple of
                  working days, and you can keep posting in the meantime.
                </Text>
              ) : !isOwner ? (
                <EmptyState
                  icon="lock-closed-outline"
                  title="Owner only"
                  hint="Submitting for verification needs the owner role."
                />
              ) : (
                <>
                  <Text style={styles.prose}>
                    Attach a photo of your registration certificate — a ROHINI ID, a facility
                    licence or an equivalent document. A reviewer checks it by hand, and the
                    badge appears only once it is approved.
                  </Text>
                  {org.verification_status === 'rejected' ? (
                    <Text style={styles.rejected}>
                      The last submission was declined. Correct the document and try again.
                    </Text>
                  ) : null}
                  <FormInput
                    label="Registration or licence number"
                    value={regNumber}
                    onChangeText={setRegNumber}
                    placeholder="e.g. ROHINI-1234567"
                    testID="org-reg-number"
                  />
                  <Button
                    label="Attach certificate and submit"
                    onPress={pickAndSubmitDocument}
                    loading={submittingKyc}
                    disabled={regNumber.trim().length < 3}
                    testID="org-kyc-submit"
                  />
                  <Text style={styles.hint}>
                    Stored privately. Only a reviewer can open it, through a link that
                    expires in five minutes.
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </PageColumn>

      <Sheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite someone"
        testID="org-invite-sheet"
        footer={
          inviteLink ? (
            <Button
              label="Share invitation link"
              onPress={() => shareLink({
                url: inviteLink,
                title: `Join ${org.name} on ForMeds`,
              })}
              style={styles.flex}
            />
          ) : (
            <>
              <Button label="Cancel" variant="outline" onPress={() => setInviteOpen(false)}
                style={styles.flex} />
              <Button
                label="Create invitation"
                onPress={sendInvite}
                loading={inviting}
                disabled={!inviteEmail.includes('@')}
                style={styles.flex}
                testID="org-invite-send"
              />
            </>
          )
        }
      >
        <View style={styles.sheetBody}>
          {inviteLink ? (
            <>
              <Text style={styles.prose}>
                Invitation created. Share this link with them — it works once, and only
                for the address you entered.
              </Text>
              <Text style={styles.link} selectable numberOfLines={3}>{inviteLink}</Text>
            </>
          ) : (
            <>
              <FormInput
                label="Their email address"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="colleague@hospital.org"
                autoCapitalize="none"
                keyboardType="email-address"
                testID="org-invite-email"
              />
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleRow}>
                {ROLES.filter(r => r !== 'owner' || isOwner).map(r => (
                  <Pressable
                    key={r}
                    testID={`org-invite-role-${r}`}
                    onPress={() => setInviteRole(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: inviteRole === r }}
                    accessibilityLabel={`${ORG_ROLE_LABELS[r]}. ${ORG_ROLE_HINTS[r]}`}
                    style={({ pressed }) => [
                      styles.roleChip, inviteRole === r && styles.roleChipOn, pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.roleChipText, inviteRole === r && styles.roleChipTextOn]}>
                      {ORG_ROLE_LABELS[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>{ORG_ROLE_HINTS[inviteRole]}</Text>
            </>
          )}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { ...typography.h3, color: colors.text },
  headerSub: { ...typography.small, color: colors.textSecondary },

  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 36,
  },
  tabOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { ...typography.small, color: colors.textSecondary },
  tabTextOn: { color: colors.white, fontFamily: fonts.body.semibold },

  notice: { paddingHorizontal: spacing.lg },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  section: { gap: spacing.md },
  prose: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  rejected: { ...typography.caption, color: colors.redText },
  label: { ...typography.label, color: colors.text },
  hint: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  link: { ...typography.caption, color: colors.navy },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexWrap: 'wrap',
  },
  memberText: { flex: 1, minWidth: 120, gap: 2 },
  memberName: { ...typography.bodyStrong, color: colors.text },
  memberMeta: { ...typography.small, color: colors.textSecondary },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  roleBtn: {
    paddingHorizontal: spacing.sm + 2,
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleBtnText: { ...typography.small, color: colors.textSecondary },
  removeBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },

  sheetBody: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleChip: {
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  roleChipText: { ...typography.caption, color: colors.textSecondary },
  roleChipTextOn: { color: colors.white, fontFamily: fonts.body.semibold },
  pressed: { opacity: 0.7 },
});
