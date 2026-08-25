/**
 * Profile section components.
 *
 * Each section is a thin composition over two primitives — `ProfileSection`
 * (overline, privacy control, add affordance, compact empty state) and either
 * `TimelineList` or `EntryListSection`. That is what keeps seventeen sections
 * from becoming seventeen bespoke layouts, and it is why adding a new section
 * type is a form definition plus a mapping function rather than a new screen.
 */

export { ProfileSection } from './ProfileSection';
export { ProfileHeader } from './ProfileHeader';
export { ProfessionalIdentity } from './ProfessionalIdentity';
export { VerifiedMark } from './VerifiedMark';
export { AboutSection } from './AboutSection';
export { TimelineList } from './TimelineList';
export type { TimelineItem } from './TimelineList';
export { ExperienceSection, EducationSection, credentialsFrom } from './CareerSections';
export { RegistrationSection } from './RegistrationSection';
export { EntryListSection, rowBuilders } from './EntryListSection';
export type { CredentialRow } from './EntryListSection';
export { SpecializationSection, SkillsSection, InterestsSection } from './TaxonomySections';
export {
  AvailabilitySection,
  MentorshipSection,
  ProfessionalLinksSection,
} from './EngagementSections';
export { ProfileCompletion } from './ProfileCompletion';
export { EntrySheet } from './EntrySheet';
export { ENTRY_FORMS, pruneEmpty } from './entryForms';
export type { FieldDef, EntryForm } from './entryForms';
export * from './format';
