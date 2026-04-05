export type ChatProviderId = 'openai' | 'codex';

// UI 语言设置：跟随系统 / 中文 / 英文 / 日文
export type UiLanguage = 'system' | 'zh' | 'en' | 'ja';

// 模型相关设置：提供给「模型」Tab 使用
export interface ModelSettings {
  provider: ChatProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  maxHistory: number;
}

// 通用设置：提供给「通用」Tab 使用
export interface GeneralSettings {
  uiLanguage: UiLanguage;
}

// 整体设置：模型设置 + 通用设置
export interface Settings {
  model: ModelSettings;
  general: GeneralSettings;
}
