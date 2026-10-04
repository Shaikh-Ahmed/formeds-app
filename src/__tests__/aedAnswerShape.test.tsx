import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AedMarkdown, parseMarkdown, sectionsOf } from '../components/aed/AedMarkdown';

/**
 * Clinical answers: the bottom line as a card, background sections folded,
 * missing information as a box at the end, and Finding -> Action tables at full
 * width. Answers without that shape render as before.
 */

const ANSWER = `**Bottom line:** Clarithromycin raises apixaban exposure, but the label requires no dose change [1].

### Mechanism
CYP3A4 and P-gp inhibition.

### What to do now
Continue apixaban 5 mg twice daily.

### Finding → Action
| Finding | Action |
|---|---|
| Melaena | Stop apixaban and assess |

**Missing information**
- Weight and serum creatinine.`;

describe('clinical answer shape', () => {
  it('splits an answer into its bottom line and sections', () => {
    const sections = sectionsOf(parseMarkdown(ANSWER));
    expect(sections[0]).toEqual({ kind: 'bottom', text: expect.stringContaining('Clarithromycin raises') });
    expect(sections.map(s => (s.kind === 'section' ? `${s.heading}:${s.variant}` : 'bottom'))).toEqual([
      'bottom', 'Mechanism:collapsible', 'What to do now:plain', 'Finding → Action:plain', 'Missing information:missing']);
  });

  it('renders the bottom line card, a folded mechanism, the trigger table and the missing-information box', () => {
    render(<AedMarkdown text={ANSWER} onCite={() => {}} />);
    expect(screen.getByTestId('aed-bottom-line')).toBeTruthy();
    expect(screen.getByText('BOTTOM LINE')).toBeTruthy();
    expect(screen.queryByText('CYP3A4 and P-gp inhibition.')).toBeNull();
    fireEvent.press(screen.getByTestId('aed-md-collapsible'));
    expect(screen.getByText('CYP3A4 and P-gp inhibition.')).toBeTruthy();
    expect(screen.getByTestId('aed-md-trigger-table')).toBeTruthy();
    expect(screen.getByTestId('aed-missing-info')).toBeTruthy();
    expect(screen.getByText('Missing information that changes the answer')).toBeTruthy();
  });

  it('keeps AED check notes out of the missing-information box', () => {
    const sections = sectionsOf(parseMarkdown(`${ANSWER}\n\n_Some doses above do not appear in the sources cited._`));
    const last = sections[sections.length - 1];
    expect(last.kind === 'section' && last.variant).toBe('plain');
    expect(sections[sections.length - 2].kind === 'section' && (sections[sections.length - 2] as any).variant).toBe('missing');
  });

  it('leaves answers without the shape as they were', () => {
    render(<AedMarkdown text={'Metformin lowers hepatic glucose output.\n\n- Take with food'} />);
    expect(screen.queryByTestId('aed-bottom-line')).toBeNull();
    expect(screen.queryByTestId('aed-missing-info')).toBeNull();
    expect(screen.getByText('Metformin lowers hepatic glucose output.')).toBeTruthy();
  });
});
