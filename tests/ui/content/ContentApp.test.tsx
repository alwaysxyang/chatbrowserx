import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ContentApp } from '../../../src/ui/content/ContentApp';

describe('ContentApp', () => {
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
    expect(screen.queryByText('清空聊天记录')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(screen.getByText('配置模型连接')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();

    await act(async () => {
      globalThis.__chromeTestUtils.dispatchRuntimeMessage({
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    expect(screen.queryByText('浏览器增强 Agent')).not.toBeInTheDocument();
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
});
