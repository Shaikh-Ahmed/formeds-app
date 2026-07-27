import { apiFetch, ApiError, setAuthHandlers } from '../utils/api';

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
