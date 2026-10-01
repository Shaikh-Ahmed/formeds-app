import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BookCard } from '../components/books/BookCard';
import { ContinueReadingCard } from '../components/books/ContinueReadingCard';
import { BooksCatalog } from '../components/books/BooksCatalog';
import BookReaderScreen from '../../app/learning/reader/[id]';
import { Book } from '../types/books';
import * as booksApi from '../api/books';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', name: 'Dr. Test' },
    token: 'mock-token',
  }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'b1000000-0000-0000-0000-000000000001' }),
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

const SAMPLE_BOOK_1: Book = {
  id: 'b1000000-0000-0000-0000-000000000001',
  title: 'Clinical Methods: The History, Physical, and Laboratory Examinations',
  author: 'H. Kenneth Walker, W. Dallas Hall',
  specialty: 'Internal Medicine',
  category: 'Clinical Guide',
  description: 'A comprehensive reference to the history and physical examination.',
  pages: 1087,
  published_year: 2020,
  publisher: 'NCBI Bookshelf',
  cover_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600',
  reader_url: 'https://www.ncbi.nlm.nih.gov/books/NBK201/',
  file_url: 'https://www.ncbi.nlm.nih.gov/books/NBK201/pdf/Bookshelf_NBK201.pdf',
  table_of_contents: [
    { chapter: 1, title: 'The Clinical Approach to the Patient', page: 1 },
    { chapter: 2, title: 'The Medical Record', page: 25 },
  ],
  is_favorite: false,
  is_recent: true,
  last_page: 25,
  progress_pct: 2.3,
  last_opened_at: '2026-09-23T17:40:00.000Z',
};

const SAMPLE_BOOK_2: Book = {
  id: 'b2000000-0000-0000-0000-000000000002',
  title: 'Cardiology Principles and Practice',
  author: 'Jane Doe, Robert Smith',
  specialty: 'Cardiology',
  category: 'Textbook',
  description: 'Essential diagnostic criteria and patient management protocols in cardiology.',
  pages: 640,
  published_year: 2022,
  publisher: 'Medical Press',
  cover_url: '',
  reader_url: 'https://example.com/cardiology',
  file_url: 'https://example.com/cardiology.pdf',
  table_of_contents: [],
  is_favorite: true,
  is_recent: false,
};

describe('BookCard Component', () => {
  it('renders title, author, specialty badge, and pages count', () => {
    render(<BookCard book={SAMPLE_BOOK_1} />);

    expect(
      screen.getByText('Clinical Methods: The History, Physical, and Laboratory Examinations')
    ).toBeTruthy();
    expect(screen.getByText('H. Kenneth Walker, W. Dallas Hall')).toBeTruthy();
    expect(screen.getByText('Internal Medicine')).toBeTruthy();
    expect(screen.getByText('1087 pages')).toBeTruthy();
    expect(screen.getByText('2020')).toBeTruthy();
  });

  it('triggers onReadPress when Read Book / Continue Reading is pressed', () => {
    const onReadPress = jest.fn();
    render(<BookCard book={SAMPLE_BOOK_1} onReadPress={onReadPress} />);

    const readBtn = screen.getByTestId(`book-read-btn-${SAMPLE_BOOK_1.id}`);
    fireEvent.press(readBtn);
    expect(onReadPress).toHaveBeenCalledWith(SAMPLE_BOOK_1);
  });

  it('triggers onToggleFavorite when heart icon is pressed', () => {
    const onToggleFavorite = jest.fn();
    render(<BookCard book={SAMPLE_BOOK_1} onToggleFavorite={onToggleFavorite} />);

    const favBtn = screen.getByTestId(`book-fav-btn-${SAMPLE_BOOK_1.id}`);
    fireEvent.press(favBtn);
    expect(onToggleFavorite).toHaveBeenCalledWith(SAMPLE_BOOK_1.id);
  });
});

describe('ContinueReadingCard Component', () => {
  it('renders recently opened book with progress percentage and current page', () => {
    const onResume = jest.fn();
    render(<ContinueReadingCard book={SAMPLE_BOOK_1} onResume={onResume} />);

    expect(screen.getByText('Page 25 of 1087')).toBeTruthy();
    expect(screen.getByText('2%')).toBeTruthy();
    expect(screen.getByText('Resume Reading')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`continue-reading-${SAMPLE_BOOK_1.id}`));
    expect(onResume).toHaveBeenCalledWith(SAMPLE_BOOK_1);
  });
});

