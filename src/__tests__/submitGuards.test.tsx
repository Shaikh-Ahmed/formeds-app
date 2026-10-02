import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { useSubmit } from '../hooks/useSubmit';
import { useFormErrors } from '../hooks/useFormErrors';
import { Button } from '../components/Button';
import { FormInput } from '../components/FormInput';
import { ApiError } from '../utils/api';

/** A request the test resolves by hand, to hold a submission "in flight". */
function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useSubmit: one logical submission, one request', () => {
  it('ignores every repeat while the first is in flight', async () => {
    const { result } = renderHook(() => useSubmit());
    const pending = deferred();
    const send = jest.fn(() => pending.promise);
    let first: Promise<unknown>;
    act(() => {
      first = result.current.run(send, { a: 1 });
      // Double click, Enter + click, a double tap: all land here.
      result.current.run(send, { a: 1 });
      result.current.run(send, { a: 1 });
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(true);
    await act(async () => { pending.resolve('ok'); await first; });
    expect(result.current.submitting).toBe(false);
  });

  it('retries the same content with the same key, so the server can replay it', async () => {
    const { result } = renderHook(() => useSubmit());
    const keys: string[] = [];
    const failing = jest.fn(async (key: string) => { keys.push(key); throw new Error('timed out'); });
    await act(async () => { await result.current.run(failing, { price: 100 }).catch(() => {}); });
    await act(async () => { await result.current.run(failing, { price: 100 }).catch(() => {}); });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('gives changed content a new key: a new submission is never blocked', async () => {
    const { result } = renderHook(() => useSubmit());
    const keys: string[] = [];
    const send = async (key: string) => { keys.push(key); };
    await act(async () => { await result.current.run(send, { date: '2026-10-01' }); });
    await act(async () => { await result.current.run(send, { date: '2026-10-02' }); });
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('replays a stray repeat just after success, and starts fresh after reset', async () => {
    const { result } = renderHook(() => useSubmit());
    const keys: string[] = [];
    const send = async (key: string) => { keys.push(key); };
    await act(async () => { await result.current.run(send, { x: 1 }); });
    await act(async () => { await result.current.run(send, { x: 1 }); });
    expect(keys[1]).toBe(keys[0]);
    act(() => result.current.reset());
    await act(async () => { await result.current.run(send, { x: 1 }); });
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('never reuses a key when no content identifies the submission', async () => {
    const { result } = renderHook(() => useSubmit());
    const keys: string[] = [];
    const send = async (key: string) => { keys.push(key); };
    await act(async () => { await result.current.run(send); });
    await act(async () => { await result.current.run(send); });
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe('useFormErrors: errors go where they can be fixed', () => {
  it('places server field errors on the form fields, mapping names', () => {
    const { result } = renderHook(() => useFormErrors<'pay' | 'date'>({
      serverFields: { pay_amount: 'pay', shift_date: 'date' },
    }));
    const e = new ApiError('Pay amount is required', 422, {
      detail: [
        { loc: ['body', 'pay_amount'], field: 'pay_amount', msg: 'Pay amount is required' },
        { loc: ['body', 'shift_date'], field: 'shift_date', msg: 'Locum date cannot be in the past' },
      ],
    });
    let placed = false;
    act(() => { placed = result.current.fromError(e); });
    expect(placed).toBe(true);
    expect(result.current.fields).toEqual({
      pay: 'Pay amount is required', date: 'Locum date cannot be in the past',
    });
    // Nothing is repeated in a banner.
    expect(result.current.formError).toBeNull();
  });

  it('maps nested paths and business-rule codes to fields', () => {
    const { result } = renderHook(() => useFormErrors<'city' | 'email'>({
      serverFields: { 'location.city': 'city' }, codes: { email_taken: 'email' },
    }));
    act(() => {
      result.current.fromError(new ApiError('City is required', 422, {
        detail: [{ loc: ['body', 'location', 'city'], field: 'city', msg: 'City is required' }],
      }));
    });
    expect(result.current.fields.city).toBe('City is required');
    act(() => {
      result.current.fromError(new ApiError('Email already registered', 400, {
        detail: { code: 'email_taken', message: 'Email already registered' },
      }));
    });
    expect(result.current.fields.email).toBe('Email already registered');
  });

  it('keeps a conflict, permission or network failure at form level, in the server\'s words', () => {
    const { result } = renderHook(() => useFormErrors<'pay'>({ known: ['pay'] }));
    act(() => {
      result.current.fromError(new ApiError('A locum already exists for this time', 409, {
        detail: { code: 'conflict', message: 'A locum already exists for this time' },
      }));
    });
    expect(result.current.fields).toEqual({});
    expect(result.current.formError).toBe('A locum already exists for this time');
  });

  it('check() reports every client-side problem at once and clears on edit', () => {
    const { result } = renderHook(() => useFormErrors<'pay' | 'date'>());
    let ok = true;
    act(() => { ok = result.current.check({ pay: 'Price is required.', date: null }); });
    expect(ok).toBe(false);
    expect(result.current.fields).toEqual({ pay: 'Price is required.' });
    act(() => result.current.clear('pay'));
    expect(result.current.fields).toEqual({});
  });
});

describe('Button', () => {
  it('stays locked while an async handler runs, so a double tap sends once', async () => {
    const pending = deferred();
    const onPress = jest.fn(() => pending.promise);
    render(<Button label="Save" loadingLabel="Saving…" onPress={onPress} testID="save" />);
    fireEvent.press(screen.getByTestId('save'));
    fireEvent.press(screen.getByTestId('save'));
    fireEvent.press(screen.getByTestId('save'));
    expect(onPress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Saving…')).toBeTruthy());
    await act(async () => { pending.resolve(undefined); await pending.promise; });
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());
    fireEvent.press(screen.getByTestId('save'));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('shows its busy label while the caller says it is loading', () => {
    render(<Button label="Post" loadingLabel="Posting…" loading onPress={() => {}} />);
    expect(screen.getByText('Posting…')).toBeTruthy();
  });
});

describe('Field errors are tied to their input', () => {
  it('marks the input invalid and describes it by the message', () => {
    render(<FormInput label="Price" value="" onChangeText={() => {}} error="Price is required." testID="price" />);
    const input = screen.getByTestId('price');
    expect(input.props['aria-invalid']).toBe(true);
    const describedBy = input.props['aria-describedby'];
    expect(describedBy).toBeTruthy();
    const message = screen.getByText('Price is required.');
    expect(message.props.nativeID).toBe(describedBy);
  });

  it('carries no invalid state without an error', () => {
    render(<><FormInput label="Price" value="100" onChangeText={() => {}} testID="price" /><Text>ok</Text></>);
    expect(screen.getByTestId('price').props['aria-invalid']).toBeUndefined();
  });
});
