import type { UiLanguage } from '../types/settings';
import { defaultSettings } from '../storage/settings-repository';

let currentUiLanguage: UiLanguage = defaultSettings.general.uiLanguage;

export function getCurrentUiLanguage(): UiLanguage {
  return currentUiLanguage;
}

export function setCurrentUiLanguage(next: UiLanguage): void {
  currentUiLanguage = next;
}

