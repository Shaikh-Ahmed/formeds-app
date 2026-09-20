import React from 'react';
import { Image } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import FeedScreen, { nearestMediaRatio, MEDIA_RATIOS } from '../../app/(tabs)/community';
import { apiFetch } from '../utils/api';

/**
 * The feed post card: inline comments, the verified badge, and the
 * repost/delete/report overflow menu.
 *
 * The one behaviour most worth pinning is that "Comments" no longer
 * navigates anywhere — it used to push to a separate screen, and a
 * regression back to that would be easy to miss since the button still
 * "does something" either way.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can only close over hoisted requires, not the top-level `React` import.
  useFocusEffect: (cb: () => void) => { require('react').useEffect(cb, []); },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'me', name: 'Dr Me', role: 'healthcare_professional' },
    token: 'test-token',
    isKycApproved: true,
  }),
}));

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
  API_URL: 'https://api.test',
}));

const mockApiFetch = apiFetch as jest.Mock;

const OWN_POST = {
  id: 'post-own', author_id: 'me', author_name: 'Dr Me', author_role: 'healthcare_professional',
  author_verified: false, content: 'My own post', post_type: 'text', image_url: '',
  like_count: 0, comment_count: 0, likes: [], created_at: new Date().toISOString(),
};

const OTHER_POST = {
  id: 'post-other', author_id: 'other-user', author_name: 'Dr Other', author_role: 'healthcare_professional',
  author_verified: true, content: 'A verified colleague posted this', post_type: 'text', image_url: '',
  like_count: 2, comment_count: 1, likes: [], created_at: new Date().toISOString(),
};

function mockFeedApi(overrides: Record<string, (path: string, ...rest: any[]) => any> = {}) {
  // Longest pattern first, so e.g. "/comments" never loses to the shorter
  // "/comment" it happens to start with.
  const patterns = Object.keys(overrides).sort((a, b) => b.length - a.length);
  mockApiFetch.mockImplementation(async (path: string, _token: any, options: any = {}) => {
    for (const pattern of patterns) {
      if (path.startsWith(pattern)) return overrides[pattern](path, options);
    }
    if (path.startsWith('/api/feed/?')) return [OWN_POST, OTHER_POST];
    if (/\/api\/feed\/[^/]+\/comments/.test(path)) return [];
    return {};
  });
}

describe('FeedScreen post card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeedApi();
  });

  it('shows the verified badge only for a verified author', async () => {
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('A verified colleague posted this')).toBeTruthy());

    expect(screen.getByLabelText('Verified healthcare professional')).toBeTruthy();
    // Only one badge exists — Dr Me's own (unverified) post has none.
    expect(screen.getAllByLabelText('Verified healthcare professional')).toHaveLength(1);
  });

  it('expands comments inline instead of navigating to a new screen', async () => {
    mockFeedApi({
      '/api/feed/post-other/comments': () => [
        { id: 'c1', author_name: 'Dr Reply', content: 'Great case', created_at: new Date().toISOString() },
      ],
    });
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('A verified colleague posted this')).toBeTruthy());

    fireEvent.press(screen.getByTestId('comment-btn-post-other'));

    await waitFor(() => expect(screen.getByText('Great case')).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('posts a new comment and bumps the visible count', async () => {
    let postedComment = false;
    mockFeedApi({
      '/api/feed/post-other/comment': () => { postedComment = true; return { message: 'ok' }; },
      '/api/feed/post-other/comments': () =>
        postedComment
          ? [{ id: 'c1', author_name: 'Dr Me', content: 'Nice work', created_at: new Date().toISOString() }]
          : [],
    });
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('A verified colleague posted this')).toBeTruthy());

    fireEvent.press(screen.getByTestId('comment-btn-post-other'));
    await waitFor(() => expect(screen.getByTestId('comment-input-post-other')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('comment-input-post-other'), 'Nice work');
    fireEvent.press(screen.getByTestId('comment-submit-post-other'));

    await waitFor(() => expect(screen.getByText('Nice work')).toBeTruthy(), { timeout: 5000 });
    // Started at comment_count: 1 on OTHER_POST.
    expect(screen.getByLabelText('Comments, 2')).toBeTruthy();
  });

  it('offers Delete (not Repost or Report) on your own post', async () => {
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('My own post')).toBeTruthy());

    fireEvent.press(screen.getByTestId('post-menu-post-own'));
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.queryByText('Repost')).toBeNull();
    expect(screen.queryByText('Report spam')).toBeNull();
  });

  it('offers Repost and Report (not Delete) on someone else\'s post', async () => {
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('A verified colleague posted this')).toBeTruthy());

    fireEvent.press(screen.getByTestId('post-menu-post-other'));
    expect(screen.getByText('Repost')).toBeTruthy();
    expect(screen.getByText('Report spam')).toBeTruthy();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('deleting your own post removes it from the feed', async () => {
    let deleted = false;
    mockFeedApi({
      '/api/feed/post-own': (_p: string, options: any) => {
        if (options?.method === 'DELETE') { deleted = true; return { message: 'ok' }; }
        return {};
      },
    });
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('My own post')).toBeTruthy());

    fireEvent.press(screen.getByTestId('post-menu-post-own'));
    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(screen.queryByText('My own post')).toBeNull(), { timeout: 5000 });
    expect(deleted).toBe(true);
  });

  it('reposting sends the original content prefixed with attribution', async () => {
    const calls: any[] = [];
    mockFeedApi({
      '/api/feed/post-other/report': () => ({}),
      '/api/feed': (path: string, options: any) => {
        if (path === '/api/feed' && options?.method === 'POST') calls.push(JSON.parse(options.body));
        return [OWN_POST, OTHER_POST];
      },
    });
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('A verified colleague posted this')).toBeTruthy());

    fireEvent.press(screen.getByTestId('post-menu-post-other'));
    fireEvent.press(screen.getByText('Repost'));

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0].content).toContain('Dr Other');
    expect(calls[0].content).toContain('A verified colleague posted this');
  });

  it('reporting calls the report endpoint with a spam reason', async () => {
    const calls: any[] = [];
    mockFeedApi({
      '/api/feed/post-other/report': (_p: string, options: any) => {
        calls.push(JSON.parse(options.body));
        return { message: 'ok' };
      },
    });
    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByText('A verified colleague posted this')).toBeTruthy());

    fireEvent.press(screen.getByTestId('post-menu-post-other'));
    fireEvent.press(screen.getByText('Report spam'));

    await waitFor(() => expect(calls).toEqual([{ reason: 'spam' }]));
  });

  it('renders an image with an aspect-ratio style, not a fixed pixel crop', async () => {
    // Full width/height measurement is exercised by `nearestMediaRatio`
    // directly below; this only checks the plumbing — that the rendered
    // Image actually carries *an* aspectRatio rather than the old fixed
    // `height: 250`, which cropped every image to the same box regardless
    // of its real shape.
    const withImage = { ...OWN_POST, image_url: 'https://x/photo.jpg' };
    mockFeedApi({ '/api/feed/?': () => [withImage] });
    // jest-expo's own default Image.getSize mock isn't happy being called
    // with a success callback, so this test supplies its own rather than
    // depend on that — the actual bucketing math is covered directly below.
    const getSizeSpy = jest
      .spyOn(Image, 'getSize')
      .mockImplementation((_uri: string, success: (w: number, h: number) => void) => { success(1920, 1080); });

    render(<FeedScreen />);
    await waitFor(() => expect(screen.getByTestId('post-image-post-own')).toBeTruthy());

    // The testID lives on the surrounding Pressable, not the Image itself.
    const img = screen.UNSAFE_getAllByType(Image).find(n => n.props.source?.uri === withImage.image_url);
    const flat = [img!.props.style].flat();
    const ratioStyle = flat.find((s: any) => s && typeof s === 'object' && 'aspectRatio' in s);
    expect(ratioStyle).toBeTruthy();
    expect(Object.values(MEDIA_RATIOS)).toContain(ratioStyle.aspectRatio);
    // No leftover fixed-height crop alongside it.
    expect(flat.some((s: any) => s && typeof s === 'object' && 'height' in s)).toBe(false);

    getSizeSpy.mockRestore();
  });
});

describe('nearestMediaRatio', () => {
  it('buckets a near-square image to 1:1', () => {
    expect(nearestMediaRatio(1000, 1000)).toBe(MEDIA_RATIOS.square);
    expect(nearestMediaRatio(1020, 1000)).toBe(MEDIA_RATIOS.square);
  });

  it('buckets a portrait photo to 4:5', () => {
    expect(nearestMediaRatio(900, 1200)).toBe(MEDIA_RATIOS.portrait); // 3:4, nearest is 4:5
  });

  it('buckets a wide photo to 16:9', () => {
    expect(nearestMediaRatio(1920, 1080)).toBe(MEDIA_RATIOS.landscape);
  });

  it('falls back to landscape when dimensions are unknown', () => {
    expect(nearestMediaRatio(0, 0)).toBe(MEDIA_RATIOS.landscape);
  });
});
