import i18next from 'i18next';
import { ensureTaskIds } from '../utils/tasks';
import type { DocContent } from '../types';

/** Демо-страница: только название и содержимое, остальное дозаполняет buildPage. */
export interface SeedPage {
  title: string;
  content: DocContent;
}

/** Марки форматирования текста в ProseMirror JSON. */
type Mark = NonNullable<DocContent['marks']>[number];

const t = (key: string) => i18next.t(key, { ns: 'translations' });

const text = (value: string, marks?: Mark[]): DocContent => ({
  type: 'text',
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: (string | DocContent)[]): DocContent => ({
  type: 'paragraph',
  content: content.map((item) => (typeof item === 'string' ? text(item) : item)),
});
const heading = (level: number, value: string): DocContent => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
const listItem = (value: string): DocContent => ({
  type: 'listItem',
  content: [paragraph(value)],
});
const taskItem = (value: string, checked = false): DocContent => ({
  type: 'taskItem',
  attrs: { checked },
  content: [paragraph(value)],
});
const cell = (type: string, value: string): DocContent => ({
  type,
  content: [value ? paragraph(value) : { type: 'paragraph' }],
});
const row = (type: string, values: string[]): DocContent => ({
  type: 'tableRow',
  content: values.map((value) => cell(type, value)),
});
const callout = (variant: string, ...content: DocContent[]): DocContent => ({
  type: 'callout',
  attrs: { variant },
  content,
});

// Строка с примерами всех видов форматирования текста.
const formattingExamples = (): DocContent => {
  const examples: [string, Mark[]][] = [
    [t('DocsBold'), [{ type: 'bold' }]],
    [t('DocsItalic'), [{ type: 'italic' }]],
    [t('DocsUnderline'), [{ type: 'underline' }]],
    [t('DocsStrike'), [{ type: 'strike' }]],
    [t('DocsInlineCode'), [{ type: 'code' }]],
    [t('DocsHighlight'), [{ type: 'highlight', attrs: { color: '#FEF08A' } }]],
    [t('DocsTextColor'), [{ type: 'textStyle', attrs: { color: '#2563EB' } }]],
  ];
  return paragraph(
    ...examples.flatMap(([value, marks], index) =>
      index ? [' · ', text(value, marks)] : [text(value, marks)]
    )
  );
};

// Стартовое содержимое нового пространства документации: пример всех блоков, кроме вложений
// (у мока нет файлов для них — вместо этого подсказка, как их добавить).
export const getSeedPages = (): SeedPage[] => [
  {
    title: t('DocsHomePage'),
    content: ensureTaskIds({
      type: 'doc',
      content: [
        paragraph(t('DocsSeedIntro')),
        callout('info', paragraph(t('DocsSeedSlashHint'))),

        heading(2, t('DocsSeedFormatting')),
        paragraph(t('DocsSeedFormattingHint')),
        formattingExamples(),

        heading(2, t('DocsSeedLists')),
        {
          type: 'bulletList',
          content: [listItem(t('DocsSeedBullet1')), listItem(t('DocsSeedBullet2'))],
        },
        {
          type: 'orderedList',
          content: [
            listItem(t('DocsSeedStep1')),
            listItem(t('DocsSeedStep2')),
            listItem(t('DocsSeedStep3')),
          ],
        },

        heading(2, t('DocsTodoList')),
        paragraph(t('DocsSeedTasksHint')),
        {
          type: 'taskList',
          content: [
            taskItem(t('DocsSeedTask1'), true),
            taskItem(t('DocsSeedTask2')),
            taskItem(t('DocsSeedTask3')),
          ],
        },

        heading(2, t('DocsTable')),
        {
          type: 'table',
          content: [
            row('tableHeader', [t('DocsSeedColRole'), t('DocsSeedColName'), t('DocsSeedColContact')]),
            row('tableCell', [t('DocsSeedRoleManager'), '', '']),
            row('tableCell', [t('DocsSeedRoleAnalyst'), '', '']),
          ],
        },

        heading(2, t('DocsSeedOtherBlocks')),
        { type: 'blockquote', content: [paragraph(t('DocsSeedQuote'))] },
        { type: 'codeBlock', content: [text('npm install\nnpm start')] },
        callout('success', paragraph(t('DocsSeedMediaHint'))),
        callout('warning', paragraph(t('DocsSeedCalloutHint'))),
        { type: 'horizontalRule' },
        paragraph(t('DocsSeedOutro')),
      ],
    }),
  },
];
