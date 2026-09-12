import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { JobWizard } from '../components/jobs/wizard/JobWizard';

/**
 * The posting wizard.
 *
 * Two behaviours are worth pinning because both are easy to break and neither
 * fails loudly:
 *
 *  1. Each step validates ONLY itself. If Next started checking the whole form,
 *     somebody would be blocked on step one by a description field three steps
 *     away that they have not seen — and the message would name a field not on
 *     screen.
 *  2. Shift fields appear only for the employment types that have dates. The
 *     server rejects a full-time role carrying a shift date and a locum without
 *     one, so showing them for every type turns a valid post into a 422.
 */

const setup = (props = {}) =>
  render(<JobWizard onSubmit={jest.fn()} {...props} />);

const typeTitle = (value: string) =>
  fireEvent.changeText(screen.getByTestId('wizard-title'), value);

describe('JobWizard', () => {
  it('says where you are, out loud', () => {
    setup();
    // A progress bar alone announces nothing; the count is the accessible part.
    expect(screen.getByTestId('wizard-progress').props.children.join('')).toBe('Step 1 of 4');
  });

  it('advances only when this step is satisfied', () => {
    setup();
    fireEvent.press(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('wizard-progress').props.children.join('')).toBe('Step 1 of 4');
    expect(screen.getByText('Give the role a full title.')).toBeTruthy();

    typeTitle('Senior Consultant Cardiologist');
    fireEvent.press(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('wizard-progress').props.children.join('')).toBe('Step 2 of 4');
  });

  it('does not block step one on a field belonging to a later step', () => {
    // The description floor lives on step four. Reaching step two must not
    // require it, or the wizard is a single form wearing a costume.
    setup();
    typeTitle('Senior Consultant Cardiologist');
    fireEvent.press(screen.getByTestId('wizard-next'));

    expect(screen.getByTestId('wizard-progress').props.children.join('')).toBe('Step 2 of 4');
    expect(screen.queryByText(/Describe the role/)).toBeNull();
  });

  it('shows shift fields for a locum and hides them for a standing post', () => {
    setup();
    typeTitle('Overnight Emergency Cover');

    fireEvent.press(screen.getByTestId('wizard-type-locum'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('wizard-shift-fields')).toBeTruthy();

    fireEvent.press(screen.getByTestId('wizard-back'));
    fireEvent.press(screen.getByTestId('wizard-type-full_time'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    expect(screen.queryByTestId('wizard-shift-fields')).toBeNull();
  });

  it('drops the location requirement for a fully remote role', () => {
    setup();
    typeTitle('Teleconsultation Physician');
    fireEvent.press(screen.getByTestId('wizard-next'));

    // On-site by default, so Next is blocked until a city is chosen...
    fireEvent.press(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('wizard-progress').props.children.join('')).toBe('Step 2 of 4');

    // ...and remote removes the requirement rather than demanding a fake city.
    fireEvent.press(screen.getByTestId('wizard-mode-remote'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('wizard-progress').props.children.join('')).toBe('Step 3 of 4');
  });

  it('offers draft and publish as separate outcomes when creating', () => {
    setup();
    typeTitle('Senior Consultant Cardiologist');
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-mode-remote'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));

    expect(screen.getByTestId('wizard-draft')).toBeTruthy();
    expect(screen.getByTestId('wizard-publish')).toBeTruthy();
  });

  it('previews with the real card, not a mock-up of one', () => {
    setup();
    typeTitle('Senior Consultant Cardiologist');
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-mode-remote'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));

    expect(screen.getByTestId('wizard-preview')).toBeTruthy();
    // The actual JobCard renders with the draft's own title.
    expect(screen.getByTestId('job-card-preview')).toBeTruthy();
    expect(screen.getAllByText('Senior Consultant Cardiologist').length).toBeGreaterThan(0);
  });

  it('sends back what was typed, and publishes only when asked', () => {
    const onSubmit = jest.fn();
    setup({ onSubmit });

    typeTitle('Senior Consultant Cardiologist');
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-mode-remote'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.changeText(
      screen.getByTestId('wizard-description'),
      'Join a busy interventional service running a full cath lab rota, with a supportive team.',
    );

    fireEvent.press(screen.getByTestId('wizard-draft'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [payload, opts] = onSubmit.mock.calls[0];
    expect(payload.title).toBe('Senior Consultant Cardiologist');
    expect(payload.work_mode).toBe('remote');
    expect(opts).toEqual({ publish: false });

    fireEvent.press(screen.getByTestId('wizard-publish'));
    expect(onSubmit.mock.calls[1][1]).toEqual({ publish: true });
  });

  it('sends no shift fields on a standing post', () => {
    // '' is still a value, and the server rejects shift fields on a non-shift
    // role, so they have to be absent rather than blank.
    const onSubmit = jest.fn();
    setup({ onSubmit });

    typeTitle('Senior Consultant Cardiologist');
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-mode-remote'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.changeText(
      screen.getByTestId('wizard-description'),
      'Join a busy interventional service running a full cath lab rota, with a supportive team.',
    );
    fireEvent.press(screen.getByTestId('wizard-publish'));

    const [payload] = onSubmit.mock.calls[0];
    expect('shift_start_date' in payload).toBe(false);
    expect('shift_time' in payload).toBe(false);
  });

  it('sends back to the offending step when finishing with a gap', () => {
    const onSubmit = jest.fn();
    setup({ onSubmit });

    typeTitle('Senior Consultant Cardiologist');
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-mode-remote'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));

    // Description never filled in.
    fireEvent.press(screen.getByTestId('wizard-publish'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Describe the role in at least a couple of sentences.')).toBeTruthy();
  });

  it('opens on the stored values when editing, and offers no draft button', () => {
    setup({
      mode: 'edit',
      initial: {
        title: 'Existing Consultant Role',
        work_mode: 'remote' as const,
        description: 'An existing description that is comfortably long enough to pass.',
      },
    });

    expect(screen.getByTestId('wizard-title').props.value).toBe('Existing Consultant Role');
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));
    fireEvent.press(screen.getByTestId('wizard-next'));

    // A published role cannot be un-published back into a draft.
    expect(screen.queryByTestId('wizard-draft')).toBeNull();
    expect(screen.getByTestId('wizard-publish')).toBeTruthy();
  });
});
