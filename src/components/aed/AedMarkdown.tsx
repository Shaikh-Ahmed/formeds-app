import React, { createContext, useContext, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

/**
 * Clinical answers have a fixed shape: a bottom line, then headed sections.
 * The bottom line becomes a card, "Missing information" a box at the end, and
 * background sections ("Mechanism", "Why?") fold away so the decision stays on
 * the first screen. Answers without that shape render exactly as before.
 */
export type MdSection =
  | { kind: 'bottom'; text: string }
  | { kind: 'section'; heading: string | null; level: number; variant: 'plain' | 'missing' | 'collapsible'; blocks: MdBlock[] };

const BOTTOM_LINE = /^\*{0,2}bottom line:?\*{0,2}:?\s*/i;
const MISSING = /^\*{0,2}missing information\b/i;
const COLLAPSIBLE = /^(mechanism|why\??|background|pharmacology)\b/i;

function headingOf(block: MdBlock): string | null {
  if (block.kind === 'heading') return block.text.replace(/\*\*/g, '').trim();
  // A bold line on its own ("**Missing information**") acts as a heading too.
  if (block.kind === 'paragraph' && /^\*\*[^*]+\*\*:?$/.test(block.text.trim())) {
    return block.text.replace(/\*\*|:$/g, '').trim();
  }
  return null;
}

export function sectionsOf(blocks: MdBlock[]): MdSection[] {
  const out: MdSection[] = [];
  let current: Extract<MdSection, { kind: 'section' }> = { kind: 'section', heading: null, level: 0, variant: 'plain', blocks: [] };
  const push = () => { if (current.heading || current.blocks.length) out.push(current); };
  blocks.forEach((block, i) => {
    if (i === 0 && block.kind === 'paragraph' && BOTTOM_LINE.test(block.text)) {
      out.push({ kind: 'bottom', text: block.text.replace(BOTTOM_LINE, '') });
      return;
    }
    const heading = headingOf(block);
    if (heading && (block.kind === 'heading' || MISSING.test(heading))) {
      push();
      current = {
        kind: 'section', heading, level: block.kind === 'heading' ? block.level : 3, blocks: [],
        variant: MISSING.test(heading) ? 'missing' : COLLAPSIBLE.test(heading) ? 'collapsible' : 'plain',
      };
      return;
    }
    // AED's own check notes (_italic_ lines appended after the answer) never
    // belong inside the Missing-information box.
    if (current.variant === 'missing' && block.kind === 'paragraph' && /^_[^_].*_$/.test(block.text.trim())) {
      push();
      current = { kind: 'section', heading: null, level: 0, variant: 'plain', blocks: [] };
    }
    current.blocks.push(block);
  });
  push();
  return out;
}

/** Tapping a citation number: the answer's sources, by number. */
const CiteContext = createContext<((n: number) => void) | null>(null);

/** Plain text with its [n] citation markers drawn as small tappable numbers. */
function Cited({ text }: { text: string }) {
  const onCite = useContext(CiteContext);
  const pieces = text.split(/(\[\d{1,3}\])/g).filter(Boolean);
  return (
    <>
      {pieces.map((piece, i) => {
        const n = /^\[(\d{1,3})\]$/.exec(piece);
        if (!n || !onCite) return <Text key={i}>{piece}</Text>;
        return (
          <Text key={i} style={styles.cite} onPress={() => onCite(Number(n[1]))}
            accessibilityRole="link" accessibilityLabel={`Source ${n[1]}`} testID={`aed-cite-${n[1]}`}>
            {` ${n[1]} `}
          </Text>
        );
      })}
    </>
  );
}

/** **bold**, *italic* / _italic_, `code`, [label](url) shown as its label, and [n] citations. */
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
        return <Cited key={i} text={part} />;
      })}
    </Text>
  );
}

function Blocks({ blocks, first = false }: { blocks: MdBlock[]; first?: boolean }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Inline key={i} text={block.text}
                style={[styles.heading, block.level <= 2 ? styles.h2 : styles.h3, first && i === 0 && styles.first]} />
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
            // Two columns (Finding → Action) use the full width; wider tables scroll.
            if (block.rows.every(row => row.length === 2)) {
              return (
                <View key={i} style={[styles.table, styles.tableScroll]} testID="aed-md-trigger-table">
                  {block.rows.map((row, r) => (
                    <View key={r} style={[styles.tr, r === 0 && styles.thRow]}>
                      {row.map((cell, c) => (
                        <View key={c} style={[styles.td, styles.tdFlex]}>
                          <Inline text={cell} style={[styles.cell, r === 0 && styles.th]} />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              );
            }
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
    </>
  );
}

function Collapsible({ heading, blocks }: { heading: string; blocks: MdBlock[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.collapsible}>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={`${heading}, ${open ? 'hide' : 'show'}`} style={styles.collapsibleHead}
        testID="aed-md-collapsible">
        <Inline text={heading} style={styles.h3} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </Pressable>
      {open ? <Blocks blocks={blocks} /> : null}
    </View>
  );
}

export function AedMarkdown({ text, onCite }: { text: string; onCite?: (n: number) => void }) {
  const sections = sectionsOf(parseMarkdown(text));
  return (
    <CiteContext.Provider value={onCite ?? null}>
    <View style={styles.root}>
      {sections.map((section, i) => {
        if (section.kind === 'bottom') {
          return (
            <View key={i} style={styles.bottomLine} testID="aed-bottom-line" accessibilityRole="summary">
              <Text style={styles.bottomLabel}>BOTTOM LINE</Text>
              <Inline text={section.text} style={styles.bottomText} />
            </View>
          );
        }
        if (section.variant === 'missing') {
          return (
            <View key={i} style={styles.missing} testID="aed-missing-info">
              <View style={styles.missingHead}>
                <Ionicons name="help-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.missingTitle}>Missing information that changes the answer</Text>
              </View>
              <Blocks blocks={section.blocks} />
            </View>
          );
        }
        if (section.variant === 'collapsible' && section.heading) {
          return <Collapsible key={i} heading={section.heading} blocks={section.blocks} />;
        }
        return (
          <View key={i} style={styles.section}>
            {section.heading ? (
              <Inline text={section.heading}
                style={[styles.heading, section.level <= 2 ? styles.h2 : styles.h3, i === 0 && styles.first]} />
            ) : null}
            <Blocks blocks={section.blocks} first={!section.heading && i === 0} />
          </View>
        );
      })}
    </View>
    </CiteContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  section: { gap: spacing.sm },
  bottomLine: {
    gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.tealBg,
    borderWidth: 1, borderColor: '#CCEDE8',
  },
  bottomLabel: { ...typography.overline, color: colors.teal },
  bottomText: { ...typography.body, color: colors.text, lineHeight: 23, fontFamily: fonts.body.medium },
  missing: {
    gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningBg,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  missingHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  missingTitle: { ...typography.label, fontFamily: fonts.heading.semibold, color: colors.text, fontSize: 14 },
  collapsible: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm },
  collapsibleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  tdFlex: { flex: 1, width: undefined },
  body: { ...typography.body, color: colors.text, lineHeight: 22, flexShrink: 1 },
  bold: { fontFamily: fonts.body.semibold },
  cite: {
    ...typography.small, fontFamily: fonts.body.semibold, color: colors.white, backgroundColor: colors.navy,
    fontSize: 11, borderRadius: 8, overflow: 'hidden',
  },
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