describe('BooksCatalog Component', () => {
  beforeEach(() => {
    jest.spyOn(booksApi, 'fetchBooks').mockResolvedValue({
      items: [SAMPLE_BOOK_1, SAMPLE_BOOK_2],
      total: 2,
      page: 1,
      limit: 10,
      total_pages: 1,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and displays books and specialty chips', async () => {
    render(<BooksCatalog />);

    expect(screen.getByTestId('books-search-input')).toBeTruthy();
    expect(screen.getByText('Internal Medicine')).toBeTruthy();
    expect(screen.getByText('Cardiology')).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getAllByText('Clinical Methods: The History, Physical, and Laboratory Examinations').length
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Cardiology Principles and Practice')).toBeTruthy();
    });
  });

  it('renders Continue Reading shelf for recent books', async () => {
    render(<BooksCatalog />);

    await waitFor(() => {
      expect(screen.getByTestId('continue-reading-section')).toBeTruthy();
      expect(screen.getAllByText('Continue Reading').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders pagination summary on single page', async () => {
    render(<BooksCatalog />);

    await waitFor(() => {
      expect(screen.getByTestId('books-pagination')).toBeTruthy();
      expect(screen.getByText('Showing 1-2 of 2 books')).toBeTruthy();
    });
  });

  it('renders pagination controls when totalPages > 1', async () => {
    jest.spyOn(booksApi, 'fetchBooks').mockResolvedValueOnce({
      items: [SAMPLE_BOOK_1, SAMPLE_BOOK_2],
      total: 18,
      page: 1,
      limit: 10,
      total_pages: 2,
    });

    render(<BooksCatalog />);

    await waitFor(() => {
      expect(screen.getByTestId('books-pagination')).toBeTruthy();
      expect(screen.getByText('Showing 1-10 of 18 books')).toBeTruthy();
      expect(screen.getByText('Page 1 of 2')).toBeTruthy();
      expect(screen.getByTestId('pagination-prev-btn')).toBeTruthy();
      expect(screen.getByTestId('pagination-next-btn')).toBeTruthy();
    });
  });
});

describe('fetchChapter API', () => {
  it('fetches chapter sections and structure from backend', async () => {
    const mockChapter = {
      book_id: 'b1000000-0000-0000-0000-000000000001',
      chapter_number: 1,
      title: 'The Clinical Approach to the Patient',
      page_start: 1,
      page_end: 24,
      sections: [
        {
          heading: 'Introduction',
          body: 'The interview is the primary tool by which the clinician obtains the patient history.',
        },
      ],
      next_chapter: 2,
      prev_chapter: null,
    };

    jest.spyOn(booksApi, 'fetchChapter').mockResolvedValue(mockChapter);

    const chapter = await booksApi.fetchChapter('b1000000-0000-0000-0000-000000000001', 1, 'mock-token');
    expect(chapter.chapter_number).toBe(1);
    expect(chapter.title).toBe('The Clinical Approach to the Patient');
    expect(chapter.sections.length).toBe(1);
    expect(chapter.sections[0].heading).toBe('Introduction');
  });
});

describe('BookReaderScreen Component', () => {
  beforeEach(() => {
    jest.spyOn(booksApi, 'fetchBookById').mockResolvedValue(SAMPLE_BOOK_1);
    jest.spyOn(booksApi, 'fetchChapter').mockResolvedValue({
      book_id: SAMPLE_BOOK_1.id,
      book_title: SAMPLE_BOOK_1.title,
      chapter: 1,
      title: 'The Clinical Approach to the Patient',
      page: 1,
      total_chapters: 2,
      prev_chapter: null,
      next_chapter: 2,
      sections: [
        { heading: '1.1 Clinical Interview', body: 'The interview is the foundation of diagnosis.' },
        { heading: '1.2 Physical Exam Principles', body: 'Inspection, palpation, percussion, auscultation.' },
      ],
      user_annotations: [],
    });
    jest.spyOn(booksApi, 'recordBookOpen').mockResolvedValue({ success: true });
    jest.spyOn(booksApi, 'updateReadingProgress').mockResolvedValue();
    jest.spyOn(booksApi, 'fetchBookAnnotations').mockResolvedValue({
      book_id: SAMPLE_BOOK_1.id,
      total: 0,
      highlighted_pages: [],
      bookmarked_pages: [],
      items: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders active section and displays Ch X/Y · Sec A/B indicator', async () => {
    render(<BookReaderScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Ch 1\/2 · Sec 1\/2/)).toBeTruthy();
    });

    // Switch to notes mode to read full text
    fireEvent.press(screen.getByLabelText('Switch to notes view'));

    await waitFor(() => {
      expect(screen.getByText('1.1 Clinical Interview')).toBeTruthy();
      expect(screen.getByText('The interview is the foundation of diagnosis.')).toBeTruthy();
    });
  });

  it('navigates section by section and then to next chapter', async () => {
    render(<BookReaderScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Ch 1\/2 · Sec 1\/2/)).toBeTruthy();
    });

    // Switch to notes mode to read text
    fireEvent.press(screen.getByLabelText('Switch to notes view'));

    const nextBtn = screen.getByTestId('reader-next-page');

    // First Next: flip from Section 1 to Section 2
    fireEvent.press(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('1.2 Physical Exam Principles')).toBeTruthy();
      expect(screen.getByText(/Ch 1\/2 · Sec 2\/2/)).toBeTruthy();
    });

    // Second Next: at last section of Chapter 1 -> advance to Chapter 2
    fireEvent.press(nextBtn);

    await waitFor(() => {
      expect(booksApi.fetchChapter).toHaveBeenCalledWith(SAMPLE_BOOK_1.id, 2, 'mock-token');
    });
  });
});
