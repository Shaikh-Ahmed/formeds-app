import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, typography } from '../../theme';

/**
 * Renders the small slice of Markdown AED answers use: headings, bullet and
 * numbered lists, tables, rules, bold, italic and inline code.
 *
 * Deliberately not a full Markdown engine or a new dependency. Everything is
 * drawn with React Native Text, which is inert -- there is no HTML path, so a
 * model answer can never inject markup into the page.
 */

export type MdBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'bullet'; depth: number; text: string }
  | { kind: 'number'; marker: string; text: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'rule' }
  | { kind: 'paragraph'; text: string };

const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

/**
 * Some models write clinical formulas as LaTeX ($\\text{SpO}_2 \\ge 94\\%$) even when
 * asked not to. There is no maths renderer here, so reduce it to readable text
 * rather than showing the reader dollar signs and backslashes.
 */
const LATEX_SYMBOLS: Record<string, string> = {
  ge: '≥', geq: '≥', le: '≤', leq: '≤', pm: '±', times: '×', to: '→', rightarrow: '→',
  leftarrow: '←', approx: '≈', neq: '≠', degree: '°', circ: '°', mu: 'µ', alpha: 'α', beta: 'β',
  gamma: 'γ', delta: 'δ', Delta: 'Δ', kappa: 'κ', lambda: 'λ', sigma: 'σ', uparrow: '↑', downarrow: '↓',
  cdot: '·', ldots: '…', dots: '…', '%': '%',
};

function cleanMath(math: string): string {
  return math
    .replace(/\\(?:text|mathrm|mathbf|textbf|operatorname)\{([^{}]*)\}/g, '$1')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/[_^]\{([^{}]*)\}/g, '$1')
    .replace(/[_^]([A-Za-z0-9])/g, '$1')
    .replace(/\\([A-Za-z]+|%)/g, (_m, name: string) => LATEX_SYMBOLS[name] ?? name)
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Only text between $ delimiters is treated as maths, so ordinary Markdown
 *  (an _italic_ word, a snake_case term) is never touched. */
export function stripLatex(text: string): string {
  if (!text.includes('$')) return text;
  return text.replace(/\$\$?([^$\n]+?)\$\$?/g, (_m, math: string) => cleanMath(math));
}

export function parseMarkdown(source: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = stripLatex(source || '').replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flush(); continue; }

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flush();
      blocks.push({ kind: 'heading', level: m[1].length, text: m[2] });
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
    } else if (line.startsWith('|')) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!TABLE_SEPARATOR.test(lines[i].trim())) rows.push(cells(lines[i]));
        i++;
      }
      i--;
      blocks.push({ kind: 'table', rows });
    } else if ((m = raw.match(/^(\s*)[-*•]\s+(.*)$/))) {
      flush();
      blocks.push({ kind: 'bullet', depth: Math.min(Math.floor(m[1].length / 2), 2), text: m[2] });
    } else if ((m = line.match(/^(\d+[.)])\s+(.*)$/))) {
      flush();
      blocks.push({ kind: 'number', marker: m[1], text: m[2] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** **bold**, *italic* / _italic_, `code`, and [label](url) shown as its label. */
function Inline({ text, style }: { text: string; style?: any }) {
  const parts = text
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g)
    .filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <Text key={i} style={styles.code}>{part.slice(1, -1)}</Text>;
        }
        if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          return <Text key={i} style={styles.italic}>{part.slice(1, -1)}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export function AedMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Inline key={i} text={block.text}
                style={[styles.heading, block.level <= 2 ? styles.h2 : styles.h3, i === 0 && styles.first]} />
            );
          case 'bullet':
            return (
              <View key={i} style={[styles.listRow, { paddingLeft: block.depth * spacing.lg }]}>
                <Text style={styles.bulletMark}>•</Text>
                <Inline text={block.text} style={styles.body} />
              </View>
            );
          case 'number':
            return (
              <View key={i} style={styles.listRow}>
                <Text style={styles.numberMark}>{block.marker}</Text>
                <Inline text={block.text} style={styles.body} />
              </View>
            );
          case 'table':
            return (
              <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
                <View style={styles.table}>
                  {block.rows.map((row, r) => (
                    <View key={r} style={[styles.tr, r === 0 && styles.thRow]}>
                      {row.map((cell, c) => (
                        <View key={c} style={styles.td}>
                          <Inline text={cell} style={[styles.cell, r === 0 && styles.th]} />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          case 'rule':
            return <View key={i} style={styles.rule} />;
          default:
            return <Inline key={i} text={block.text} style={styles.body} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  body: { ...typography.body, color: colors.text, lineHeight: 22, flexShrink: 1 },
  bold: { fontFamily: fonts.body.semibold },
  italic: { fontStyle: 'italic' },
  code: {
    fontFamily: 'monospace', fontSize: 13, backgroundColor: colors.bgMuted,
    color: colors.navy,
  },
  heading: { color: colors.navy, marginTop: spacing.sm },
  first: { marginTop: 0 },
  h2: { ...typography.h3 },
  h3: { ...typography.label, fontFamily: fonts.heading.semibold, fontSize: 15 },
  listRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bulletMark: { ...typography.body, color: colors.teal, lineHeight: 22 },
  numberMark: { ...typography.body, fontFamily: fonts.body.semibold, color: colors.teal, lineHeight: 22, minWidth: 20 },
  tableScroll: { marginVertical: spacing.xs },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  thRow: { borderTopWidth: 0, backgroundColor: colors.bgMuted },
  td: { width: 150, padding: spacing.sm, borderLeftWidth: 1, borderLeftColor: colors.border },
  cell: { ...typography.caption, color: colors.text, lineHeight: 18 },
  th: { fontFamily: fonts.body.semibold },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
