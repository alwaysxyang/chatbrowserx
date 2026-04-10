import type { UiLanguage } from '../types/settings';

export type Locale = 'zh' | 'en' | 'ja';

export type MessageKey =
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
  | 'settings.codex.fields.accessToken'
  | 'settings.fields.systemPrompt'
  | 'settings.fields.maxHistory'
  | 'settings.fields.language'
  | 'settings.tabs.navLabel'
  | 'settings.language.system'
  | 'settings.language.zh'
  | 'settings.language.en'
  | 'settings.language.ja'
  | 'shell.rail.chat'
  | 'shell.rail.settings'
  | 'shell.rail.navLabel'
  | 'shell.header.pin'
  | 'shell.header.unpin'
  | 'shell.header.close'
  | 'chat.empty.title'
  | 'chat.empty.subtitle'
  | 'chat.suggestion.analyze'
  | 'chat.suggestion.analyzeTooltip'
  | 'chat.suggestion.analyzeCommand'
  | 'chat.toolbar.screenshotLabel'
  | 'chat.toolbar.screenshotTooltip'
  | 'chat.screenshot.previewAlt'
  | 'chat.screenshot.remove'
  | 'chat.screenshot.fullscreen'
  | 'chat.screenshot.long'
  | 'chat.screenshot.cancelLong'
  | 'chat.screenshot.done'
  | 'chat.imagePreview.label'
  | 'chat.imagePreview.close'
  | 'chat.toolbar.attachmentLabel'
  | 'chat.toolbar.attachmentTooltip'
  | 'chat.toolbar.clearLabel'
  | 'chat.toolbar.clearTooltip'
  | 'chat.toolbar.sendLabel'
  | 'chat.toolbar.sendTooltipDisabled'
  | 'chat.toolbar.sendTooltipEnabled'
  | 'chat.toolbar.stopLabel'
  | 'chat.toolbar.stopTooltip'
  | 'chat.message.copy'
  | 'chat.message.copied'
  | 'chat.composer.placeholder'
  | 'chat.message.imageAlt'
  | 'tools.scroll.loading'
  | 'chat.loading'
  | 'settings.provider.switchLabel'
  | 'settings.provider.openaiTooltip'
  | 'settings.provider.codexTooltip'
  | 'settings.apiKey.show'
  | 'settings.apiKey.hide'
  | 'error.model.misconfigured'
  | 'error.request.failed'
  | 'error.response.empty'
  | 'error.message.sendFailed'
  | 'error.message.pageRefreshInterrupted'
  | 'popup.description';

