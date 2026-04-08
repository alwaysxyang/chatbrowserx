export type ChatProviderId = 'openai' | 'codex';

// UI 语言设置：跟随系统 / 中文 / 英文 / 日文
export type UiLanguage = 'system' | 'zh' | 'en' | 'ja';

// OpenAI 专属配置
export interface OpenAIModelSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Codex 专属配置
export interface CodexModelSettings {
  accessToken: string;
  model: string;
  baseUrl: string;
}

// 模型相关设置：公共字段 + 各 provider 独立配置
export interface ModelSettings {
  // 当前激活的 provider
  provider: ChatProviderId;
  model: string;

  // 公共配置（系统提示、上下文窗口大小）
  systemPrompt: string;
  maxHistory: number;

  // 各自 provider 的独立配置，切换时不会相互覆盖
  openai: OpenAIModelSettings;
  codex: CodexModelSettings;
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
