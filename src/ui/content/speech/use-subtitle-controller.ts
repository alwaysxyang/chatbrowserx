import { useState, useEffect, useCallback } from 'react';
import type { RecognitionResult } from '../../../shared/types/speech';
import {
  getRuntimeResponseData,
  isSpeechResultMessage,
  type SpeechRuntimeResponse,
  speechStartRequestType,
  speechStopRequestType,
} from '../../../shared/types/runtime-messages';

interface SubtitleState {
  sourceText: string;
  translationText: string;
  isActive: boolean;
}

const emptySubtitleState: SubtitleState = {
  sourceText: '',
  translationText: '',
  isActive: false,
};

const listeningSubtitleState: SubtitleState = {
  sourceText: '',
  translationText: '',
  isActive: true,
};

export function useSubtitleController() {
  const [subtitle, setSubtitle] = useState<SubtitleState>(emptySubtitleState);

  const resetSubtitle = useCallback(() => {
    setSubtitle(emptySubtitleState);
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
    setSubtitle(listeningSubtitleState);

    try {
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
