import type { UiLanguage } from '../types/settings';
import { getCurrentUiLanguage } from './current-language';

export type Locale = 'zh' | 'en' | 'ja';

const FALLBACK_LOCALE: Locale = 'en';

export function getBrowserLanguage(): string | undefined {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language;
  }
  return undefined;
}

export function resolveLocale(uiLanguage: UiLanguage): Locale {
  if (uiLanguage === 'zh' || uiLanguage === 'en' || uiLanguage === 'ja') {
    return uiLanguage;
  }

  const lang = (getBrowserLanguage() || '').toLowerCase();

  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';

  return FALLBACK_LOCALE;
}

type MessageKey =
  | 'settings.tabs.model'
  | 'settings.tabs.general'
  | 'settings.actions.save'
  | 'settings.actions.saving'
  | 'settings.actions.reset'
  | 'settings.toast.saved'
  | 'settings.toast.saveFailed'
  | 'settings.fields.provider'
  | 'settings.fields.apiBaseUrl'
  | 'settings.fields.apiKey'
  | 'settings.fields.model'
  | 'settings.fields.systemPrompt'
  | 'settings.fields.maxHistory'
  | 'settings.fields.language'
  | 'settings.language.system'
  | 'settings.language.zh'
  | 'settings.language.en'
  | 'settings.language.ja'
  | 'shell.rail.chat'
  | 'shell.rail.settings'
  | 'chat.empty.title'
  | 'chat.empty.subtitle'
  | 'chat.suggestion.analyze'
  | 'chat.suggestion.analyzeTooltip'
  | 'chat.suggestion.analyzeCommand'
  | 'chat.toolbar.screenshotLabel'
  | 'chat.toolbar.screenshotTooltip'
  | 'chat.toolbar.attachmentLabel'
  | 'chat.toolbar.attachmentTooltip'
  | 'chat.toolbar.clearLabel'
  | 'chat.toolbar.clearTooltip'
  | 'chat.toolbar.sendLabel'
  | 'chat.toolbar.sendTooltipDisabled'
  | 'chat.toolbar.sendTooltipEnabled'
  | 'chat.composer.placeholder';

const messages: Record<MessageKey, Record<Locale, string>> = {
  'settings.tabs.model': {
    zh: '模型',
    en: 'Model',
    ja: 'モデル',
  },
  'settings.tabs.general': {
    zh: '通用',
    en: 'General',
    ja: '一般',
  },
  'settings.actions.save': {
    zh: '保存设置',
    en: 'Save settings',
    ja: '設定を保存',
  },
  'settings.actions.saving': {
    zh: '保存中…',
    en: 'Saving…',
    ja: '保存中…',
  },
  'settings.actions.reset': {
    zh: '恢复默认',
    en: 'Reset to default',
    ja: 'デフォルトに戻す',
  },
  'settings.toast.saved': {
    zh: '设置已保存。',
    en: 'Settings saved.',
    ja: '設定を保存しました。',
  },
  'settings.toast.saveFailed': {
    zh: '设置保存失败。',
    en: 'Failed to save settings.',
    ja: '設定の保存に失敗しました。',
  },
  'settings.fields.provider': {
    zh: 'Provider',
    en: 'Provider',
    ja: 'プロバイダ',
  },
  'settings.fields.apiBaseUrl': {
    zh: 'API Base URL',
    en: 'API Base URL',
    ja: 'API Base URL',
  },
  'settings.fields.apiKey': {
    zh: 'API Key',
    en: 'API Key',
    ja: 'API Key',
  },
  'settings.fields.model': {
    zh: 'Model',
    en: 'Model',
    ja: 'モデル',
  },
  'settings.fields.systemPrompt': {
    zh: 'System Prompt',
    en: 'System Prompt',
    ja: 'システムプロンプト',
  },
  'settings.fields.maxHistory': {
    zh: 'Max History',
    en: 'Max History',
    ja: '履歴上限',
  },
  'settings.fields.language': {
    zh: '语言',
    en: 'Language',
    ja: '言語',
  },
  'settings.language.system': {
    zh: '跟随系统',
    en: 'Follow system',
    ja: 'システムに合わせる',
  },
  'settings.language.zh': {
    zh: '中文',
    en: 'Chinese',
    ja: '中国語',
  },
  'settings.language.en': {
    zh: '英文',
    en: 'English',
    ja: '英語',
  },
  'settings.language.ja': {
    zh: '日文',
    en: 'Japanese',
    ja: '日本語',
  },
  // Rail
  'shell.rail.chat': { zh: '聊天', en: 'Chat', ja: 'チャット' },
  'shell.rail.settings': { zh: '设置', en: 'Settings', ja: '設定' },
  // Chat empty state
  'chat.empty.title': { zh: '你好！我是你的 AI 助手。', en: 'Hi! I am your AI assistant.', ja: 'こんにちは！AI アシスタントです。' },
  'chat.empty.subtitle': {
    zh: '我可以帮你总结网页内容、解答问题、优化文本等。有什么可以帮助你的吗？',
    en: 'I can summarize pages, answer questions, and refine text. How can I help?',
    ja: 'ページ要約、質問への回答、文章の改善などができます。何をお手伝いしましょうか？',
  },
  // Chat suggestion
  'chat.suggestion.analyze': { zh: '网站内容分析', en: 'Analyze page content', ja: 'ページ内容を分析' },
  'chat.suggestion.analyzeTooltip': { zh: '一键分析当前网页内容', en: 'Analyze current page with one click', ja: '現在のページをワンクリックで分析' },
  'chat.suggestion.analyzeCommand': {
    zh: '请帮我分析当前网页内容',
    en: 'Please analyze the current page content',
    ja: '現在のページ内容を分析してください',
  },
  // Chat toolbar
  'chat.toolbar.screenshotLabel': { zh: '截图（占位）', en: 'Screenshot (placeholder)', ja: 'スクリーンショット（仮）' },
  'chat.toolbar.screenshotTooltip': { zh: '截图（开发中）', en: 'Screenshot (in development)', ja: 'スクリーンショット（開発中）' },
  'chat.toolbar.attachmentLabel': { zh: '上传附件（占位）', en: 'Upload attachment (placeholder)', ja: '添付アップロード（仮）' },
  'chat.toolbar.attachmentTooltip': { zh: '上传附件（开发中）', en: 'Upload attachment (in development)', ja: '添付アップロード（開発中）' },
  'chat.toolbar.clearLabel': { zh: '清空聊天记录', en: 'Clear chat history', ja: 'チャット履歴を消去' },
  'chat.toolbar.clearTooltip': { zh: '清空聊天记录', en: 'Clear chat history', ja: 'チャット履歴を消去' },
  'chat.toolbar.sendLabel': { zh: '发送', en: 'Send', ja: '送信' },
  'chat.toolbar.sendTooltipDisabled': { zh: '输入内容后可发送', en: 'Type a message to send', ja: '入力すると送信できます' },
  'chat.toolbar.sendTooltipEnabled': { zh: '发送消息', en: 'Send message', ja: 'メッセージを送信' },
  // Composer
  'chat.composer.placeholder': { zh: '问任何问题，@ 模型，/ 提示', en: 'Ask anything, @ model, / prompt', ja: '何でも質問、@ モデル、/ プロンプト' },
};

export function translateMessage(key: MessageKey, uiLanguage?: UiLanguage): string {
  const effectiveUiLanguage = uiLanguage ?? getCurrentUiLanguage();
  const locale = resolveLocale(effectiveUiLanguage);
  const entry = messages[key];

  if (!entry) return key;
  return entry[locale] ?? entry[FALLBACK_LOCALE];
}
