import type { Job } from '../types/jobs';

/**
 * Who may do what, by account type -- the client's mirror of the server's
 * rules, used only to decide what to SHOW. The server enforces every one of
 * these independently; nothing here grants anything.
 */
type RoleUser = { role?: string | null; verified?: boolean; is_admin?: boolean } | null | undefined;

export const isStudent = (u: RoleUser) => u?.role === 'student';
export const isProfessional = (u: RoleUser) => u?.role === 'healthcare_professional';

/** Applies for jobs and internships (never posts or manages them). */
export const appliesForWork = (u: RoleUser) => isProfessional(u) || isStudent(u);

/**
 * Ready to apply now: an approved verification -- a professional's
 * registration certificate, a student's college ID.
 */
export const canApplyNow = (u: RoleUser, isKycApproved: boolean) =>
  appliesForWork(u) && isKycApproved;

/** Learning: professionals and students. */
export const hasLearning = (u: RoleUser) => appliesForWork(u);

/** Locum is clinical cover: professionals only, never students. */
export const hasLocum = (u: RoleUser) => !isStudent(u);

/** Who a posting takes applications from. Missing = professionals only. */
export type Eligibility = 'professionals' | 'students' | 'both';
export const eligibilityOf = (job: Pick<Job, 'eligibility'> | null | undefined): Eligibility =>
  (job?.eligibility as Eligibility) || 'professionals';

/** Whether this account type can apply to this posting at all. */
export function acceptsRole(job: Pick<Job, 'eligibility'> | null | undefined, role?: string | null): boolean {
  const e = eligibilityOf(job);
  if (role === 'student') return e === 'students' || e === 'both';
  if (role === 'healthcare_professional') return e === 'professionals' || e === 'both';
  return false;
}

export const ELIGIBILITY_LABELS: Record<Eligibility, string> = {
  professionals: 'Professionals',
  students: 'Students',
  both: 'Professionals and students',
};

/** "MBBS · 3rd year" -- a student's course line. */
export function studentLine(u: { student_course?: string | null; student_year?: number | null } | null | undefined): string {
  if (!u?.student_course) return '';
  const y = u.student_year;
  const ord = !y ? '' : y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : `${y}th`;
  return [u.student_course, ord ? `${ord} year` : ''].filter(Boolean).join(' · ');
}
