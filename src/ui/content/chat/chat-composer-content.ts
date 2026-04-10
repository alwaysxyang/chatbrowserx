import type { ChatContentPart, ChatMessageContent } from '../../../shared/types/chat';

export function buildComposerContent(text: string, imageUrls: string[]): ChatMessageContent {
  if (!imageUrls.length) {
    return text;
  }

  const parts: ChatContentPart[] = imageUrls.map((url) => ({
    type: 'image_url',
    image_url: { url },
  }));

  if (text) {
    parts.push({ type: 'text', text });
  }

  return parts;
}
