import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList,
  KeyboardAvoidingView, Platform, useWindowDimensions,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, fonts, MIN_TOUCH_TARGET } from '../theme';

/**
 * A single-choice field backed by a searchable sheet.
 *
 * The existing `select` in `EntrySheet` lays its options out as chips, which
 * works for the five or six an employment type has and falls apart at the ~900
 * of an Indian city list. This is the long-list counterpart: the field itself
 * stays one row tall, and the options open in a sheet you can type into.
 *
 * The sheet is sized from `useWindowDimensions`, so rotating a phone or
 * resizing a browser re-measures it rather than leaving a sheet taller than the
 * screen — the case that actually breaks a picker in landscape.
 */

const SEARCH_THRESHOLD = 8;

export interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Blocks opening the sheet — e.g. a city list with no state chosen yet. */
  disabled?: boolean;
  /** Shown in place of the placeholder while disabled, saying what to do first. */
  disabledHint?: string;
  /** Small print under the field. */
  helper?: string;
  searchPlaceholder?: string;
  /** Sheet heading; falls back to the label. */
  title?: string;
  /**
   * Suppresses the built-in label so a host that already draws its own — the
   * profile EntrySheet does — gets one label, in its own type. `label` is still
   * required and still names the control for screen readers.
   */
  hideLabel?: boolean;
  /** Outer spacing, for hosts that space their fields themselves. */
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SelectField({
  label, value, onChange, options, placeholder = 'Select…', icon,
  disabled = false, disabledHint, helper, searchPlaceholder = 'Search…',
  title, hideLabel = false, containerStyle, testID,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const searchable = options.length > SEARCH_THRESHOLD;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Prefix matches first: typing "Ka" should reach Kakinada before Alappuzha,
    // which only matches on a syllable buried mid-word.
    const starts: string[] = [];
    const contains: string[] = [];
    for (const option of options) {
      const haystack = option.toLowerCase();
      if (haystack.startsWith(q)) starts.push(option);
      else if (haystack.includes(q)) contains.push(option);
    }
    return [...starts, ...contains];
  }, [options, query]);

  const close = () => { setOpen(false); setQuery(''); };
  const pick = (option: string) => { onChange(option); close(); };

  // Leave room for the status bar and, in landscape, for the keyboard the
  // search field raises. A fixed pixel height strands the list off-screen.
  const sheetMaxHeight = Math.max(240, Math.round(windowHeight * 0.8));

  return (
    <View style={[styles.group, containerStyle]}>
      {hideLabel ? null : <Text style={styles.label}>{label}</Text>}

      <Pressable
        testID={testID}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value || 'Nothing selected'}`}
        accessibilityHint={disabled ? disabledHint : 'Opens a list of options'}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.triggerDisabled,
          pressed && !disabled && styles.triggerPressed,
        ]}
      >
        {icon ? <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.icon} /> : null}
        <Text
          style={[styles.triggerText, !value && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {value || (disabled && disabledHint ? disabledHint : placeholder)}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={disabled ? colors.border : colors.textMuted}
        />
      </Pressable>

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        supportedOrientations={['portrait', 'landscape']}
      >
        {/* Tapping the scrim closes, but the sheet swallows the press so a tap
            inside it never dismisses by accident. */}
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close options">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.scrimInner}
          >
            <Pressable
              style={[
                styles.sheet,
                { maxHeight: sheetMaxHeight, width: Math.min(windowWidth - spacing.xxl, 520) },
              ]}
              // A no-op press handler is what stops the scrim's press from
              // firing through; it is not itself a control.
              onPress={() => {}}
              accessibilityViewIsModal
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{title || label}</Text>
                <Pressable
                  testID={testID ? `${testID}-close` : undefined}
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.sheetClose}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              {searchable ? (
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    testID={testID ? `${testID}-search` : undefined}
                    style={styles.searchInput}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    accessibilityLabel={`Search ${label.toLowerCase()}`}
                  />
                  {query ? (
                    <Pressable
                      onPress={() => setQuery('')}
                      accessibilityRole="button"
                      accessibilityLabel="Clear search"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <FlatList
                data={results}
                keyExtractor={item => item}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                style={styles.list}
                renderItem={({ item }) => {
                  const selected = item === value;
                  return (
                    <Pressable
                      testID={testID ? `${testID}-option-${item}` : undefined}
                      onPress={() => pick(item)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item}
                      style={({ pressed }) => [
                        styles.option,
                        pressed && styles.optionPressed,
                        selected && styles.optionSelected,
                      ]}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {item}
                      </Text>
                      {/* A tick as well as the tint: colour alone should never
                          be the only marker of the current choice. */}
                      {selected ? (
                        <Ionicons name="checkmark" size={18} color={colors.navy} />
                      ) : null}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Nothing matches “{query.trim()}”.</Text>
                  </View>
                }
              />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches FormInput so a form mixing the two reads as one set of fields.
  group: { marginBottom: spacing.lg + 2 },
  label: { ...typography.label, color: '#334155', marginBottom: 6 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg - 2,
    minHeight: Math.max(MIN_TOUCH_TARGET, 52),
  },
  triggerPressed: { backgroundColor: colors.bgMuted, borderColor: colors.textMuted },
  triggerDisabled: { opacity: 0.6 },
  icon: { marginRight: spacing.xs },
  triggerText: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md },
  triggerPlaceholder: { color: colors.textMuted },
  helper: { ...typography.small, color: colors.textMuted, marginTop: 4 },

  scrim: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  scrimInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  sheetClose: { padding: spacing.xs },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  optionPressed: { backgroundColor: colors.bgMuted },
  optionSelected: { backgroundColor: colors.bg },
  optionText: { ...typography.body, color: colors.text, flex: 1 },
  optionTextSelected: { fontFamily: fonts.body.semibold, color: colors.navy },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
