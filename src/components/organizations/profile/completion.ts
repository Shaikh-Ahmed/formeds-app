import type { Organization } from '../../../types/organizations';

/** What makes a hospital profile complete differs from a clinic's. */
export function completionItems(org: Organization): { key: string; label: string; prompt: string; done: boolean }[] {
  const hospital = org.org_type === 'hospital';
  const items = [
    { key: 'name', label: 'Name', prompt: 'Add your name', done: !!org.name },
    { key: 'logo', label: 'Logo', prompt: 'Add your logo', done: !!org.logo },
    { key: 'location', label: 'Location', prompt: 'Add your address', done: !!org.city },
    { key: 'about', label: 'About', prompt: `Describe your ${hospital ? 'hospital' : 'clinic'}`, done: !!org.about },
    { key: 'contact', label: 'Contact details', prompt: 'Add a phone number or email', done: !!(org.public_phone || org.public_email) },
    { key: 'specialties', label: hospital ? 'Departments' : 'Specialties',
      prompt: hospital ? 'Add your departments' : 'Add your specialties', done: !!org.specialties?.length },
    { key: 'services', label: 'Services', prompt: 'Add your services', done: !!org.services?.length },
    hospital
      ? { key: 'facilities', label: 'Facilities', prompt: 'Add your facilities', done: !!org.facilities?.length }
      : { key: 'hours', label: 'Opening hours', prompt: 'Add your opening hours', done: !!(org.open_24x7 || org.opening_hours?.length) },
    { key: 'website', label: 'Website', prompt: 'Add your website', done: !!org.website },
    { key: 'photos', label: 'Photos', prompt: 'Add photos of your premises', done: !!org.photos?.length },
  ];
  return items;
}
