import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { PageColumn } from '../../src/components/web';
import { uploadBook } from '../../src/api/books';
import { uploadResearchPaper } from '../../src/api/research';
import { appendFile } from '../../src/utils/upload';
import { colors, spacing, radius, typography, fonts, shadow } from '../../src/theme';

const SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Orthopedics',
  'Oncology',
  'Surgery',
  'Dermatology',
  'Psychiatry',
  'Radiology',
  'Anesthesiology',
  'Emergency Medicine',
];

const BOOK_CATEGORIES = [
  'Textbook',
  'Reference',
  'Clinical Guide',
  'Handbook',
  'Atlas',
];

interface PickedFile {
  uri: string;
  name: string;
  size?: number;
  mimeType: string;
}

export default function AdminUploadScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<'books' | 'research'>(
    tab === 'research' ? 'research' : 'books'
  );

  // Book Form State
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookSpecialty, setBookSpecialty] = useState('General Medicine');
  const [bookCategory, setBookCategory] = useState('Textbook');
  const [bookFile, setBookFile] = useState<PickedFile | null>(null);

  // Research Form State
  const [resTitle, setResTitle] = useState('');
  const [resAuthors, setResAuthors] = useState('');
  const [resJournal, setResJournal] = useState('');
  const [resDoi, setResDoi] = useState('');
  const [resSpecialty, setResSpecialty] = useState('General Medicine');
  const [resAbstract, setResAbstract] = useState('');
  const [resFile, setResFile] = useState<PickedFile | null>(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    type: 'book' | 'research';
    title: string;
    id: string;
    pages: number;
  } | null>(null);

  // Pick PDF File
  const handlePickPdf = (target: 'book' | 'research') => {
    setErrorMsg(null);
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (!file.name.toLowerCase().endsWith('.pdf')) {
            setErrorMsg('Please select a valid PDF file.');
            return;
          }
          const uri = URL.createObjectURL(file);
          const picked: PickedFile = {
            uri,
            name: file.name,
            size: file.size,
            mimeType: 'application/pdf',
          };
          if (target === 'book') setBookFile(picked);
          else setResFile(picked);
        }
      };
      input.click();
    } else {
      Alert.alert('Notice', 'Please upload documents via desktop/web browser for fast processing.');
    }
  };

  // Submit Book
  const handleUploadBook = async () => {
    if (!bookTitle.trim()) {
      setErrorMsg('Book title is required.');
      return;
    }
    if (!bookAuthor.trim()) {
      setErrorMsg('Author name is required.');
      return;
    }
    if (!bookFile) {
      setErrorMsg('Please select a PDF file to upload.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('title', bookTitle.trim());
      formData.append('author', bookAuthor.trim());
      formData.append('specialty', bookSpecialty);
      formData.append('category', bookCategory);

      await appendFile(formData, 'file', bookFile);

      const res = await uploadBook(formData, token);
      setSuccessData({
        type: 'book',
        title: res.book.title,
        id: res.book.id,
        pages: res.book.pages || 1,
      });

      // Reset fields
      setBookTitle('');
      setBookAuthor('');
      setBookFile(null);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to upload textbook.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Research Paper
  const handleUploadResearch = async () => {
    if (!resTitle.trim()) {
      setErrorMsg('Research paper title is required.');
      return;
    }
    if (!resFile) {
      setErrorMsg('Please select a PDF file to upload.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('title', resTitle.trim());
      formData.append('authors', resAuthors.trim());
      formData.append('journal', resJournal.trim());
      formData.append('doi', resDoi.trim());
      formData.append('specialty', resSpecialty);
      formData.append('abstract', resAbstract.trim());

      await appendFile(formData, 'file', resFile);

      const res = await uploadResearchPaper(formData, token);
      setSuccessData({
        type: 'research',
        title: res.paper.title,
        id: res.paper.id,
        pages: res.paper.pages || 1,
      });

      // Reset fields
      setResTitle('');
      setResAuthors('');
      setResJournal('');
      setResDoi('');
      setResAbstract('');
      setResFile(null);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to upload research paper.');
    } finally {
      setLoading(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyText}>Admin access required</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PageColumn maxWidth={860} testID="admin-upload-column">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.navy} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Learning Content Upload</Text>
            <Text style={styles.headerSubtitle}>
              Admin portal to upload medical textbooks and clinical research papers
            </Text>
          </View>
          <TouchableOpacity
            style={styles.kycSwitchBtn}
            onPress={() => router.push('/admin/kyc' as any)}
            accessibilityRole="button"
          >
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.teal} style={{ marginRight: 4 }} />
            <Text style={styles.kycSwitchBtnText}>KYC Review</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Segmented Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'books' && styles.activeTabButton]}
              onPress={() => {
                setActiveTab('books');
                setErrorMsg(null);
                setSuccessData(null);
              }}
              accessibilityRole="tab"
            >
              <Ionicons
                name="book-outline"
                size={18}
                color={activeTab === 'books' ? colors.white : colors.navy}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.tabText, activeTab === 'books' && styles.activeTabText]}>
                Upload Medical Book
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'research' && styles.activeTabButton]}
              onPress={() => {
                setActiveTab('research');
                setErrorMsg(null);
                setSuccessData(null);
              }}
              accessibilityRole="tab"
            >
              <Ionicons
                name="newspaper-outline"
                size={18}
                color={activeTab === 'research' ? colors.white : colors.navy}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.tabText, activeTab === 'research' && styles.activeTabText]}>
                Upload Research Paper
              </Text>
            </TouchableOpacity>
          </View>

          {/* Success Banner */}
          {successData && (
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={32} color={colors.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>
                  {successData.type === 'book' ? 'Book Published Successfully!' : 'Research Paper Published!'}
                </Text>
                <Text style={styles.successSubtitle} numberOfLines={2}>
                  {successData.title} ({successData.pages} pages processed)
                </Text>
                <View style={styles.successActions}>
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={() => {
                      router.push(
                        `/learning/reader/${successData.id}?type=${successData.type}` as any
                      );
                    }}
                  >
                    <Ionicons name="reader-outline" size={15} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={styles.previewBtnText}>Open in Reader</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => setSuccessData(null)}
                  >
                    <Text style={styles.dismissBtnText}>Upload Another</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* FORM 1: BOOKS UPLOAD */}
          {activeTab === 'books' && (
            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>Textbook & Manual Details</Text>

              {/* PDF File Box */}
              <Text style={styles.inputLabel}>Book PDF File *</Text>
              <TouchableOpacity
                style={[styles.dropZone, bookFile && styles.dropZoneActive]}
                onPress={() => handlePickPdf('book')}
                accessibilityRole="button"
              >
                {bookFile ? (
                  <View style={styles.selectedFileRow}>
                    <View style={styles.fileIconWrap}>
                      <Ionicons name="document-text" size={28} color={colors.teal} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {bookFile.name}
                      </Text>
                      <Text style={styles.fileSize}>{formatFileSize(bookFile.size)}</Text>
                    </View>
                    <View style={styles.changeBadge}>
                      <Text style={styles.changeBadgeText}>Change</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.dropZoneContent}>
                    <Ionicons name="cloud-upload-outline" size={38} color={colors.teal} />
                    <Text style={styles.dropZoneTitle}>Click to select PDF document</Text>
                    <Text style={styles.dropZoneSubtitle}>Supports medical textbooks & handbooks up to 100MB</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Title */}
              <Text style={styles.inputLabel}>Book Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Harrison's Principles of Internal Medicine"
                placeholderTextColor={colors.textMuted}
                value={bookTitle}
                onChangeText={setBookTitle}
              />

              {/* Author */}
              <Text style={styles.inputLabel}>Author(s) / Editors *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. J. Larry Jameson, Anthony S. Fauci"
                placeholderTextColor={colors.textMuted}
                value={bookAuthor}
                onChangeText={setBookAuthor}
              />

              {/* Specialty */}
              <Text style={styles.inputLabel}>Medical Specialty</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                {SPECIALTIES.map(spec => (
                  <TouchableOpacity
                    key={spec}
                    style={[styles.pill, bookSpecialty === spec && styles.pillActive]}
                    onPress={() => setBookSpecialty(spec)}
                  >
                    <Text style={[styles.pillText, bookSpecialty === spec && styles.pillTextActive]}>
                      {spec}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Category */}
              <Text style={styles.inputLabel}>Book Category</Text>
              <View style={styles.categoriesRow}>
                {BOOK_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pill, bookCategory === cat && styles.pillActive]}
                    onPress={() => setBookCategory(cat)}
                  >
                    <Text style={[styles.pillText, bookCategory === cat && styles.pillTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleUploadBook}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Publish Book to Catalog</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* FORM 2: RESEARCH PAPER UPLOAD */}
          {activeTab === 'research' && (
            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>Clinical Study & Paper Details</Text>

              {/* PDF File Box */}
              <Text style={styles.inputLabel}>Research Paper PDF *</Text>
              <TouchableOpacity
                style={[styles.dropZone, resFile && styles.dropZoneActive]}
                onPress={() => handlePickPdf('research')}
                accessibilityRole="button"
              >
                {resFile ? (
                  <View style={styles.selectedFileRow}>
                    <View style={styles.fileIconWrap}>
                      <Ionicons name="document-text" size={28} color={colors.teal} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {resFile.name}
                      </Text>
                      <Text style={styles.fileSize}>{formatFileSize(resFile.size)}</Text>
                    </View>
                    <View style={styles.changeBadge}>
                      <Text style={styles.changeBadgeText}>Change</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.dropZoneContent}>
                    <Ionicons name="cloud-upload-outline" size={38} color={colors.teal} />
                    <Text style={styles.dropZoneTitle}>Click to select Research PDF</Text>
                    <Text style={styles.dropZoneSubtitle}>Clinical studies, trials, meta-analyses, reviews</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Title */}
              <Text style={styles.inputLabel}>Paper Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Efficacy and Safety of Novel SGLT2 Inhibitors in Heart Failure"
                placeholderTextColor={colors.textMuted}
                value={resTitle}
                onChangeText={setResTitle}
              />

              {/* Authors */}
              <Text style={styles.inputLabel}>Authors</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Dr. Sesha Sai, Dr. Ashok Chandra"
                placeholderTextColor={colors.textMuted}
                value={resAuthors}
                onChangeText={setResAuthors}
              />

              {/* Journal & DOI */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Journal</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. NEJM, Lancet, BMJ"
                    placeholderTextColor={colors.textMuted}
                    value={resJournal}
                    onChangeText={setResJournal}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>DOI (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 10.1056/NEJMoa2026123"
                    placeholderTextColor={colors.textMuted}
                    value={resDoi}
                    onChangeText={setResDoi}
                  />
                </View>
              </View>

              {/* Specialty */}
              <Text style={styles.inputLabel}>Specialty</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                {SPECIALTIES.map(spec => (
                  <TouchableOpacity
                    key={spec}
                    style={[styles.pill, resSpecialty === spec && styles.pillActive]}
                    onPress={() => setResSpecialty(spec)}
                  >
                    <Text style={[styles.pillText, resSpecialty === spec && styles.pillTextActive]}>
                      {spec}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Abstract */}
              <Text style={styles.inputLabel}>Abstract & Summary</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Enter background, methods, primary outcomes, and clinical conclusion..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                value={resAbstract}
                onChangeText={setResAbstract}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleUploadResearch}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Publish Research Paper</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </PageColumn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    fontSize: 20,
    color: colors.navy,
    fontFamily: fonts.heading.bold,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  activeTabButton: {
    backgroundColor: colors.navy,
  },
  tabText: {
    ...typography.bodyStrong,
    color: colors.navy,
    fontSize: 14,
  },
  activeTabText: {
    color: colors.white,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  formSectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.navy,
    fontFamily: fonts.heading.bold,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.small,
    color: colors.navy,
    fontFamily: fonts.heading.semibold,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.body.regular,
    color: colors.text,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  dropZone: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dropZoneActive: {
    borderColor: colors.teal,
    borderStyle: 'solid',
    backgroundColor: colors.tealBg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dropZoneContent: {
    alignItems: 'center',
  },
  dropZoneTitle: {
    ...typography.bodyStrong,
    color: colors.navy,
    marginTop: spacing.sm,
  },
  dropZoneSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  selectedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  fileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileName: {
    ...typography.bodyStrong,
    color: colors.navy,
    fontSize: 14,
  },
  fileSize: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  changeBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeBadgeText: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
    color: colors.navy,
  },
  pillsScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: 4,
  },
  pill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: colors.tealBg,
    borderColor: colors.teal,
  },
  pillText: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
    color: '#475569',
  },
  pillTextActive: {
    color: colors.teal,
    fontFamily: fonts.heading.bold,
  },
  twoColumnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
    ...shadow.card,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyStrong,
    color: colors.white,
    fontSize: 15,
  },
  successCard: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  successIconWrap: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  successTitle: {
    ...typography.h3,
    fontSize: 15,
    color: '#166534',
    fontFamily: fonts.heading.bold,
  },
  successSubtitle: {
    ...typography.body,
    fontSize: 13,
    color: '#15803D',
    marginTop: 2,
  },
  successActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  previewBtnText: {
    fontSize: 12,
    fontFamily: fonts.heading.bold,
    color: colors.white,
  },
  dismissBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  dismissBtnText: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
    color: '#166534',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.body,
    fontSize: 13,
    color: '#B91C1C',
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    ...typography.h3,
    color: '#94A3B8',
    marginTop: 16,
  },
  backLink: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.navy,
    borderRadius: radius.pill,
  },
  backLinkText: {
    color: colors.white,
    ...typography.bodyStrong,
  },

  kycSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tealBg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  kycSwitchBtnText: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
    color: colors.teal,
    fontWeight: '700',
  },
});