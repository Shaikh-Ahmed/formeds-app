import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSubmit } from '../src/hooks/useSubmit';
import { FieldError } from '../src/components/FieldError';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch, API_URL } from '../src/utils/api';
import { useWebSocket } from '../src/hooks/useWebSocket';
import * as ImagePicker from 'expo-image-picker';
import { PageColumn } from '../src/components/web';
import { mediaUri } from '../src/utils/media';

import { colors, gloss } from '../src/theme';
interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  content: string;
  message_type?: string;
  attachment?: string;
  read: boolean;
  created_at: string;
}

export default function ConversationScreen() {
  const { userId, userName } = useLocalSearchParams<{ userId: string; userName: string }>();
  const { user, token } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const { submitting: sending, run: runSend } = useSubmit();
  const [sendError, setSendError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<any>(null);

  // Load initial messages
  const loadMessages = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/messages/${userId}`, token);
      setMessages(data);
    } catch (e) { console.log('Thread error:', e); }
    finally { setLoading(false); }
  }, [userId, token]);

  // Check online status
  const checkOnline = useCallback(async () => {
    try {
      const data = await apiFetch('/api/users/online', token);
      setIsOnline(data.online_users?.includes(userId) || false);
    } catch (e) {}
  }, [userId, token]);

  // Realtime events (shared socket hook: header-free auth + backoff reconnect)
  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'new_message' && data.message) {
      const msg = data.message;
      if (msg.sender_id === userId) {
        setMessages(prev => (prev.find(m => m.id === msg.id) ? prev : [...prev, msg]));
        wsSendRef.current?.({ type: 'read_receipt', target_id: userId, message_ids: [msg.id] });
      }
    } else if (data.type === 'typing' && data.user_id === userId) {
      setIsTyping(data.is_typing);
      if (data.is_typing) {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 4000);
      }
    } else if (data.type === 'read_receipt' && data.user_id === userId) {
      setMessages(prev => prev.map(m => (data.message_ids.includes(m.id) ? { ...m, read: true } : m)));
    } else if (data.type === 'presence' && data.user_id === userId) {
      setIsOnline(data.online);
    }
  }, [userId]);

  const { send } = useWebSocket(token, handleWsMessage);
  const wsSendRef = useRef(send);
  wsSendRef.current = send;

  useEffect(() => {
    loadMessages();
    checkOnline();
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [loadMessages, checkOnline]);

  // Send typing indicator
  const handleInputChange = (text: string) => {
    setInput(text);
    send({ type: text ? 'typing' : 'stop_typing', target_id: userId });
  };

  // Enter and the send button both land here, and a double tap can fire it
  // twice before the input clears: the guard lets exactly one through. No
  // content is passed, so each message gets its own key -- sending the same
  // words twice on purpose is two messages.
  const sendMessage = (msgType: string = 'text', attachment?: string) =>
    runSend(key => deliver(key, msgType, attachment));

  const deliver = async (key: string, msgType: string, attachment?: string) => {
    const content = msgType === 'text' ? input.trim() : 'Sent an image';
    if (msgType === 'text' && !content) return;
    setSendError(null);
    if (msgType === 'text') setInput('');
    // Stop typing
    send({ type: 'stop_typing', target_id: userId });
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = { id: tempId, sender_id: user?.id || '', sender_name: user?.name || '', receiver_id: userId || '', content, message_type: msgType, attachment, read: false, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    try {
      const body: any = { receiver_id: userId, content, message_type: msgType };
      if (attachment) body.attachment = attachment;
      const result = await apiFetch('/api/messages/send', token, {
        method: 'POST', body: JSON.stringify(body), idempotencyKey: key,
      });
      // The optimistic bubble becomes the server's message, never a second copy.
      setMessages(prev => prev.map(m => m.id === tempId ? { ...result, id: result.id } : m));
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      // Give the words back so nothing typed is lost, and say why.
      if (msgType === 'text') setInput(content);
      setSendError(e?.message || 'Could not send your message. Please try again.');
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { alert('Permission required to access photos'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      
      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        formData.append('file', blob, filename);
      } else {
        formData.append('file', { uri: asset.uri, name: filename, type } as any);
      }
      
      const upload = await apiFetch('/api/upload/image', token, { method: 'POST', body: formData });
      const finalUrl = upload.url.startsWith('http') ? upload.url : `${API_URL}${upload.url}`;
      await sendMessage('image', finalUrl);
    } catch (e: any) { alert(e.message || 'Upload failed'); }
    finally { setUploadingImage(false); }
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDateSep = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    if (date.toDateString() === yest.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const showDate = index === 0 || formatDateSep(item.created_at) !== formatDateSep(messages[index - 1].created_at);
    const isImage = item.message_type === 'image';
    return (
      <View>
        {showDate && <View style={s.dateSep}><Text style={s.dateText}>{formatDateSep(item.created_at)}</Text></View>}
        <View style={[s.msgRow, isMe ? s.myRow : s.theirRow]}>
          {!isMe && <View style={s.msgAvatar}><Text style={s.msgAvatarText}>{item.sender_name?.charAt(0)}</Text></View>}
          <View style={[s.bubble, isMe ? s.myBubble : s.theirBubble, isImage && s.imgBubble]}>
            {isImage && item.attachment ? (
              <Image source={{ uri: mediaUri(item.attachment) }} style={s.msgImage} resizeMode="cover" />
            ) : (
              <Text style={[s.msgText, isMe && s.myMsgText]}>{item.content}</Text>
            )}
            <View style={s.msgMeta}>
              <Text style={[s.msgTime, isMe && s.myMsgTime]}>{formatTime(item.created_at)}</Text>
              {isMe && <Ionicons name={item.read ? "checkmark-done" : "checkmark"} size={14} color={item.read ? "#60A5FA" : "rgba(255,255,255,0.5)"} />}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <PageColumn maxWidth={760} testID="conversation-column">
      <View style={s.header}>
        <TouchableOpacity testID="convo-back-btn" style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={s.headerAvatarWrap}>
          <View style={s.headerAvatar}><Text style={s.headerAvatarText}>{userName?.charAt(0)}</Text></View>
          {isOnline && <View style={s.onlineDot} />}
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{userName}</Text>
          <Text style={s.headerStatus}>
            {isTyping ? 'typing...' : isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex} keyboardVerticalOffset={0}>
        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={colors.navy} /></View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={s.msgList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<View style={s.emptyChat}><Ionicons name="chatbubbles-outline" size={40} color={colors.iconFaint} /><Text style={s.emptyChatText}>Start the conversation!</Text></View>}
          />
        )}

        {isTyping && (
          <View style={s.typingBar}>
            <View style={s.typingDots}>
              <View style={[s.dot, s.dot1]} /><View style={[s.dot, s.dot2]} /><View style={[s.dot, s.dot3]} />
            </View>
            <Text style={s.typingLabel}>{userName} is typing...</Text>
          </View>
        )}

        {sendError ? <View style={s.sendErrorWrap}><FieldError message={sendError} /></View> : null}
        <View style={s.inputBar}>
          <TouchableOpacity testID="attach-image-btn" style={s.attachBtn} onPress={pickImage} disabled={uploadingImage}>
            {uploadingImage ? <ActivityIndicator size="small" color={colors.navy} /> : <Ionicons name="image-outline" size={24} color={colors.navy} />}
          </TouchableOpacity>
          <TextInput maxLength={5000} testID="message-input" style={s.chatInput} placeholder="Type a message..." placeholderTextColor={colors.textMuted} value={input} onChangeText={handleInputChange} multiline onSubmitEditing={() => sendMessage('text')} />
          <TouchableOpacity testID="send-message-btn" style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]} onPress={() => sendMessage('text')} disabled={!input.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={20} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </PageColumn>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  sendErrorWrap: { paddingHorizontal: 16, paddingTop: 6 },
  safe: { flex: 1, backgroundColor: '#F0F2F5' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy, paddingHorizontal: 12, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerAvatarWrap: { position: 'relative', marginRight: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.navy },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  headerStatus: { fontSize: 12, color: colors.textMuted },
  msgList: { padding: 12, paddingBottom: 8 },
  dateSep: { alignItems: 'center', marginVertical: 12 },
  dateText: { fontSize: 12, color: colors.textMuted, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  msgRow: { flexDirection: 'row', marginBottom: 6, maxWidth: '80%' },
  myRow: { alignSelf: 'flex-end' },
  theirRow: { alignSelf: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryFill, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginTop: 2 },
  msgAvatarText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%' },
  myBubble: { backgroundColor: colors.primaryFill, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  imgBubble: { padding: 4, overflow: 'hidden' },
  msgImage: { width: 200, height: 200, borderRadius: 14 },
  msgText: { fontSize: 15, color: colors.textBody, lineHeight: 21 },
  myMsgText: { color: '#FFFFFF' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  msgTime: { fontSize: 11, color: colors.textMuted },
  myMsgTime: { color: 'rgba(255,255,255,0.6)' },
  typingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#F0F2F5' },
  typingDots: { flexDirection: 'row', gap: 3, marginRight: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.8 },
  typingLabel: { fontSize: 12, color: colors.textSubtle, fontStyle: 'italic' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, paddingBottom: 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  attachBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  chatInput: { flex: 1, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.action, ...gloss.fill, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyChat: { alignItems: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 15, color: colors.textMuted, marginTop: 10 },
});
