import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AEDChatScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [sessionId, setSessionId] = useState<string>(`aed-${user?.id || 'anon'}`);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await apiFetch(`/api/chat/history/${sessionId}`, token);
      if (data.length > 0) {
        setMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
        setShowDisclaimer(false);
      }
    } catch (e) { console.log('History error:', e); }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setShowDisclaimer(false);

    try {
      const data = await apiFetch('/api/chat/message', token, {
        method: 'POST',
        body: JSON.stringify({ message: userMsg.content, session_id: sessionId }),
      });
      const aiMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: data.response };
      setMessages(prev => [...prev, aiMsg]);
      if (data.session_id) setSessionId(data.session_id);
    } catch (e: any) {
      const errMsg: Message = { id: `e-${Date.now()}`, role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errMsg]);
    } finally { setLoading(false); }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.msgRow, item.role === 'user' ? styles.userRow : styles.aiRow]}>
      {item.role === 'assistant' && (
        <View style={styles.aiAvatar}><Ionicons name="medical" size={18} color="#FFF" /></View>
      )}
      <View style={[styles.msgBubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.msgText, item.role === 'user' && styles.userText]}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="aed-back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}><Ionicons name="medical" size={20} color="#FFF" /></View>
          <View>
            <Text style={styles.headerName}>AED</Text>
            <Text style={styles.headerStatus}>Medical AI Assistant</Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex} keyboardVerticalOffset={0}>
        {showDisclaimer && messages.length === 0 && (
          <View style={styles.disclaimerBox}>
            <Ionicons name="alert-circle" size={20} color="#D97706" />
            <Text style={styles.disclaimerText}>For verified healthcare professionals only. Not a substitute for clinical judgment.</Text>
          </View>
        )}

        {messages.length === 0 && !loading && (
          <View style={styles.welcomeBox}>
            <View style={styles.welcomeAvatar}><Ionicons name="medical" size={40} color="#FFF" /></View>
            <Text style={styles.welcomeTitle}>Hi, I am AED!</Text>
            <Text style={styles.welcomeSubtitle}>Your medical AI assistant. Ask me about drug dosing, interactions, differential diagnosis, or clinical guidelines.</Text>
            <View style={styles.suggestions}>
              {['Drug interactions with Warfarin', 'Dose adjustment for renal failure', 'Differential diagnosis for chest pain'].map((s, i) => (
                <TouchableOpacity key={i} testID={`suggestion-${i}`} style={styles.suggestionChip} onPress={() => { setInput(s); }}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={loading ? (
            <View style={styles.typingRow}>
              <View style={styles.aiAvatar}><Ionicons name="medical" size={18} color="#FFF" /></View>
              <View style={styles.typingBubble}><ActivityIndicator size="small" color="#1A3A5C" /><Text style={styles.typingText}>AED is thinking...</Text></View>
            </View>
          ) : null}
        />

        <View style={styles.inputBar}>
          <TextInput testID="aed-chat-input" style={styles.chatInput} placeholder="Ask AED anything..." placeholderTextColor="#94A3B8" value={input} onChangeText={setInput} multiline onSubmitEditing={sendMessage} />
          <TouchableOpacity testID="aed-send-btn" style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!input.trim() || loading}>
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A3A5C', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E84545', alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  headerStatus: { fontSize: 12, color: '#94A3B8' },
  disclaimerBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  disclaimerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  welcomeBox: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  welcomeAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E84545', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  welcomeTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  welcomeSubtitle: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  suggestions: { marginTop: 20, gap: 8, width: '100%' },
  suggestionChip: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  suggestionText: { fontSize: 14, color: '#1A3A5C', fontWeight: '500' },
  msgList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%' },
  userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  aiRow: { alignSelf: 'flex-start' },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E84545', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  msgBubble: { borderRadius: 16, padding: 14, maxWidth: '100%' },
  userBubble: { backgroundColor: '#1A3A5C', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  msgText: { fontSize: 15, color: '#334155', lineHeight: 22 },
  userText: { color: '#FFFFFF' },
  typingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  typingText: { fontSize: 13, color: '#64748B' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 8 },
  chatInput: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#0F172A', maxHeight: 100, borderWidth: 1, borderColor: '#E2E8F0' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E84545', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
});
