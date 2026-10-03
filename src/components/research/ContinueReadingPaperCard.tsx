import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResearchPaper } from '../../types/research';
import { colors } from '../../theme';
import { continueCardStyles as styles } from '../books/ContinueReadingCard';

interface Props {
  paper: ResearchPaper;
  onResume: (paper: ResearchPaper) => void;
  testID?: string;
}

/** The research shelf's compact card -- the same one-row layout as books. */
export function ContinueReadingPaperCard({ paper, onResume, testID }: Props) {
  const [imgError, setImgError] = useState(false);
  const progress = Math.min(Math.max(paper.progress_pct || 0, 0), 100);
  const byline = paper.authors || paper.journal || paper.specialty || 'Research study';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => onResume(paper)}
      testID={testID || `continue-reading-paper-${paper.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Resume reading ${paper.title}, page ${paper.last_page || 1}`}
    >
      <View style={styles.coverWrap}>
        {paper.cover_url && !imgError ? (
          <Image
            source={{ uri: paper.cover_url }}
            style={styles.cover}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="newspaper-outline" size={16} color={colors.navy} />
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{paper.title}</Text>
        <Text style={styles.byline} numberOfLines={1}>{byline}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.footer}>
          <View style={styles.progressText}>
            <Text style={styles.page} numberOfLines={1}>
              Page {paper.last_page || 1} of {Math.max(paper.pages || 1, paper.last_page || 1)}
            </Text>
            <Text style={styles.pct}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.resume}>
            <Text style={styles.resumeText}>Resume Reading</Text>
            <Ionicons name="play-forward" size={10} color={colors.teal} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
