import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OrgVerifiedBadge } from '../components/organizations/OrgVerifiedBadge';
import { ORG_VERIFICATION_META, type OrgVerification } from '../types/organizations';

/**
 * The trust mark.
 *
 * This badge is the single place the claim "verified" is rendered, and the
 * whole reason organisations were built was to stop that claim being derivable
 * from "someone with a KYC'd account typed a hospital's name into a form". So
 * the tests are mostly about what must NOT appear.
 */

const ALL: OrgVerification[] = ['unverified', 'pending', 'verified', 'rejected'];

describe('OrgVerifiedBadge', () => {
  it('says nothing at all for an unverified organisation', () => {
    // Not a negative badge: marking every new organisation would be noise, and
    // would punish employers for a review they are waiting on.
    render(<OrgVerifiedBadge status="unverified" />);
    expect(screen.queryByTestId('org-verification-unverified')).toBeNull();
  });

  it('renders nothing when the status is missing entirely', () => {
    render(<OrgVerifiedBadge status={undefined} />);
    expect(screen.queryByText(/verif/i)).toBeNull();
  });

  it('claims verification for exactly one status', () => {
    const claiming = ALL.filter(s => {
      const meta = ORG_VERIFICATION_META[s];
      return !!meta && /^verified/i.test(meta.label);
    });
    expect(claiming).toEqual(['verified']);
  });

  it('spells out the claim rather than relying on a tick', () => {
    render(<OrgVerifiedBadge status="verified" />);
    expect(screen.getByText('Verified organisation')).toBeTruthy();
    expect(screen.getByTestId('org-verification-verified')).toBeTruthy();
  });

  it('does not imply verification while a review is in progress', () => {
    render(<OrgVerifiedBadge status="pending" />);
    expect(screen.getByText('Verification in review')).toBeTruthy();
    expect(screen.queryByText('Verified organisation')).toBeNull();
  });

  it('says a declined review is declined, not merely unverified', () => {
    render(<OrgVerifiedBadge status="rejected" />);
    expect(screen.getByText('Verification declined')).toBeTruthy();
  });

  it('announces the compact tick, which is otherwise silent to a screen reader', () => {
    render(<OrgVerifiedBadge status="verified" compact />);
    expect(screen.getByLabelText('Verified organisation')).toBeTruthy();
  });

  it('renders no compact tick for anything unverified', () => {
    for (const status of ['unverified', 'pending', 'rejected'] as const) {
      const { unmount } = render(<OrgVerifiedBadge status={status} compact />);
      expect(screen.queryByLabelText('Verified organisation')).toBeNull();
      unmount();
    }
  });
});
