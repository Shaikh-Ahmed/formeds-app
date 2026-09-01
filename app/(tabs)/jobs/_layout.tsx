import { Stack } from 'expo-router';

/**
 * Everything under Jobs lives in ONE route tree.
 *
 * Discover, Saved, Applications, Posted and the detail page are siblings here,
 * so expo-router's static-beats-dynamic ranking applies between them and
 * `/jobs/saved` can never be read as a job whose id is "saved". Splitting the
 * detail out to a top-level `app/jobs/[id].tsx` would break that, because the
 * `(tabs)` group is stripped from the URL and the two trees would collide at
 * the same path.
 *
 * Keeping the detail inside the tab also keeps the bottom tab bar mounted on
 * it, which is why the pinned Apply bar has to clear TAB_BAR_HEIGHT.
 */
export default function JobsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="saved" />
      <Stack.Screen name="applications" />
      <Stack.Screen name="posted" />
      <Stack.Screen name="[id]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
