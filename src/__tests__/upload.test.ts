import { Platform } from 'react-native';
import { appendFile } from '../utils/upload';

/**
 * The web/native FormData split.
 *
 * KYC document upload was broken on the web build from the day it shipped:
 * kyc.tsx appended React Native's { uri, name, type } descriptor, which a
 * browser's FormData coerces with String() into the literal "[object Object]".
 * The API then rejected it as `Expected UploadFile, received: <class 'str'>` —
 * a message that reads like a validation bug rather than a missing platform
 * branch, which is why it survived so long.
 *
 * Nothing else catches this: jest runs one platform, and a native-shaped
 * append is perfectly valid there.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const setPlatform = (os: string) => {
  (Platform as unknown as { OS: string }).OS = os;
};

const fakeForm = () => ({ append: jest.fn() }) as unknown as FormData & { append: jest.Mock };

describe('appendFile', () => {
  afterEach(() => {
    setPlatform('ios');
    delete (global as { fetch?: unknown }).fetch;
  });

  it('sends real bytes on web, never the descriptor object', async () => {
    setPlatform('web');
    const blob = { size: 3, type: 'image/png' };
    // Minimal stand-in for the fetch used to read bytes back out of a blob: URI.
    (global as { fetch?: unknown }).fetch = jest.fn().mockResolvedValue({ blob: async () => blob });

    const form = fakeForm();
    await appendFile(form, 'document', { uri: 'blob:http://x/abc', name: 'cert.png' });

    const [field, value, filename] = form.append.mock.calls[0];
    expect(field).toBe('document');
    expect(value).toBe(blob);
    expect(filename).toBe('cert.png');
    // The regression itself: a plain object here becomes "[object Object]".
    expect(typeof value).not.toBe('string');
    expect((value as any).uri).toBeUndefined();
  });

  it('sends the descriptor on native, which RN streams from disk', async () => {
    setPlatform('ios');
    const form = fakeForm();
    await appendFile(form, 'document', {
      uri: 'file:///tmp/cert.png',
      name: 'cert.png',
      mimeType: 'image/png',
    });

    const [field, value] = form.append.mock.calls[0];
    expect(field).toBe('document');
    expect(value).toEqual({ uri: 'file:///tmp/cert.png', name: 'cert.png', type: 'image/png' });
  });

  it('falls back to a sane name and type when the picker omits them', async () => {
    setPlatform('ios');
    const form = fakeForm();
    await appendFile(form, 'file', { uri: 'file:///tmp/scan.pdf' });

    const [, value] = form.append.mock.calls[0];
    expect(value).toEqual({
      uri: 'file:///tmp/scan.pdf',
      name: 'scan.pdf',
      type: 'application/pdf',
    });
  });
});
