import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, useBreakpoint } from '../../src/theme';

/**
 * Floating AED entry point — phones only.
 * On desktop the same action lives in the right rail as AedCard, where it can
 * carry a label instead of hovering over the layout as a bare red circle.
 */
function AEDBubble() {
  const router = useRouter();
  return (
    <TouchableOpacity
      testID="aed-bubble-btn"
      style={bubbleStyles.bubble}
      onPress={() => router.push('/aed-chat')}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Open AED Assist"
    >
      <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const bubbleStyles = StyleSheet.create({
  bubble: { position: 'absolute', bottom: 80, right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: '#E84545', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#E84545', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, zIndex: 999 },
});

export default function TabLayout() {
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const role = user?.role || 'healthcare_professional';

  // The desktop TopBar is mounted in app/_layout.tsx, not here — it has to
  // survive navigation to stack routes like /messages that sit outside this
  // group.
  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.navy,
          tabBarInactiveTintColor: colors.textMuted,
          // The bottom bar is a phone idiom. Above 768px the TopBar owns
          // navigation, so this is hidden rather than duplicated.
          tabBarStyle: isMobile
            ? { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, height: 60, paddingBottom: 8, paddingTop: 4 }
            : { display: 'none' },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        {/* "chatbubbles", not "people" — the Specialists tab already owns the
            people glyph, and these read as the same shape at tab-bar size. */}
        <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} /> }} />
        <Tabs.Screen name="jobs" options={{
          title: role === 'hospital' ? 'Postings' : 'Jobs',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
          href: role === 'clinic' ? null : '/(tabs)/jobs',
        }} />
        <Tabs.Screen name="learning" options={{
          title: 'Learning',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
          href: role === 'healthcare_professional' ? '/(tabs)/learning' : null,
        }} />
        <Tabs.Screen name="specialists" options={{
          title: role === 'clinic' ? 'Listings' : 'Specialists',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          href: role === 'hospital' ? null : '/(tabs)/specialists',
        }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
      </Tabs>

      {isMobile && <AEDBubble />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
