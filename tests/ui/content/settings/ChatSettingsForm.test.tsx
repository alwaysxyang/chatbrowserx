import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatSettingsForm } from '../../../../src/ui/content/settings/ChatSettingsForm';
import type { ModelSettings } from '../../../../src/shared/types/settings';

const baseSettings = {
  provider: 'codex',
  model: 'codex-model',
  systemPrompt: 'system prompt',
  maxHistory: 20,
  tavilyApiKey: 'tavily-key',
  openai: {
    apiKey: 'openai-key',
    model: 'openai-model',
    baseUrl: 'https://openai.example.com',
  },
  codex: {
    accessToken: 'codex-token',
    model: 'codex-model',
    baseUrl: 'https://codex.example.com',
    effort: 'high',
  },
} as ModelSettings;

describe('ChatSettingsForm', () => {
  it('renders Codex effort with the same zh/en/ja label and updates selected effort', async () => {
    const onChange = vi.fn();
    render(<ChatSettingsForm value={baseSettings} disabled={false} onChange={onChange} />);

    const effortSelect = screen.getByLabelText('effort');

    expect(effortSelect).toHaveValue('high');
    expect(screen.getByRole('option', { name: 'medium' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'high' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'low' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'xhigh' })).toBeInTheDocument();

    fireEvent.change(effortSelect, { target: { value: 'xhigh' } });

    expect(onChange).toHaveBeenCalledWith({
      ...baseSettings,
      codex: {
        ...baseSettings.codex,
        effort: 'xhigh',
      },
    });
  });
});
