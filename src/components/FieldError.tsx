import React, { useContext, useEffect, useId, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { FormScrollContext, registerInvalidField } from '../utils/invalidFields';

/**
 * The one way a field says what is wrong with it: directly under the field,
 * an icon as well as colour (never colour alone), announced to screen readers.
 *
 * `useFieldError` gives the input the matching aria props, so the message is
 * read out with the field and the field is findable by focusFirstInvalid().
 * On iOS and Android, where there is no DOM to search, the message registers
 * itself instead -- with the FormScrollView around it and, via `onFocusField`,
 * the input to focus -- so a failed submit can scroll to it.
 */
export function FieldError({ message, id, onFocusField }: {
  message?: string | null;
  id?: string;
  /** Focuses the input this message belongs to (native reveal). */
  onFocusField?: () => void;
}) {
  const anchor = useRef<View>(null);
  const scroll = useContext(FormScrollContext);
  const focusRef = useRef(onFocusField);
  focusRef.current = onFocusField;

  useEffect(() => {
    if (!message) return;
    return registerInvalidField({ anchor, scroll, focus: () => focusRef.current?.() });
  }, [message, scroll]);

  if (!message) return null;
  return (
    <View style={styles.row} ref={anchor}>
      <Ionicons name="alert-circle" size={14} color={colors.redText} style={styles.icon} />
      <Text style={styles.text} accessibilityRole="alert" accessibilityLiveRegion="polite" nativeID={id}>
        {message}
      </Text>
    </View>
  );
}

/** An id for a field's error plus the aria props its input should carry. */
export function useFieldError(error?: string | null) {
  const id = `field-error-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const inputProps = error
    ? ({ 'aria-invalid': true, 'aria-describedby': id } as Record<string, unknown>)
    : ({} as Record<string, unknown>);
  return { id, inputProps };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 },
  icon: { marginTop: 2 },
  text: { flex: 1, color: colors.redText, fontSize: 13, lineHeight: 18 },
});
