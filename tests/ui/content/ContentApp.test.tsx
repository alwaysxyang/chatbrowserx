import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ContentApp } from '../../../src/ui/content/ContentApp';

const panelStateKey = 'chatbrowserx.panel';

describe('ContentApp', () => {
  it('opens by default only when current site was pinned and open', async () => {
    await chrome.storage.local.set({
      [panelStateKey]: {
        pinned: true,
        open: true,
      },
    });

    render(<ContentApp />);

    await waitFor(() => {
      expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '取消固定面板' })).toBeInTheDocument();
  });

  it('does not auto open after refresh when pinned but previously closed', async () => {
    await chrome.storage.local.set({
      [panelStateKey]: {
        pinned: true,
        open: false,
      },
    });

    await act(async () => {
      render(<ContentApp />);
    });

    expect(screen.queryByText('ChatBrowserX')).not.toBeInTheDocument();
  });

  it('opens and closes the dialog from background panel commands', async () => {
    render(<ContentApp />);

    expect(screen.queryByText('浏览器增强 Agent')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开 ChatBrowserX' })).not.toBeInTheDocument();

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();
    expect(screen.queryByText('浏览器增强 Agent')).not.toBeInTheDocument();
    expect(screen.getByText(/^Build \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭对话框' })).toHaveTextContent('×');
    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('配置模型连接')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空聊天记录' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(screen.getByRole('button', { name: '模型' })).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    expect(screen.queryByText('浏览器增强 Agent')).not.toBeInTheDocument();
  });

  it('hides the sidebar while taking a screenshot and restores it after capture', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({
      ok: true,
      data: { dataUrl: 'data:image/png;base64,shot1' },
    });

    render(<ContentApp />);

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '截图' }));

    expect(screen.getByTestId('sidebar-shell')).toHaveClass('sidebar-shell-hidden-for-screenshot');

    await user.click(screen.getByRole('button', { name: '全屏截图' }));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: '截图预览' })).toHaveAttribute('src', 'data:image/png;base64,shot1');
    });

    expect(screen.getByTestId('sidebar-shell')).not.toHaveClass('sidebar-shell-hidden-for-screenshot');
  });

  it('renders image previews outside the sidebar so the page is dimmed instead of the plugin only', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({
      ok: true,
      data: { dataUrl: 'data:image/png;base64,shot1' },
    });

    render(<ContentApp />);

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '截图' }));
    await user.click(screen.getByRole('button', { name: '全屏截图' }));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: '截图预览' })).toBeInTheDocument();
    });

    await user.dblClick(screen.getByRole('img', { name: '截图预览' }));

    const dialog = screen.getByTestId('image-preview-dialog');
    expect(dialog).toHaveClass('image-preview-dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('sidebar-shell').contains(dialog)).toBe(false);

    await user.click(screen.getByRole('img', { name: '图片预览' }));

    expect(screen.getByTestId('image-preview-dialog')).toBeInTheDocument();
    expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();

    await user.click(dialog);

    expect(screen.queryByTestId('image-preview-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();

    await user.dblClick(screen.getByRole('img', { name: '截图预览' }));

    await user.click(screen.getByRole('button', { name: '关闭图片预览' }));

    expect(screen.queryByTestId('image-preview-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();
  });

  it('supports resizing the sidebar horizontally', async () => {
    render(<ContentApp />);

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    const shell = screen.getByTestId('sidebar-shell');
    const handle = screen.getByTestId('sidebar-resize-handle');

    expect(shell).toHaveStyle({ width: '460px' });

    await act(async () => {
      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(shell).toHaveStyle({ width: '540px' });
  });

  it('starts with a wider sidebar than before', async () => {
    render(<ContentApp />);

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    expect(screen.getByTestId('sidebar-shell')).toHaveStyle({ width: '460px' });
  });

  it('closes when clicking outside while unpinned', async () => {
    render(<ContentApp />);

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(screen.queryByText('ChatBrowserX')).not.toBeInTheDocument();
  });

  it('stays open when pinned and clicking outside', async () => {
    render(<ContentApp />);

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '固定面板' }));

    expect(screen.getByRole('button', { name: '取消固定面板' })).toBeInTheDocument();

    const persisted = await chrome.storage.local.get(panelStateKey);
    expect(persisted[panelStateKey]).toEqual({ pinned: true, open: true });

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(screen.getByText('ChatBrowserX')).toBeInTheDocument();
  });

  it('keeps pinned state after closing and reopening', async () => {
    render(<ContentApp />);

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '固定面板' }));
    await user.click(screen.getByRole('button', { name: '关闭对话框' }));

    expect(screen.queryByText('ChatBrowserX')).not.toBeInTheDocument();

    const persistedClosed = await chrome.storage.local.get(panelStateKey);
    expect(persistedClosed[panelStateKey]).toEqual({ pinned: true, open: false });

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    expect(screen.getByRole('button', { name: '取消固定面板' })).toBeInTheDocument();
  });
});
