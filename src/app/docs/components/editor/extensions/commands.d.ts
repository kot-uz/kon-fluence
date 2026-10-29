import type { CalloutVariant } from '../../../constants';

// Команды вставки блоков документации: без этого объявления editor.chain().setCallout()
// и setImageBlock/setVideoBlock/setAudioBlock/setFileBlock не видны в типах TipTap.
// Команды блоков-вложений создаёт createMediaNode по commandName.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docsBlocks: {
      setCallout: (attrs?: { variant?: CalloutVariant }) => ReturnType;
      setImageBlock: (attrs?: Record<string, unknown>) => ReturnType;
      setVideoBlock: (attrs?: Record<string, unknown>) => ReturnType;
      setAudioBlock: (attrs?: Record<string, unknown>) => ReturnType;
      setFileBlock: (attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}
