/**
 * Choices offered when a hospital or clinic describes itself. Suggestions, not
 * a closed list, except the subtype -- the server accepts only these, per
 * org_type (models/schemas.py HOSPITAL_SUBTYPES / CLINIC_SUBTYPES).
 *
 * Hospital and clinic lists are separate on purpose: a clinic is never offered
 * "Blood bank" or "Inpatient care", so its page never looks like a small
 * hospital's with the gaps showing.
 */

export const HOSPITAL_SUBTYPES = [
  'Multi-speciality hospital', 'General hospital', 'Speciality hospital', 'Super-speciality hospital',
  'Teaching hospital', 'Government hospital', 'Private hospital', 'Corporate hospital',
  'Maternity hospital', "Children's hospital", 'Other hospital',
];

export const CLINIC_SUBTYPES = [
  'General practice clinic', 'Family medicine clinic', 'Speciality clinic', 'Multi-speciality clinic',
  'Dental clinic', 'Dermatology clinic', 'Eye clinic', 'Physiotherapy clinic', 'Polyclinic',
  'Day-care clinic', 'Other clinic',
];

export const HOSPITAL_DEPARTMENTS = [
  'General Medicine', 'General Surgery', 'Cardiology', 'Neurology', 'Orthopaedics', 'Paediatrics',
  'Obstetrics & Gynaecology', 'Dermatology', 'ENT', 'Ophthalmology', 'Oncology', 'Nephrology',
  'Urology', 'Gastroenterology', 'Pulmonology', 'Psychiatry', 'Anaesthesiology', 'Radiology',
  'Emergency Medicine', 'Critical Care',
];

export const CLINIC_SPECIALTIES = [
  'General Practice', 'Family Medicine', 'Paediatrics', 'Dermatology', 'Aesthetic Medicine', 'Dental',
  'Physiotherapy', 'Gynaecology', 'Ophthalmology', 'ENT', 'Diabetology', 'Psychiatry',
];

export const HOSPITAL_SERVICES = [
  'Emergency Care', 'Outpatient Department', 'Inpatient Care', 'Intensive Care', 'Surgery',
  'Day-care Procedures', 'Diagnostics', 'Laboratory', 'Radiology', 'Pharmacy', 'Ambulance',
  'Dialysis', 'Physiotherapy & Rehabilitation', 'Health Check-ups',
];

export const CLINIC_SERVICES = [
  'Consultation', 'Preventive Care', 'Diagnostics', 'Vaccination', 'Minor Procedures',
  'Physiotherapy', 'Home Visits', 'Teleconsultation', 'Health Check-ups', 'Chronic Disease Management',
];

export const HOSPITAL_FACILITIES = [
  'ICU', 'NICU', 'PICU', 'Operation Theatres', 'Emergency Department', 'Blood Bank', 'Laboratory',
  'Radiology', 'Pharmacy', 'Ambulance', 'Cath Lab', 'Dialysis Unit', 'Parking', 'Cafeteria',
];

export const CLINIC_FACILITIES = [
  'Consultation Rooms', 'Laboratory', 'Pharmacy', 'Diagnostic Equipment', 'Waiting Area',
  'Wheelchair Access', 'Parking',
];

export const ACCREDITATIONS = ['NABH', 'NABL', 'JCI', 'ISO 9001', 'NQAS'];
