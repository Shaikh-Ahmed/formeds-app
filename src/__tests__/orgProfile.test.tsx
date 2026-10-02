import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockAuth: { token: string; user: any } = { token: 't', user: { id: 'viewer', role: 'healthcare_professional' } };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ ...mockAuth, refreshUser: jest.fn() }) }));
jest.mock('../api/organizations', () => ({
  fetchOrgProfile: jest.fn(), fetchAccountOrganization: jest.fn(), fetchAffiliations: jest.fn(async () => []),
  updateOrganization: jest.fn(), uploadOrgLogo: jest.fn(), uploadOrgCover: jest.fn(), addOrgPhoto: jest.fn(),
  removeOrgPhoto: jest.fn(), removeOrgCover: jest.fn(), requestAffiliation: jest.fn(), decideAffiliation: jest.fn(),
  removeAffiliation: jest.fn(),
}));
jest.mock('../api/profile', () => ({ ...jest.requireActual('../api/profile'), fetchMyProfile: jest.fn(async () => ({ id: 'h1', role: 'hospital' })) }));

import * as orgApi from '../api/organizations';
import { OrganizationProfile, completionItems, formatHours } from '../components/organizations/profile/OrganizationProfile';
import { ProfileView } from '../components/profile/ProfileView';
import type { OrgProfilePage, Organization } from '../types/organizations';

const api = orgApi as jest.Mocked<typeof orgApi>;
const SLOW = { timeout: 8000 };

const HOSPITAL: Organization = {
  id: 'o1', slug: 'xyz', name: 'XYZ Multi-Speciality Hospital', org_type: 'hospital',
  subtype: 'Multi-speciality hospital', headline: '250-bed tertiary care hospital', about: 'Comprehensive care.',
  city: 'Bengaluru', state: 'Karnataka', bed_count: 250, founded_year: 1998, teaching: true,
  specialties: ['Cardiology', 'Neurology'], services: ['Emergency Care'], facilities: ['ICU'],
  emergency_24x7: true, emergency_phone: '080 1234 5678', public_phone: '080 2222 3333',
  verification_status: 'verified', verified: true, job_count: 0, member_count: 1, created_at: '',
  account_user_id: 'h1', can_edit: false,
};
const CLINIC: Organization = {
  ...HOSPITAL, id: 'o2', name: 'ABC Skin Clinic', org_type: 'clinic', subtype: 'Dermatology clinic',
  bed_count: undefined, teaching: undefined, facilities: [], emergency_24x7: false,
  specialties: ['Dermatology'], opening_hours: [0, 1, 2, 3, 4, 5].map(day => ({ day, open: '09:00', close: '19:00' })),
  account_user_id: 'c1',
};

function page(org: Organization, extra: Partial<OrgProfilePage> = {}): OrgProfilePage {
  return {
    organization: org, team: [{ id: 'd1', name: 'Dr. Ahmed Khan', affiliation_id: 'a1', title: 'Cardiologist',
      account_verified: true }], jobs: [], job_total: 12, locums: [], locum_total: 5,
    my_affiliation: null, is_account: false, ...extra,
  };
}

beforeEach(() => { jest.clearAllMocks(); mockAuth.user = { id: 'viewer', role: 'healthcare_professional' }; });

