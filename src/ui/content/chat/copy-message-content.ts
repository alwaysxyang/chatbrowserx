import type { ChatMessageContent } from '../../../shared/types/chat';
import { getChatMessageContentParts, getChatMessageTextContent } from '../../../shared/types/chat';

/**
 * 复制消息内容到剪贴板，支持文字和图片
 */
export async function copyMessageContent(content: ChatMessageContent): Promise<void> {
  const parts = getChatMessageContentParts(content);
  const imageParts = parts.filter((part) => part.type === 'image_url');
  const textContent = getChatMessageTextContent(content);

  // 如果没有图片，只复制文字
  if (imageParts.length === 0) {
    await navigator.clipboard.writeText(textContent);
    return;
  }

  // 如果有图片，构建 HTML 格式的内容（图片 + 文字）
  let htmlContent = '';

  // 添加图片到 HTML
  for (const imagePart of imageParts) {
    htmlContent += `<img src="${imagePart.image_url.url}" />`;
  }

  // 添加文字到 HTML
  if (textContent) {
    htmlContent += `<p>${textContent.replace(/\n/g, '<br>')}</p>`;
  }

  // 创建包含 HTML 和纯文本两种格式的 ClipboardItem
  const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
  const textBlob = new Blob([textContent || ''], { type: 'text/plain' });

  const clipboardItem = new ClipboardItem({
    'text/html': htmlBlob,
    'text/plain': textBlob,
  });

  await navigator.clipboard.write([clipboardItem]);
}
