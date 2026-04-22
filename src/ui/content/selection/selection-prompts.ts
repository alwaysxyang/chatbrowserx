import type { UiLanguage } from '../../../shared/types/settings';

export type TargetLocale = 'zh' | 'en' | 'ja';

/**
 * Resolves the output language for selection features using General settings and browser language.
 *
 * @param params - Language resolution inputs.
 * @returns The resolved locale and its English name for prompt construction.
 */
export function resolveTargetLanguage(params: { uiLanguage: UiLanguage; browserLanguage: string | undefined }): { locale: TargetLocale; name: string } {
  const { uiLanguage, browserLanguage } = params;

  if (uiLanguage === 'zh') return { locale: 'zh', name: 'Chinese' };
  if (uiLanguage === 'ja') return { locale: 'ja', name: 'Japanese' };
  if (uiLanguage === 'en') return { locale: 'en', name: 'English' };

  const lang = (browserLanguage || '').toLowerCase();
  if (lang.startsWith('zh')) return { locale: 'zh', name: 'Chinese' };
  if (lang.startsWith('ja')) return { locale: 'ja', name: 'Japanese' };
  return { locale: 'en', name: 'English' };
}

/**
 * Builds a strict translation prompt for the selected text.
 *
 * @param params - Translation prompt inputs.
 * @returns User prompt string.
 */
export function buildTranslatePrompt(params: { selectedText: string; targetLanguageName: string }): string {
  return [
    `Translate the text below into ${params.targetLanguageName}.`,
    `Output only the translation. Do not add explanations.`,
    `Preserve paragraph breaks when possible.`,
    `---`,
    params.selectedText,
  ].join('\n');
}

/**
 * Builds an analysis prompt that includes page content as context.
 *
 * @param params - Ask AI prompt inputs.
 * @returns User prompt string.
 */
export function buildAskAiPrompt(params: {
  selectedText: string;
  pageTitle: string;
  pageUrl: string;
  pageText: string;
  targetLanguageName: string;
  maxPageChars: number;
}): string {
  const pageText = params.pageText.length > params.maxPageChars ? params.pageText.slice(0, params.maxPageChars) : params.pageText;
  return [
    `Analyze the Selected Text using the Page Content as context.`,
    `Answer in ${params.targetLanguageName}.`,
    ``,
    `Page Title: ${params.pageTitle}`,
    `Page URL: ${params.pageUrl}`,
    ``,
    `Page Content:`,
    pageText,
    ``,
    `Selected Text:`,
    params.selectedText,
  ].join('\n');
}

