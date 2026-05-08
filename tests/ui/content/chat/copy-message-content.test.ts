import { describe, it, expect, beforeEach, vi } from 'vitest';
import { copyMessageContent } from '../../../../src/ui/content/chat/copy-message-content';
import type { ChatMessageContent } from '../../../../src/shared/types/chat';

/**
 * Reads a Blob as text in the jsdom test environment.
 *
 * @param blob - The Blob to read.
 * @returns The decoded text content.
 */
function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe('copyMessageContent', () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);
  const mockWrite = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockWriteText.mockClear();
    mockWrite.mockClear();

    // Mock ClipboardItem
    global.ClipboardItem = class ClipboardItem {
      constructor(public data: Record<string, Blob>) {}
    } as any;

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
        write: mockWrite,
      },
      writable: true,
      configurable: true,
    });
  });

  it('copies plain text using writeText', async () => {
    const content: ChatMessageContent = '这是纯文字消息';

    await copyMessageContent(content);

    expect(mockWriteText).toHaveBeenCalledWith('这是纯文字消息');
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('copies text from content array using writeText when no images', async () => {
    const content: ChatMessageContent = [
      { type: 'text', text: '第一段文字' },
      { type: 'text', text: '第二段文字' },
    ];

    await copyMessageContent(content);

    expect(mockWriteText).toHaveBeenCalledWith('第一段文字\n第二段文字');
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('copies images and text using write API with HTML format', async () => {
    const content: ChatMessageContent = [
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      { type: 'text', text: '分析这张图片' },
    ];

    await copyMessageContent(content);

    expect(mockWrite).toHaveBeenCalled();
    expect(mockWriteText).not.toHaveBeenCalled();

    const clipboardItems = mockWrite.mock.calls[0][0] as any[];
    expect(clipboardItems).toHaveLength(1);

    const clipboardItem = clipboardItems[0];
    expect(clipboardItem.data['text/html']).toBeInstanceOf(Blob);
    expect(clipboardItem.data['text/plain']).toBeInstanceOf(Blob);
  });

  it('copies multiple images', async () => {
    const content: ChatMessageContent = [
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,def456' } },
      { type: 'text', text: '比较这两张图片' },
    ];

    await copyMessageContent(content);

    expect(mockWrite).toHaveBeenCalled();
    const clipboardItems = mockWrite.mock.calls[0][0] as any[];
    expect(clipboardItems).toHaveLength(1);

    const clipboardItem = clipboardItems[0];
    expect(clipboardItem.data['text/html']).toBeInstanceOf(Blob);
    expect(clipboardItem.data['text/plain']).toBeInstanceOf(Blob);
  });

  it('copies only images when no text content', async () => {
    const content: ChatMessageContent = [
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
    ];

    await copyMessageContent(content);

    expect(mockWrite).toHaveBeenCalled();
    const clipboardItems = mockWrite.mock.calls[0][0] as any[];
    expect(clipboardItems).toHaveLength(1);

    const clipboardItem = clipboardItems[0];
    expect(clipboardItem.data['text/html']).toBeInstanceOf(Blob);
    expect(clipboardItem.data['text/plain']).toBeInstanceOf(Blob);
  });

  it('includes images in HTML format', async () => {
    const content: ChatMessageContent = [
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      { type: 'text', text: '测试文字' },
    ];

    await copyMessageContent(content);

    const clipboardItems = mockWrite.mock.calls[0][0] as any[];
    const htmlBlob = clipboardItems[0].data['text/html'];

    // Verify the blob was created with correct content
    expect(htmlBlob).toBeInstanceOf(Blob);
    expect(htmlBlob.type).toBe('text/html');
  });

  it('escapes copied HTML text and image attributes', async () => {
    const content: ChatMessageContent = [
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123" onerror="alert(1)' } },
      { type: 'text', text: '<script>alert(1)</script>&\nnext line' },
    ];

    await copyMessageContent(content);

    const clipboardItems = mockWrite.mock.calls[0][0] as any[];
    const htmlBlob = clipboardItems[0].data['text/html'] as Blob;
    const html = await readBlobAsText(htmlBlob);

    expect(html).toContain('src="data:image/png;base64,abc123&quot; onerror=&quot;alert(1)"');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&amp;<br>next line');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('" onerror="');
  });
});
