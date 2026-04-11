import { useState, useEffect, useCallback } from 'react';
import type { RecognitionResult } from '../../../shared/types/speech';
import { isSpeechResultMessage, speechStartRequestType, speechStopRequestType } from '../../../shared/types/runtime-messages';
import { getSpeechState, setSpeechState, clearSpeechState } from '../../../shared/storage/speech-state-repository';

export interface SubtitleState {
  sourceText: string;
  translationText: string;
  isActive: boolean;
}

async function getCurrentTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id || null;
}

export function useSubtitleController() {
  const [subtitle, setSubtitle] = useState<SubtitleState>({
    sourceText: '',
    translationText: '',
    isActive: false,
  });

  // Load state from storage on mount
  useEffect(() => {
    const loadState = async () => {
      const tabId = await getCurrentTabId();
      if (!tabId) return;

      const savedState = await getSpeechState(tabId);
      if (savedState) {
        console.log('[Subtitle] Loaded saved state:', savedState);
        setSubtitle(savedState);
      }
    };

    loadState();
  }, []);

  // Save state to storage whenever it changes
  useEffect(() => {
    const saveState = async () => {
      const tabId = await getCurrentTabId();
      if (!tabId) return;

      await setSpeechState(tabId, subtitle);
      console.log('[Subtitle] Saved state:', subtitle);
    };

    saveState();
  }, [subtitle]);

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

    try {
      const tabId = await getCurrentTabId();

      if (!tabId) {
        console.error('[Subtitle] No active tab');
        throw new Error('No active tab');
      }

      await chrome.runtime.sendMessage({
        type: speechStartRequestType,
        payload: { tabId },
      });

      setSubtitle((prev) => ({ ...prev, isActive: true }));

      // Mock data for testing
      console.log('[Subtitle] Setting mock data in 1 second...');
      setTimeout(() => {
        console.log('[Subtitle] Showing mock subtitle');
        setSubtitle({
          sourceText: 'こんにちは、今日はいい天気ですね。',
          translationText: '你好，今天天气真好啊。',
          isActive: true,
        });
      }, 1000);
    } catch (error) {
      console.error('[Subtitle] Error starting recognition:', error);
      throw error;
    }
  }, []);

  const stopRecognition = useCallback(async () => {
    console.log('[Subtitle] Stopping recognition...');

    await chrome.runtime.sendMessage({
      type: speechStopRequestType,
    });

    const tabId = await getCurrentTabId();
    if (tabId) {
      await clearSpeechState(tabId);
    }

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
