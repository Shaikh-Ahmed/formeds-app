import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Tokens live in the OS keychain/keystore on native. SecureStore is unavailable
// on web, where AsyncStorage (localStorage) is the only option.
const useSecureStore = Platform.OS !== 'web';

export async function getItem(key: string): Promise<string | null> {
  if (useSecureStore) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

/** One-time migration: move a token previously saved in AsyncStorage into SecureStore. */
export async function migrateFromAsyncStorage(key: string): Promise<void> {
  if (!useSecureStore) return;
  try {
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      const existing = await SecureStore.getItemAsync(key);
      if (!existing) await SecureStore.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // Best-effort: a failed migration just means the user logs in again.
  }
}
