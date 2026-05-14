import { describe, expect, it } from 'vitest';
import { buildAskAiPrompt, buildTranslatePrompt, resolveTargetLanguage } from '../../../../src/ui/page/selection/selection-prompts';

describe('selection prompts', () => {
  it('maps system language using browser language', () => {
    expect(resolveTargetLanguage({ uiLanguage: 'system', browserLanguage: 'zh-CN' })).toEqual({ locale: 'zh', name: 'Chinese' });
    expect(resolveTargetLanguage({ uiLanguage: 'system', browserLanguage: 'ja-JP' })).toEqual({ locale: 'ja', name: 'Japanese' });
    expect(resolveTargetLanguage({ uiLanguage: 'system', browserLanguage: 'fr-FR' })).toEqual({ locale: 'en', name: 'English' });
  });

  it('builds translate prompt containing target language and selected text', () => {
    const prompt = buildTranslatePrompt({ selectedText: 'Hello', targetLanguageName: 'Japanese' });
    expect(prompt).toContain('Japanese');
    expect(prompt).toContain('Hello');
  });

  it('builds ask-ai prompt containing page content and selected text', () => {
    const prompt = buildAskAiPrompt({
      selectedText: 'S',
      pageTitle: 'T',
      pageUrl: 'U',
      pageText: 'P',
      targetLanguageName: 'English',
      maxPageChars: 10,
    });
    expect(prompt).toContain('Selected Text');
    expect(prompt).toContain('Page Content');
    expect(prompt).toContain('S');
  });

  it('tells ask-ai not to call page content tools because context is already included', () => {
    const prompt = buildAskAiPrompt({
      selectedText: 'Selected',
      pageTitle: 'Title',
      pageUrl: 'https://example.com',
      pageText: 'Already included page text',
      targetLanguageName: 'English',
      maxPageChars: 100,
    });

    expect(prompt).toContain('Do not call page tools to reread the page');
    expect(prompt).toContain('Page Content');
    expect(prompt).toContain('Already included page text');
  });
});
