export type ChatProviderId = 'openai' | 'codex';

export interface ChatSettings {
  provider: ChatProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  maxHistory: number;
}
