import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

export default function LearningScreen() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'books' | 'cme' | 'research'>('books');
  const [books, setBooks] = useState<any[]>([]);
  const [cme, setCme] = useState<any[]>([]);
  const [research, setResearch] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('medical');
  const [searching, setSearching] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [booksData, cmeData, resData] = await Promise.all([
        apiFetch('/api/learning/books', token),
        apiFetch('/api/learning/cme', token),
        apiFetch(`/api/learning/openalex?search=${searchQuery}&per_page=15`, token).catch(() => ({ works: [] })),
      ]);
      setBooks(booksData);
      setCme(cmeData);
      setResearch(resData.works || []);
    } catch (e) { console.log('Learning error:', e); }
    finally { setLoading(false); }
  }, [token, searchQuery]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiFetch(`/api/learning/openalex?search=${searchQuery}&per_page=15`, token);
      setResearch(data.works || []);
    } catch (e) { console.log('Search error:', e); }
    finally { setSearching(false); }
  };

  const renderBook = ({ item }: any) => (
    <View testID={`book-card-${item.id}`} style={styles.card}>
      <View style={styles.bookIcon}><Ionicons name="book" size={28} color="#1A3A5C" /></View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardAuthor}>{item.author}</Text>
        <View style={styles.tagRow}>
          <View style={styles.specialtyTag}><Text style={styles.specialtyText}>{item.specialty}</Text></View>
          <Text style={styles.pages}>{item.pages} pages</Text>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      </View>
    </View>
  );

  const renderCME = ({ item }: any) => (
    <View testID={`cme-card-${item.id}`} style={styles.card}>
      <View style={[styles.bookIcon, { backgroundColor: '#FEF3C7' }]}><Ionicons name="videocam" size={28} color="#D97706" /></View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.tagRow}>
          <View style={styles.specialtyTag}><Text style={styles.specialtyText}>{item.specialty}</Text></View>
          <View style={styles.creditBadge}><Ionicons name="ribbon" size={14} color="#7C3AED" /><Text style={styles.creditText}>{item.credits} credits</Text></View>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color="#64748B" /><Text style={styles.metaText}>{item.duration}</Text>
          <Ionicons name="help-circle-outline" size={14} color="#64748B" style={{ marginLeft: 12 }} /><Text style={styles.metaText}>{item.quiz_questions} questions</Text>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        <TouchableOpacity testID={`start-cme-${item.id}`} style={styles.startBtn}>
          <Ionicons name="play-circle" size={18} color="#FFF" /><Text style={styles.startText}>Start Lesson</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResearch = ({ item }: any) => (
    <View testID={`research-card-${item.id}`} style={[styles.researchCard]}>
      <View style={styles.researchHeader}>
        <View style={styles.researchIcon}><Ionicons name="flask" size={20} color="#2563EB" /></View>
        <View style={styles.researchMeta}>
          {item.open_access && <View style={styles.oaBadge}><Text style={styles.oaText}>Open Access</Text></View>}
          {item.year && <Text style={styles.yearText}>{item.year}</Text>}
        </View>
      </View>
      <Text style={styles.researchTitle}>{item.title}</Text>
      {item.authors?.length > 0 && <Text style={styles.researchAuthors}>{item.authors.slice(0, 3).join(', ')}{item.authors.length > 3 ? ` +${item.authors.length - 3}` : ''}</Text>}
      {item.source ? <Text style={styles.researchSource}>{item.source}</Text> : null}
      {item.abstract ? <Text style={styles.researchAbstract} numberOfLines={3}>{item.abstract}</Text> : null}
      <View style={styles.researchFooter}>
        <View style={styles.citationBadge}>
          <Ionicons name="document-text-outline" size={14} color="#64748B" />
          <Text style={styles.citationText}>{item.cited_by_count?.toLocaleString()} citations</Text>
        </View>
        {item.doi && <Text style={styles.doiText} numberOfLines={1}>DOI: {item.doi.replace('https://doi.org/', '')}</Text>}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><Text style={styles.headerTitle}>Learning Hub</Text></View>
      <View style={styles.tabBar}>
        {[
          { key: 'books', label: 'Books', icon: 'book-outline' },
          { key: 'cme', label: 'CME', icon: 'school-outline' },
          { key: 'research', label: 'Research', icon: 'flask-outline' },
        ].map(t => (
          <TouchableOpacity key={t.key} testID={`tab-${t.key}`} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key as any)}>
            <Ionicons name={t.icon as any} size={16} color={activeTab === t.key ? '#FFF' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'research' && (
        <View style={styles.searchBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput testID="research-search-input" style={styles.searchInput} placeholder="Search papers (e.g. diabetes, cardiology)" placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search" />
            {searching && <ActivityIndicator size="small" color="#1A3A5C" />}
          </View>
          <TouchableOpacity testID="research-search-btn" style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1A3A5C" /></View>
      ) : (
        <FlatList
          data={activeTab === 'books' ? books : activeTab === 'cme' ? cme : research}
          renderItem={activeTab === 'books' ? renderBook : activeTab === 'cme' ? renderCME : renderResearch}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="book-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No content available</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#1A3A5C' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },
  searchBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A', height: 44 },
  searchBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row' },
  bookIcon: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  cardAuthor: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  specialtyTag: { backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  specialtyText: { fontSize: 11, fontWeight: '600', color: '#0F766E' },
  pages: { fontSize: 12, color: '#94A3B8' },
  creditBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F3FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  creditText: { fontSize: 11, fontWeight: '600', color: '#7C3AED' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  metaText: { fontSize: 12, color: '#64748B' },
  cardDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0F766E', borderRadius: 10, paddingVertical: 10, marginTop: 10 },
  startText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  // Research styles
  researchCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4, borderLeftColor: '#2563EB' },
  researchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  researchIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  researchMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oaBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  oaText: { fontSize: 11, fontWeight: '600', color: '#0F766E' },
  yearText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  researchTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', lineHeight: 22, marginBottom: 6 },
  researchAuthors: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  researchSource: { fontSize: 12, color: '#2563EB', fontWeight: '500', marginBottom: 6 },
  researchAbstract: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  researchFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  citationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  citationText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  doiText: { fontSize: 11, color: '#94A3B8', flex: 1, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 12 },
});
