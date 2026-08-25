import React from 'react';
import { ProfileSection } from './ProfileSection';
import { TimelineList, TimelineItem } from './TimelineList';
import {
  EducationData,
  EMPLOYMENT_TYPE_LABELS,
  ExperienceData,
  ProfileEntry,
  Visibility,
} from '../../types/profile';
import { formatRange, formatYearRange, joinMeta, toBullets } from './format';

interface SectionProps {
  entries: ProfileEntry[];
  editable?: boolean;
  visibility?: Visibility;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onChangeVisibility?: () => void;
  last?: boolean;
}

/** Professional Experience — the career rail. */
export function ExperienceSection({
  entries, editable, visibility, onAdd, onEdit, onChangeVisibility, last,
}: SectionProps) {
  const items: TimelineItem[] = entries.map((entry) => {
    const d = entry.data as ExperienceData;
    return {
      id: entry.id,
      title: d.title,
      subtitle: joinMeta(d.organization, d.department),
      meta: joinMeta(
        d.location,
        d.employment_type ? EMPLOYMENT_TYPE_LABELS[d.employment_type] : '',
      ),
      dateRange: formatRange(d.start_date, d.end_date, d.is_current),
      bullets: toBullets(d.description),
      tags: d.skills,
      isCurrent: d.is_current,
      status: entry.verification_status,
    };
  });

  return (
    <ProfileSection
      title="Professional experience"
      isEmpty={items.length === 0}
      emptyTitle="Build your professional journey"
      emptyHint="Add your clinical roles, responsibilities and achievements so colleagues and employers can see your career at a glance."
      addLabel="Add experience"
      onAdd={onAdd}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-experience"
    >
      <TimelineList
        items={items}
        editable={editable}
        onEdit={onEdit}
        testID="timeline-experience"
      />
    </ProfileSection>
  );
}

/**
 * Education & Medical Training.
 *
 * Residencies and fellowships share this section but carry a kicker so they
 * read as training posts rather than academic degrees — the distinction matters
 * to anyone assessing a clinical CV.
 */
export function EducationSection({
  entries, editable, visibility, onAdd, onEdit, onChangeVisibility, last,
}: SectionProps) {
  const items: TimelineItem[] = entries.map((entry) => {
    const d = entry.data as EducationData;
    return {
      id: entry.id,
      kicker: d.is_training ? 'Residency / Fellowship' : undefined,
      title: joinMeta(d.degree, d.field_of_study) || d.degree,
      subtitle: d.institution,
      meta: d.location,
      dateRange: joinMeta(
        formatYearRange(d.start_year, d.end_year),
        d.grade ? `Grade ${d.grade}` : '',
      ),
      bullets: toBullets(d.description),
      status: entry.verification_status,
    };
  });

  return (
    <ProfileSection
      title="Education & medical training"
      isEmpty={items.length === 0}
      emptyTitle="Add your qualifications"
      emptyHint="MBBS, MD, DNB, nursing and allied health qualifications, plus any residency or fellowship training."
      addLabel="Add education"
      onAdd={onAdd}
      editable={editable}
      visibility={visibility}
      onChangeVisibility={onChangeVisibility}
      last={last}
      testID="section-education"
    >
      <TimelineList
        items={items}
        editable={editable}
        onEdit={onEdit}
        testID="timeline-education"
      />
    </ProfileSection>
  );
}

/** Post-nominals for the identity block, newest qualification first. */
export function credentialsFrom(entries: ProfileEntry[]): string[] {
  return entries
    .filter((e) => !(e.data as EducationData).is_training)
    .map((e) => (e.data as EducationData).degree)
    .filter(Boolean)
    .slice(0, 5);
}
