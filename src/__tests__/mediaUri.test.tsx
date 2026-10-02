import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { mediaUri } from '../utils/media';
import { API_URL } from '../utils/api';
import { Avatar } from '../components/Avatar';

describe('stored image addresses', () => {
  it('resolves a server-relative path against the API, and leaves everything else alone', () => {
    expect(mediaUri('/api/images/mock/media/u1/a.jpg')).toBe(`${API_URL}/api/images/mock/media/u1/a.jpg`);
    for (const url of ['https://cdn.example.com/a.jpg', 'data:image/png;base64,AAA', 'blob:http://x/1',
      'file:///tmp/a.jpg', '//cdn.example.com/a.jpg']) {
      expect(mediaUri(url)).toBe(url);
    }
    expect(mediaUri('')).toBeUndefined();
    expect(mediaUri(null)).toBeUndefined();
  });
});

describe('Avatar', () => {
  it('loads a relative photo from the API server', () => {
    const { UNSAFE_getByType } = render(<Avatar name="Arshed Jan" uri="/api/images/mock/media/u1/a.jpg" />);
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: `${API_URL}/api/images/mock/media/u1/a.jpg` });
  });

  it('shows the initial instead of a blank circle when the photo cannot load', () => {
    const { UNSAFE_getByType } = render(<Avatar name="Arshed Jan" uri="https://broken.example/a.jpg" />);
    fireEvent(UNSAFE_getByType(Image), 'error');
    expect(screen.getByText('A')).toBeTruthy();
  });
});
