import { describe, expect, it, vi } from 'vitest';
import {
  copyImageToClipboard,
  getClipboardImageFiles,
  readClipboardImagesAsDataUrls,
} from '../../../../src/ui/content/chat/clipboard/image-clipboard';

describe('image clipboard helpers', () => {
  it('prefers clipboard items and reads them as data urls', async () => {
    const originalFileReader = globalThis.FileReader;
    const file = new File(['image-bytes'], 'paste.png', { type: 'image/png' });

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;

      readAsDataURL() {
        this.result = 'data:image/png;base64,pasted';
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: MockFileReader,
    });

    try {
      const clipboardData = {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        files: [],
      } as unknown as DataTransfer;

      expect(getClipboardImageFiles(clipboardData)).toEqual([file]);
      await expect(readClipboardImagesAsDataUrls(clipboardData)).resolves.toEqual(['data:image/png;base64,pasted']);
    } finally {
      Object.defineProperty(globalThis, 'FileReader', {
        configurable: true,
        value: originalFileReader,
      });
    }
  });

  it('copies data urls through the browser clipboard api', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    const originalClipboardItem = globalThis.ClipboardItem;

    class MockClipboardItem {
      constructor(public readonly payload: Record<string, Blob>) {}
    }

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: clipboardWrite },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: MockClipboardItem,
    });

    try {
      await copyImageToClipboard('data:image/png;base64,Zm9v');

      expect(clipboardWrite).toHaveBeenCalledTimes(1);
      const [items] = clipboardWrite.mock.calls[0];
      expect(items).toHaveLength(1);
      expect(items[0]).toBeInstanceOf(MockClipboardItem);
      expect((items[0] as MockClipboardItem).payload['image/png']).toBeInstanceOf(Blob);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: originalClipboardItem,
      });
    }
  });
});
