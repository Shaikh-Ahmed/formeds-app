import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Linking,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { Book, BookAnnotation, BookAnnotationsResponse, ChapterData } from '../../../src/types/books';
import { recordResearchOpen, updateResearchProgress } from '../../../src/api/research';
import {
  fetchBookById,
  fetchChapter,
  recordBookOpen,
  updateReadingProgress,
  fetchBookAnnotations,
  createBookAnnotation,
  deleteBookAnnotation,
} from '../../../src/api/books';
import { colors, spacing, radius as themeRadius, typography, fonts as themeFonts, shadow as themeShadow } from '../../../src/theme';

const fonts = {
  regular: themeFonts.body.regular,
  medium: themeFonts.body.medium,
  semiBold: themeFonts.heading.semibold,
  bold: themeFonts.heading.bold,
};

const radius = {
  ...themeRadius,
  xs: 4,
};

const shadow = {
  ...themeShadow,
  sm: themeShadow.card,
  md: themeShadow.card,
  lg: themeShadow.card,
};
import { API_URL, apiFetch } from '../../../src/utils/api';

const HIGHLIGHT_COLORS: { label: string; value: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'; hex: string }[] = [
  { label: 'Yellow', value: 'yellow', hex: '#FEF08A' },
  { label: 'Green', value: 'green', hex: '#BBF7D0' },
  { label: 'Blue', value: 'blue', hex: '#BAE6FD' },
  { label: 'Pink', value: 'pink', hex: '#FBCFE8' },
  { label: 'Purple', value: 'purple', hex: '#DDD6FE' },
];

