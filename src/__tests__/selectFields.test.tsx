import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SelectField } from '../components/SelectField';
import {
  INDIAN_STATES, STATE_NAMES, citiesForState, isCustomCity, OTHER_CITY,
} from '../data/indiaLocations';
import {
  SPECIALTIES, SPECIALTY_OPTIONS, OTHER_SPECIALTY, isCustomSpecialty,
} from '../data/specialties';

/**
 * The pickers that replaced free-text state, city and specialty fields.
 *
 * The round-trip helpers are what stop a saved value from vanishing when its
 * form re-opens — a member who typed "Ballarpur" before these lists existed
 * must still see it, not an empty field over their saved profile.
 */

describe('Indian location data', () => {
  it('covers all 28 states and 8 union territories', () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(STATE_NAMES).toContain('Maharashtra');
    expect(STATE_NAMES).toContain('Ladakh');
    expect(STATE_NAMES).toContain('Puducherry');
  });

  it('gives every state a non-empty, duplicate-free city list', () => {
    for (const state of INDIAN_STATES) {
      expect(state.cities.length).toBeGreaterThan(0);
      expect(new Set(state.cities).size).toBe(state.cities.length);
    }
  });

  it('keeps each state cities sorted, so a picker reads alphabetically', () => {
    for (const state of INDIAN_STATES) {
      const sorted = [...state.cities].sort((a, b) => a.localeCompare(b));
      expect(state.cities).toEqual(sorted);
    }
  });

  it('returns cities for a known state and nothing for an unknown one', () => {
    expect(citiesForState('Kerala')).toContain('Kochi');
    expect(citiesForState('Atlantis')).toEqual([]);
    expect(citiesForState(undefined)).toEqual([]);
  });

  it('flags a free-text city as custom so it re-opens under "Other"', () => {
    expect(isCustomCity('Kerala', 'Kochi')).toBe(false);
    expect(isCustomCity('Kerala', 'Some Village')).toBe(true);
    // An empty city is simply unset, not a custom value.
    expect(isCustomCity('Kerala', '')).toBe(false);
  });
});

describe('specialty data', () => {
  it('is alphabetical and duplicate-free', () => {
    expect(new Set(SPECIALTIES).size).toBe(SPECIALTIES.length);
    expect(SPECIALTIES).toEqual([...SPECIALTIES].sort((a, b) => a.localeCompare(b)));
  });

  it('pins the free-text escape last so it is not lost mid-list', () => {
    expect(SPECIALTY_OPTIONS[SPECIALTY_OPTIONS.length - 1]).toBe(OTHER_SPECIALTY);
    expect(SPECIALTIES).not.toContain(OTHER_SPECIALTY);
  });

  it('flags a free-text specialty as custom', () => {
    expect(isCustomSpecialty('Cardiology')).toBe(false);
    expect(isCustomSpecialty('Hyperbaric Medicine')).toBe(true);
    expect(isCustomSpecialty('')).toBe(false);
  });
});

describe('SelectField', () => {
  const setup = (props: Partial<React.ComponentProps<typeof SelectField>> = {}) => {
    const onChange = jest.fn();
    render(
      <SelectField
        testID="picker"
        label="State"
        value=""
        onChange={onChange}
        options={STATE_NAMES}
        placeholder="Select your state"
        {...props}
      />,
    );
    return { onChange };
  };

  it('shows the placeholder until something is chosen', () => {
    setup();
    expect(screen.getByText('Select your state')).toBeTruthy();
  });

  it('shows the current value once there is one', () => {
    setup({ value: 'Kerala' });
    expect(screen.getByText('Kerala')).toBeTruthy();
  });

  it('opens the sheet and reports the option that was tapped', () => {
    const { onChange } = setup();
    fireEvent.press(screen.getByTestId('picker'));
    fireEvent.press(screen.getByTestId('picker-option-Kerala'));
    expect(onChange).toHaveBeenCalledWith('Kerala');
  });

  it('filters as you type', () => {
    setup();
    fireEvent.press(screen.getByTestId('picker'));
    fireEvent.changeText(screen.getByTestId('picker-search'), 'punj');
    expect(screen.getByTestId('picker-option-Punjab')).toBeTruthy();
    expect(screen.queryByTestId('picker-option-Kerala')).toBeNull();
  });

  it('ranks prefix matches above matches buried mid-word', () => {
    const onChange = jest.fn();
    render(
      <SelectField
        testID="city"
        label="City"
        value=""
        onChange={onChange}
        // Long enough to earn a search box, and mixing both kinds of match.
        options={[
          'Ajmer', 'Alwar', 'Bhilwara', 'Bikaner', 'Haridwar', 'Jaipur',
          'Kota', 'Udaipur', 'Warangal', 'Wardha',
        ]}
      />,
    );
    fireEvent.press(screen.getByTestId('city'));
    fireEvent.changeText(screen.getByTestId('city-search'), 'war');

    const shown = screen.getAllByRole('radio').map(node => node.props.accessibilityLabel);
    // Warangal/Wardha start with it; the rest only contain it.
    expect(shown).toEqual(['Warangal', 'Wardha', 'Alwar', 'Bhilwara', 'Haridwar']);
  });

  it('says so when nothing matches, rather than showing a blank sheet', () => {
    setup();
    fireEvent.press(screen.getByTestId('picker'));
    fireEvent.changeText(screen.getByTestId('picker-search'), 'zzzz');
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('cannot be opened while disabled, and explains what to do first', () => {
    const { onChange } = setup({ disabled: true, disabledHint: 'Choose a state first' });
    expect(screen.getByText('Choose a state first')).toBeTruthy();
    fireEvent.press(screen.getByTestId('picker'));
    expect(screen.queryByTestId('picker-search')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers the free-text escape at the end of a city list', () => {
    const onChange = jest.fn();
    render(
      <SelectField
        testID="city"
        label="City"
        value=""
        onChange={onChange}
        options={[...citiesForState('Goa'), OTHER_CITY]}
      />,
    );
    fireEvent.press(screen.getByTestId('city'));
    fireEvent.press(screen.getByTestId(`city-option-${OTHER_CITY}`));
    expect(onChange).toHaveBeenCalledWith(OTHER_CITY);
  });

  it('skips the search box for a list short enough to read at a glance', () => {
    const onChange = jest.fn();
    render(
      <SelectField testID="tiny" label="Pick" value="" onChange={onChange} options={['A', 'B']} />,
    );
    fireEvent.press(screen.getByTestId('tiny'));
    expect(screen.queryByTestId('tiny-search')).toBeNull();
    expect(screen.getByTestId('tiny-option-A')).toBeTruthy();
  });
});
