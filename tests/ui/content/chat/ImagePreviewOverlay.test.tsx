import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImagePreviewOverlay } from '../../../../src/ui/content/chat/ImagePreviewOverlay';

describe('ImagePreviewOverlay', () => {
  it('copies the preview image to the clipboard on Ctrl+C', async () => {
    const originalClipboard = navigator.clipboard;
    const originalClipboardItem = globalThis.ClipboardItem;
    const write = vi.fn(async (_items: unknown[]) => undefined);

    class MockClipboardItem {
      constructor(readonly items: Record<string, Blob>) {}
    }

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: MockClipboardItem,
    });

    try {
      render(<ImagePreviewOverlay src="data:image/png;base64,AA==" onClose={vi.fn()} />);

      await userEvent.keyboard('{Control>}c{/Control}');

      await waitFor(() => {
        expect(write).toHaveBeenCalledTimes(1);
      });

      const clipboardItem = write.mock.calls[0]?.[0]?.[0] as MockClipboardItem | undefined;
      expect(Object.keys(clipboardItem?.items ?? {})).toEqual(['image/png']);
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

    expect(screen.getByRole('dialog', { name: '图片预览' })).toBeInTheDocument();
  });

  it('positions the round close button against the image corner without a text caret', () => {
    render(<ImagePreviewOverlay src="data:image/png;base64,AA==" onClose={vi.fn()} />);

    expect(screen.getByTestId('image-preview-stage')).toContainElement(screen.getByRole('img', { name: '图片预览' }));
    expect(screen.getByRole('button', { name: '关闭图片预览' })).toHaveStyle({
      position: 'absolute',
      top: '0px',
      right: '0px',
      borderRadius: '999px',
      caretColor: 'transparent',
    });
  });
});
