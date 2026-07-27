import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../components/Button';
import { RoleBadge } from '../components/RoleBadge';
import { EmptyState, ErrorBanner } from '../components/States';

describe('Button', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<Button label="Save changes" onPress={onPress} testID="btn" />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(screen.getByText('Save changes')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading', () => {
    const onPress = jest.fn();
    render(<Button label="Save" onPress={onPress} loading testID="btn" />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes an accessible role and label', () => {
    render(<Button label="Sign in" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });
});

describe('RoleBadge', () => {
  it('shows the short label by default and the long one on request', () => {
    const { rerender } = render(<RoleBadge role="healthcare_professional" />);
    expect(screen.getByText('Professional')).toBeTruthy();
    rerender(<RoleBadge role="healthcare_professional" long />);
    expect(screen.getByText('Healthcare Professional')).toBeTruthy();
  });

  it('falls back for an unknown role instead of rendering blank', () => {
    render(<RoleBadge role="something-else" />);
    expect(screen.getByText('Professional')).toBeTruthy();
  });
});

describe('States', () => {
  it('EmptyState shows guidance and an optional action', () => {
    const onAction = jest.fn();
    render(<EmptyState title="No connections yet" hint="Search for colleagues" actionLabel="Find people" onAction={onAction} />);
    expect(screen.getByText('No connections yet')).toBeTruthy();
    expect(screen.getByText('Search for colleagues')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Find people' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('ErrorBanner renders nothing when there is no message', () => {
    const { toJSON } = render(<ErrorBanner message={null} />);
    expect(toJSON()).toBeNull();
  });
});
