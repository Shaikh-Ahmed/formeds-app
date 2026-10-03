import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { FormInput } from '../FormInput';
import { SelectField } from '../SelectField';
import { apiFetch } from '../../utils/api';

/**
 * A student's education: course, college, university, year of study and
 * expected graduation. One component for signup, Google onboarding and the
 * profile editor, so the three can never disagree. The pickers come from
 * GET /api/students/options -- the same list the server validates against.
 */
export interface StudentEducation {
  course: string;
  institution: string;
  university: string;
  current_year: string;       // kept as text for the pickers; sent as a number
  graduation_year: string;
}

export type EducationField = keyof StudentEducation;

export const EMPTY_EDUCATION: StudentEducation = {
  course: '', institution: '', university: '', current_year: '', graduation_year: '',
};

interface Options { courses: string[]; years: number[]; graduation_years: number[] }

let cached: Options | null = null;

/** The server's lists, fetched once per session. */
export function useStudentOptions(): Options | null {
  const [options, setOptions] = useState<Options | null>(cached);
  useEffect(() => {
    if (cached) return;
    apiFetch('/api/students/options', null)
      .then((o: Options) => { cached = o; setOptions(o); })
      .catch(() => {});
  }, []);
  return options;
}

export const ordinalYear = (y: number | string) => {
  const n = Number(y);
  return n === 1 ? '1st year' : n === 2 ? '2nd year' : n === 3 ? '3rd year' : `${n}th year`;
};
const yearFromLabel = (label: string) => String(parseInt(label, 10) || '');

/** The same rules the server applies, so a valid-looking form never 422s. */
export function validateEducation(e: StudentEducation): Partial<Record<EducationField, string>> {
  const out: Partial<Record<EducationField, string>> = {};
  const thisYear = new Date().getFullYear();
  if (!e.course) out.course = 'Choose your course';
  if (!e.institution.trim()) out.institution = 'Enter your college or institution';
  if (!e.current_year) out.current_year = 'Choose your year of study';
  if (!e.graduation_year) out.graduation_year = 'Choose your expected graduation year';
  else if (Number(e.graduation_year) < thisYear) out.graduation_year = 'Expected graduation cannot be in the past';
  return out;
}

/** What the API takes. */
export const educationPayload = (e: StudentEducation) => ({
  course: e.course,
  institution: e.institution.trim(),
  university: e.university.trim() || undefined,
  current_year: Number(e.current_year),
  graduation_year: Number(e.graduation_year),
});

export function StudentEducationFields({ value, onChange, errors = {}, testIDPrefix = 'student' }: {
  value: StudentEducation;
  onChange: (field: EducationField, v: string) => void;
  errors?: Partial<Record<EducationField, string | undefined>>;
  testIDPrefix?: string;
}) {
  const options = useStudentOptions();
  return (
    <View>
      <SelectField
        testID={`${testIDPrefix}-course`}
        label="Course / programme"
        icon="school-outline"
        value={value.course}
        onChange={v => onChange('course', v)}
        options={options?.courses ?? []}
        placeholder={options ? 'Choose your course' : 'Loading courses…'}
        disabled={!options}
        error={errors.course}
      />
      <FormInput
        testID={`${testIDPrefix}-institution`}
        label="College / institution"
        icon="business-outline"
        value={value.institution}
        onChangeText={v => onChange('institution', v)}
        placeholder="e.g. St. John's Medical College"
        autoCapitalize="words"
        maxLength={160}
        error={errors.institution}
      />
      <FormInput
        testID={`${testIDPrefix}-university`}
        label="University (optional)"
        icon="library-outline"
        value={value.university}
        onChangeText={v => onChange('university', v)}
        placeholder="e.g. RGUHS"
        autoCapitalize="words"
        maxLength={160}
      />
      <SelectField
        testID={`${testIDPrefix}-year`}
        label="Current year of study"
        icon="calendar-outline"
        value={value.current_year ? ordinalYear(value.current_year) : ''}
        onChange={v => onChange('current_year', yearFromLabel(v))}
        options={(options?.years ?? []).map(ordinalYear)}
        placeholder="Choose your year"
        disabled={!options}
        error={errors.current_year}
      />
      <SelectField
        testID={`${testIDPrefix}-graduation`}
        label="Expected graduation"
        icon="ribbon-outline"
        value={value.graduation_year}
        onChange={v => onChange('graduation_year', v)}
        options={(options?.graduation_years ?? []).map(String)}
        placeholder="Choose a year"
        disabled={!options}
        error={errors.graduation_year}
      />
    </View>
  );
}
