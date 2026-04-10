import { useState, useEffect, useCallback } from 'react';
import type { RecognitionResult } from '../../../shared/types/speech';
import { isSpeechResultMessage, speechStartRequestType, speechStopRequestType } from '../../../shared/types/runtime-messages';

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
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;

    if (!tabId) {
      throw new Error('No active tab');
    }

    await chrome.runtime.sendMessage({
      type: speechStartRequestType,
      payload: { tabId },
    });

    setSubtitle((prev) => ({ ...prev, isActive: true }));
  }, []);

  const stopRecognition = useCallback(async () => {
    await chrome.runtime.sendMessage({
      type: speechStopRequestType,
    });

    setSubtitle({
      sourceText: '',
      translationText: '',
      isActive: false,
    });
  }, []);

  return {
    subtitle,
    startRecognition,
    stopRecognition,
  };
}
