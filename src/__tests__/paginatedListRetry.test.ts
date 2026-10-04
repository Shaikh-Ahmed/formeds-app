import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePaginatedList } from '../hooks/usePaginatedList';

const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * A failed page must not look like "more to come".
 *
 * When /api/jobs started returning 500, the jobs screen fired the SAME request
 * dozens of times a second: the list renders its error state into an empty,
 * short list, `onEndReached` therefore keeps firing, `hasMore` was still at its
 * optimistic initial `true`, and `pageRef` only advances on success — so every
 * one of those retries asked for page 2 again. A server error turned one screen
 * into a load generator against the service that was already failing.
 */
describe('usePaginatedList after a failed page', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stops claiming there is more, so onEndReached cannot spin', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ detail: 'Internal server error' }, 500)) as any;

    const { result } = renderHook(() => usePaginatedList({ path: '/api/jobs/' }));
    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.hasMore).toBe(false);

    // What the list does on every end-reached while the error state is shown.
    const callsAfterFailure = (global.fetch as jest.Mock).mock.calls.length;
    await act(async () => {
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();
    });
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFailure);
  });

  it('recovers once a retry succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'Internal server error' }, 500))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'a' }], total: 40, has_more: true }));
    global.fetch = fetchMock as any;

    const { result } = renderHook(() => usePaginatedList({ path: '/api/jobs/' }));
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
  });
});
