import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch, API_URL } from '../../src/utils/api';
import {
  Button, ErrorBanner, KycNotice, LoadingState, ScreenHeader, TagChip,
} from '../../src/components';
import { colors, radius, spacing, typography, MIN_TOUCH_TARGET } from '../../src/theme';

// Mirrors the server's validators (models/schemas.py). Enforced here too so the
// writer sees the limit while typing rather than as a 422 on submit.
const TITLE_MIN = 10;
const TITLE_MAX = 200;
const BODY_MIN = 20;
const MAX_TAGS = 5;

const BODY_PROMPT = `Presentation, relevant history, what you have already tried, and the specific question you want answered.

Leave out anything that could identify the patient — no names, MRNs, dates of birth or face photos.`;

export default function CaseComposerScreen() {
  // `id` present ⇒ editing an existing case. Same form either way: the fields
  // are identical, and a separate edit screen would drift from this one.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const { token, isKycApproved } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const [loading, setLoading] = useState(editing);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    try {
      const existing = await apiFetch(`/api/cases/${id}`, token);
      setTitle(existing.title);
      setBody(existing.body);
      setSpecialty(existing.specialty || '');
      setTags(existing.tags || []);
      setImageUrl(existing.image_url || '');
      setAnonymous(!!existing.is_anonymous);
    } catch (e: any) {
      setError(e?.message || 'Could not load this case.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { if (editing) loadExisting(); }, [editing, loadExisting]);

  const addTag = (raw: string) => {
    const clean = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9+#-]/g, '');
    if (clean.length < 2 || tags.includes(clean) || tags.length >= MAX_TAGS) {
      setTagDraft('');
      return;
    }
    setTags(prev => [...prev, clean]);
    setTagDraft('');
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permission is required to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploading(true);
    setError(null);
    try {
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const form = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        form.append('file', blob, filename);
      } else {
        form.append('file', { uri: asset.uri, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
      }
      const upload = await apiFetch('/api/upload/image', token, { method: 'POST', body: form });
      setImageUrl(upload.url.startsWith('http') ? upload.url : `${API_URL}${upload.url}`);
    } catch (e: any) {
      setError(e?.message || 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  };

  const titleShort = title.trim().length > 0 && title.trim().length < TITLE_MIN;
  const bodyShort = body.trim().length > 0 && body.trim().length < BODY_MIN;
  const ready = title.trim().length >= TITLE_MIN && body.trim().length >= BODY_MIN && isKycApproved;

  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        specialty: specialty.trim(),
        tags,
        image_url: imageUrl,
        ...(editing ? {} : { is_anonymous: anonymous }),
      };
      const saved = editing
        ? await apiFetch(`/api/cases/${id}`, token, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch('/api/cases/', token, { method: 'POST', body: JSON.stringify(payload) });

      // replace(), not push(): backing out of a freshly posted case should land
      // on the list, not on the composer that created it.
      router.replace({ pathname: '/case/[id]', params: { id: saved.id } } as any);
    } catch (e: any) {
      setError(e?.message || 'Could not save this case.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Edit case" />
        <LoadingState label="Loading case…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={editing ? 'Edit case' : 'Post a case'} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <KycNotice action="post a case" />
          <ErrorBanner message={error} />

          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
            <Text style={styles.privacyText}>
              Cases are visible to the whole ForMeds community. De-identify before you post.
            </Text>
          </View>

          <Text style={styles.label}>Question</Text>
          <TextInput
            testID="case-title-input"
            style={styles.input}
            placeholder="Summarise it in one line, as you would ask a colleague"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            editable={isKycApproved}
            maxLength={TITLE_MAX}
            multiline
            accessibilityLabel="Case question"
          />
          <Text style={[styles.hint, titleShort && styles.hintWarn]}>
            {titleShort ? `At least ${TITLE_MIN} characters` : `${title.trim().length}/${TITLE_MAX}`}
          </Text>

          <Text style={styles.label}>Details</Text>
          <TextInput
            testID="case-body-input"
            style={[styles.input, styles.textArea]}
            placeholder={BODY_PROMPT}
            placeholderTextColor={colors.textMuted}
            value={body}
            onChangeText={setBody}
            editable={isKycApproved}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Case details"
          />
          {bodyShort ? <Text style={[styles.hint, styles.hintWarn]}>At least {BODY_MIN} characters</Text> : null}

          <Text style={styles.label}>Specialty</Text>
          <TextInput
            testID="case-specialty-input"
            style={styles.input}
            placeholder="e.g. Anaesthesiology"
            placeholderTextColor={colors.textMuted}
            value={specialty}
            onChangeText={setSpecialty}
            editable={isKycApproved}
            accessibilityLabel="Specialty"
          />

          <Text style={styles.label}>Tags</Text>
          <Text style={styles.hint}>Up to {MAX_TAGS}. These are how colleagues find your case.</Text>
          {tags.length ? (
            <View style={styles.tagRow}>
              {tags.map(tag => (
                <TagChip
                  key={tag}
                  testID={`case-tag-${tag}`}
                  label={tag}
                  onRemove={() => setTags(prev => prev.filter(t => t !== tag))}
                />
              ))}
            </View>
          ) : null}
          {tags.length < MAX_TAGS ? (
            <TextInput
              testID="case-tag-input"
              style={styles.input}
              placeholder="Add a tag and press enter"
              placeholderTextColor={colors.textMuted}
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={() => addTag(tagDraft)}
              blurOnSubmit={false}
              returnKeyType="done"
              editable={isKycApproved}
              accessibilityLabel="Add a tag"
            />
          ) : null}

          <Text style={styles.label}>Attachment</Text>
          {imageUrl ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removeImage}
                onPress={() => setImageUrl('')}
                accessibilityRole="button"
                accessibilityLabel="Remove attached image"
              >
                <Ionicons name="close-circle" size={26} color={colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              testID="case-image-btn"
              style={styles.attach}
              onPress={pickImage}
              disabled={uploading || !isKycApproved}
              accessibilityRole="button"
              accessibilityLabel="Attach an image"
            >
              {uploading ? <ActivityIndicator color={colors.navy} /> : (
                <>
                  <Ionicons name="image-outline" size={20} color={colors.navy} />
                  <Text style={styles.attachText}>Attach imaging, ECG or a chart</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Anonymity is fixed at creation: flipping it later would expose an
              author whose earlier readers already saw the post as anonymous. */}
          {!editing ? (
            <TouchableOpacity
              testID="case-anonymous-toggle"
              style={styles.anonRow}
              onPress={() => setAnonymous(v => !v)}
              disabled={!isKycApproved}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: anonymous }}
            >
              <Ionicons
                name={anonymous ? 'checkbox' : 'square-outline'}
                size={20}
                color={anonymous ? colors.navy : colors.textMuted}
              />
              <View style={styles.flex}>
                <Text style={styles.anonTitle}>Post anonymously</Text>
                <Text style={styles.hint}>Your name is hidden from other members. Moderators can still see it.</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <Button
            testID="submit-case-btn"
            label={editing ? 'Save changes' : 'Post case'}
            onPress={submit}
            loading={saving}
            disabled={!ready}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  privacyNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.tealBg, borderWidth: 1, borderColor: '#CCFBF1',
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
  },
  privacyText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.lg },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    ...typography.body, color: colors.text, minHeight: MIN_TOUCH_TARGET + 4,
  },
  textArea: { minHeight: 180, paddingTop: spacing.md },
  hint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  hintWarn: { color: colors.warning },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.sm },
  attach: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: spacing.lg, minHeight: MIN_TOUCH_TARGET + 12,
  },
  attachText: { ...typography.caption, color: colors.navy, fontWeight: '600' },
  imageWrap: { position: 'relative', alignSelf: 'flex-start' },
  image: { width: 160, height: 160, borderRadius: radius.lg },
  removeImage: { position: 'absolute', top: -10, right: -10, backgroundColor: 'rgba(15,23,42,0.65)', borderRadius: 13 },
  anonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xl },
  anonTitle: { ...typography.bodyStrong, color: colors.text },
  submit: { marginTop: spacing.xxl },
});
