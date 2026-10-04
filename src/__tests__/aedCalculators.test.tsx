import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/** The calculator screen builds its form from each calculator's schema and
 *  shows the server's validated result, never a number of its own. */

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ token: 't', user: { id: 'u1' } }) }));

const mockRun = jest.fn();
jest.mock('../api/aedCalculators', () => {
  const actual = jest.requireActual('../api/aedCalculators');
  return {
    ...actual,
    fetchCalculators: jest.fn(async () => ({ calculators: [
      { name: 'egfr_ckd_epi_2021', title: 'eGFR (CKD-EPI 2021)', inputs: { properties: {
        age: { title: 'Age (years)', type: 'integer' },
        sex: { title: 'Sex', type: 'string', enum: ['female', 'male'] },
        creatinine_mg_dl: { title: 'Serum creatinine (mg/dL)', type: 'number' } } } },
      { name: 'cha2ds2_vasc', title: 'CHA2DS2-VASc', inputs: { properties: {
        hypertension: { title: 'Hypertension', type: 'boolean', default: false } } } },
    ] })),
    runCalculator: (...args: any[]) => mockRun(...args),
  };
});

// eslint-disable-next-line import/first
import AedCalculatorsScreen from '../../app/aed/calculators';

describe('clinical calculators', () => {
  beforeEach(() => mockRun.mockReset());

  it('sends typed values and shows the validated result with its reference', async () => {
    mockRun.mockResolvedValue({ name: 'egfr_ckd_epi_2021', value: 35, unit: 'mL/min/1.73 m²', category: 'G3b',
                                interpretation: 'eGFR category G3b (KDIGO).', reference: 'Inker LA et al. 2021', details: {} });
    render(<AedCalculatorsScreen />);
    await waitFor(() => expect(screen.getByTestId('calc-egfr_ckd_epi_2021')).toBeTruthy());
    fireEvent.press(screen.getByTestId('calc-egfr_ckd_epi_2021'));
    fireEvent.changeText(screen.getByTestId('field-age'), '70');
    fireEvent.press(screen.getByTestId('field-sex-male'));
    fireEvent.changeText(screen.getByTestId('field-creatinine_mg_dl'), '2.0');
    await act(async () => { fireEvent.press(screen.getByTestId('calc-run')); });
    expect(mockRun).toHaveBeenCalledWith('t', 'egfr_ckd_epi_2021', { age: 70, sex: 'male', creatinine_mg_dl: 2 });
    expect(screen.getByTestId('calc-result')).toBeTruthy();
    expect(screen.getByText('G3b')).toBeTruthy();
    expect(screen.getByText('Inker LA et al. 2021')).toBeTruthy();
  });

  it('names the field the server rejected', async () => {
    mockRun.mockRejectedValue({ message: 'Input should be greater than or equal to 18',
                                data: { detail: { code: 'aed_invalid_inputs', field: 'age' } } });
    render(<AedCalculatorsScreen />);
    await waitFor(() => expect(screen.getByTestId('calc-egfr_ckd_epi_2021')).toBeTruthy());
    fireEvent.press(screen.getByTestId('calc-egfr_ckd_epi_2021'));
    fireEvent.changeText(screen.getByTestId('field-age'), '12');
    await act(async () => { fireEvent.press(screen.getByTestId('calc-run')); });
    expect(screen.getByText('Age (years): Input should be greater than or equal to 18')).toBeTruthy();
  });

  it('starts yes/no inputs at their default', async () => {
    mockRun.mockResolvedValue({ name: 'cha2ds2_vasc', value: 0, unit: 'points', category: null,
                                interpretation: 'i', reference: 'r', details: {} });
    render(<AedCalculatorsScreen />);
    await waitFor(() => expect(screen.getByTestId('calc-cha2ds2_vasc')).toBeTruthy());
    fireEvent.press(screen.getByTestId('calc-cha2ds2_vasc'));
    await act(async () => { fireEvent.press(screen.getByTestId('calc-run')); });
    expect(mockRun).toHaveBeenCalledWith('t', 'cha2ds2_vasc', { hypertension: false });
  });
});
