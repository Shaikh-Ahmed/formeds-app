import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { EntrySheet } from '../components/profile/EntrySheet';
import { SCALAR_FORMS } from '../components/profile/entryForms';
import { citiesForState } from '../data/indiaLocations';

/**
 * The "Edit profile" sheet's state and city pickers.
 *
 * This is the form the web app actually opens — `app/edit-profile.tsx` is the
 * mobile drawer's route, and the two are wired separately. A regression here
 * puts free-text location fields back on the profile without anything failing.
 */

// EntrySheet reaches the component barrel, which pulls AuthContext and with it
// the native secure-storage module. Stubbing the context is how the other
// suites here keep that chain out of the test environment.
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, token: null, isKycApproved: true }),
}));

const renderSheet = async (initial?: Record<string, any>) => {
  const onSave = jest.fn();
  render(
    <EntrySheet
      visible
      kind={null}
      form={SCALAR_FORMS.identity}
      // Full name is required on this form; supplying it keeps these tests
      // about the location pickers rather than about validation.
      initial={{ name: 'Dr Demo Sharma', ...initial }}
      onSave={onSave}
      onClose={jest.fn()}
    />,
  );
  // The sheet probes reduce-motion on mount; flushing it here keeps that state
  // update inside act() instead of warning after the test has finished.
  await act(async () => {});
  return { onSave };
};

const save = () => fireEvent.press(screen.getByTestId('entry-sheet-save'));

/**
 * Opens a picker and chooses an option, searching first so the choice does not
 * depend on where the option falls in the virtualised list — Mumbai sits past
 * FlatList's initial window in Maharashtra's 47 cities.
 */
const choose = (fieldTestID: string, option: string) => {
  fireEvent.press(screen.getByTestId(fieldTestID));
  const search = screen.queryByTestId(`${fieldTestID}-search`);
  if (search) fireEvent.changeText(search, option);
  fireEvent.press(screen.getByTestId(`${fieldTestID}-option-${option}`));
};

describe('EntrySheet identity lookups', () => {
  it('renders state and city as pickers, not text inputs', async () => {
    await renderSheet();
    expect(screen.getByTestId('entry-state')).toBeTruthy();
    expect(screen.getByTestId('entry-city')).toBeTruthy();
  });

  it('keeps city closed until a state is chosen, and says why', async () => {
    await renderSheet();
    expect(screen.getByText('Choose a state first')).toBeTruthy();
    fireEvent.press(screen.getByTestId('entry-city'));
    expect(screen.queryByTestId('entry-city-search')).toBeNull();
  });

  it('offers that state cities once a state is picked', async () => {
    await renderSheet();
    choose('entry-state', 'Kerala');

    fireEvent.press(screen.getByTestId('entry-city'));
    fireEvent.changeText(screen.getByTestId('entry-city-search'), 'Kochi');
    expect(screen.getByTestId('entry-city-option-Kochi')).toBeTruthy();
    // A Maharashtra city must not be reachable from Kerala.
    fireEvent.changeText(screen.getByTestId('entry-city-search'), 'Mumbai');
    expect(screen.queryByTestId('entry-city-option-Mumbai')).toBeNull();
  });

  it('saves the pair that was chosen', async () => {
    const { onSave } = await renderSheet();
    choose('entry-state', 'Maharashtra');
    choose('entry-city', 'Pune');
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'Maharashtra', city: 'Pune' }),
    );
  });

  it('clears the city when the state changes, rather than saving Mumbai, Kerala', async () => {
    const { onSave } = await renderSheet();
    choose('entry-state', 'Maharashtra');
    choose('entry-city', 'Mumbai');

    choose('entry-state', 'Kerala');

    save();
    const saved = onSave.mock.calls[0][0];
    expect(saved.state).toBe('Kerala');
    expect(saved.city).toBeUndefined(); // pruneEmpty drops the cleared field
  });

  it('reveals a text box for a town that is not listed, and saves what is typed', async () => {
    const { onSave } = await renderSheet();
    choose('entry-state', 'Goa');
    choose('entry-city', 'Other');

    fireEvent.changeText(screen.getByTestId('entry-city-other'), 'Assagao');
    save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'Goa', city: 'Assagao' }),
    );
  });

  it('re-opens a city saved before these lists existed, instead of blanking it', async () => {
    // Free text from the old input: in Maharashtra, but not on the list.
    await renderSheet({ state: 'Maharashtra', city: 'Ballarpur' });
    expect(citiesForState('Maharashtra')).not.toContain('Ballarpur');
    // Shown in the "Other" box rather than silently dropped.
    expect(screen.getByTestId('entry-city-other').props.value).toBe('Ballarpur');
  });

  it('shows a listed city as the picker value, with no stray text box', async () => {
    await renderSheet({ state: 'Maharashtra', city: 'Pune' });
    expect(screen.getByText('Pune')).toBeTruthy();
    expect(screen.queryByTestId('entry-city-other')).toBeNull();
  });
});
