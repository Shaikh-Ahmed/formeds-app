import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { AuthCardContext } from './authCardContext';
import { colors, spacing, radius, typography, useBreakpoint } from '../../theme';

/**
 * Desktop chrome for the signed-out screens.
 *
 * A phone auth screen is a single centred column, which in a 1440px browser
 * leaves a form floating in an empty field with nothing identifying the
 * product. This puts the brand on a fixed left panel and the form in a card
 * beside it — the layout a professional service is expected to have — while
 * mobile renders the children exactly as before.
 *
 * The user chose an auth gateway over a marketing homepage, so the left panel
 * states what ForMeds is and stops. No feature pitch, no testimonials.
 */
export function AuthShell({
  children,
  /** Cap for the form card. Registration is longer and wants a bit more room. */
  maxWidth = 460,
  /**
   * Give the card a definite height.
   *
   * Required whenever a child uses `flex: 1` — every auth screen wraps its
   * form in a flex KeyboardAvoidingView, and `flex: 1` resolves `flex-basis`
   * to 0 against an auto-height parent, collapsing the card to nothing.
   * Screens whose content is plain, self-sizing markup pass `fill={false}` so
   * the card hugs its content instead of leaving dead space below it.
   */
  fill = true,
  testID,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  fill?: boolean;
  testID?: string;
}) {
  const { isMobile } = useBreakpoint();

  if (isMobile) return <>{children}</>;

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.brandPanel}>
        <View style={styles.brandInner}>
          {/* The reversed logo -- white lettering, teal mark, transparent
              background -- made for dark surfaces like this panel. */}
          <Image
            source={require('../../../assets/images/formeds-logo-white.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="ForMeds"
          />
          <Text style={styles.tagline} accessibilityRole="header">
            India&apos;s first integrated healthcare platform
          </Text>
          <Text style={styles.mission}>
            Ensuring access to medical care is driven by need, not geography.
          </Text>

          <View style={styles.points}>
            <Point text="A verified-only network of professionals, hospitals and clinics" />
            <Point text="Clinical cases, discussion and peer answers" />
            <Point text="Permanent roles and locum shifts in one place" />
          </View>
        </View>
      </View>

      {/* The card grows with its form and never scrolls on its own -- a
          scrollbar inside a card reads as broken. If the window is too short
          for the form, this panel scrolls instead, like any web page. The
          screen's own ScrollView renders as a plain view in here (see
          AuthCardContext), and +html.tsx keeps its wrapper from collapsing. */}
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formPanel}>
        <AuthCardContext.Provider value>
          <View style={[styles.card, { maxWidth }]} nativeID="auth-card">{children}</View>
        </AuthCardContext.Provider>
      </ScrollView>
    </View>
  );
}

/**
 * Two fields side by side on desktop, stacked on a phone. Lets the longer
 * sign-up forms fit the card without a scrollbar inside it.
 */
export function AuthRow({ children }: { children: React.ReactNode }) {
  const { isMobile } = useBreakpoint();
  if (isMobile) return <>{children}</>;
  return (
    <View style={styles.row}>
      {React.Children.toArray(children).map((child, i) => (
        <View key={i} style={styles.rowItem}>{child}</View>
      ))}
    </View>
  );
}

/** Back button and the account-type badge on one line, on every width. */
export function AuthTopRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.topRow}>{children}</View>;
}

function Point({ text }: { text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.dot} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },

  brandPanel: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl + 16,
    // Below ~1024px the panel would squeeze the form; capping it keeps the
    // form card at a comfortable width on smaller laptops.
    maxWidth: 520,
  },
  brandInner: { gap: spacing.md },
  // The image's own 3.34:1 shape, so it sits flush with the text below.
  logo: { width: 167, height: 50, marginBottom: spacing.lg },
  tagline: { ...typography.h2, color: colors.white, lineHeight: 30 },
  mission: { ...typography.body, color: '#B6C6D8', lineHeight: 22 },
  points: { marginTop: spacing.xl, gap: spacing.md },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.tealLight, marginTop: 8 },
  pointText: { ...typography.caption, color: '#B6C6D8', flex: 1, lineHeight: 20 },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },

  formScroll: { flex: 1 },
  formPanel: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.xl + 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    // Horizontal padding is deliberately omitted: each auth screen's own
    // ScrollView already applies it, and doubling it made the fields narrow.
    paddingVertical: spacing.xl,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});
