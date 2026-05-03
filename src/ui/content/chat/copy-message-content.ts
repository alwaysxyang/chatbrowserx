import type { ChatMessageContent } from '../../../shared/types/chat';
import { getChatMessageContentParts, getChatMessageTextContent } from '../../../shared/types/chat';

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

  let htmlContent = '';

  for (const imagePart of imageParts) {
    htmlContent += `<img src="${imagePart.image_url.url}" />`;
  }

  if (textContent) {
    htmlContent += `<p>${textContent.replace(/\n/g, '<br>')}</p>`;
  }

  const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
  const textBlob = new Blob([textContent || ''], { type: 'text/plain' });

  const clipboardItem = new ClipboardItem({
    'text/html': htmlBlob,
    'text/plain': textBlob,
  });

  await navigator.clipboard.write([clipboardItem]);
}
