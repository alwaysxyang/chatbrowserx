import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScreenshotOverlay } from '../../../../src/ui/content/chat/ScreenshotOverlay';

describe('ScreenshotOverlay', () => {
  it('renders screenshot controls and cancels with Escape', async () => {
    const onCancel = vi.fn();

    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => 'data:image/png;base64,viewport')}
        onComplete={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('button', { name: '全屏截图' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '长截图' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '截图完成' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('captures the visible viewport when fullscreen screenshot is clicked', async () => {
    const onComplete = vi.fn();
    const onCaptureVisibleTab = vi.fn(async () => 'data:image/png;base64,viewport');

    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={onCaptureVisibleTab}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '全屏截图' }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('data:image/png;base64,viewport');
    });
    expect(onCaptureVisibleTab).toHaveBeenCalledTimes(1);
  });

  it('keeps the selection area transparent and centers controls below it', () => {
    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => 'data:image/png;base64,viewport')}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId('screenshot-overlay');
    const selection = screen.getByTestId('screenshot-selection');
    const controls = screen.getByTestId('screenshot-controls');
    const selectionLeft = parseFloat(selection.style.left);
    const selectionWidth = parseFloat(selection.style.width);

    expect(overlay).toHaveStyle({ background: 'transparent' });
    expect(selection).toHaveStyle({ background: 'transparent', border: '0px', outlineColor: '#ffffff' });
    expect(controls).toHaveStyle({ transform: 'translateX(-50%)' });
    expect(parseFloat(controls.style.left)).toBeCloseTo(selectionLeft + selectionWidth / 2);
  });

  it('moves the selection when dragging inside and resizes it from the edge', () => {
    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => 'data:image/png;base64,viewport')}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const overlay = screen.getByTestId('screenshot-overlay');
    const selection = screen.getByTestId('screenshot-selection');
    const startLeft = parseFloat(selection.style.left);
    const startTop = parseFloat(selection.style.top);
    const startWidth = parseFloat(selection.style.width);
    const startHeight = parseFloat(selection.style.height);

    fireEvent.pointerDown(overlay, {
      button: 0,
      pointerId: 1,
      clientX: startLeft + startWidth / 2,
      clientY: startTop + startHeight / 2,
    });
    fireEvent.pointerMove(overlay, {
      pointerId: 1,
      clientX: startLeft + startWidth / 2 + 28,
      clientY: startTop + startHeight / 2 + 16,
    });
    fireEvent.pointerUp(overlay, { pointerId: 1 });

    expect(parseFloat(selection.style.left)).toBeCloseTo(startLeft + 28);
    expect(parseFloat(selection.style.top)).toBeCloseTo(startTop + 16);

    const movedLeft = parseFloat(selection.style.left);
    const movedTop = parseFloat(selection.style.top);
    const movedWidth = parseFloat(selection.style.width);
    const movedHeight = parseFloat(selection.style.height);

    fireEvent.pointerMove(overlay, {
      pointerId: 1,
      clientX: movedLeft + movedWidth - 1,
      clientY: movedTop + movedHeight / 2,
    });
    expect(overlay).toHaveStyle({ cursor: 'ew-resize' });

    fireEvent.pointerDown(overlay, {
      button: 0,
      pointerId: 2,
      clientX: movedLeft + movedWidth - 1,
      clientY: movedTop + movedHeight / 2,
    });
    fireEvent.pointerMove(overlay, {
      pointerId: 2,
      clientX: movedLeft + movedWidth + 36,
      clientY: movedTop + movedHeight / 2,
    });
    fireEvent.pointerUp(overlay, { pointerId: 2 });

    expect(parseFloat(selection.style.width)).toBeGreaterThan(movedWidth);
  });

  it('enters manual long screenshot mode before finishing', async () => {
    const onComplete = vi.fn();

    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => {
          throw new Error('capture unavailable');
        })}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '长截图' }));

    expect(screen.getByRole('button', { name: '取消长截图' })).toHaveAttribute('aria-pressed', 'true');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('toggles manual long screenshot mode off with cancel wording', async () => {
    render(
      <ScreenshotOverlay
        onCaptureVisibleTab={vi.fn(async () => {
          throw new Error('capture unavailable');
        })}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '长截图' }));

    expect(screen.getByRole('button', { name: '取消长截图' })).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消长截图' })).not.toBeDisabled();
    });

    await userEvent.click(screen.getByRole('button', { name: '取消长截图' }));

    expect(screen.getByRole('button', { name: '长截图' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('captures long screenshot chunks while wheeling inside the selection and stitches them on done without flashing or overlapping', async () => {
    const originalImage = globalThis.Image;
    const originalScrollBy = window.scrollBy;
    const originalScrollTo = window.scrollTo;
    const originalScrollY = window.scrollY;
    let scrollY = 0;

    class MockImage {
      naturalWidth = 1024;
      naturalHeight = 768;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    Object.defineProperty(globalThis, 'Image', {
      value: MockImage as unknown as typeof Image,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      get: () => scrollY,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollBy', {
      value: vi.fn((options: ScrollToOptions) => {
        scrollY += Number(options.top ?? 0);
      }),
      configurable: true,
    });
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn((_x: number, y: number) => {
        scrollY = y;
      }),
      configurable: true,
    });

    const drawImageMock = vi.fn();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ drawImage: drawImageMock }) as unknown as CanvasRenderingContext2D);
    const toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('data:image/png;base64,crop-start')
      .mockReturnValueOnce('data:image/png;base64,crop-next')
      .mockReturnValueOnce('data:image/png;base64,crop-next-2')
      .mockReturnValue('data:image/png;base64,stitched');
    const onComplete = vi.fn();
    const captureResults = [
      'data:image/png;base64,viewport-start',
      'data:image/png;base64,viewport-next',
      'data:image/png;base64,viewport-next-2',
    ];
    const onCaptureVisibleTab = vi.fn(async () => {
      expect(screen.getByTestId('screenshot-overlay')).not.toHaveClass('screenshot-overlay-capturing');
      return captureResults.shift() ?? 'data:image/png;base64,viewport-extra';
    });

    try {
      render(
        <ScreenshotOverlay
          onCaptureVisibleTab={onCaptureVisibleTab}
          onComplete={onComplete}
          onCancel={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: '长截图' }));

      await waitFor(() => {
        expect(onCaptureVisibleTab).toHaveBeenCalledTimes(1);
      });

      const overlay = screen.getByTestId('screenshot-overlay');
      const selection = screen.getByTestId('screenshot-selection');
      const selectionLeft = parseFloat(selection.style.left);
      const selectionTop = parseFloat(selection.style.top);
      const selectionWidth = parseFloat(selection.style.width);
      const selectionHeight = parseFloat(selection.style.height);

      expect(overlay).not.toHaveClass('screenshot-overlay-capturing');

      fireEvent.wheel(overlay, {
        clientX: selectionLeft + selectionWidth / 2,
        clientY: selectionTop + selectionHeight / 2,
        deltaY: 220,
      });
      fireEvent.wheel(overlay, {
        clientX: selectionLeft + selectionWidth / 2,
        clientY: selectionTop + selectionHeight / 2,
        deltaY: 180,
      });

      await waitFor(() => {
        expect(window.scrollBy).toHaveBeenCalledWith({ left: 0, top: 220, behavior: 'auto' });
        expect(window.scrollBy).toHaveBeenCalledWith({ left: 0, top: 180, behavior: 'auto' });
      });
      expect(overlay).not.toHaveClass('screenshot-overlay-capturing');

      await waitFor(() => {
        expect(onCaptureVisibleTab).toHaveBeenCalledTimes(3);
      });
      expect(overlay).not.toHaveClass('screenshot-overlay-capturing');

      await userEvent.click(screen.getByRole('button', { name: '截图完成' }));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith('data:image/png;base64,stitched');
      });

      const cropDrawCalls = drawImageMock.mock.calls.filter((call) => call.length === 9);
      expect(cropDrawCalls).toHaveLength(3);
      expect(cropDrawCalls.reduce((sum, call) => sum + Number(call[4]), 0)).toBe(
        parseFloat(selection.style.height) + 400,
      );
      expect(window.scrollTo).not.toHaveBeenCalled();
    } finally {
      getContextSpy.mockRestore();
      toDataUrlSpy.mockRestore();
      Object.defineProperty(globalThis, 'Image', {
        value: originalImage,
        configurable: true,
      });
      Object.defineProperty(window, 'scrollBy', {
        value: originalScrollBy,
        configurable: true,
      });
      Object.defineProperty(window, 'scrollTo', {
        value: originalScrollTo,
        configurable: true,
      });
      Object.defineProperty(window, 'scrollY', {
        value: originalScrollY,
        configurable: true,
      });
    }
  });

  it('does not keep draining queued wheel scrolls after long screenshot is completed', async () => {
    const originalImage = globalThis.Image;
    const originalScrollBy = window.scrollBy;
    const originalScrollTo = window.scrollTo;
    const originalScrollY = window.scrollY;
    let scrollY = 0;

    class MockImage {
      naturalWidth = 1024;
      naturalHeight = 768;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    Object.defineProperty(globalThis, 'Image', {
      value: MockImage as unknown as typeof Image,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      get: () => scrollY,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollBy', {
      value: vi.fn((options: ScrollToOptions) => {
        scrollY += Number(options.top ?? 0);
      }),
      configurable: true,
    });
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn((_x: number, y: number) => {
        scrollY = y;
      }),
      configurable: true,
    });

    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D);
    const toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('data:image/png;base64,crop-start')
      .mockReturnValue('data:image/png;base64,stitched');
    const onComplete = vi.fn();
    const onCaptureVisibleTab = vi.fn(async () => 'data:image/png;base64,viewport');

    try {
      render(
        <ScreenshotOverlay
          onCaptureVisibleTab={onCaptureVisibleTab}
          onComplete={onComplete}
          onCancel={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: '长截图' }));

      await waitFor(() => {
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(1);
      });

      const overlay = screen.getByTestId('screenshot-overlay');
      const selection = screen.getByTestId('screenshot-selection');
      const selectionLeft = parseFloat(selection.style.left);
      const selectionTop = parseFloat(selection.style.top);
      const selectionWidth = parseFloat(selection.style.width);
      const selectionHeight = parseFloat(selection.style.height);

      vi.mocked(window.scrollBy).mockClear();

      fireEvent.wheel(overlay, {
        clientX: selectionLeft + selectionWidth / 2,
        clientY: selectionTop + selectionHeight / 2,
        deltaY: 220,
      });
      fireEvent.wheel(overlay, {
        clientX: selectionLeft + selectionWidth / 2,
        clientY: selectionTop + selectionHeight / 2,
        deltaY: 180,
      });
      fireEvent.click(screen.getByRole('button', { name: '截图完成' }));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith('data:image/png;base64,stitched');
      });
      expect(window.scrollBy).not.toHaveBeenCalled();
    } finally {
      getContextSpy.mockRestore();
      toDataUrlSpy.mockRestore();
      Object.defineProperty(globalThis, 'Image', {
        value: originalImage,
        configurable: true,
      });
      Object.defineProperty(window, 'scrollBy', {
        value: originalScrollBy,
        configurable: true,
      });
      Object.defineProperty(window, 'scrollTo', {
        value: originalScrollTo,
        configurable: true,
      });
      Object.defineProperty(window, 'scrollY', {
        value: originalScrollY,
        configurable: true,
      });
    }
  });
});
