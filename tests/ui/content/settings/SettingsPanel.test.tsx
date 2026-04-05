import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SettingsPanel } from '../../../../src/ui/content/settings/SettingsPanel';

describe('SettingsPanel', () => {
  it('loads saved settings and submits edits', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.settings': {
        apiKey: 'saved-key',
        model: 'saved-model',
        baseUrl: 'https://example.com/v1',
        systemPrompt: 'saved prompt',
        maxHistory: 12,
      },
    });

    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('API Key')).toHaveValue('saved-key');
    });

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Model'));
    await user.type(screen.getByLabelText('Model'), 'new-model');
    const saveButton = screen.getByRole('button', { name: '保存设置' });
    await user.click(saveButton);

    // 等待保存流程（包含 1s sleep + saveSettings）完成
    await waitFor(async () => {
      const saved = await chrome.storage.local.get('chatbrowserx.settings');
      expect((saved['chatbrowserx.settings'] as { model: string }).model).toBe('new-model');
    });
  });

  it('prevents save when required fields are invalid and shows feedback', async () => {
    render(<SettingsPanel />);

    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByLabelText('API Base URL')).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText('API Base URL'));
    await user.clear(screen.getByLabelText('Model'));
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    expect(screen.getByText('请先填写 API Base URL 与 Model。')).toBeInTheDocument();
  });

  it('keeps user edits when async settings hydration finishes later', async () => {
    let resolveGet!: (value: Record<string, unknown>) => void;
    const originalGet = chrome.storage.local.get;
    const getMock = chrome.storage.local.get as unknown as ReturnType<typeof vi.fn>;

    getMock.mockImplementationOnce(() => {
      return new Promise<Record<string, unknown>>((resolve) => {
        resolveGet = resolve;
      });
    });

    render(<SettingsPanel />);

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Model'));
    await user.type(screen.getByLabelText('Model'), 'draft-model');

    resolveGet({
      'chatbrowserx.settings': {
        model: 'persisted-model',
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toHaveValue('draft-model');
    });

    getMock.mockImplementation(originalGet as unknown as (...args: unknown[]) => unknown);
  });
});
