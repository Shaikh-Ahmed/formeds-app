import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ExpandableText } from '../components/ExpandableText';
import { MediaViewer } from '../components/MediaViewer';

/**
 * Feed post body and media viewer.
 *
 * The behaviour worth pinning is the *conditional* nature of both controls:
 * "…more" must not appear on a post that already fits, and the viewer must
 * show the whole image rather than the cropped feed thumbnail.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

const LONG = Array.from({ length: 40 }, (_, i) => `line ${i}`).join(' ');

/** Fires the native onTextLayout with a given number of laid-out lines. */
const layoutWith = (lineCount: number) => {
  const node = screen.getByText(LONG);
  act(() => {
    node.props.onTextLayout?.({
      nativeEvent: { lines: Array.from({ length: lineCount }, () => ({})) },
    });
  });
};

describe('ExpandableText', () => {
  it('stays collapsed to the line limit until asked to expand', () => {
    render(<ExpandableText text={LONG} numberOfLines={3} testID="body" />);
    expect(screen.getByText(LONG).props.numberOfLines).toBe(3);
  });

  it('offers "…more" only once the text is known to overflow', () => {
    render(<ExpandableText text={LONG} numberOfLines={3} testID="body" />);
    // Nothing has reported a layout yet, so no control is shown.
    expect(screen.queryByTestId('body-toggle')).toBeNull();

    layoutWith(6);
    expect(screen.getByTestId('body-toggle')).toBeTruthy();
    expect(screen.getByText('…more')).toBeTruthy();
  });

  it('never offers to expand text that already fits', () => {
    render(<ExpandableText text={LONG} numberOfLines={3} testID="body" />);
    layoutWith(2);
    expect(screen.queryByTestId('body-toggle')).toBeNull();
  });

  it('expands to the full text and back again', () => {
    render(<ExpandableText text={LONG} numberOfLines={3} testID="body" />);
    layoutWith(6);

    fireEvent.press(screen.getByTestId('body-toggle'));
    expect(screen.getByText(LONG).props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Show less')).toBeTruthy();

    fireEvent.press(screen.getByTestId('body-toggle'));
    expect(screen.getByText(LONG).props.numberOfLines).toBe(3);
    expect(screen.getByText('…more')).toBeTruthy();
  });

  it('describes its state to a screen reader', () => {
    render(<ExpandableText text={LONG} numberOfLines={3} testID="body" />);
    layoutWith(6);
    expect(screen.getByLabelText('Show the full post')).toBeTruthy();
    fireEvent.press(screen.getByTestId('body-toggle'));
    expect(screen.getByLabelText('Show less of this post')).toBeTruthy();
  });
});

describe('MediaViewer', () => {
  const post = {
    author_name: 'Dr Asha Rao',
    author_role: 'healthcare_professional',
    content: 'Post-op imaging from this morning.',
    created_at: new Date().toISOString(),
    like_count: 4,
    comment_count: 2,
  };

  it('renders nothing while closed', () => {
    render(<MediaViewer visible={false} onClose={jest.fn()} imageUri="https://x/a.png" post={post} />);
    expect(screen.queryByTestId('media-close')).toBeNull();
  });

  it('shows the whole image rather than the cropped feed thumbnail', () => {
    render(<MediaViewer visible onClose={jest.fn()} imageUri="https://x/a.png" post={post} />);
    const image = screen.UNSAFE_getAllByType(require('react-native').Image)[0];
    // `cover` is what crops the feed card; the viewer exists to undo that.
    expect(image.props.resizeMode).toBe('contain');
  });

  it('keeps the post text alongside the image', () => {
    render(<MediaViewer visible onClose={jest.fn()} imageUri="https://x/a.png" post={post} />);
    expect(screen.getByText('Post-op imaging from this morning.')).toBeTruthy();
    expect(screen.getByText('Dr Asha Rao')).toBeTruthy();
    expect(screen.getByText('4 likes · 2 comments')).toBeTruthy();
  });

  it('closes from the close button', () => {
    const onClose = jest.fn();
    render(<MediaViewer visible onClose={onClose} imageUri="https://x/a.png" post={post} />);
    fireEvent.press(screen.getByTestId('media-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes before navigating on to the full post', () => {
    const onClose = jest.fn();
    const onOpenPost = jest.fn();
    render(
      <MediaViewer visible onClose={onClose} imageUri="https://x/a.png" post={post} onOpenPost={onOpenPost} />,
    );
    fireEvent.press(screen.getByTestId('media-open-post'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenPost).toHaveBeenCalledTimes(1);
  });

  it('omits the comments link when there is nowhere to go', () => {
    render(<MediaViewer visible onClose={jest.fn()} imageUri="https://x/a.png" post={post} />);
    expect(screen.queryByTestId('media-open-post')).toBeNull();
  });
});
