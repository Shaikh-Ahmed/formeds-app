import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography, MIN_TOUCH_TARGET } from '../theme';
import { SelectField } from './SelectField';
import { Sheet } from './Sheet';
import { Button } from './Button';

/**
 * Controlled inputs for the kinds of data a text box handles badly.
 *
 * A date, a time or an amount typed as free text is the commonest source of
 * bad data in a form: "12 Sept", "9am", "three thousand". These controls make
 * the invalid value impossible to enter in the first place --
 *
 *  - web: the browser's own date / time / date-time picker (keyboard, locale
 *    and min/max handled by the platform, impossible dates like 30 Feb never
 *    produced);
 *  - iOS and Android: the OS picker dialog.
 *
 * Values stay in the wire format the API expects -- 'YYYY-MM-DD', 'HH:MM'
 * (24-hour), 'YYYY-MM-DDTHH:MM' (wall clock, read as IST by the server) -- so
 * a form swapping a FormInput for one of these changes nothing else.
 *
 * They only PREVENT bad input. Every rule is still checked by the form (see
 * utils/validation.ts) and again by the server, which is authoritative.
 */

type Mode = 'date' | 'time' | 'datetime';

interface PickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Same format as `value`. */
  min?: string;
  max?: string;
  error?: string | null;
  helper?: string;
  placeholder?: string;
  /** Shows a clear button when there is a value: for optional fields. */
  clearable?: boolean;
  disabled?: boolean;
  testID?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDate(value: string, mode: Mode): Date | null {
  if (!value) return null;
  if (mode === 'time') {
    const [h, m] = value.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, mo, da] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const d = new Date(y, (mo || 1) - 1, da || 1, h || 0, mi || 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fromDate(d: Date, mode: Mode): string {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return mode === 'date' ? day : mode === 'time' ? time : `${day}T${time}`;
}

/** "9:30 AM", in the app's 12-hour display convention. */
export function displayTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m || 0)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Wed, 30 Sep 2026". */
export function displayDate(ymd: string): string {
  const d = toDate(ymd, 'date');
  return d ? `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ymd;
}

function display(value: string, mode: Mode): string {
  if (!value) return '';
  if (mode === 'time') return displayTime(value);
  if (mode === 'date') return displayDate(value);
  const [d, t] = value.split('T');
  return `${displayDate(d)}, ${displayTime(t || '00:00')}`;
}

const ICONS: Record<Mode, keyof typeof Ionicons.glyphMap> = {
  date: 'calendar-outline', time: 'time-outline', datetime: 'calendar-outline',
};
const HTML_TYPES: Record<Mode, string> = { date: 'date', time: 'time', datetime: 'datetime-local' };

function PickerField({ mode, label, value, onChange, min, max, error, helper, placeholder, clearable, disabled, testID }:
  PickerProps & { mode: Mode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);

  const frame = (control: React.ReactNode) => (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.wrap, error ? styles.wrapError : null, disabled ? styles.wrapDisabled : null]}>
        <Ionicons name={ICONS[mode]} size={20} color={colors.textMuted} style={styles.icon} />
        {control}
        {clearable && value && !disabled ? (
          <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}
            hitSlop={10} testID={testID ? `${testID}-clear` : undefined}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text>
        : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );

  if (Platform.OS === 'web') {
    // A real <input>: react-native-web renders DOM elements as they are.
    return frame(React.createElement('input', {
      type: HTML_TYPES[mode],
      value,
      min,
      max,
      disabled,
      'aria-label': label,
      'aria-invalid': error ? true : undefined,
      'data-testid': testID,
      // An impossible or half-typed entry reads back as '' -- the browser
      // never hands over "2026-02-30".
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    }));
  }

  // iOS / Android: a pressable showing the value, opening the OS picker.
  const current = toDate(value, mode) ?? toDate(min ?? '', mode) ?? new Date();
  // Lazy: the native module is only needed (and only present) off the web.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DateTimePicker = require('@react-native-community/datetimepicker').default;
  const bounds = { minimumDate: toDate(min ?? '', mode) ?? undefined, maximumDate: toDate(max ?? '', mode) ?? undefined };

  const openAndroid = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
    const pick = (m: 'date' | 'time', base: Date, then: (d: Date) => void) => DateTimePickerAndroid.open({
      value: base, mode: m, is24Hour: false, ...(m === 'date' ? bounds : {}),
      onChange: (event: any, d?: Date) => { if (event.type === 'set' && d) then(d); },
    });
    if (mode === 'datetime') {
      pick('date', current, d => pick('time', d, t => {
        const out = new Date(d); out.setHours(t.getHours(), t.getMinutes(), 0, 0);
        onChange(fromDate(out, mode));
      }));
    } else {
      pick(mode, current, d => onChange(fromDate(d, mode)));
    }
  };

  return (
    <>
      {frame(
        <Pressable style={styles.native} disabled={disabled} testID={testID} accessibilityRole="button"
          accessibilityLabel={`${label}. ${value ? display(value, mode) : 'Not set'}`}
          onPress={() => (Platform.OS === 'android' ? openAndroid() : (setDraft(current), setOpen(true)))}>
          <Text style={[styles.nativeText, !value && styles.placeholder]} numberOfLines={1}>
            {value ? display(value, mode) : placeholder ?? (mode === 'time' ? 'Choose a time' : 'Choose a date')}
          </Text>
        </Pressable>,
      )}
      {Platform.OS === 'ios' ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label}
          footer={<Button label="Done" testID={testID ? `${testID}-done` : undefined}
            onPress={() => { if (draft) onChange(fromDate(draft, mode)); setOpen(false); }} />}>
          <View style={{ alignItems: 'center', padding: spacing.md }}>
            <DateTimePicker value={draft ?? current} mode={mode} {...bounds}
              display={mode === 'date' ? 'inline' : 'spinner'}
              onChange={(_: any, d?: Date) => d && setDraft(d)} />
          </View>
        </Sheet>
      ) : null}
    </>
  );
}

export const DateField = (p: PickerProps) => <PickerField mode="date" {...p} />;
export const TimeField = (p: PickerProps) => <PickerField mode="time" {...p} />;
export const DateTimeField = (p: PickerProps) => <PickerField mode="datetime" {...p} />;

// ── Month and year ─────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

/** A range of years, newest first. */
export function yearOptions(from: number, to: number): string[] {
  const out: string[] = [];
  for (let y = to; y >= from; y--) out.push(String(y));
  return out;
}

/**
 * Month precision ('YYYY-MM') as two selects. The browser month input is not
 * supported in Safari or Firefox, and "YYYY-MM" typed by hand is exactly the
 * free text this file exists to remove.
 */
export function MonthField({ label, value, onChange, minYear = 1950, maxYear = new Date().getFullYear() + 10,
  error, helper, testID }: {
  label: string; value: string; onChange: (v: string) => void; minYear?: number; maxYear?: number;
  error?: string | null; helper?: string; testID?: string;
}) {
  const [y, m] = (value || '').split('-');
  const [year, setYear] = useState(y || '');
  const [month, setMonth] = useState(m ? MONTH_NAMES[Number(m) - 1] : '');
  // Follow the value when the host replaces it (an edit sheet reopened on
  // another entry); a half-picked month/year stays as the user left it.
  useEffect(() => {
    if (!value) return;
    const [vy, vm] = value.split('-');
    setYear(vy);
    setMonth(MONTH_NAMES[Number(vm) - 1] ?? '');
  }, [value]);
  const emit = (nextMonth: string, nextYear: string) => {
    const idx = MONTH_NAMES.indexOf(nextMonth);
    onChange(idx >= 0 && nextYear ? `${nextYear}-${pad(idx + 1)}` : '');
  };
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <SelectField label={`${label} month`} hideLabel value={month} placeholder="Month" options={MONTH_NAMES}
            onChange={v => { setMonth(v); emit(v, year); }} testID={testID ? `${testID}-month` : undefined}
            containerStyle={styles.flush} />
        </View>
        <View style={styles.pairItem}>
          <SelectField label={`${label} year`} hideLabel value={year} placeholder="Year"
            options={yearOptions(minYear, maxYear)}
            onChange={v => { setYear(v); emit(month, v); }} testID={testID ? `${testID}-year` : undefined}
            containerStyle={styles.flush} />
        </View>
        {value || month || year ? (
          <Pressable onPress={() => { setMonth(''); setYear(''); onChange(''); }} accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`} hitSlop={10} style={styles.pairClear}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text>
        : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

// ── Numbers ────────────────────────────────────────────────────────────────

/**
 * A number, and nothing else. Letters, signs and (unless `decimals`) points
 * never reach the value; the numeric keyboard comes up on a phone. Range and
 * required-ness are still the form's rules to check, with a message.
 */
export function NumberField({ value, onChangeText, decimals = false, maxDigits = 9, prefix, suffix, label, error,
  helper, testID, placeholder, ...rest }: Omit<TextInputProps, 'style' | 'keyboardType' | 'onChangeText'> & {
  label: string; value: string; onChangeText: (v: string) => void; decimals?: boolean; maxDigits?: number;
  prefix?: string; suffix?: string; error?: string | null; helper?: string;
}) {
  const clean = (t: string) => {
    let out = t.replace(decimals ? /[^\d.]/g : /\D/g, '');
    if (decimals) {
      const [whole, ...frac] = out.split('.');
      out = frac.length ? `${whole}.${frac.join('').slice(0, 2)}` : whole;
    }
    return out.slice(0, maxDigits + (decimals ? 3 : 0));
  };
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.wrap, error ? styles.wrapError : null]}>
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          {...rest}
          testID={testID}
          value={value}
          onChangeText={t => onChangeText(clean(t))}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          inputMode={decimals ? 'decimal' : 'numeric'}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          style={styles.input}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text>
        : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const webInputStyle = {
  flex: 1,
  minWidth: 0,
  height: 50,
  border: 'none',
  background: 'transparent',
  fontSize: 16,
  color: colors.text,
  fontFamily: fonts.body.regular,
  outline: 'none',
  padding: 0,
  colorScheme: 'light',
};

const styles = StyleSheet.create({
  group: { marginBottom: spacing.lg + 2 },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: 6 },
  wrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg - 2,
    minHeight: Math.max(MIN_TOUCH_TARGET, 52), gap: spacing.sm,
  },
  wrapError: { borderColor: colors.red },
  wrapDisabled: { opacity: 0.6 },
  icon: { marginRight: 2 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md, minWidth: 0 },
  native: { flex: 1, minHeight: 50, justifyContent: 'center' },
  nativeText: { fontSize: 16, color: colors.text },
  placeholder: { color: colors.textMuted },
  affix: { ...typography.bodyStrong, color: colors.textSecondary },
  error: { color: colors.redText, fontSize: 13, marginTop: 4 },
  helper: { ...typography.small, color: colors.textSecondary, marginTop: 4 },
  pair: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pairItem: { flex: 1, minWidth: 0 },
  pairClear: { paddingHorizontal: 2 },
  flush: { marginBottom: 0 },
});
