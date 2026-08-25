import { apiFetch, ApiError, setAuthHandlers, deriveApiBase } from '../utils/api';

const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiFetch', () => {
  afterEach(() => {
    setAuthHandlers(null);
    jest.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ ok: true })) as any;
    await expect(apiFetch('/api/thing')).resolves.toEqual({ ok: true });
  });

  it('throws ApiError with the server detail message', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ detail: 'Not allowed' }, 403)) as any;
    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 403, message: 'Not allowed' });
  });

  it('surfaces a readable error for non-JSON responses', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    ) as any;
    await expect(apiFetch('/api/thing')).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes once on 401 and retries the request', async () => {
    const refreshTokens = jest.fn().mockResolvedValue('new-token');
    const onAuthFailure = jest.fn().mockResolvedValue(undefined);
    setAuthHandlers({ refreshTokens, onAuthFailure });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'Token expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true })) as any;

    await expect(apiFetch('/api/thing', 'old-token')).resolves.toEqual({ ok: true });
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('logs out when the refresh also fails', async () => {
    const refreshTokens = jest.fn().mockResolvedValue(null);
    const onAuthFailure = jest.fn().mockResolvedValue(undefined);
    setAuthHandlers({ refreshTokens, onAuthFailure });

    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ detail: 'Token expired' }, 401)) as any;

    await expect(apiFetch('/api/thing', 'old-token')).rejects.toBeInstanceOf(ApiError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('converts network failures into a friendly ApiError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as any;
    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ status: 0 });
  });
});

describe('deriveApiBase', () => {
  const DEV = true;
  const PROD = false;

  it('replaces a stale LAN IP with the host Metro is actually served from', () => {
    // The exact failure this exists to stop: .env pinned an address DHCP had
    // already reassigned, so every request timed out against nothing.
    expect(deriveApiBase('http://192.168.1.5:8000', '192.168.1.3:8081', DEV)).toBe(
      'http://192.168.1.3:8000',
    );
  });

  it('keeps the port and scheme from configuration', () => {
    expect(deriveApiBase('http://192.168.1.5:9999', '10.0.0.4:8081', DEV)).toBe(
      'http://10.0.0.4:9999',
    );
  });

  it('resolves to localhost for a browser on the dev machine', () => {
    expect(deriveApiBase('http://192.168.1.5:8000', 'localhost:8081', DEV)).toBe(
      'http://localhost:8000',
    );
  });

  it('never repoints a deployed backend at Metro', () => {
    const remote = 'https://formeds-api.onrender.com';
    expect(deriveApiBase(remote, '192.168.1.3:8081', DEV)).toBe(remote);
  });

  it('trusts the page it was served from over a stale Metro hostUri', () => {
    // The live failure: Metro started while the machine was 192.168.1.3 and
    // kept advertising it after DHCP moved the box, so a browser loading the
    // bundle from localhost still posted every request to a dead address.
    expect(
      deriveApiBase('http://192.168.1.3:8000', '192.168.1.3:8081', DEV, 'localhost'),
    ).toBe('http://localhost:8000');
  });

  it('still uses Metro hostUri on native, where there is no page host', () => {
    expect(
      deriveApiBase('http://192.168.1.3:8000', '192.168.1.7:8081', DEV, undefined),
    ).toBe('http://192.168.1.7:8000');
  });

  it('never repoints a deployed backend at the page host', () => {
    const remote = 'https://api.formeds.in';
    expect(deriveApiBase(remote, '192.168.1.3:8081', DEV, 'localhost')).toBe(remote);
  });

  it('leaves production builds completely alone', () => {
    expect(deriveApiBase('http://192.168.1.5:8000', '192.168.1.3:8081', PROD)).toBe(
      'http://192.168.1.5:8000',
    );
  });

  it('falls back to configuration when Metro reports no host', () => {
    expect(deriveApiBase('http://192.168.1.5:8000', undefined, DEV)).toBe(
      'http://192.168.1.5:8000',
    );
  });

  it('handles an exp:// style hostUri', () => {
    expect(deriveApiBase('http://localhost:8000', 'exp://192.168.1.7:8081', DEV)).toBe(
      'http://192.168.1.7:8000',
    );
  });

  it('preserves a path prefix if one is configured', () => {
    expect(deriveApiBase('http://localhost:8000/v2', '192.168.1.3:8081', DEV)).toBe(
      'http://192.168.1.3:8000/v2',
    );
  });

  it('defaults sensibly when nothing is configured at all', () => {
    expect(deriveApiBase('', '192.168.1.3:8081', DEV)).toBe('http://192.168.1.3:8000');
  });
});
