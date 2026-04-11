import { useState, useEffect, useCallback } from 'react';
import type { RecognitionResult } from '../../../shared/types/speech';
import {
  getRuntimeResponseData,
  isSpeechResultMessage,
  type SpeechRuntimeResponse,
  speechStartRequestType,
  speechStopRequestType,
} from '../../../shared/types/runtime-messages';

export interface SubtitleState {
  sourceText: string;
  translationText: string;
  isActive: boolean;
}

export function useSubtitleController() {
  const [subtitle, setSubtitle] = useState<SubtitleState>({
    sourceText: '',
    translationText: '',
    isActive: false,
  });

  const resetSubtitle = useCallback(() => {
    setSubtitle({
      sourceText: '',
      translationText: '',
      isActive: false,
    });
  }, []);

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      if (!isSpeechResultMessage(message)) {
        return;
      }

      const result: RecognitionResult = message.payload;

      setSubtitle({
        sourceText: result.sourceText,
        translationText: result.translationText || '',
        isActive: true,
      });
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const startRecognition = useCallback(async () => {
    console.log('[Subtitle] Starting recognition...');

    setSubtitle({
      sourceText: '',
      translationText: '',
      isActive: true,
    });

    try {
      // The background script will get the tab ID from sender
      const response = (await chrome.runtime.sendMessage({
        type: speechStartRequestType,
      })) as SpeechRuntimeResponse;

      getRuntimeResponseData(response, 'Failed to start recognition');
    } catch (error) {
      console.error('[Subtitle] Error starting recognition:', error);
      resetSubtitle();
    }
  }, [resetSubtitle]);

  const stopRecognition = useCallback(async () => {
    console.log('[Subtitle] Stopping recognition...');

    try {
      const response = (await chrome.runtime.sendMessage({
        type: speechStopRequestType,
      })) as SpeechRuntimeResponse;

      getRuntimeResponseData(response, 'Failed to stop recognition');
    } catch (error) {
      console.error('[Subtitle] Error stopping recognition:', error);
    } finally {
      resetSubtitle();
    }
  }, [resetSubtitle]);

  return {
    subtitle,
    startRecognition,
    stopRecognition,
  };
}