export default function BookReaderScreen() {
  const { id, type, initialPage } = useLocalSearchParams<{ id: string; type?: string; initialPage?: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chapter content tracking
  const [currentChapterNum, setCurrentChapterNum] = useState<number>(1);
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loadingChapter, setLoadingChapter] = useState(false);

  // Section-within-chapter navigation (each section = 1 continuous page)
  const [sectionIndex, setSectionIndex] = useState<number>(0);

  // Derived TOC and page calculations
  const toc = useMemo(() => book?.table_of_contents || [], [book]);
  const totalChapters = useMemo(() => {
    if (type === 'research') {
      return Math.max(1, book?.pages || 1);
    }
    return Math.max(1, book?.total_chapters || chapterData?.total_chapters || toc.length || 1);
  }, [type, book, chapterData, toc]);
  const totalBookPages = Math.max(1, book?.pages || 100);

  // Sections in current chapter
  const sections = chapterData?.sections || [];
  const totalSections = Math.max(1, sections.length);
  const safeSectionIndex = Math.min(Math.max(0, sectionIndex), Math.max(0, sections.length - 1));

  // Base page for current chapter
  const currentChapterPage =
    chapterData?.page ||
    (type === 'research'
      ? currentChapterNum
      : (toc.find(c => c.chapter === currentChapterNum)?.page || 1));

  // Current physical display page number (strictly sequential, never jumps!)
  const displayPageNumber: number = currentChapterPage + safeSectionIndex;

  // Current active section (or fallback)
  const currentSection = sections[safeSectionIndex] || null;

  // Current chapter metadata
  const currentChapterObj: { chapter: number; title: string; page: number } = useMemo(() => {
    if (type === 'research') {
      if (toc.length > 0) {
        for (let i = toc.length - 1; i >= 0; i--) {
          if (displayPageNumber >= toc[i].page) {
            return { chapter: i + 1, title: toc[i].title, page: toc[i].page };
          }
        }
      }
      return { chapter: displayPageNumber, title: `Page ${displayPageNumber}`, page: displayPageNumber };
    }
    const found = toc.find(c => c.chapter === currentChapterNum);
    if (found) return found;
    if (chapterData) return { chapter: chapterData.chapter ?? 1, title: chapterData.title, page: chapterData.page ?? 1 };
    return { chapter: 1, title: 'Chapter 1', page: 1 };
  }, [toc, currentChapterNum, chapterData, type, displayPageNumber]);

  // Annotations & Bookmarks state
  const [annotations, setAnnotations] = useState<BookAnnotationsResponse>({
    book_id: id || '',
    total: 0,
    highlighted_pages: [],
    bookmarked_pages: [],
    items: [],
  });

  // Modals
  const [showToc, setShowToc] = useState(false);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState(false);
  const [activeAnnotationTab, setActiveAnnotationTab] = useState<'bookmarks' | 'highlights'>('bookmarks');
  const [jumpPageText, setJumpPageText] = useState('');

  // Add Annotation Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newType, setNewType] = useState<'bookmark' | 'highlight'>('bookmark');
  const [selectedColor, setSelectedColor] = useState<'yellow' | 'green' | 'blue' | 'pink' | 'purple'>('yellow');
  const [newSelectedText, setNewSelectedText] = useState('');
  const [newNote, setNewNote] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Reader View Mode: 'scan' (crisp original page scan) vs 'text' (selectable, formatted readable text)
  const [viewMode, setViewMode] = useState<'scan' | 'text'>('scan');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Right-Click Highlight Context Menu state
  const [highlightContextMenu, setHighlightContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    selectedText: string;
  } | null>(null);

  // Load a chapter from API and position at specific section
  const loadChapter = useCallback(
    async (chapterNum: number, targetSection: number | 'last' = 0) => {
      if (!id) return;
      setLoadingChapter(true);
      try {
        if (type === 'research') {
          const pageNum = Math.max(1, chapterNum);
          const pageData = await apiFetch(`/api/learning/research/${id}/pages/${pageNum}`, token);
          setChapterData({
            chapter: pageNum,
            title: pageData.title || 'Research Paper',
            page: pageNum,
            sections: pageData.sections || [
              {
                heading: `Page ${pageNum}`,
                body: '',
                page: pageNum,
                image_url: `/api/learning/research/${id}/pages/${pageNum}/image`
              }
            ]
          });
          setCurrentChapterNum(pageNum);
          setSectionIndex(0);
        } else {
          const data = await fetchChapter(id, chapterNum, (token || ''));
          setChapterData(data);
          setCurrentChapterNum(data.chapter ?? 1);
          const count = data.sections?.length || 1;
          if (targetSection === 'last') {
            const lastIdx = Math.max(0, count - 1);
            setSectionIndex(lastIdx);
          } else {
            const clamped = Math.max(0, Math.min(targetSection, Math.max(0, count - 1)));
            setSectionIndex(clamped);
          }
        }
      } catch (e) {
        console.warn('Could not load chapter content:', e);
      } finally {
        setLoadingChapter(false);
      }
    },
    [id, token]
  );

  // Helper to sync reading progress to backend smoothly
  const syncProgress = useCallback(
    (pageNumber: number) => {
      if (!id) return;
      const progress_pct = Math.min(
        100,
        Math.max(1, Math.round((pageNumber / totalBookPages) * 100))
      );
      if (type === 'research') {
        updateResearchProgress(id, { current_page: pageNumber, progress_pct }, token).catch(e =>
          console.warn('Could not save research progress:', e)
        );
      } else {
        updateReadingProgress(id, { current_page: pageNumber, progress_pct }, (token || '')).catch(e =>
          console.warn('Could not save progress:', e)
        );
      }
    },
    [id, totalBookPages, token, type]
  );

  // Jump directly to any chapter from Chapter List (starts at section 0)
  const goToChapter = useCallback(
    (targetChapterNum: number) => {
      if (type === 'research') {
        const targetPage = Math.max(1, Math.min(targetChapterNum, totalBookPages));
        setCurrentChapterNum(targetPage);
        setSectionIndex(0);
        loadChapter(targetPage, 0);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        syncProgress(targetPage);
        return;
      }
      if (targetChapterNum < 1 || targetChapterNum > totalChapters) return;
      setCurrentChapterNum(targetChapterNum);
      setSectionIndex(0);
      loadChapter(targetChapterNum, 0);

      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      const targetChObj = toc.find(c => c.chapter === targetChapterNum);
      const targetPage = targetChObj?.page || 1;
      syncProgress(targetPage);
    },
    [type, totalBookPages, totalChapters, toc, loadChapter, syncProgress]
  );

  // Next button: flips through sections sequentially, then seamlessly into next chapter
  const handleNext = useCallback(() => {
    if (safeSectionIndex < sections.length - 1) {
      const nextSec = safeSectionIndex + 1;
      setSectionIndex(nextSec);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      syncProgress(currentChapterPage + nextSec);
    } else if (currentChapterNum < totalChapters) {
      const nextCh = currentChapterNum + 1;
      setCurrentChapterNum(nextCh);
      setSectionIndex(0);
      loadChapter(nextCh, 0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      const nextChObj = toc.find(c => c.chapter === nextCh);
      const targetPage = nextChObj?.page || displayPageNumber + 1;
      syncProgress(targetPage);
    }
  }, [
    safeSectionIndex,
    sections.length,
    currentChapterNum,
    totalChapters,
    currentChapterPage,
    displayPageNumber,
    toc,
    loadChapter,
    syncProgress,
  ]);

  // Prev button: flips through sections, or to last section of prev chapter
  const handlePrev = useCallback(() => {
    if (safeSectionIndex > 0) {
      const prevSec = safeSectionIndex - 1;
      setSectionIndex(prevSec);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      syncProgress(currentChapterPage + prevSec);
    } else if (currentChapterNum > 1) {
      const prevCh = currentChapterNum - 1;
      setCurrentChapterNum(prevCh);
      loadChapter(prevCh, 'last');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [safeSectionIndex, currentChapterPage, currentChapterNum, loadChapter, syncProgress]);

  // Jump to specific page input handler
  const handleJumpPageSubmit = useCallback(() => {
    const pageNum = parseInt(jumpPageText.trim(), 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalBookPages) {
      Alert.alert('Invalid Page', `Please enter a page number between 1 and ${totalBookPages}.`);
      return;
    }
    setShowToc(false);
    setJumpPageText('');

    if (type === 'research') {
      setCurrentChapterNum(pageNum);
      setSectionIndex(0);
      loadChapter(pageNum, 0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      syncProgress(pageNum);
      return;
    }

    // Find which chapter this page belongs to
    let targetCh = toc[0] || { chapter: 1, page: 1, title: 'Chapter 1' };
    for (let i = toc.length - 1; i >= 0; i--) {
      if (pageNum >= toc[i].page) {
        targetCh = toc[i];
        break;
      }
    }

    const offset = pageNum - targetCh.page;
    setCurrentChapterNum(targetCh.chapter);
    loadChapter(targetCh.chapter, offset);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    syncProgress(pageNum);
  }, [jumpPageText, totalBookPages, toc, loadChapter, syncProgress]);

  // Copy extracted text of the active page to clipboard
  const handleCopyPageText = useCallback(async () => {
    if (!currentSection) return;
    const textToCopy = (currentSection.body && currentSection.body.trim()) || currentSection.heading || '';
    if (!textToCopy || textToCopy.includes('non-extractable text')) {
      Alert.alert('Visual Page', 'This page consists of visual diagrams, illustrations, or non-extractable content.');
      return;
    }

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(textToCopy);
      } else if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (e) {
      console.warn('Clipboard write error:', e);
    }

    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  }, [currentSection]);

  // Dismiss right-click context menu on outside click or scroll
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleDismiss = () => {
      setHighlightContextMenu(prev => (prev?.visible ? null : prev));
    };
    window.addEventListener('click', handleDismiss);
    window.addEventListener('scroll', handleDismiss, true);
    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('scroll', handleDismiss, true);
    };
  }, []);

  // Handle right click on notes view
  const handleNotesContextMenu = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text && text.length > 0) {
      e.preventDefault();
      const native = e.nativeEvent || e;
      const clientX = native.clientX ?? 150;
      const clientY = native.clientY ?? 150;
      const menuWidth = 220;
      const menuHeight = 140;
      const x = Math.max(10, Math.min(clientX, window.innerWidth - menuWidth - 20));
      const y = Math.max(10, Math.min(clientY, window.innerHeight - menuHeight - 20));

      setHighlightContextMenu({
        visible: true,
        x,
        y,
        selectedText: text,
      });
    }
  }, []);

  // Quick 1-click highlight action from right-click menu
  const handleQuickHighlight = useCallback(
    async (color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple') => {
      if (!highlightContextMenu?.selectedText || !id) return;
      const textToHighlight = highlightContextMenu.selectedText;
      setHighlightContextMenu(null);

      try {
        const created = await createBookAnnotation(
          id,
          {
            type: 'highlight',
            page_number: displayPageNumber,
            selected_text: textToHighlight,
            color: color,
          },
          token || ''
        );
        setAnnotations(prev => ({
          ...prev,
          total: prev.total + 1,
          highlighted_pages: !prev.highlighted_pages.includes(displayPageNumber)
            ? [...prev.highlighted_pages, displayPageNumber]
            : prev.highlighted_pages,
          items: [created, ...prev.items],
        }));
      } catch (err) {
        console.warn('Could not save highlight:', err);
      }
    },
    [highlightContextMenu, id, displayPageNumber, token]
  );

  // Add note with quote pre-filled from right click menu
  const handleContextAddNote = useCallback(() => {
    if (!highlightContextMenu?.selectedText) return;
    setNewSelectedText(highlightContextMenu.selectedText);
    setNewType('highlight');
    setHighlightContextMenu(null);
    setShowAddModal(true);
  }, [highlightContextMenu]);

  // Copy selected text from right click menu
  const handleContextCopy = useCallback(async () => {
    if (!highlightContextMenu?.selectedText) return;
    const text = highlightContextMenu.selectedText;
    setHighlightContextMenu(null);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  }, [highlightContextMenu]);

  // Active page highlights for inline text painting
  const pageHighlights = useMemo(() => {
    return annotations.items.filter(
      a => (a.type === 'highlight' || a.selected_text) && a.page_number === displayPageNumber && a.selected_text
    );
  }, [annotations.items, displayPageNumber]);

  // Helper to render paragraph text with persistent inline highlights
  const renderParagraphWithHighlights = (paragraph: string, pIdx: number, highlights: BookAnnotation[]) => {
    if (!highlights.length) {
      return (
        <Text key={pIdx} selectable={true} style={styles.sectionBody}>
          {paragraph}
        </Text>
      );
    }

    type Match = { start: number; end: number; color?: string; annId: string };
    const matches: Match[] = [];

    for (const h of highlights) {
      if (!h.selected_text) continue;
      const query = h.selected_text.trim();
      if (!query) continue;

      let searchStart = 0;
      while (searchStart < paragraph.length) {
        const idx = paragraph.indexOf(query, searchStart);
        if (idx === -1) break;
        matches.push({
          start: idx,
          end: idx + query.length,
          color: h.color || 'yellow',
          annId: h.id,
        });
        searchStart = idx + query.length;
      }
    }

    if (!matches.length) {
      return (
        <Text key={pIdx} selectable={true} style={styles.sectionBody}>
          {paragraph}
        </Text>
      );
    }

    matches.sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    for (let mIdx = 0; mIdx < matches.length; mIdx++) {
      const m = matches[mIdx];
      if (m.start < cursor) continue;

      if (m.start > cursor) {
        nodes.push(
          <Text key={`plain-${pIdx}-${cursor}`}>
            {paragraph.slice(cursor, m.start)}
          </Text>
        );
      }

      const colorObj = HIGHLIGHT_COLORS.find(c => c.value === m.color) || HIGHLIGHT_COLORS[0];
      nodes.push(
        <Text
          key={`hl-${pIdx}-${m.start}-${m.annId}`}
          style={{
            backgroundColor: colorObj.hex,
            borderRadius: 3,
            paddingHorizontal: 2,
          }}
        >
          {paragraph.slice(m.start, m.end)}
        </Text>
      );

      cursor = m.end;
    }

    if (cursor < paragraph.length) {
      nodes.push(
        <Text key={`plain-${pIdx}-${cursor}`}>
          {paragraph.slice(cursor)}
        </Text>
      );
    }

    return (
      <Text key={pIdx} selectable={true} style={styles.sectionBody}>
        {nodes}
      </Text>
    );
  };

  // Load Book and Annotations on initial mount
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      let bookData: Book;
      if (type === 'research') {
        const paperRes = await apiFetch(`/api/learning/research/${id}`, token);
        const smartToc =
          Array.isArray(paperRes.table_of_contents) && paperRes.table_of_contents.length > 0
            ? paperRes.table_of_contents
            : [{ chapter: 1, title: 'Full Research Paper', page: 1 }];
        const paperPages = Math.max(1, paperRes.pages || 1);
        bookData = {
          id: paperRes.id,
          title: paperRes.title,
          author: paperRes.authors || paperRes.journal || 'Medical Research',
          specialty: paperRes.specialty || 'General Medicine',
          category: paperRes.journal || 'Research Paper',
          description: paperRes.abstract || '',
          pages: paperPages,
          cover_url: paperRes.cover_url || '',
          reader_url: paperRes.reader_url || '',
          pdf_url: paperRes.pdf_url || '',
          url: paperRes.url || '',
          table_of_contents: smartToc,
          total_chapters: paperPages,
          last_page: paperRes.last_page || 1,
          progress_pct: paperRes.progress_pct || 0,
        };
        if (paperRes.source !== 'upload' || !paperRes.cover_url) {
          setViewMode('text');
        }
      } else {
        bookData = await fetchBookById(id, (token || ''));
      }
      setBook(bookData);

      // Determine initial chapter & section based on user's last_page / initialPage or default to chapter 1
      const targetPage = Number(initialPage) || bookData.last_page || 1;
      let startingChapter = 1;
      let startingSection = 0;
      if (type === 'research') {
        startingChapter = Math.max(1, Math.min(targetPage, bookData.pages || 1));
        startingSection = 0;
      } else if (targetPage > 1 && bookData.table_of_contents?.length) {
        for (let i = bookData.table_of_contents.length - 1; i >= 0; i--) {
          if (targetPage >= bookData.table_of_contents[i].page) {
            startingChapter = bookData.table_of_contents[i].chapter;
            startingSection = targetPage - bookData.table_of_contents[i].page;
            break;
          }
        }
      }
      setCurrentChapterNum(startingChapter);
      setSectionIndex(startingSection);
      loadChapter(startingChapter, startingSection);

      // Record book or research opened without overwriting user's reading progress to page 1
      if (type === 'research') {
        recordResearchOpen(id, token).catch(e => console.warn('Could not record research open:', e));
      } else {
        recordBookOpen(id, (token || '')).catch(e => console.warn('Could not record open:', e));
      }

      // Fetch existing annotations
      const annData = await fetchBookAnnotations(id, (token || ''));
      setAnnotations(annData || { book_id: id, total: 0, highlighted_pages: [], bookmarked_pages: [], items: [] });
    } catch (err: any) {
      console.error('Error loading book reader:', err);
      setError(err?.message || 'Could not load reader for this book.');
    } finally {
      setLoading(false);
    }
  }, [id, (token || ''), loadChapter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Bookmarking current page
  const isCurrentPageBookmarked = annotations.bookmarked_pages.includes(displayPageNumber);

  const handleToggleCurrentBookmark = async () => {
    if (!id) return;
    const existingBookmark = annotations.items.find(
      a => a.type === 'bookmark' && a.page_number === displayPageNumber
    );

    if (existingBookmark) {
      try {
        await deleteBookAnnotation(id, existingBookmark.id, (token || ''));
        setAnnotations(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
          bookmarked_pages: prev.bookmarked_pages.filter(p => p !== displayPageNumber),
          items: prev.items.filter(a => a.id !== existingBookmark.id),
        }));
      } catch (e) {
        Alert.alert('Error', 'Could not remove bookmark.');
      }
    } else {
      try {
        const newAnn = await createBookAnnotation(
          id,
          {
            type: 'bookmark',
            page_number: displayPageNumber,
            note: `Bookmarked page ${displayPageNumber}`,
          }, (token || "")
        );
        setAnnotations(prev => ({
          ...prev,
          total: prev.total + 1,
          bookmarked_pages: [...prev.bookmarked_pages, displayPageNumber],
          items: [newAnn, ...prev.items],
        }));
      } catch (e) {
        Alert.alert('Error', 'Could not save bookmark.');
      }
    }
  };

  // Add highlight/note modal submission
  const handleSaveAnnotation = async () => {
    if (!id) return;
    setSavingAnnotation(true);
    try {
      const created = await createBookAnnotation(
        id,
        {
          type: newType,
          page_number: displayPageNumber,
          selected_text: newType === 'highlight' ? newSelectedText : undefined,
          color: newType === 'highlight' ? selectedColor : undefined,
          note: newNote.trim() || undefined,
        }, (token || "")
      );
      setAnnotations(prev => ({
        ...prev,
        total: prev.total + 1,
        highlighted_pages:
          newType === 'highlight' && !prev.highlighted_pages.includes(displayPageNumber)
            ? [...prev.highlighted_pages, displayPageNumber]
            : prev.highlighted_pages,
        bookmarked_pages:
          newType === 'bookmark' && !prev.bookmarked_pages.includes(displayPageNumber)
            ? [...prev.bookmarked_pages, displayPageNumber]
            : prev.bookmarked_pages,
        items: [created, ...prev.items],
      }));
      setShowAddModal(false);
      setNewSelectedText('');
      setNewNote('');
    } catch (e) {
      Alert.alert('Error', 'Failed to save annotation.');
    } finally {
      setSavingAnnotation(false);
    }
  };

  const handleDeleteAnnotation = async (annId: string) => {
    if (!id) return;
    try {
      await deleteBookAnnotation(id, annId, (token || ''));
      setAnnotations(prev => {
        const itemToDelete = prev.items.find(a => a.id === annId);
        const remainingItems = prev.items.filter(a => a.id !== annId);
        const pageNum = itemToDelete?.page_number;
        const stillHighlighted = remainingItems.some(a => a.type === 'highlight' && a.page_number === pageNum);
        const stillBookmarked = remainingItems.some(a => a.type === 'bookmark' && a.page_number === pageNum);

        return {
          ...prev,
          total: Math.max(0, prev.total - 1),
          highlighted_pages: stillHighlighted
            ? prev.highlighted_pages
            : prev.highlighted_pages.filter(p => p !== pageNum),
          bookmarked_pages: stillBookmarked
            ? prev.bookmarked_pages
            : prev.bookmarked_pages.filter(p => p !== pageNum),
          items: remainingItems,
        };
      });
    } catch (e) {
      Alert.alert('Error', 'Could not delete annotation.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Opening textbook reader...</Text>
      </SafeAreaView>
    );
  }

  if (error || !book) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.redText} />
        <Text style={styles.errorTitle}>Could not open reader</Text>
        <Text style={styles.errorSubtitle}>{error || 'Book data unavailable.'}</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.backHomeText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const bookmarkedItems = annotations.items.filter(a => a.type === 'bookmark');
  const highlightItems = annotations.items.filter(a => a.type === 'highlight' || a.type === 'note');

  const isAtFirst = currentChapterNum <= 1 && safeSectionIndex <= 0;
  const isAtLast = currentChapterNum >= totalChapters && safeSectionIndex >= sections.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 1. Header Navigation Bar (100% In-App, NO external links!) */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to library"
          testID="reader-back-btn"
        >
          <Ionicons name="arrow-back" size={20} color={colors.navy} />
        </TouchableOpacity>

        <View style={styles.topTitleMeta}>
          <Text style={styles.topBookTitle} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={styles.topChapterTitle} numberOfLines={1}>
            {chapterData?.title
              ? `Ch ${currentChapterNum}: ${chapterData.title}`
              : currentChapterObj?.title
              ? `Ch ${currentChapterNum}: ${currentChapterObj.title}`
              : book.specialty}
          </Text>
        </View>

        <View style={styles.topActionGroup}>
          {/* Pencil icon for highlight / add note */}
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Highlight or add note"
            testID="top-highlight-pencil-btn"
          >
            <Ionicons name="pencil" size={18} color={colors.navy} />
          </TouchableOpacity>

          {/* Bookmark page quick button */}
          <TouchableOpacity
            onPress={handleToggleCurrentBookmark}
            style={[styles.iconBtn, isCurrentPageBookmarked && styles.bookmarkedActiveBtn]}
            accessibilityRole="button"
            accessibilityLabel={isCurrentPageBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            testID="reader-bookmark-btn"
          >
            <Ionicons
              name={isCurrentPageBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isCurrentPageBookmarked ? colors.teal : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Table of Contents button */}
          {toc.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowToc(true)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Table of contents"
              testID="reader-toc-btn"
            >
              <Ionicons name="list" size={18} color={colors.navy} />
            </TouchableOpacity>
          )}

          {/* Annotations & Notes Drawer Toggle */}
          <TouchableOpacity
            onPress={() => setShowAnnotationsDrawer(true)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="View bookmarks and notes"
            testID="reader-annotations-btn"
          >
            <Ionicons name="create-outline" size={20} color={colors.navy} />
            {annotations.total > 0 && (
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>{annotations.total}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. In-App Interactive Reader Viewport */}
      <ScrollView ref={scrollViewRef} style={styles.viewport} contentContainerStyle={styles.viewportContent}>
        <View style={styles.readerDocCard}>
          {/* Top Banner: Specialty, Category & Non-Clickable Source Attribution */}
          <View style={styles.docHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              <View style={styles.badgeSpecialty}>
                <Text style={styles.badgeSpecialtyText}>{book.specialty}</Text>
              </View>
              {book.category ? (
                <View style={styles.badgeCategory}>
                  <Text style={styles.badgeCategoryText}>{book.category}</Text>
                </View>
              ) : null}
            </View>

            {/* Non-clickable source reference badge */}
            <View style={styles.badgeSourceReference}>
              <Ionicons name="library" size={12} color={colors.teal} style={{ marginRight: 4 }} />
              <Text style={styles.badgeSourceText}>
                Source: {book.publisher || 'Academic Medical Press'}
              </Text>
            </View>
          </View>

          {/* Book Title & Quick Action Icons (Pencil for highlight & Bookmark) */}
          <View style={styles.docTitleHeaderRow}>
            <Text style={styles.docTitle}>{book.title}</Text>
            <View style={styles.docTitleActions}>
              {(book.pdf_url || book.url) && (
                <TouchableOpacity
                  style={styles.titleActionBtn}
                  onPress={() => {
                    const target = book.pdf_url || book.url;
                    if (target) {
                      if (Platform.OS === 'web') {
                        window.open(target, '_blank');
                      } else {
                        Linking.openURL(target);
                      }
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open external full paper link"
                  testID="doc-external-link-btn"
                >
                  <Ionicons name="open-outline" size={17} color={colors.navy} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.titleActionBtn}
                onPress={() => setShowAddModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Highlight or add note"
                testID="doc-highlight-pencil-btn"
              >
                <Ionicons name="pencil" size={17} color={colors.navy} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.titleActionBtn, isCurrentPageBookmarked && styles.titleBookmarkBtnActive]}
                onPress={handleToggleCurrentBookmark}
                accessibilityRole="button"
                accessibilityLabel={isCurrentPageBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
                testID="doc-bookmark-btn"
              >
                <Ionicons
                  name={isCurrentPageBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={17}
                  color={isCurrentPageBookmarked ? colors.teal : colors.navy}
                />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.docAuthor}>{book.author}</Text>
          {book.publisher ? (
            <Text style={styles.docPublisher}>
              {book.publisher} {book.published_year ? `• ${book.published_year}` : ''}
              {book.isbn ? ` • ISBN ${book.isbn}` : ''}
            </Text>
          ) : null}

          {/* Quick Chapter Selector Dropdown Pill */}
          {toc.length > 0 && (
            <TouchableOpacity
              style={styles.chapterQuickJumpBtn}
              onPress={() => setShowToc(true)}
              accessibilityRole="button"
              accessibilityLabel="Open table of contents"
            >
              <View style={styles.chapterQuickJumpLeft}>
                <View style={styles.chapterNumPill}>
                  <Text style={styles.chapterNumPillText}>Ch {currentChapterNum}</Text>
                </View>
                <Text style={styles.chapterQuickJumpTitle} numberOfLines={1}>
                  {chapterData?.title || currentChapterObj?.title}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.chapterQuickJumpPage}>
                  Page {displayPageNumber} of {totalBookPages}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          )}

          {/* Chapter Content Loading Indicator */}
          {loadingChapter && (
            <View style={styles.chapterInlineLoader}>
              <ActivityIndicator size="small" color={colors.teal} />
              <Text style={styles.chapterInlineLoaderText}>Loading textbook content...</Text>
            </View>
          )}

          {/* Active Page Viewport */}
          {currentSection && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionPageIndicatorRow}>
                <View style={styles.sectionPageIndicator}>
                  <Text style={styles.sectionPageText}>
                    Page {displayPageNumber} of {totalBookPages} · Chapter {currentChapterNum}: {currentChapterObj.title}
                  </Text>
                </View>

                {/* Quick Copy Button in header */}
                <TouchableOpacity
                  style={[styles.copyPageQuickBtn, copiedFeedback && styles.copyPageBtnSuccess]}
                  onPress={handleCopyPageText}
                  accessibilityRole="button"
                  accessibilityLabel="Copy page text to clipboard"
                >
                  <Ionicons
                    name={copiedFeedback ? 'checkmark-circle' : 'copy-outline'}
                    size={14}
                    color={copiedFeedback ? '#15803D' : colors.teal}
                  />
                  <Text style={[styles.copyPageQuickText, copiedFeedback && styles.copyPageBtnTextSuccess]}>
                    {copiedFeedback ? 'Copied!' : 'Copy Page'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* View Mode Toggle: Page Scan vs Selectable Text */}
              <View style={styles.viewModeToggleRow}>
                <TouchableOpacity
                  style={[styles.viewModeTab, viewMode === 'scan' && styles.viewModeTabActive]}
                  onPress={() => setViewMode('scan')}
                  accessibilityRole="button"
                  accessibilityLabel={type === 'research' ? 'Switch to paper scan' : 'Switch to book scan'}
                >
                  <Ionicons
                    name={type === 'research' ? 'newspaper-outline' : 'book-outline'}
                    size={15}
                    color={viewMode === 'scan' ? colors.white : colors.navy}
                  />
                  <Text style={[styles.viewModeTabText, viewMode === 'scan' && styles.viewModeTabTextActive]}>
                    {type === 'research' ? 'Paper' : 'Book'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.viewModeTab, viewMode === 'text' && styles.viewModeTabActive]}
                  onPress={() => setViewMode('text')}
                  accessibilityRole="button"
                  accessibilityLabel="Switch to notes view"
                >
                  <Ionicons
                    name="document-text-outline"
                    size={15}
                    color={viewMode === 'text' ? colors.white : colors.navy}
                  />
                  <Text style={[styles.viewModeTabText, viewMode === 'text' && styles.viewModeTabTextActive]}>
                    Notes
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Feedback toast banner when text is copied */}
              {copiedFeedback && (
                <View style={styles.copiedToast}>
                  <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                  <Text style={styles.copiedToastText}>
                    Page {displayPageNumber} text copied to clipboard!
                  </Text>
                </View>
              )}

              {/* View Mode: Original Page Scan */}
              {viewMode === 'scan' ? (
                <View>
                  <View style={styles.pageScanWrapper}>
                    {currentSection.image_url ? (
                      <Image
                        source={{
                          uri: currentSection.image_url.startsWith('http')
                            ? currentSection.image_url
                            : `${API_URL}${currentSection.image_url}`
                        }}
                        style={styles.pageScanImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                        <Ionicons name="newspaper-outline" size={36} color={colors.teal} style={{ marginBottom: 8 }} />
                        <Text style={styles.pageScanEmptyText}>
                          Clinical study details & abstract are available in the Notes tab.
                        </Text>
                        <TouchableOpacity
                          style={{
                            marginTop: 12,
                            backgroundColor: colors.teal,
                            paddingHorizontal: spacing.md,
                            paddingVertical: 8,
                            borderRadius: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                          onPress={() => setViewMode('text')}
                        >
                          <Ionicons name="document-text" size={15} color={colors.white} style={{ marginRight: 6 }} />
                          <Text style={{ color: colors.white, fontSize: 13, fontWeight: '700' }}>
                            Read Full Notes
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.scanSwitchBanner}
                    onPress={() => setViewMode('text')}
                    accessibilityRole="button"
                    accessibilityLabel="Switch to Selectable Text view"
                  >
                    <Ionicons name="sparkles" size={15} color={colors.teal} style={{ marginRight: 6 }} />
                    <Text style={styles.scanSwitchText}>
                      Need to select or copy paragraphs? Tap here for Notes mode.
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* View Mode: Notes with Right-Click Highlight */
                <View
                  style={styles.textViewCard}
                  // @ts-ignore
                  onContextMenu={handleNotesContextMenu}
                >
                  <View style={styles.textSelectNotice}>
                    <Ionicons name="sparkles" size={15} color={colors.teal} style={{ marginRight: 6 }} />
                    <Text style={styles.textSelectNoticeText}>
                      {"Select text & right-click to highlight with colors or add notes. Use 'Copy Page' above to copy all."}
                    </Text>
                  </View>

                  {currentSection.heading ? (
                    <Text selectable={true} style={styles.sectionHeading}>
                      {currentSection.heading}
                    </Text>
                  ) : null}

                  {currentSection.body && currentSection.body.trim() && !currentSection.body.includes('non-extractable text') ? (
                    <View style={styles.textParagraphsWrap}>
                      {currentSection.body.split('\n\n').map((paragraph: string, idx: number) => {
                        const pTrimmed = paragraph.trim();
                        if (!pTrimmed) return null;
                        return renderParagraphWithHighlights(pTrimmed, idx, pageHighlights);
                      })}
                    </View>
                  ) : (
                    <View style={styles.noTextCard}>
                      <Ionicons name="images-outline" size={32} color={colors.textMuted} />
                      <Text style={styles.noTextTitle}>Visual Content Page</Text>
                      <Text style={styles.noTextDesc}>
                        This page primarily contains diagrams, clinical charts, or scanned visual tables.
                      </Text>
                      <TouchableOpacity
                        style={styles.switchToScanBtn}
                        onPress={() => setViewMode('scan')}
                      >
                        <Ionicons name="image" size={15} color={colors.white} />
                        <Text style={styles.switchToScanText}>View Original Book</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Clinical Reference Highlights / Pearls if present */}
                  {currentSection.clinical_pearl &&
                    currentSection.clinical_pearl !== 'Consult complete clinical text and diagrams for comprehensive context.' &&
                    currentSection.clinical_pearl !== 'Review full section for clinical context.' &&
                    currentSection.clinical_pearl !== 'Consult full text for details.' && (
                      <View style={styles.pearlCard}>
                        <View style={styles.pearlCardHeader}>
                          <Ionicons name="bulb" size={16} color="#D97706" />
                          <Text style={styles.pearlCardTitle}>Clinical Pearl</Text>
                        </View>
                        <Text selectable={true} style={styles.pearlCardBody}>
                          {currentSection.clinical_pearl}
                        </Text>
                      </View>
                    )}
                </View>
              )}
            </View>
          )}

          </View>
      </ScrollView>

      {/* 3. Floating Bottom Navigation Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handlePrev}
          disabled={isAtFirst}
          style={[styles.pageNavBtn, isAtFirst && styles.pageNavDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Previous section"
          testID="reader-prev-page"
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={isAtFirst ? colors.textMuted : colors.navy}
          />
          <Text style={[styles.pageNavText, isAtFirst && styles.pageNavTextDisabled]}>Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pageIndicatorContainer}
          onPress={() => setShowToc(true)}
          testID="reader-add-annotation-prompt"
        >
          {/* Matches Ch X/Y · Sec A/B for test validation while showing physical page */}
          <Text style={styles.pageIndicatorText}>
            Ch {currentChapterNum}/{totalChapters} · Sec {safeSectionIndex + 1}/{totalSections}
          </Text>
          <View style={styles.addAnnotationMini}>
            <Ionicons name="list" size={13} color={colors.teal} style={{ marginRight: 3 }} />
            <Text style={styles.addAnnotationMiniText}>
              Page {displayPageNumber} of {totalBookPages} • Chapter List ▾
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={isAtLast}
          style={[styles.pageNavBtn, isAtLast && styles.pageNavDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next section"
          testID="reader-next-page"
        >
          <Text
            style={[styles.pageNavText, isAtLast && styles.pageNavTextDisabled]}
          >
            Next
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isAtLast ? colors.textMuted : colors.navy}
          />
        </TouchableOpacity>
      </View>

      {/* Floating Right-Click Highlight Context Menu */}
      {Platform.OS === 'web' && highlightContextMenu && highlightContextMenu.visible && (
        <View
          style={[
            styles.floatingContextMenu,
            {
              // @ts-ignore
              position: 'fixed',
              left: highlightContextMenu.x,
              top: highlightContextMenu.y,
              zIndex: 99999,
            },
          ]}
        >
          <View style={styles.contextMenuHeader}>
            <Ionicons name="color-palette" size={13} color={colors.teal} style={{ marginRight: 5 }} />
            <Text style={styles.contextMenuTitle}>Highlight Selection</Text>
          </View>
          <View style={styles.contextColorRow}>
            {HIGHLIGHT_COLORS.map(c => (
              <TouchableOpacity
                key={c.value}
                onPress={() => handleQuickHighlight(c.value)}
                style={[styles.contextColorDot, { backgroundColor: c.hex }]}
                accessibilityRole="button"
                accessibilityLabel={`Highlight with ${c.label}`}
              />
            ))}
          </View>
          <View style={styles.contextMenuDivider} />
          <TouchableOpacity
            style={styles.contextMenuItem}
            onPress={handleContextAddNote}
            accessibilityRole="button"
          >
            <Ionicons name="pencil" size={14} color={colors.navy} style={{ marginRight: 8 }} />
            <Text style={styles.contextMenuItemText}>Add Note to Quote</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.contextMenuItem}
            onPress={handleContextCopy}
            accessibilityRole="button"
          >
            <Ionicons name="copy-outline" size={14} color={colors.navy} style={{ marginRight: 8 }} />
            <Text style={styles.contextMenuItemText}>Copy Selected Text</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Table of Contents (Chapter List) Modal */}
      <Modal visible={showToc} transparent animationType="slide" onRequestClose={() => setShowToc(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.drawerCard}>
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="list" size={18} color={colors.navy} style={{ marginRight: 6 }} />
                <Text style={styles.drawerTitle}>Table of Contents ({toc.length} Chapters)</Text>
              </View>
              <TouchableOpacity onPress={() => setShowToc(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Direct Jump to Page Input Bar */}
            <View style={styles.jumpPageBar}>
              <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.jumpPageInput}
                placeholder={`Go directly to page (1 - ${totalBookPages})...`}
                placeholderTextColor={colors.textMuted}
                value={jumpPageText}
                onChangeText={setJumpPageText}
                keyboardType="numeric"
                onSubmitEditing={handleJumpPageSubmit}
              />
              <TouchableOpacity style={styles.jumpPageGoBtn} onPress={handleJumpPageSubmit}>
                <Text style={styles.jumpPageGoBtnText}>Go</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.tocList}>
              {toc.map((item, index) => {
                const isCurrent =
                  type === 'research'
                    ? displayPageNumber >= item.page &&
                      (index === toc.length - 1 || displayPageNumber < toc[index + 1].page)
                    : currentChapterNum === item.chapter;
                return (
                  <TouchableOpacity
                    key={`ch-${item.chapter}-${index}`}
                    style={[styles.tocItem, isCurrent && styles.tocItemActive]}
                    onPress={() => {
                      setShowToc(false);
                      if (type === 'research') {
                        goToChapter(item.page);
                      } else {
                        goToChapter(item.chapter);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to Chapter ${item.chapter}: ${item.title}`}
                  >
                    <View style={[styles.tocItemNum, isCurrent && styles.tocItemNumActive]}>
                      <Text style={[styles.tocItemNumText, isCurrent && styles.tocItemNumTextActive]}>
                        {item.chapter}
                      </Text>
                    </View>
                    <View style={styles.tocItemContent}>
                      <Text style={[styles.tocItemTitle, isCurrent && styles.tocItemTitleActive]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {isCurrent && <Text style={styles.tocCurrentBadge}>Currently Reading</Text>}
                    </View>
                    <Text style={styles.tocItemPage}>p. {item.page}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. Annotations & Bookmarks Drawer Modal */}
      <Modal
        visible={showAnnotationsDrawer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnnotationsDrawer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.drawerCard}>
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="bookmarks-outline" size={18} color={colors.navy} style={{ marginRight: 6 }} />
                <Text style={styles.drawerTitle}>Annotations & Bookmarks</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAnnotationsDrawer(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Segmented Tabs */}
            <View style={styles.annotationTabs}>
              <TouchableOpacity
                style={[styles.annTab, activeAnnotationTab === 'bookmarks' && styles.annTabActive]}
                onPress={() => setActiveAnnotationTab('bookmarks')}
              >
                <Ionicons
                  name="bookmark"
                  size={14}
                  color={activeAnnotationTab === 'bookmarks' ? colors.white : colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.annTabText,
                    activeAnnotationTab === 'bookmarks' && styles.annTabTextActive,
                  ]}
                >
                  Bookmarked Pages ({bookmarkedItems.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.annTab, activeAnnotationTab === 'highlights' && styles.annTabActive]}
                onPress={() => setActiveAnnotationTab('highlights')}
              >
                <Ionicons
                  name="color-wand-outline"
                  size={14}
                  color={activeAnnotationTab === 'highlights' ? colors.white : colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.annTabText,
                    activeAnnotationTab === 'highlights' && styles.annTabTextActive,
                  ]}
                >
                  Highlights ({highlightItems.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Drawer Body */}
            <ScrollView style={styles.annotationList}>
              {activeAnnotationTab === 'bookmarks' ? (
                bookmarkedItems.length === 0 ? (
                  <View style={styles.emptyDrawer}>
                    <Ionicons name="bookmark-outline" size={36} color={colors.textMuted} />
                    <Text style={styles.emptyDrawerTitle}>No pages bookmarked</Text>
                    <Text style={styles.emptyDrawerSub}>
                      Tap the bookmark icon on any page while reading to save it for quick review.
                    </Text>
                  </View>
                ) : (
                  bookmarkedItems.map(item => (
                    <View key={item.id} style={styles.annotationCard}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => {
                          setShowAnnotationsDrawer(false);
                          // Jump to bookmarked page
                          const pageNum = item.page_number;
                          let targetCh = toc[0] || { chapter: 1, page: 1 };
                          for (let i = toc.length - 1; i >= 0; i--) {
                            if (pageNum >= toc[i].page) {
                              targetCh = toc[i];
                              break;
                            }
                          }
                          setCurrentChapterNum(targetCh.chapter);
                          loadChapter(targetCh.chapter, pageNum - targetCh.page);
                        }}
                      >
                        <View style={styles.annotationHeader}>
                          <View style={styles.annotationPageBadge}>
                            <Text style={styles.annotationPageBadgeText}>Page {item.page_number}</Text>
                          </View>
                          <Text style={styles.annotationDate}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        {item.note ? <Text style={styles.annotationNote}>{item.note}</Text> : null}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteAnnotation(item.id)}
                        style={styles.deleteAnnBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Delete bookmark"
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.redText} />
                      </TouchableOpacity>
                    </View>
                  ))
                )
              ) : highlightItems.length === 0 ? (
                <View style={styles.emptyDrawer}>
                  <Ionicons name="color-wand-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyDrawerTitle}>No highlights yet</Text>
                  <Text style={styles.emptyDrawerSub}>
                    Use the Highlight / Add Note button on any page to record key definitions or pearls.
                  </Text>
                </View>
              ) : (
                highlightItems.map(item => (
                  <View key={item.id} style={styles.annotationCard}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        setShowAnnotationsDrawer(false);
                        const pageNum = item.page_number;
                        let targetCh = toc[0] || { chapter: 1, page: 1 };
                        for (let i = toc.length - 1; i >= 0; i--) {
                          if (pageNum >= toc[i].page) {
                            targetCh = toc[i];
                            break;
                          }
                        }
                        setCurrentChapterNum(targetCh.chapter);
                        loadChapter(targetCh.chapter, pageNum - targetCh.page);
                      }}
                    >
                      <View style={styles.annotationHeader}>
                        <View style={styles.annotationPageBadge}>
                          <Text style={styles.annotationPageBadgeText}>Page {item.page_number}</Text>
                        </View>
                        {item.color && (
                          <View
                            style={[
                              styles.colorDot,
                              {
                                backgroundColor:
                                  HIGHLIGHT_COLORS.find(c => c.value === item.color)?.hex || '#FEF08A',
                              },
                            ]}
                          />
                        )}
                        <Text style={styles.annotationDate}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      {item.selected_text ? (
                        <Text style={styles.annotationQuote} numberOfLines={3}>
                          {'"' + item.selected_text + '"'}
                        </Text>
                      ) : null}
                      {item.note ? <Text style={styles.annotationNote}>{item.note}</Text> : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteAnnotation(item.id)}
                      style={styles.deleteAnnBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Delete highlight"
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.redText} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 6. Add Annotation / Note Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Add Annotation (Page {displayPageNumber})</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Type selector */}
            <View style={styles.dialogTypeToggle}>
              <TouchableOpacity
                style={[styles.dialogTypeBtn, newType === 'bookmark' && styles.dialogTypeBtnActive]}
                onPress={() => setNewType('bookmark')}
              >
                <Ionicons
                  name="bookmark"
                  size={15}
                  color={newType === 'bookmark' ? colors.white : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.dialogTypeBtnText,
                    newType === 'bookmark' && styles.dialogTypeBtnTextActive,
                  ]}
                >
                  Bookmark Page
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dialogTypeBtn, newType === 'highlight' && styles.dialogTypeBtnActive]}
                onPress={() => setNewType('highlight')}
              >
                <Ionicons
                  name="color-wand"
                  size={15}
                  color={newType === 'highlight' ? colors.white : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.dialogTypeBtnText,
                    newType === 'highlight' && styles.dialogTypeBtnTextActive,
                  ]}
                >
                  Highlight Text
                </Text>
              </TouchableOpacity>
            </View>

            {newType === 'highlight' && (
              <>
                <Text style={styles.fieldLabel}>Highlight Color:</Text>
                <View style={styles.colorPickerRow}>
                  {HIGHLIGHT_COLORS.map(c => (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c.hex },
                        selectedColor === c.value && styles.colorCircleSelected,
                      ]}
                      onPress={() => setSelectedColor(c.value)}
                    >
                      {selectedColor === c.value && <Ionicons name="checkmark" size={14} color="#1E293B" />}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Key Medical Text / Phrase:</Text>
                <TextInput
                  style={styles.textInputArea}
                  multiline
                  numberOfLines={2}
                  placeholder="Paste or type phrase to highlight..."
                  placeholderTextColor={colors.textMuted}
                  value={newSelectedText}
                  onChangeText={setNewSelectedText}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Personal Clinical Note (Optional):</Text>
            <TextInput
              style={styles.textInputArea}
              multiline
              numberOfLines={3}
              placeholder="e.g. Diagnostic criteria, attending pearls, board question..."
              placeholderTextColor={colors.textMuted}
              value={newNote}
              onChangeText={setNewNote}
            />

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setShowAddModal(false)}
                disabled={savingAnnotation}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogSaveBtn}
                onPress={handleSaveAnnotation}
                disabled={savingAnnotation}
              >
                {savingAnnotation ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.dialogSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  errorTitle: {
    marginTop: spacing.md,
    fontSize: typography.h3.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  errorSubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  backHomeText: {
    color: colors.white,
    fontFamily: fonts.semiBold,
    fontSize: typography.body.fontSize,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    ...shadow.sm,
  },
  iconBtn: {
    padding: spacing.xs,
    borderRadius: radius.sm,
    position: 'relative',
  },
  bookmarkedActiveBtn: {
    backgroundColor: colors.tealLight,
  },
  topTitleMeta: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  topBookTitle: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  topChapterTitle: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  topActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeWrap: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.teal,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontFamily: fonts.bold,
  },

  // Viewport
  viewport: {
    flex: 1,
  },
  viewportContent: {
    padding: spacing.md,
    paddingBottom: 110,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  readerDocCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },
  docHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 8,
  },
  badgeSpecialty: {
    backgroundColor: colors.tealLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  badgeSpecialtyText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.teal,
  },
  badgeCategory: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  badgeCategoryText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  badgeSourceReference: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeSourceText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.navy,
  },

  docTitleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: spacing.xs,
  },
  docTitleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  titleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleBookmarkBtnActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  docTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.navy,
    lineHeight: 28,
  },
  docAuthor: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 4,
  },
  docPublisher: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.lg,
  },

  // Chapter Jump Quick Pill
  chapterQuickJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chapterQuickJumpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  chapterNumPill: {
    backgroundColor: colors.navy,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.xs,
    marginRight: 8,
  },
  chapterNumPillText: {
    color: colors.white,
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  chapterQuickJumpTitle: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    flex: 1,
  },
  chapterQuickJumpPage: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.teal,
  },

  chapterInlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 8,
  },
  chapterInlineLoaderText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.medium,
    color: colors.teal,
  },

  // Section Cards
  sectionCard: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sectionPageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionPageText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.teal,
    letterSpacing: 0.3,
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.navy,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  sectionBody: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#334155',
    lineHeight: 25,
  },

  // Chapter Bottom Navigation Card
  chapterBottomNavCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  chapterBottomNavTitle: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  chapterBottomNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chapterBottomPrevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chapterBottomPrevText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    marginLeft: 4,
  },
  chapterBottomNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.navy,
    marginLeft: 'auto',
  },
  chapterBottomNextText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.white,
    marginRight: 4,
  },
  bookFinishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginLeft: 'auto',
  },
  bookFinishedText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#15803D',
    marginLeft: 6,
  },

  // Page Action Quick Buttons
  pageActionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  addNoteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  addNoteBtnText: {
    color: colors.white,
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
  },
  bookmarkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bookmarkedActionBtnActive: {
    backgroundColor: colors.tealLight,
    borderColor: colors.teal,
  },
  bookmarkActionText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  bookmarkedActionTextActive: {
    color: colors.teal,
  },

  // Academic Source Attribution Panel
  sourceAttributionPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sourceAttributionIconWrap: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  sourceAttributionTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.navy,
    marginBottom: 2,
  },
  sourceAttributionText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: '#475569',
    marginBottom: 3,
  },
  sourceAttributionNote: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    lineHeight: 16,
  },

  // Bottom Floating Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadow.md,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pageNavDisabled: {
    opacity: 0.35,
  },
  pageNavText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    marginHorizontal: 4,
  },
  pageNavTextDisabled: {
    color: colors.textMuted,
  },
  pageIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  pageIndicatorText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  addAnnotationMini: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  addAnnotationMiniText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.teal,
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '82%',
    ...shadow.lg,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  drawerTitle: {
    fontSize: typography.h3.fontSize,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  closeBtn: {
    padding: 4,
  },

  // Jump to Page Bar in TOC modal
  jumpPageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  jumpPageInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.navy,
    paddingVertical: 4,
  },
  jumpPageGoBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginLeft: 6,
  },
  jumpPageGoBtnText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fonts.bold,
  },

  tocList: {
    marginBottom: spacing.md,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  tocItemActive: {
    backgroundColor: colors.tealLight,
  },
  tocItemNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  tocItemNumActive: {
    backgroundColor: colors.teal,
  },
  tocItemNumText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  tocItemNumTextActive: {
    color: colors.white,
  },
  tocItemContent: {
    flex: 1,
  },
  tocItemTitle: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  tocItemTitleActive: {
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  tocCurrentBadge: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.teal,
    marginTop: 2,
  },
  tocItemPage: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },

  // Annotation Drawer Tabs
  annotationTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  annTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#F1F5F9',
  },
  annTabActive: {
    backgroundColor: colors.navy,
  },
  annTabText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  annTabTextActive: {
    color: colors.white,
  },
  annotationList: {
    marginBottom: spacing.md,
  },
  emptyDrawer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyDrawerTitle: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    marginTop: spacing.sm,
  },
  emptyDrawerSub: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  annotationCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  annotationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  annotationPageBadge: {
    backgroundColor: colors.navy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  annotationPageBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  annotationDate: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  annotationQuote: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#334155',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  annotationNote: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.navy,
  },
  deleteAnnBtn: {
    padding: 6,
    alignSelf: 'center',
    marginLeft: 6,
  },

  // Add Annotation Dialog Card
  dialogCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    margin: spacing.lg,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 480,
    ...shadow.lg,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dialogTitle: {
    fontSize: typography.h3.fontSize,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  dialogTypeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  dialogTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#F1F5F9',
  },
  dialogTypeBtnActive: {
    backgroundColor: colors.navy,
  },
  dialogTypeBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  dialogTypeBtnTextActive: {
    color: colors.white,
  },
  fieldLabel: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    marginBottom: 6,
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  colorCircleSelected: {
    borderWidth: 2,
    borderColor: colors.navy,
  },
  textInputArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.navy,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: spacing.xs,
  },
  dialogCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  dialogCancelText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  dialogSaveBtn: {
    backgroundColor: colors.teal,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  dialogSaveText: {
    fontSize: typography.body.fontSize,
    fontFamily: fonts.bold,
    color: colors.white,
  },
  viewModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    gap: 6,
  },
  viewModeTabActive: {
    backgroundColor: colors.navy,
  },
  viewModeTabText: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  viewModeTabTextActive: {
    color: colors.white,
  },
  pageScanWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    minHeight: 500,
  },
  pageScanImage: {
    width: '100%',
    aspectRatio: 0.707,
    borderRadius: radius.sm,
  },
  pageScanEmptyText: {
    padding: spacing.xl,
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  scanSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    marginBottom: spacing.md,
  },
  scanSwitchText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.teal,
  },
  sectionPageIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: 8,
  },
  copyPageQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    gap: 4,
  },
  copyPageQuickText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.teal,
  },
  copyPageBtnSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  copyPageBtnTextSuccess: {
    color: '#15803D',
  },
  copiedToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: spacing.sm,
    gap: 8,
  },
  copiedToastText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#15803D',
  },
  textViewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 450,
  },
  textSelectNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textSelectNoticeText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#64748B',
    flex: 1,
  },
  textParagraphsWrap: {
    gap: 12,
  },
  noTextCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    gap: 8,
    marginTop: spacing.md,
  },
  noTextTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  noTextDesc: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  switchToScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
    gap: 6,
    marginTop: spacing.sm,
  },
  switchToScanText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  pearlCard: {
    marginTop: spacing.lg,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pearlCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pearlCardTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#92400E',
  },
  pearlCardBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#78350F',
    lineHeight: 20,
  },  floatingContextMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 10,
    minWidth: 210,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  contextMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  contextMenuTitle: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  contextColorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 6,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  contextMenuItemText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.navy,
  },
});