export const messages: Record<MessageKey, Record<Locale, string>> = {
  'settings.tabs.model': { zh: '模型', en: 'Model', ja: 'モデル' },
  'settings.tabs.general': { zh: '通用', en: 'General', ja: '一般' },
  'settings.actions.save': { zh: '保存设置', en: 'Save settings', ja: '設定を保存' },
  'settings.actions.saving': { zh: '保存中…', en: 'Saving…', ja: '保存中…' },
  'settings.actions.reset': { zh: '恢复默认', en: 'Reset to default', ja: 'デフォルトに戻す' },
  'settings.toast.saved': { zh: '设置已保存。', en: 'Settings saved.', ja: '設定を保存しました。' },
  'settings.toast.saveFailed': { zh: '设置保存失败。', en: 'Failed to save settings.', ja: '設定の保存に失敗しました。' },
  'settings.fields.provider': { zh: 'Provider', en: 'Provider', ja: 'プロバイダ' },
  'settings.fields.apiBaseUrl': { zh: 'API Base URL', en: 'API Base URL', ja: 'API Base URL' },
  'settings.fields.apiKey': { zh: 'API Key', en: 'API Key', ja: 'API Key' },
  'settings.codex.fields.accessToken': { zh: 'Codex ACCESS_TOKEN', en: 'Codex ACCESS_TOKEN', ja: 'Codex ACCESS_TOKEN' },
  'settings.fields.model': { zh: 'Model', en: 'Model', ja: 'モデル' },
  'settings.fields.systemPrompt': { zh: 'System Prompt', en: 'System Prompt', ja: 'システムプロンプト' },
  'settings.fields.maxHistory': { zh: 'Max History', en: 'Max History', ja: '履歴上限' },
  'settings.tabs.navLabel': { zh: '设置分类', en: 'Settings sections', ja: '設定のカテゴリ' },
  'settings.fields.language': { zh: '语言', en: 'Language', ja: '言語' },
  'settings.language.system': { zh: '跟随系统', en: 'Follow system', ja: 'システムに合わせる' },
  'settings.language.zh': { zh: '中文', en: 'Chinese', ja: '中国語' },
  'settings.language.en': { zh: '英文', en: 'English', ja: '英語' },
  'settings.language.ja': { zh: '日文', en: 'Japanese', ja: '日本語' },
  'shell.rail.chat': { zh: '聊天', en: 'Chat', ja: 'チャット' },
  'shell.rail.settings': { zh: '设置', en: 'Settings', ja: '設定' },
  'shell.rail.navLabel': { zh: '功能导航', en: 'Navigation', ja: 'ナビゲーション' },
  'shell.header.pin': { zh: '固定面板', en: 'Pin panel', ja: 'パネルを固定' },
  'shell.header.unpin': { zh: '取消固定面板', en: 'Unpin panel', ja: '固定を解除' },
  'shell.header.close': { zh: '关闭对话框', en: 'Close dialog', ja: 'ダイアログを閉じる' },
  'chat.empty.title': { zh: '你好！我是你的 AI 助手。', en: 'Hi! I am your AI assistant.', ja: 'こんにちは！AI アシスタントです。' },
  'chat.empty.subtitle': {
    zh: '我可以帮你总结网页内容、解答问题、优化文本等。有什么可以帮助你的吗？',
    en: 'I can summarize pages, answer questions, and refine text. How can I help?',
    ja: 'ページ要約、質問への回答、文章の改善などができます。何をお手伝いしましょうか？',
  },
  'chat.suggestion.analyze': { zh: '网站内容分析', en: 'Analyze page content', ja: 'ページ内容を分析' },
  'chat.suggestion.analyzeTooltip': { zh: '一键分析当前网页内容', en: 'Analyze current page with one click', ja: '現在のページをワンクリックで分析' },
  'chat.suggestion.analyzeCommand': {
    zh: '请帮我分析当前网页内容',
    en: 'Please analyze the current page content',
    ja: '現在のページ内容を分析してください',
  },
  'chat.toolbar.screenshotLabel': { zh: '截图', en: 'Screenshot', ja: 'スクリーンショット' },
  'chat.toolbar.screenshotTooltip': { zh: '截图', en: 'Screenshot', ja: 'スクリーンショット' },
  'chat.screenshot.previewAlt': { zh: '截图预览', en: 'Screenshot preview', ja: 'スクリーンショットのプレビュー' },
  'chat.screenshot.remove': { zh: '删除截图', en: 'Remove screenshot', ja: 'スクリーンショットを削除' },
  'chat.screenshot.fullscreen': { zh: '全屏截图', en: 'Fullscreen screenshot', ja: '全画面スクリーンショット' },
  'chat.screenshot.long': { zh: '长截图', en: 'Long screenshot', ja: 'ロングスクリーンショット' },
  'chat.screenshot.cancelLong': { zh: '取消长截图', en: 'Cancel long screenshot', ja: 'ロングスクリーンショットをキャンセル' },
  'chat.screenshot.done': { zh: '截图完成', en: 'Complete screenshot', ja: 'スクリーンショット完了' },
  'chat.imagePreview.label': { zh: '图片预览', en: 'Image preview', ja: '画像プレビュー' },
  'chat.imagePreview.close': { zh: '关闭图片预览', en: 'Close image preview', ja: '画像プレビューを閉じる' },
  'chat.toolbar.attachmentLabel': { zh: '上传附件（占位）', en: 'Upload attachment (placeholder)', ja: '添付アップロード（仮）' },
  'chat.toolbar.attachmentTooltip': { zh: '上传附件（开发中）', en: 'Upload attachment (in development)', ja: '添付アップロード（開発中）' },
  'chat.toolbar.clearLabel': { zh: '清空聊天记录', en: 'Clear chat history', ja: 'チャット履歴を消去' },
  'chat.toolbar.clearTooltip': { zh: '清空聊天记录', en: 'Clear chat history', ja: 'チャット履歴を消去' },
  'chat.toolbar.sendLabel': { zh: '发送', en: 'Send', ja: '送信' },
  'chat.toolbar.sendTooltipDisabled': { zh: '输入内容后可发送', en: 'Type a message to send', ja: '入力すると送信できます' },
  'chat.toolbar.sendTooltipEnabled': { zh: '发送消息', en: 'Send message', ja: 'メッセージを送信' },
  'chat.toolbar.stopLabel': { zh: '停止生成', en: 'Stop generating', ja: '生成を停止' },
  'chat.toolbar.stopTooltip': { zh: '中断当前回复', en: 'Stop current reply', ja: '現在の返信を中断' },
  'chat.message.copy': { zh: '复制消息', en: 'Copy message', ja: 'メッセージをコピー' },
  'chat.message.copied': { zh: '已复制', en: 'Copied', ja: 'コピーしました' },
  'chat.composer.placeholder': { zh: '问任何问题，@ 模型，/ 提示', en: 'Ask anything, @ model, / prompt', ja: '何でも質問、@ モデル、/ プロンプト' },
  'chat.message.imageAlt': { zh: '用户上传图片', en: 'Uploaded image', ja: 'アップロードされた画像' },
  'tools.scroll.loading': { zh: '滚动中…', en: 'Scrolling…', ja: 'スクロール中…' },
  'chat.loading': { zh: '正在生成回复...', en: 'Generating reply…', ja: '返信を生成しています…' },
  'settings.provider.switchLabel': { zh: '模型 Provider', en: 'Model provider', ja: 'モデルプロバイダ' },
  'settings.provider.openaiTooltip': { zh: '使用 OpenAI 兼容接口', en: 'Use OpenAI-compatible API', ja: 'OpenAI 互換 API を使用' },
  'settings.provider.codexTooltip': { zh: 'Codex（开发中）', en: 'Codex (in development)', ja: 'Codex（開発中）' },
  'settings.apiKey.show': { zh: '显示 API Key', en: 'Show API Key', ja: 'API Key を表示' },
  'settings.apiKey.hide': { zh: '隐藏 API Key', en: 'Hide API Key', ja: 'API Key を隠す' },
  'error.model.misconfigured': {
    zh: '请先在设置中填写 API Base URL、API Key 和 Model。',
    en: 'Please fill API Base URL, API Key and Model in settings first.',
    ja: 'まず設定で API Base URL・API Key・Model を入力してください。',
  },
  'error.request.failed': { zh: '请求失败', en: 'Request failed', ja: 'リクエストに失敗しました' },
  'error.response.empty': { zh: '模型返回了空响应。', en: 'The model returned an empty response.', ja: 'モデルから空のレスポンスが返されました。' },
  'error.message.sendFailed': { zh: '发送失败', en: 'Send failed', ja: '送信に失敗しました' },
  'error.message.pageRefreshInterrupted': {
    zh: '页面已刷新，当前请求已中断。',
    en: 'The page was refreshed and the current request was interrupted.',
    ja: 'ページが再読み込みされたため、現在のリクエストは中断されました。',
  },
  'popup.description': {
    zh: 'ChatBrowserX 当前以基础聊天能力为起点。打开任意网页后，点击页面右下角按钮即可打开侧边栏。',
    en: 'ChatBrowserX currently focuses on basic chat capabilities. Open any page and click the bottom-right button to open the sidebar.',
    ja: 'ChatBrowserX は現在、基本的なチャット機能にフォーカスしています。任意のページを開き、右下のボタンをクリックするとサイドバーが開きます。',
  },
};

export function resolveLocale(uiLanguage: UiLanguage, browserLanguage: string | undefined, fallbackLocale: Locale): Locale {
  if (uiLanguage === 'zh' || uiLanguage === 'en' || uiLanguage === 'ja') {
    return uiLanguage;
  }

  const lang = (browserLanguage || '').toLowerCase();

  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';

  return fallbackLocale;
}
