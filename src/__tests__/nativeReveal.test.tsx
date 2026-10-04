import React from 'react';
import { Dimensions } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { registerInvalidField, revealFirstInvalidNative, type InvalidField } from '../utils/invalidFields';
import { FormScrollView } from '../components/FormScrollView';
import { FormInput } from '../components/FormInput';

/** A registered field whose on-screen position the test decides. */
function field(y: number, h = 18): InvalidField & { reveal: jest.Mock; focus: jest.Mock } {
  const reveal = jest.fn();
  const focus = jest.fn();
  const node: any = { measureInWindow: (cb: any) => cb(16, y, 300, h) };
  return { anchor: { current: node }, scroll: { reveal }, focus, reveal };
}

const flush = () => new Promise(r => setTimeout(r, 400));

beforeAll(() => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 2, fontScale: 1 });
});

describe('native: bring the first invalid field into view', () => {
  it('scrolls to the topmost invalid field when it is off screen, then focuses it', async () => {
    const below = field(1500);
    const further = field(2200);
    const off = [registerInvalidField(further), registerInvalidField(below)];
    revealFirstInvalidNative();
    await flush();
    expect(below.reveal).toHaveBeenCalledTimes(1);
    expect(below.focus).toHaveBeenCalledTimes(1);
    expect(further.reveal).not.toHaveBeenCalled();
    off.forEach(f => f());
  });

  it('does not move the screen when the field is already visible', async () => {
    const visible = field(400);
    const off = registerInvalidField(visible);
    revealFirstInvalidNative();
    await flush();
    expect(visible.reveal).not.toHaveBeenCalled();
    expect(visible.focus).toHaveBeenCalledTimes(1);
    off();
  });

  it('ignores fields on screens further back in the stack (zero-sized)', async () => {
    const hidden: InvalidField & { reveal: jest.Mock } = {
      ...field(0), anchor: { current: { measureInWindow: (cb: any) => cb(0, 0, 0, 0) } as any },
    } as any;
    const current = field(1200);
    const off = [registerInvalidField(hidden), registerInvalidField(current)];
    revealFirstInvalidNative();
    await flush();
    expect(hidden.reveal).not.toHaveBeenCalled();
    expect(current.reveal).toHaveBeenCalled();
    off.forEach(f => f());
  });

  it('a field error inside a FormScrollView registers while shown, and not otherwise', () => {
    const { rerender } = render(
      <FormScrollView>
        <FormInput label="Price" value="" onChangeText={() => {}} error="Price is required." testID="price" />
      </FormScrollView>,
    );
    expect(screen.getByText('Price is required.')).toBeTruthy();
    rerender(
      <FormScrollView>
        <FormInput label="Price" value="100" onChangeText={() => {}} testID="price" />
      </FormScrollView>,
    );
    expect(screen.queryByText('Price is required.')).toBeNull();
  });
});
