import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
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
          {/* The logo is a transparent PNG whose lettering is brand navy — the
              same colour as this panel — so it must sit on a light chip. Placed
              directly on navy it renders as an invisible rectangle. */}
          <View style={styles.logoChip}>
            <Image
              source={require('../../../assets/images/formeds-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="ForMeds"
            />
          </View>
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

      {/* No ScrollView here: every auth screen already owns one, and nesting
          two scroll containers on web produces a card that scrolls its own
          scrollbar. The card is height-capped instead and the child scrolls
          inside it. */}
      <View style={styles.formPanel}>
        <View style={[styles.card, { maxWidth }, fill && styles.cardFill]}>{children}</View>
      </View>
    </View>
  );
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
  logoChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  logo: { width: 168, height: 48 },
  tagline: { ...typography.h2, color: colors.white, lineHeight: 30 },
  mission: { ...typography.body, color: '#B6C6D8', lineHeight: 22 },
  points: { marginTop: spacing.xl, gap: spacing.md },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.tealLight, marginTop: 8 },
  pointText: { ...typography.caption, color: '#B6C6D8', flex: 1, lineHeight: 20 },

  formPanel: {
    flex: 1,
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
  // Fills the panel but stops growing on tall monitors, where a 1300px-tall
  // card holding a six-field form reads as a rendering mistake.
  cardFill: { height: '100%', maxHeight: 720 },
});
