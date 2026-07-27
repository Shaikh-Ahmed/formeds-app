import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../src/components';
import { colors, spacing, typography, radius, MIN_TOUCH_TARGET } from '../src/theme';

const SUPPORT_EMAIL = 'support@formeds.in';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I get verified?',
    a: 'Open your Profile and submit your NMC registration (professionals) or ROHINI ID (hospitals and clinics) along with a supporting document. Our team reviews every submission manually, usually within a couple of working days.',
  },
  {
    q: 'Why can\'t I message someone?',
    a: 'Messaging is only available between connected members. Search for the person under People, send a connection request, and you can message once they accept.',
  },
  {
    q: 'I didn\'t receive my verification email.',
    a: 'Check your spam folder first. You can request a new link from your Profile. If it still doesn\'t arrive, email us and we\'ll confirm your address manually.',
  },
  {
    q: 'How do job applications work?',
    a: 'Hospitals post permanent roles and locum shifts. Applying notifies the hospital directly, and you can track every application under Jobs → My Applications.',
  },
  {
    q: 'Is the AED assistant a medical authority?',
    a: 'No. AED is an AI assistant for quick reference between shifts. It can be wrong, and final clinical decisions always rest with the treating professional.',
  },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Help & Support" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Common questions, and how to reach a human if you need one.</Text>

        {FAQS.map((faq, i) => {
          const expanded = open === i;
          return (
            <View key={faq.q} style={styles.card}>
              <TouchableOpacity
                style={styles.qRow}
                onPress={() => setOpen(expanded ? null : i)}
                accessibilityRole="button"
                accessibilityLabel={faq.q}
                accessibilityState={{ expanded }}
              >
                <Text style={styles.q}>{faq.q}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
              {expanded ? <Text style={styles.a}>{faq.a}</Text> : null}
            </View>
          );
        })}

        <View style={styles.contact}>
          <Ionicons name="mail-outline" size={24} color={colors.navy} />
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactBody}>Email our support team and we&apos;ll get back to you.</Text>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            accessibilityRole="button"
            accessibilityLabel={`Email support at ${SUPPORT_EMAIL}`}
          >
            <Text style={styles.contactBtnText}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  qRow: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET + 8, gap: spacing.md },
  q: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  a: { ...typography.body, color: colors.textSecondary, lineHeight: 22, paddingBottom: spacing.lg },
  contact: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs },
  contactTitle: { ...typography.h3, color: colors.text, marginTop: spacing.sm },
  contactBody: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  contactBtn: { marginTop: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.bgMuted, borderRadius: radius.md, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  contactBtnText: { ...typography.bodyStrong, color: colors.navy },
});
