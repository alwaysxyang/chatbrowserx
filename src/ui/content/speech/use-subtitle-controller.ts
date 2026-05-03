import { useState, useEffect, useCallback } from 'react';
import type { RecognitionResult } from '../../../shared/types/speech';
import { getRuntimeResponseData, type RuntimeMessage, type RuntimeResponse } from '../../../shared/types/runtime-messages';
import {
  isSpeechResultMessage,
  isSpeechErrorMessage,
  type SpeechStateQueryResponsePayload,
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

const speechStateQueryFallbackError = 'Failed to query speech state';

/**
 * Sends a typed speech runtime request and unwraps the standard runtime response.
 */
async function sendSpeechRuntimeMessage<TData>(message: RuntimeMessage<string>, fallbackError: string): Promise<TData> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<TData>;

  return getRuntimeResponseData(response, fallbackError);
}

/**
 * Checks whether a caught runtime error came from a reloaded extension context.
 */
function isExtensionContextInvalidated(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Extension context invalidated');
}

/**
 * Alerts the user when the extension context was invalidated by a reload.
 */
function alertIfExtensionContextInvalidated(error: unknown): void {
  if (isExtensionContextInvalidated(error)) {
    alert('Extension was reloaded. Please refresh the page to continue.');
  }
}

/**
 * Checks whether an initial state query error can be ignored during UI hydration.
 */
function isIgnorableInitialQueryError(error: unknown): boolean {
  return isExtensionContextInvalidated(error) ||
    (error instanceof Error && error.message === speechStateQueryFallbackError);
}

/**
 * Checks whether a speech state query payload can restore local recording state.
 */
function isRecordingState(data: SpeechStateQueryResponsePayload | null): data is SpeechStateQueryResponsePayload {
  return Boolean(data?.isRecording);
}

/**
 * Keeps subtitle UI state local while coordinating speech start/stop with background runtime messages.
 */
export function useSubtitleController() {
  const [subtitle, setSubtitle] = useState<SubtitleState>(emptySubtitleState);

  const resetSubtitle = useCallback(() => {
    setSubtitle(emptySubtitleState);
  }, []);

  // Query recording state on mount (for page refresh recovery)
  useEffect(() => {
    const queryState = async () => {
      try {
        const data = await sendSpeechRuntimeMessage<SpeechStateQueryResponsePayload | null>(
          { type: speechStateQueryType },
          speechStateQueryFallbackError,
        );

        if (isRecordingState(data)) {
          // Restore listening state
          setSubtitle(listeningSubtitleState);
        }
      } catch (error) {
        // Silently ignore errors during initial query (extension might be reloading)
        if (!isIgnorableInitialQueryError(error)) {
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
      await sendSpeechRuntimeMessage<null>({ type: speechStartRequestType }, 'Failed to start recognition');
    } catch (error) {
      console.error('[Subtitle] Error starting recognition:', error);
      alertIfExtensionContextInvalidated(error);

      resetSubtitle();
    }
  }, [resetSubtitle]);

  const stopRecognition = useCallback(async () => {
    try {
      await sendSpeechRuntimeMessage<null>({ type: speechStopRequestType }, 'Failed to stop recognition');
    } catch (error) {
      console.error('[Subtitle] Error stopping recognition:', error);
      alertIfExtensionContextInvalidated(error);
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
