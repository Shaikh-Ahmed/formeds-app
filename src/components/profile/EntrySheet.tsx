import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Pressable, Switch,
  KeyboardAvoidingView, Platform, AccessibilityInfo, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors, spacing, radius, typography, useBreakpoint, MIN_TOUCH_TARGET,
} from '../../theme';
import { Button, ErrorBanner } from '../index';
import { Chip } from '../Chip';
import { EntryKind } from '../../types/profile';
import { ENTRY_FORMS, EntryForm, FieldDef, OTHER_OPTION, pruneEmpty } from './entryForms';
import { SelectField } from '../SelectField';

interface Props {
  visible: boolean;
  /** Null when `form` is supplied directly (scalar profile fields). */
  kind: EntryKind | null;
  /** Overrides the per-kind form — lets scalar edits reuse this sheet. */
  form?: EntryForm;
  /** Existing payload when editing; undefined when adding. */
  initial?: Record<string, any>;
  saving?: boolean;
  error?: string | null;
  onSave: (data: Record<string, any>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * One sheet for every entry kind, driven by `ENTRY_FORMS`.
 *
 * Bottom sheet on mobile, centred dialog on desktop — the same responsive
 * `Modal` shape already proven in `jobs.tsx`, rather than a new sheet library.
 * Animation is skipped entirely under reduce-motion, matching `AppDrawer`.
 */
export function EntrySheet({
  visible, kind, form: formOverride, initial, saving, error, onSave, onDelete, onClose,
}: Props) {
  const { isMobile } = useBreakpoint();
  const [values, setValues] = useState<Record<string, any>>({});
  const [touched, setTouched] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) {
      setValues(initial ? { ...initial } : {});
      setTouched(false);
    }
  }, [visible, initial]);

  const form = formOverride ?? (kind ? ENTRY_FORMS[kind] : null);
  const isEdit = !!initial;

  const missing = useMemo(() => {
    if (!form) return [];
    return form.fields
      .filter((f) => f.required && !String(values[f.key] ?? '').trim())
      .map((f) => f.key);
  }, [form, values]);

  if (!form) return null;

  const set = (key: string, value: any) =>
    setValues((v) => {
      const next = { ...v, [key]: value };
      // A city chosen under the old state is almost never in the new one, so
      // any lookup scoped to the field just changed starts over.
      for (const f of form.fields) {
        if (f.lookup?.clearedBy === key) next[f.key] = '';
      }
      return next;
    });

  const submit = () => {
    setTouched(true);
    if (missing.length) return;
    onSave(pruneEmpty(values));
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.shell, isMobile ? styles.shellMobile : styles.shellWide]}
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {isEdit ? form.editTitle : form.addTitle}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              testID="entry-sheet-close"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ErrorBanner message={error} />
            {form.fields.map((field) => {
              if (field.hiddenWhen && values[field.hiddenWhen]) return null;
              return (
                <Field
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  draft={values}
                  onChange={(v) => set(field.key, v)}
                  showError={touched && missing.includes(field.key)}
                />
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            {isEdit && onDelete ? (
              <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete this entry"
                style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
                testID="entry-sheet-delete"
              >
                <Ionicons name="trash-outline" size={17} color={colors.redText} />
              </Pressable>
            ) : null}
            <View style={styles.footerActions}>
              <Button label="Cancel" variant="outline" onPress={onClose} style={styles.footerBtn} />
              <Button
                label={isEdit ? 'Save' : 'Add'}
                onPress={submit}
                loading={saving}
                style={styles.footerBtn}
                testID="entry-sheet-save"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * A `lookup` field: `SelectField` plus the free-text escape behind "Other".
 *
 * The form stores one string either way, so "Other" cannot be a stored value —
 * it is inferred. A value that is not in the list came from free text, which is
 * also how a city saved before these lists existed re-opens with its text
 * intact instead of showing an empty field over saved data.
 */
function Lookup({
  field, value, draft, onChange,
}: {
  field: FieldDef;
  value: any;
  draft: Record<string, any>;
  onChange: (v: any) => void;
}) {
  const config = field.lookup!;
  const options = typeof config.options === 'function' ? config.options(draft) : config.options;
  const stored = String(value ?? '');

  // "Other" chosen but nothing typed yet is indistinguishable from "unset" in
  // the stored value, so that one transient state is tracked here.
  const [pickedOther, setPickedOther] = useState(false);
  const dependency = config.clearedBy ? String(draft[config.clearedBy] ?? '') : '';
  useEffect(() => { setPickedOther(false); }, [dependency]);

  const isOther = config.allowOther && (pickedOther || (!!stored && !options.includes(stored)));
  const blocked = !!config.clearedBy && !dependency.trim();

  const choose = (picked: string) => {
    if (picked === OTHER_OPTION) {
      setPickedOther(true);
      onChange('');
      return;
    }
    setPickedOther(false);
    onChange(picked);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}</Text>
      <SelectField
        testID={`entry-${field.key}`}
        label={field.label}
        hideLabel
        containerStyle={styles.lookupField}
        value={isOther ? OTHER_OPTION : stored}
        onChange={choose}
        options={config.allowOther ? [...options, OTHER_OPTION] : options}
        placeholder={field.placeholder || 'Select…'}
        disabled={blocked}
        disabledHint={config.requiresHint}
        helper={field.helper}
        searchPlaceholder={config.searchPlaceholder}
      />
      {isOther ? (
        <TextInput
          testID={`entry-${field.key}-other`}
          value={stored}
          onChangeText={onChange}
          placeholder={`Type your ${field.label.toLowerCase()}`}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={`${field.label}, other`}
        />
      ) : null}
    </View>
  );
}

function Field({
  field, value, draft, onChange, showError,
}: {
  field: FieldDef;
  value: any;
  /** The whole payload, so a lookup can scope itself to another field. */
  draft: Record<string, any>;
  onChange: (v: any) => void;
  showError?: boolean;
}) {
  const [tagDraft, setTagDraft] = useState('');

  if (field.type === 'lookup' && field.lookup) {
    return <Lookup field={field} value={value} draft={draft} onChange={onChange} />;
  }

  if (field.type === 'switch') {
    return (
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.label}>{field.label}</Text>
          {field.helper ? <Text style={styles.helper}>{field.helper}</Text> : null}
        </View>
        <Switch
          value={!!value}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.tealLight }}
          thumbColor={value ? colors.teal : colors.white}
          accessibilityLabel={field.label}
        />
      </View>
    );
  }

  if (field.type === 'select') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{field.label}</Text>
        <View style={styles.options}>
          {(field.options || []).map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              tone={value === opt.value ? 'navy' : 'neutral'}
              onPress={() => onChange(value === opt.value ? undefined : opt.value)}
            />
          ))}
        </View>
      </View>
    );
  }

  if (field.type === 'multiselect') {
    const selected: string[] = Array.isArray(value) ? value : [];
    const toggle = (option: string) =>
      onChange(
        selected.includes(option)
          ? selected.filter((v) => v !== option)
          : [...selected, option],
      );
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{field.label}</Text>
        <View style={styles.options}>
          {(field.options || []).map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <Chip
                key={opt.value}
                label={opt.label}
                tone={on ? 'teal' : 'neutral'}
                icon={on ? 'checkmark' : undefined}
                onPress={() => toggle(opt.value)}
              />
            );
          })}
        </View>
        {field.helper ? <Text style={styles.helper}>{field.helper}</Text> : null}
      </View>
    );
  }

  if (field.type === 'tags') {
    const items: string[] = Array.isArray(value) ? value : [];
    const add = () => {
      const next = tagDraft.trim();
      if (!next || items.includes(next)) return setTagDraft('');
      onChange([...items, next]);
      setTagDraft('');
    };
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{field.label}</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={add}
            placeholder={field.placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            returnKeyType="done"
            accessibilityLabel={field.label}
          />
          <Pressable
            onPress={add}
            accessibilityRole="button"
            accessibilityLabel={`Add ${field.label}`}
            style={({ pressed }) => [styles.tagAdd, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color={colors.navy} />
          </Pressable>
        </View>
        {items.length ? (
          <View style={styles.options}>
            {items.map((item) => (
              <Chip
                key={item}
                label={item}
                tone="teal"
                onRemove={() => onChange(items.filter((i) => i !== item))}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  const multiline = field.type === 'textarea';
  const numeric = field.type === 'year' || field.type === 'number';
  const placeholder =
    field.type === 'month' ? 'YYYY-MM' : field.type === 'year' ? 'YYYY' : field.placeholder;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {field.label}
        {field.required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        value={value == null ? '' : String(value)}
        onChangeText={(text) => onChange(numeric ? (text ? Number(text) || undefined : undefined) : text)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={numeric ? 'number-pad' : 'default'}
        style={[styles.input, multiline && styles.inputMultiline, showError && styles.inputError]}
        accessibilityLabel={field.label}
      />
      {showError ? (
        <Text style={styles.error} accessibilityRole="alert">{`${field.label} is required`}</Text>
      ) : field.helper ? (
        <Text style={styles.helper}>{field.helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,12,20,0.55)', justifyContent: 'flex-end' },
  shell: { backgroundColor: colors.white, overflow: 'hidden' },
  shellMobile: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
  },
  shellWide: {
    alignSelf: 'center',
    marginVertical: 'auto',
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    borderRadius: radius.xl,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { ...typography.h3, color: colors.text, flex: 1 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  body: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  field: { gap: spacing.sm },
  // The sheet spaces its own fields; SelectField's default margin would
  // double it and push lookups out of rhythm with the inputs around them.
  lookupField: { marginBottom: 0 },
  label: { ...typography.label, color: colors.text },
  required: { color: colors.redText },
  helper: { ...typography.small, color: colors.textMuted, lineHeight: 16 },
  error: { ...typography.small, color: colors.redText },

  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
  inputError: { borderColor: colors.red },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  switchLabel: { flex: 1, gap: 2 },

  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tagAdd: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerActions: { flex: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  footerBtn: { flex: 1, maxWidth: 160 },
  delete: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
