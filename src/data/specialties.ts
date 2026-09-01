/**
 * Specialties offered wherever a member names their field.
 *
 * Scoped to Indian practice: the clinical entries follow the NMC's recognised
 * broad and super-specialities, and the allied block covers the non-physician
 * professionals who also hold accounts here. Stored as the display string —
 * the server keeps these columns free-text — so adding or renaming an entry
 * never needs a migration.
 *
 * No list of this kind is ever complete, which is why every picker built on it
 * offers OTHER_SPECIALTY and keeps whatever the member types.
 */

/** Chosen when nothing in the list fits; the picker then asks for free text. */
export const OTHER_SPECIALTY = 'Other';

const CLINICAL = [
  'Anaesthesiology',
  'Andrology',
  'Cardiology',
  'Cardiothoracic and Vascular Surgery',
  'Clinical Genetics',
  'Clinical Haematology',
  'Clinical Immunology and Rheumatology',
  'Clinical Pharmacology',
  'Community Medicine',
  'Critical Care Medicine',
  'Dermatology, Venereology and Leprosy',
  'Emergency Medicine',
  'Endocrinology',
  'Family Medicine',
  'Gastroenterology',
  'General Medicine',
  'General Surgery',
  'Geriatric Medicine',
  'Gynaecologic Oncology',
  'Hepatology',
  'Infectious Diseases',
  'Internal Medicine',
  'Interventional Radiology',
  'Medical Genetics',
  'Medical Oncology',
  'Neonatology',
  'Nephrology',
  'Neurology',
  'Neurosurgery',
  'Nuclear Medicine',
  'Obstetrics and Gynaecology',
  'Onco-Anaesthesia and Palliative Medicine',
  'Ophthalmology',
  'Oral and Maxillofacial Surgery',
  'Orthopaedics',
  'Otorhinolaryngology (ENT)',
  'Paediatric Cardiology',
  'Paediatric Surgery',
  'Paediatrics',
  'Palliative Medicine',
  'Physical Medicine and Rehabilitation',
  'Plastic and Reconstructive Surgery',
  'Psychiatry',
  'Pulmonary Medicine',
  'Radiation Oncology',
  'Radiodiagnosis',
  'Reproductive Medicine and Surgery',
  'Respiratory Medicine',
  'Rheumatology',
  'Sports Medicine',
  'Surgical Gastroenterology',
  'Surgical Oncology',
  'Transplant Surgery',
  'Trauma Surgery',
  'Tropical Medicine',
  'Urology',
  'Vascular Surgery',
];

const DIAGNOSTIC_AND_BASIC = [
  'Anatomy',
  'Biochemistry',
  'Forensic Medicine and Toxicology',
  'Haematopathology',
  'Immunohaematology and Blood Transfusion',
  'Microbiology',
  'Pathology',
  'Pharmacology',
  'Physiology',
  'Transfusion Medicine',
];

const DENTAL = [
  'Conservative Dentistry and Endodontics',
  'Dentistry',
  'Oral Medicine and Radiology',
  'Oral Pathology and Microbiology',
  'Orthodontics and Dentofacial Orthopaedics',
  'Paediatric and Preventive Dentistry',
  'Periodontology',
  'Prosthodontics and Crown and Bridge',
  'Public Health Dentistry',
];

const ALLIED_AND_NURSING = [
  'Audiology',
  'Clinical Psychology',
  'Dental Hygiene',
  'Dietetics and Nutrition',
  'Medical Laboratory Technology',
  'Nursing',
  'Occupational Therapy',
  'Operation Theatre Technology',
  'Optometry',
  'Paramedic and Emergency Care',
  'Perfusion Technology',
  'Pharmacy',
  'Physiotherapy',
  'Radiography and Imaging Technology',
  'Respiratory Therapy',
  'Speech and Language Therapy',
];

const ADMINISTRATIVE = [
  'Health Informatics',
  'Hospital Administration',
  'Occupational Health',
  'Public Health',
];

/** Every specialty, alphabetical — the order a searchable picker wants. */
export const SPECIALTIES: string[] = [
  ...CLINICAL,
  ...DIAGNOSTIC_AND_BASIC,
  ...DENTAL,
  ...ALLIED_AND_NURSING,
  ...ADMINISTRATIVE,
].sort((a, b) => a.localeCompare(b));

/** Options for a picker: the full list with the free-text escape pinned last. */
export const SPECIALTY_OPTIONS: string[] = [...SPECIALTIES, OTHER_SPECIALTY];

/** True when a stored value came from free text rather than the list. */
export const isCustomSpecialty = (value: string) =>
  !!value.trim() && !SPECIALTIES.includes(value.trim());
