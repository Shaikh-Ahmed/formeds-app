import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, useBreakpoint, MIN_TOUCH_TARGET } from '../theme';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';
import { timeAgo } from '../utils/time';

/**
 * Full-bleed media viewer for a feed post.
 *
 * The feed thumbnail is deliberately cropped to a fixed height so cards stay
 * a uniform size, which means the feed alone can never show the whole image.
 * This is where the uncropped version lives: `contain`, on a dark ground, with
 * the post's own text beside it so the picture keeps its context.
 *
 * Layout follows the space available — the caption sits in a side panel on a
 * wide screen and stacks underneath on a phone, where a side panel would
 * leave neither the image nor the text usable.
 */
export function MediaViewer({
  visible,
  onClose,
  imageUri,
  post,
  onOpenPost,
}: {
  visible: boolean;
  onClose: () => void;
  imageUri: string;
  post: {
    author_name: string;
    author_role: string;
    content: string;
    created_at: string;
    like_count?: number;
    comment_count?: number;
  };
  /** Route into the full post, where comments live. */
  onOpenPost?: () => void;
}) {
  const { isMobile } = useBreakpoint();

  // Escape closes on web, matching every other lightbox a browser user has met.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const doc: any = typeof document !== 'undefined' ? document : null;
    if (!doc?.addEventListener) return;
    const onKey = (e: any) => { if (e.key === 'Escape') onClose(); };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const caption = (
    <ScrollView
      style={[styles.panel, isMobile ? styles.panelMobile : styles.panelWide]}
      contentContainerStyle={styles.panelContent}
    >
      <View style={styles.author}>
        <Avatar name={post.author_name} role={post.author_role} size={40} />
        <View style={styles.authorMeta}>
          <Text style={styles.authorName} numberOfLines={1}>{post.author_name}</Text>
          <View style={styles.authorRow}>
            <RoleBadge role={post.author_role} />
            <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
          </View>
        </View>
      </View>

      {post.content ? <Text style={styles.caption}>{post.content}</Text> : null}

      {(post.like_count || post.comment_count) ? (
        <Text style={styles.counts}>
          {post.like_count ?? 0} likes · {post.comment_count ?? 0} comments
        </Text>
      ) : null}

      {onOpenPost && (
        <Pressable
          testID="media-open-post"
          onPress={() => { onClose(); onOpenPost(); }}
          accessibilityRole="link"
          accessibilityLabel="Open the full post and comments"
          style={({ pressed }) => [styles.openBtn, pressed && styles.openBtnPressed]}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.navy} />
          <Text style={styles.openBtnText}>View comments</Text>
        </Pressable>
      )}
    </ScrollView>
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      <View style={styles.root}>
        {/* Scrim: tapping outside the image closes, as a lightbox should. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
        />

        <View style={[styles.frame, isMobile ? styles.frameMobile : styles.frameWide]}>
          {/* `contain`, not `cover` — the whole point of opening it is to stop
              cropping the image. */}
          <View style={styles.stage} pointerEvents="box-none">
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={
                post.content ? `Image from post: ${post.content}` : 'Post image'
              }
            />
          </View>
          {caption}
        </View>

        <Pressable
          testID="media-close"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(8, 12, 20, 0.92)' },

  frame: { flex: 1 },
  frameWide: { flexDirection: 'row', padding: spacing.xxxl, gap: spacing.xl },
  frameMobile: { flexDirection: 'column', paddingTop: 64, paddingBottom: spacing.lg },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },

  panel: { backgroundColor: colors.white, borderRadius: radius.lg },
  panelWide: { width: 360, flexGrow: 0, flexShrink: 0 },
  // Capped so a long caption can never squeeze the image off the screen.
  panelMobile: { maxHeight: '38%', marginHorizontal: spacing.lg, marginTop: spacing.lg },
  panelContent: { padding: spacing.lg, gap: spacing.md },

  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  authorMeta: { flex: 1, minWidth: 0 },
  authorName: { ...typography.bodyStrong, color: colors.text },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  time: { ...typography.small, color: colors.textSecondary },

  caption: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  counts: { ...typography.small, color: colors.textSecondary },

  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  openBtnPressed: { backgroundColor: colors.bgMuted },
  openBtnText: { ...typography.label, color: colors.navy },

  close: {
    position: 'absolute',
    top: Platform.OS === 'web' ? spacing.lg : 44,
    right: spacing.lg,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { backgroundColor: 'rgba(15, 23, 42, 0.85)' },
});
