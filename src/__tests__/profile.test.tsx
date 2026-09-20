import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VerifiedMark } from '../components/profile/VerifiedMark';
import { ProfileSection } from '../components/profile/ProfileSection';
import { TimelineList } from '../components/profile/TimelineList';
import { ProfileCompletion } from '../components/profile/ProfileCompletion';
import { ProfessionalIdentity } from '../components/profile/ProfessionalIdentity';
import { Chip } from '../components/Chip';
import { formatRange, maskNumber, toBullets, joinMeta } from '../components/profile/format';
import type { Profile } from '../types/profile';

/**
 * These cover the rules that make the profile trustworthy rather than merely
 * pretty. Each one is a claim the design brief makes that is easy to break
 * later without anything looking wrong.
 */

describe('VerifiedMark', () => {
  it('renders nothing for an unverified claim on a public profile', () => {
    // Absence, not a grey badge: a wall of "not verified" chips reads as noise
    // and quietly implies the opposite of what the section is for.
    const { toJSON } = render(<VerifiedMark status="unverified" />);
    expect(toJSON()).toBeNull();
  });

  it('still offers an unverified state to the owner, who can act on it', () => {
    const { toJSON } = render(<VerifiedMark status="unverified" showUnverified />);
    expect(toJSON()).not.toBeNull();
  });

  it('never signals with colour alone', () => {
    // Teal-vs-amber is not a distinction every reader can make, so each state
    // carries a word as well as a hue.
    const { getByText } = render(<VerifiedMark status="verified" />);
    expect(getByText('Verified')).toBeTruthy();
    const pending = render(<VerifiedMark status="pending" />);
    expect(pending.getByText('Pending')).toBeTruthy();
  });

  it('exposes the state to screen readers', () => {
    const { getByLabelText } = render(<VerifiedMark status="verified" />);
    expect(getByLabelText('Verification status: Verified')).toBeTruthy();
  });
});

describe('ProfileSection', () => {
  const empty = {
    title: 'Professional experience',
    isEmpty: true,
    emptyTitle: 'Build your professional journey',
    emptyHint: 'Add your clinical experience.',
    addLabel: 'Add experience',
  };

  it('guides a first-time user instead of showing a blank space', () => {
    const { getByText } = render(<ProfileSection {...empty} editable onAdd={() => {}} />);
    expect(getByText('Build your professional journey')).toBeTruthy();
    expect(getByText('Add your clinical experience.')).toBeTruthy();
  });

  it('offers no editing affordances to a visitor', () => {
    const { queryByLabelText } = render(
      <ProfileSection {...empty} onAdd={() => {}} onChangeVisibility={() => {}} visibility="everyone" />,
    );
    expect(queryByLabelText(/Add experience/)).toBeNull();
    expect(queryByLabelText(/visibility/i)).toBeNull();
  });

  it('vanishes entirely for a visitor when it has nothing to show', () => {
    // Otherwise a visitor reads ten "Add your ..." prompts down a stranger CV.
    const { toJSON } = render(<ProfileSection {...empty} />);
    expect(toJSON()).toBeNull();
  });

  it('names the current audience on the privacy control', () => {
    const { getByLabelText } = render(
      <ProfileSection
        {...empty}
        editable
        visibility="employers"
        onChangeVisibility={() => {}}
        testID="section-x"
      />,
    );
    expect(
      getByLabelText('Professional experience visibility: Employers and hospitals. Change'),
    ).toBeTruthy();
  });
});

describe('TimelineList', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: `e${i}`,
    title: `Role ${i}`,
    subtitle: 'Apollo Hospitals',
  }));

  it('caps a long history and expands on demand rather than hiding it in an accordion', () => {
    const { getByText, queryByText } = render(<TimelineList items={items} testID="tl" />);
    expect(getByText('Role 0')).toBeTruthy();
    expect(queryByText('Role 4')).toBeNull();

    fireEvent.press(getByText('Show all 5'));
    expect(getByText('Role 4')).toBeTruthy();
  });

  it('does not offer an expander when everything already fits', () => {
    const { queryByText } = render(<TimelineList items={items.slice(0, 2)} />);
    expect(queryByText(/Show all/)).toBeNull();
  });
});

