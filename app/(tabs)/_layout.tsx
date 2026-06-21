import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

function AEDBubble() {
  const router = useRouter();
  return (
    <TouchableOpacity testID="aed-bubble-btn" style={bubbleStyles.bubble} onPress={() => router.push('/aed-chat')} activeOpacity={0.8}>
      <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const bubbleStyles = StyleSheet.create({
  bubble: { position: 'absolute', bottom: 80, right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: '#E84545', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#E84545', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, zIndex: 999 },
});

export default function TabLayout() {
  const { user } = useAuth();
  const role = user?.role || 'healthcare_professional';

  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A3A5C',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
        <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} /> }} />
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
      <AEDBubble />
    </View>
  );
}