describe('hospital profile', () => {
  it('reads as an institution, with hospital facts and none of the professional CV', async () => {
    api.fetchOrgProfile.mockResolvedValue(page(HOSPITAL));
    render(<OrganizationProfile orgId="o1" />);
    await waitFor(() => screen.getByTestId('org-name-heading'), SLOW);
    expect(screen.getByTestId('org-name-heading')).toHaveTextContent('XYZ Multi-Speciality Hospital');
    expect(screen.getAllByText('Verified healthcare organisation').length).toBeGreaterThan(0);
    expect(screen.getByText('Departments & specialties')).toBeTruthy();
    expect(screen.getByText('250')).toBeTruthy();
    expect(screen.getByText('Emergency services · 24/7')).toBeTruthy();
    expect(screen.getByText('Dr. Ahmed Khan')).toBeTruthy();
    expect(screen.getByText('Open positions · 12')).toBeTruthy();
    for (const cv of ['Professional experience', 'Medical registration', 'Education & medical training',
      'Mentorship', 'Professional summary']) {
      expect(screen.queryByText(cv)).toBeNull();
    }
    // A visitor gets Connect, not editing (Message follows an accepted connection).
    await waitFor(() => screen.getByTestId('org-connect-request'), SLOW);
    expect(screen.queryByTestId('org-edit')).toBeNull();
    // A professional can ask to join the team.
    expect(screen.getByTestId('org-join')).toBeTruthy();
  });

  it('gives its owner editing, settings and completion', async () => {
    api.fetchOrgProfile.mockResolvedValue(page({ ...HOSPITAL, can_edit: true, logo: '' }, { is_account: true }));
    mockAuth.user = { id: 'h1', role: 'hospital' };
    render(<OrganizationProfile orgId="o1" />);
    await waitFor(() => screen.getByTestId('org-edit'), SLOW);
    // Only the account exists: no separate organisation page or settings to manage.
    expect(screen.queryByTestId('org-settings')).toBeNull();
    expect(screen.getByText('Hospital details')).toBeTruthy();
    // The same completion card a professional sees.
    expect(screen.getByText(/^Profile \d+% complete/)).toBeTruthy();
    expect(screen.queryByTestId('org-connect-request')).toBeNull();
    expect(screen.queryByTestId('org-join')).toBeNull();
  });
});

describe('clinic profile', () => {
  it('leads with opening hours and never shows beds or teaching', async () => {
    api.fetchOrgProfile.mockResolvedValue(page(CLINIC));
    render(<OrganizationProfile orgId="o2" />);
    await waitFor(() => screen.getByTestId('org-name-heading'), SLOW);
    expect(screen.getByText('Opening hours')).toBeTruthy();
    expect(screen.getByText('Mon–Sat')).toBeTruthy();
    expect(screen.getAllByText('Specialties').length).toBeGreaterThan(0);
    expect(screen.queryByText('Departments & specialties')).toBeNull();
    expect(screen.queryByText('Beds')).toBeNull();
    expect(screen.queryByText('Teaching hospital')).toBeNull();
  });
});

describe('the Me tab of a hospital account', () => {
  it('shows the organisation, not the professional profile', async () => {
    mockAuth.user = { id: 'h1', role: 'hospital' };
    api.fetchAccountOrganization.mockResolvedValue({ ...HOSPITAL, can_edit: true });
    api.fetchOrgProfile.mockResolvedValue(page({ ...HOSPITAL, can_edit: true }, { is_account: true }));
    render(<ProfileView />);
    await waitFor(() => screen.getByTestId('org-name-heading'), SLOW);
    expect(api.fetchAccountOrganization).toHaveBeenCalledWith('t', 'h1');
    expect(screen.queryByText('Professional experience')).toBeNull();
  });
});

describe('helpers', () => {
  it('collapses consecutive days with the same hours', () => {
    expect(formatHours([0, 1, 2, 3, 4].map(day => ({ day, open: '09:00', close: '18:00' }))
      .concat([{ day: 5, open: '09:00', close: '13:00' }]))).toEqual([
      { days: 'Mon–Fri', time: '9:00 AM – 6:00 PM' },
      { days: 'Saturday', time: '9:00 AM – 1:00 PM' },
    ]);
  });

  it('measures a hospital by facilities and a clinic by opening hours', () => {
    const h = completionItems(HOSPITAL).map(i => i.label);
    const c = completionItems(CLINIC).map(i => i.label);
    expect(h).toContain('Facilities');
    expect(h).not.toContain('Opening hours');
    expect(c).toContain('Opening hours');
    expect(c).not.toContain('Facilities');
  });
});
