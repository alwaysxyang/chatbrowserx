import type { UiLanguage } from '../types/settings';
import { getCurrentUiLanguage } from './current-language';
import { messages, resolveLocale, type Locale, type MessageKey } from './message-catalog';

const FALLBACK_LOCALE: Locale = 'en';

export type { Locale, MessageKey } from './message-catalog';

function getBrowserLanguage(): string | undefined {
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language;
  }
  return undefined;
}

export function translateMessage(key: MessageKey, uiLanguage?: UiLanguage): string {
  const effectiveUiLanguage = uiLanguage ?? getCurrentUiLanguage();
  const locale = resolveLocale(effectiveUiLanguage, getBrowserLanguage(), FALLBACK_LOCALE);
  const entry = messages[key];

  if (!entry) return key;
  return entry[locale] ?? entry[FALLBACK_LOCALE];
}
