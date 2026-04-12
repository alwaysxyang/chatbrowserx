import { useState, useEffect, useCallback } from 'react';
import type { RecognitionResult } from '../../../shared/types/speech';
import {
  getRuntimeResponseData,
} from '../../../shared/types/runtime-messages';
import {
  isSpeechResultMessage,
  isSpeechErrorMessage,
  type SpeechRuntimeResponse,
  type SpeechStateQueryResponse,
  speechStartRequestType,
  speechStopRequestType,
  speechStateQueryType,
} from '../../../shared/types/speech';

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

  // Query recording state on mount (for page refresh recovery)
  useEffect(() => {
    const queryState = async () => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: speechStateQueryType,
        })) as SpeechStateQueryResponse;

        const data = getRuntimeResponseData(response, 'Failed to query speech state');

        if (data.isRecording) {
          // Restore listening state
          setSubtitle(listeningSubtitleState);
          console.log('[Subtitle] Restored recording state after page refresh');
        }
      } catch (error) {
        // Silently ignore errors during initial query (extension might be reloading)
        if (error instanceof Error && !error.message.includes('Extension context invalidated')) {
          console.error('[Subtitle] Error querying speech state:', error);
        }
      }
    };

    void queryState();
  }, []);

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      if (isSpeechResultMessage(message)) {
        const result: RecognitionResult = message.payload;

        setSubtitle({
          sourceText: result.sourceText,
          translationText: result.translationText || '',
          isActive: true,
        });
      } else if (isSpeechErrorMessage(message)) {
        console.error('[Subtitle] Recognition error:', message.payload.error);
        resetSubtitle();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [resetSubtitle]);

  const startRecognition = useCallback(async () => {
    setSubtitle(listeningSubtitleState);

    try {
      const response = (await chrome.runtime.sendMessage({
        type: speechStartRequestType,
      })) as SpeechRuntimeResponse;

      getRuntimeResponseData(response, 'Failed to start recognition');
    } catch (error) {
      console.error('[Subtitle] Error starting recognition:', error);

      // Check if extension context was invalidated (extension reloaded)
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        alert('Extension was reloaded. Please refresh the page to continue.');
      }

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

      // Check if extension context was invalidated
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        alert('Extension was reloaded. Please refresh the page to continue.');
      }
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
