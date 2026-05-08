import type { ChatMessageContent } from '../../../shared/types/chat';
import { getChatMessageContentParts, getChatMessageTextContent } from '../../../shared/types/chat';

/**
 * Escapes text for safe HTML text-node insertion.
 *
 * @param value - Raw text content.
 * @returns HTML-escaped text.
 */
function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes a value for safe HTML attribute insertion.
 *
 * @param value - Raw attribute value.
 * @returns HTML-escaped attribute value.
 */
function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the HTML clipboard representation for mixed image and text content.
 *
 * @param content - Message content to serialize.
 * @returns Sanitized HTML clipboard content.
 */
function buildClipboardHtml(content: ChatMessageContent): string {
  const parts = getChatMessageContentParts(content);
  const imageHtml = parts
    .filter((part) => part.type === 'image_url')
    .map((part) => `<img src="${escapeHtmlAttribute(part.image_url.url)}" />`);
  const textContent = getChatMessageTextContent(content);

  if (textContent) {
    imageHtml.push(`<p>${escapeHtmlText(textContent).replace(/\n/g, '<br>')}</p>`);
  }

  return imageHtml.join('');
}

/**
 * Copies message content to the clipboard with text and image support.
 *
 * @param content - Message content to copy.
 */
export async function copyMessageContent(content: ChatMessageContent): Promise<void> {
  const parts = getChatMessageContentParts(content);
  const imageParts = parts.filter((part) => part.type === 'image_url');
  const textContent = getChatMessageTextContent(content);

  if (imageParts.length === 0) {
    await navigator.clipboard.writeText(textContent);
    return;
  }

  const htmlBlob = new Blob([buildClipboardHtml(content)], { type: 'text/html' });
  const textBlob = new Blob([textContent || ''], { type: 'text/plain' });

  const clipboardItem = new ClipboardItem({
    'text/html': htmlBlob,
    'text/plain': textBlob,
  });

  await navigator.clipboard.write([clipboardItem]);
}
