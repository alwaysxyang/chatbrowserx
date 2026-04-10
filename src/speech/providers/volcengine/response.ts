import type { RecognitionResult } from '../../../shared/types/speech';
import type { SubtitlePayload, ServerMessageType } from './protocol';

/**
 * Converts Volcengine subtitle payload to unified RecognitionResult format.
 */
export function convertSubtitleToResult(
  type: ServerMessageType,
  payload: SubtitlePayload,
  translationText?: string,
): RecognitionResult {
  const isSourceEnd = type === 'SourceSubtitleEnd';
  const isTranslationEnd = type === 'TranslationSubtitleEnd';

  return {
    sourceText: payload.text,
    translationText,
    startTime: payload.start_time,
    endTime: payload.end_time,
    isFinal: isSourceEnd || isTranslationEnd,
  };
}
