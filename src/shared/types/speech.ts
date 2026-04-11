export type SpeechProviderId = 'volcengine';

export type SourceLanguage = 'auto' | 'zh' | 'en' | 'ja';
export type TargetLanguage = 'none' | 'zh' | 'en' | 'ja';

export interface VolcengineSettings {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SpeechSettings {
  provider: SpeechProviderId;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  volcengine: VolcengineSettings;
}

export interface RecognitionResult {
  sourceText: string;
  translationText?: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}
