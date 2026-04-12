import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SettingsPanel } from '../../../../src/ui/content/settings/SettingsPanel';
import { defaultSettings } from '../../../../src/shared/storage/settings-repository';

describe('SettingsPanel', () => {
  it('loads saved settings and submits edits', async () => {
    await chrome.storage.local.set({
      'chatbrowserx.settings': {
        model: {
          apiKey: 'saved-key',
          model: 'saved-model',
          baseUrl: 'https://example.com/v1',
          systemPrompt: 'saved prompt',
          maxHistory: 12,
          tavilyApiKey: 'saved-tavily-key',
        },
        general: {
          uiLanguage: 'system',
        },
      },
    });

    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('API Key')).toHaveValue('saved-key');
    });
    expect(screen.getByLabelText('Tavily Key')).toHaveValue('saved-tavily-key');

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Model'));
    await user.type(screen.getByLabelText('Model'), 'new-model');
    await user.clear(screen.getByLabelText('Tavily Key'));
    await user.type(screen.getByLabelText('Tavily Key'), 'new-tavily-key');
    const saveButton = screen.getByRole('button', { name: '保存设置' });
    await user.click(saveButton);

    // 等待保存流程（包含 1s sleep + saveSettings）完成
    await waitFor(async () => {
      const saved = await chrome.storage.local.get('chatbrowserx.settings');
      expect((saved['chatbrowserx.settings'] as { model: { model: string } }).model.model).toBe('new-model');
      expect((saved['chatbrowserx.settings'] as { model: { tavilyApiKey: string } }).model.tavilyApiKey).toBe('new-tavily-key');
    });
  });

  it('keeps user edits when async settings hydration finishes later', async () => {
    let resolveGet!: (value: Record<string, unknown>) => void;
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
        model: {
          ...defaultSettings.model,
          model: 'persisted-model',
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toHaveValue('draft-model');
    });
  });

  it('keeps settings actions outside the scrollable form body for each tab', async () => {
    const { container } = render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toBeInTheDocument();
    });

    const settingsBody = container.querySelector('.settings-body');
    const footer = container.querySelector('.settings-footer');

    expect(settingsBody).toBeInstanceOf(HTMLElement);
    expect(footer).toBeInstanceOf(HTMLElement);

    const bodyElement = settingsBody as HTMLElement;
    const footerElement = footer as HTMLElement;

    expect(bodyElement).toContainElement(screen.getByLabelText('Model'));
    expect(bodyElement).not.toContainElement(footerElement);
    expect(footerElement.previousElementSibling).toBe(bodyElement);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '通用' }));

    expect(bodyElement).toContainElement(screen.getByLabelText('语言'));
    expect(bodyElement).not.toContainElement(screen.getByRole('button', { name: '保存设置' }));
    expect(bodyElement).not.toContainElement(screen.getByRole('button', { name: '恢复默认' }));
  });

  it('shows provider switch tooltips below the buttons to avoid clipping at the top edge', async () => {
    render(<SettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'OpenAI' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'OpenAI' })).toHaveAttribute('data-tooltip-placement', 'bottom');
    expect(screen.getByRole('button', { name: 'Codex' })).toHaveAttribute('data-tooltip-placement', 'bottom');
  });
});
