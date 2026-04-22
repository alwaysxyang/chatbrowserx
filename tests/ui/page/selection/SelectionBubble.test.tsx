import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionBubble } from '../../../../src/ui/page/selection/SelectionBubble';

const originalGetSelection = window.getSelection;

/**
 * Stubs a page text selection with a stable bounding box for SelectionBubble tests.
 */
function stubPageSelection(text: string): void {
  const textNode = document.createTextNode(text);
  document.body.appendChild(textNode);

  const range = {
    getBoundingClientRect: () => new DOMRect(120, 120, 140, 24),
    getClientRects: () => [new DOMRect(120, 120, 140, 24)],
  };

  Object.defineProperty(window, 'getSelection', {
    configurable: true,
    value: vi.fn(() => ({
      anchorNode: textNode,
      rangeCount: 1,
      toString: () => text,
      getRangeAt: () => range,
    })),
  });
}

/**
 * Stubs an empty page selection.
 */
function stubEmptySelection(): void {
  Object.defineProperty(window, 'getSelection', {
    configurable: true,
    value: vi.fn(() => null),
  });
}

describe('SelectionBubble', () => {
  afterEach(() => {
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: originalGetSelection,
    });
    document.body.innerHTML = '';
  });

  it('hides action buttons after an action opens the result dialog', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '你好' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));

    expect(await screen.findByRole('dialog', { name: 'Selection result' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '翻译' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
    });
  });

  it('keeps the result dialog open when clicking inside it after page selection clears', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '你好' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));
    const dialog = await screen.findByRole('dialog', { name: 'Selection result' });

    stubEmptySelection();
    await user.click(dialog);

    expect(screen.getByRole('dialog', { name: 'Selection result' })).toBeInTheDocument();
  });

  it('keeps the result dialog open when copying its text with a keyboard shortcut', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '你好' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));
    await screen.findByRole('dialog', { name: 'Selection result' });

    stubEmptySelection();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', ctrlKey: true, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
    });

    expect(screen.getByRole('dialog', { name: 'Selection result' })).toBeInTheDocument();
  });

  it('renders markdown in the result dialog', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '**你好**' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));

    const dialog = await screen.findByRole('dialog', { name: 'Selection result' });
    expect(dialog.querySelector('strong')).toHaveTextContent('你好');
  });
});
