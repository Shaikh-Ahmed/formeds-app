import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ArticleFeedCard, formatArticleUrl } from '../components/articles/ArticleFeedCard';
import type { ArticleFeedPost } from '../types/feed';

describe('formatArticleUrl helper', () => {
  it('converts bare DOIs starting with 10. to https://doi.org/', () => {
    expect(formatArticleUrl('10.1056/NEJMoa2401234')).toBe('https://doi.org/10.1056/NEJMoa2401234');
  });

  it('preserves existing https:// and http:// URLs', () => {
    expect(formatArticleUrl('https://pubmed.ncbi.nlm.nih.gov/39291024/')).toBe(
      'https://pubmed.ncbi.nlm.nih.gov/39291024/'
    );
  });

  it('returns empty string for empty input', () => {
    expect(formatArticleUrl('')).toBe('');
    expect(formatArticleUrl('   ')).toBe('');
  });
});

const SAMPLE_PUBMED_FEED_ARTICLE: ArticleFeedPost = {
  id: 'd29cc188-aa4a-4d9b-8003-cd1a6f6ea032',
  author_id: null,
  author_name: 'Formeds Newsletter',
  author_role: 'Official',
  content: 'Impact of Braille Booklet, Audio-Tactile Performance and Caregiver-supervised Training on Oral Hygiene Status: A Randomized Clinical Trial.',
  post_type: 'article',
  image_url: '',
  article_id: 'pubmed:42768901',
  article_source: 'pubmed',
  article_url: 'https://pubmed.ncbi.nlm.nih.gov/42768901/',
  journal: 'Special Care in Dentistry',
  authors: 'Ragavane P, Murugappan S, Kengadaran S, et al.',
  abstract: 'To evaluate the effectiveness of braille booklet, Audio-Tactile Performance using specialized model...',
  keywords: ['Humans', 'Child', 'Oral Hygiene', 'Health Education'],
  cited_by: 5,
  likes: ['user-1'],
  like_count: 1,
  comment_count: 2,
  created_at: '2026-09-22T16:11:26.546400+00:00',
};

const SAMPLE_OPENALEX_FEED_ARTICLE: ArticleFeedPost = {
  id: 'e39aa299-bb5b-4e9c-9114-de2b7f7fb143',
  author_id: null,
  author_name: 'Formeds Newsletter',
  author_role: 'Official',
  content: 'Global Trends in Diabetes Mellitus and Cardiovascular Outcomes',
  post_type: 'article',
  image_url: '',
  article_id: 'openalex:W7205318739',
  article_source: 'openalex',
  article_url: 'https://doi.org/10.1016/S2214-109X(26)00123-4',
  journal: 'The Lancet Global Health',
  authors: 'Taylor B, Chen Y',
  abstract: '',
  keywords: ['Endocrinology', 'Cardiovascular'],
  cited_by: null,
  likes: [],
  like_count: 0,
  comment_count: 0,
  created_at: '2026-09-22T16:15:00.000000+00:00',
};

describe('ArticleFeedCard Component', () => {
  it('renders official Formeds Newsletter author and article content headline', () => {
    render(<ArticleFeedCard post={SAMPLE_PUBMED_FEED_ARTICLE} isLiked={true} />);

    expect(screen.getByText('Formeds Newsletter')).toBeTruthy();
    expect(screen.getByText('Official')).toBeTruthy();
    expect(screen.getByText('Special Care in Dentistry')).toBeTruthy();
    expect(screen.getByText('Ragavane P, Murugappan S, Kengadaran S +1 more')).toBeTruthy();
    expect(screen.getByText('Oral Hygiene')).toBeTruthy();
    expect(screen.getByText('Read Full Paper')).toBeTruthy();
    expect(screen.queryByText('PubMed')).toBeNull();
    expect(screen.queryByText(/Read Full Paper on/i)).toBeNull();
  });

  it('renders OpenAlex article, Read Full Paper button, and handles missing abstract cleanly', () => {
    render(<ArticleFeedCard post={SAMPLE_OPENALEX_FEED_ARTICLE} isLiked={false} />);

    expect(screen.getByText('Formeds Newsletter')).toBeTruthy();
    expect(screen.getByText('The Lancet Global Health')).toBeTruthy();
    expect(screen.getByText('Taylor B, Chen Y')).toBeTruthy();
    expect(screen.getByText('Endocrinology')).toBeTruthy();
    expect(screen.getByText('Read Full Paper')).toBeTruthy();
    expect(screen.queryByText('OpenAlex')).toBeNull();
  });

  it('triggers onLike, onComment, and onShare callbacks', () => {
    const onLike = jest.fn();
    const onComment = jest.fn();
    const onShare = jest.fn();

    render(
      <ArticleFeedCard
        post={SAMPLE_PUBMED_FEED_ARTICLE}
        onLike={onLike}
        onComment={onComment}
        onShare={onShare}
      />
    );

    fireEvent.press(screen.getByTestId(`article-like-btn-${SAMPLE_PUBMED_FEED_ARTICLE.id}`));
    expect(onLike).toHaveBeenCalledWith(SAMPLE_PUBMED_FEED_ARTICLE.id);

    fireEvent.press(screen.getByTestId(`article-comment-btn-${SAMPLE_PUBMED_FEED_ARTICLE.id}`));
    expect(onComment).toHaveBeenCalledWith(SAMPLE_PUBMED_FEED_ARTICLE.id);

    fireEvent.press(screen.getByTestId(`article-share-btn-${SAMPLE_PUBMED_FEED_ARTICLE.id}`));
    expect(onShare).toHaveBeenCalledWith(SAMPLE_PUBMED_FEED_ARTICLE);
  });
});