describe('ProfileCompletion', () => {
  it('disappears at 100% rather than lingering as a trophy', () => {
    const { toJSON } = render(
      <ProfileCompletion completion={{ percent: 100, suggestions: [] }} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('reports progress to assistive tech as a progressbar', () => {
    const { getByLabelText } = render(
      <ProfileCompletion completion={{ percent: 78, suggestions: [] }} />,
    );
    const bar = getByLabelText('Profile completeness');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 78 });
  });

  it('surfaces at most three suggestions', () => {
    const suggestions = [
      { key: 'avatar' as const, label: 'Add a profile photo' },
      { key: 'about' as const, label: 'Write a professional summary' },
      { key: 'experience' as const, label: 'Add your clinical experience' },
    ];
    const { getByText } = render(
      <ProfileCompletion completion={{ percent: 40, suggestions }} />,
    );
    suggestions.forEach((s) => expect(getByText(s.label)).toBeTruthy());
  });
});

describe('Chip', () => {
  it('is inert with no handler, so a static label is not announced as a button', () => {
    const { queryByRole } = render(<Chip label="Cardiology" />);
    expect(queryByRole('button')).toBeNull();
  });

  it('describes what removal will do', () => {
    const onRemove = jest.fn();
    const { getByLabelText } = render(<Chip label="ECG" onRemove={onRemove} />);
    fireEvent.press(getByLabelText('Remove ECG'));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('ProfessionalIdentity Connect button', () => {
  const visited: Profile = { id: 'other-1', name: 'Dr Other', entries: {} };

  it('offers Connect on a stranger\'s profile you have never messaged', () => {
    const onConnect = jest.fn();
    const { getByTestId } = render(
      <ProfessionalIdentity profile={visited} isMobile connectionState="none" onConnect={onConnect} />,
    );
    const btn = getByTestId('profile-connect');
    expect(btn.props.accessibilityLabel).toBe('Connect');
    fireEvent.press(btn);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('goes inert instead of re-sending once a request is already pending', () => {
    const onConnect = jest.fn();
    const { getByTestId } = render(
      <ProfessionalIdentity profile={visited} isMobile connectionState="pending" onConnect={onConnect} />,
    );
    const btn = getByTestId('profile-connect');
    expect(btn.props.accessibilityLabel).toBe('Request sent');
    fireEvent.press(btn);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('shows Connected, not another Connect prompt, once accepted', () => {
    const { getByTestId } = render(
      <ProfessionalIdentity profile={visited} isMobile connectionState="accepted" onConnect={jest.fn()} />,
    );
    expect(getByTestId('profile-connect').props.accessibilityLabel).toBe('Connected');
  });

  it('never offers to connect with yourself', () => {
    const { queryByTestId } = render(
      <ProfessionalIdentity profile={{ ...visited, is_self: true }} isMobile editable onEdit={jest.fn()} />,
    );
    expect(queryByTestId('profile-connect')).toBeNull();
  });
});

describe('resume formatting', () => {
  it('reads an open-ended role as Present rather than leaving it blank', () => {
    // A missing end date is ambiguous between "current" and "not filled in".
    expect(formatRange('2022-01', undefined, true)).toBe('Jan 2022 — Present');
    expect(formatRange('2019-06', '2022-01')).toBe('Jun 2019 — Jan 2022');
    expect(formatRange(undefined, undefined)).toBe('');
  });

  it('masks a registration number but keeps it recognisable', () => {
    expect(maskNumber('TSMC123456')).toBe('••••••3456');
    expect(maskNumber('1234')).toBe('1234');
    expect(maskNumber('')).toBe('');
  });

  it('turns a description into bullets, tolerating pasted list markers', () => {
    expect(toBullets('- Managed cases\n• Performed procedures\n\nLed teams')).toEqual([
      'Managed cases',
      'Performed procedures',
      'Led teams',
    ]);
  });

  it('drops blanks so no stray separators appear in a meta line', () => {
    expect(joinMeta('Cardiology', undefined, 'Hyderabad')).toBe('Cardiology · Hyderabad');
    expect(joinMeta(undefined, '')).toBe('');
  });
});
