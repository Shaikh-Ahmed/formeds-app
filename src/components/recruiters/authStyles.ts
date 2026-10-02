import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

/** Shared by the recruiter sign-up and sign-in screens; mirrors register.tsx. */
export const authStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  backBtn: {
    width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.bgMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.lg - 2, paddingVertical: spacing.sm, borderRadius: radius.pill, marginBottom: spacing.lg,
  },
  badgeText: { ...typography.label },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.lg, minHeight: 44 },
  linkText: { ...typography.body, color: colors.textSecondary },
  linkBold: { fontWeight: '700', color: colors.navy },
  linkBtnSmall: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  linkSmall: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
