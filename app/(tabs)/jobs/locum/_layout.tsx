import { Stack } from 'expo-router';

/**
 * Locum's routes, nested under Jobs so the Jobs tab stays selected and the
 * bottom bar stays mounted.
 *
 * A nested Stack rather than entries in `jobs/_layout.tsx`: the Jobs route
 * tree is left exactly as it was. `/jobs/locum` is a static segment, so
 * expo-router ranks it above `/jobs/[id]` and it can never be read as a job id.
 */
export default function LocumLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="applications" />
      <Stack.Screen name="mine" />
      <Stack.Screen name="applicants" />
      <Stack.Screen name="[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="manage/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="edit/[id]" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
