/**
 * Sharing a post or a case shares a link to its own page -- not a pasted copy
 * of the text with no way back into the app, which is what posts used to do.
 */
import { Share } from 'react-native';
import { sharePost, shareCase } from '../utils/share';

describe('sharePost / shareCase', () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as any);
  });
  afterEach(() => spy.mockRestore());

  it('shares the post page, with a short preview of the text', async () => {
    const outcome = await sharePost({
      id: 'p1', author_name: 'Dr. Demo Sharma',
      content: `${'Night-shift handover with a structured SBAR template. '.repeat(5)}\nSecond line`,
    });
    expect(outcome).toBe('shared');
    const [payload] = spy.mock.calls[0];
    const text = JSON.stringify(payload);
    expect(text).toContain('/post/p1');
    expect(text).not.toContain('Second line');
  });

  it('shares the case page', async () => {
    await shareCase({ id: 'c9', title: 'Persistent hypotension after spinal' });
    expect(JSON.stringify(spy.mock.calls[0][0])).toContain('/case/c9');
  });

  it('reports a dismissed sheet, so no "Link copied" is shown', async () => {
    spy.mockResolvedValue({ action: Share.dismissedAction } as any);
    expect(await sharePost({ id: 'p1', author_name: 'A', content: 'B' })).toBe('dismissed');
  });
});
