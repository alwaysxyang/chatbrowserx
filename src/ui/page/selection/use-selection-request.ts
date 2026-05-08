import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSettings, defaultSettings } from '../../../shared/storage/settings-repository';
import { translateMessage } from '../../../shared/i18n/i18n';
import { getRuntimeResponseData } from '../../../shared/types/runtime-messages';
import type { SelectionMode, SelectionRuntimeResponse } from '../../../shared/types/selection';
import {
  isSelectionStreamChunkMessage,
  selectionCancelType,
  selectionRequestType,
} from '../../../shared/types/selection';
import { buildAskAiPrompt, buildTranslatePrompt, resolveTargetLanguage } from './selection-prompts';
import { readCurrentPageText } from './page-content';

/**
 * Creates a client-side request id for correlating streaming chunks.
 *
 * @returns A locally unique selection request id.
 */
function createRequestId(): string {
  return `sel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Copies selection result text without depending on chat-specific clipboard logic.
 *
 * @param text - The selection panel text to copy.
 */
async function copySelectionText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/**
 * Coordinates selection prompts, runtime requests, stream chunks, and copy state.
 *
 * @returns Request state and command handlers for the selection bubble.
 */
export function useSelectionRequest() {
  const activeRequestIdRef = useRef<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [content, setContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  /**
   * Cancels the current background request and resets panel-local state.
   */
  const cancelActiveRequestAndResetPanel = useCallback(() => {
    if (activeRequestIdRef.current) {
      void chrome.runtime.sendMessage({ type: selectionCancelType }).catch(() => undefined);
    }
    activeRequestIdRef.current = null;
    setIsSending(false);
    setIsPanelOpen(false);
    setContent('');
    setIsCopied(false);
  }, []);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (!isSelectionStreamChunkMessage(message)) return;
      if (message.payload.requestId !== activeRequestIdRef.current) return;
      if (!message.payload.content) return;

      setContent((prev) => prev + message.payload.content);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  /**
   * Builds a prompt for the current selection action.
   *
   * @param mode - The selected Translate or Ask AI mode.
   * @returns The prompt sent to background selection orchestration.
   */
  const buildPrompt = useCallback(async (mode: SelectionMode, selectedText: string) => {
    const settings = await loadSettings().catch(() => defaultSettings);
    const { name: targetLanguageName } = resolveTargetLanguage({
      uiLanguage: settings.general.uiLanguage,
      browserLanguage: typeof navigator !== 'undefined' ? navigator.language : undefined,
    });

    if (mode === 'translate') {
      return buildTranslatePrompt({ selectedText, targetLanguageName });
    }

    const page = readCurrentPageText(40000);
    return buildAskAiPrompt({
      selectedText,
      pageTitle: page.title,
      pageUrl: page.url,
      pageText: page.text,
      targetLanguageName,
      maxPageChars: 40000,
    });
  }, []);

  /**
   * Sends the current selection action request through background.
   *
   * @param mode - The selected Translate or Ask AI mode.
   * @param selectedText - Text selected on the host page.
   * @param hasSelection - Whether a selection anchor is active.
   */
  const run = useCallback(async (mode: SelectionMode, selectedText: string, hasSelection: boolean) => {
    if (!hasSelection || !selectedText) return;

    if (activeRequestIdRef.current) {
      void chrome.runtime.sendMessage({ type: selectionCancelType }).catch(() => undefined);
    }

    const requestId = createRequestId();
    activeRequestIdRef.current = requestId;
    setIsSending(true);
    setIsPanelOpen(true);
    setContent('');
    setIsCopied(false);

    try {
      const prompt = await buildPrompt(mode, selectedText);
      const response = (await chrome.runtime.sendMessage({
        type: selectionRequestType,
        payload: { requestId, mode, prompt },
      })) as SelectionRuntimeResponse;

      const reply = getRuntimeResponseData(response, translateMessage('error.request.failed')).reply;
      if (activeRequestIdRef.current === requestId) {
        setContent(reply);
      }
    } catch (error) {
      if (activeRequestIdRef.current === requestId) {
        setContent(error instanceof Error ? error.message : translateMessage('error.request.failed'));
      }
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsSending(false);
      }
    }
  }, [buildPrompt]);

  /**
   * Copies the current panel content and updates copy feedback state.
   */
  const copy = useCallback(async () => {
    try {
      await copySelectionText(content);
      setIsCopied(true);
    } catch {
      // ignore clipboard errors in unsupported environments
    }
  }, [content]);

  return {
    isPanelOpen,
    isSending,
    content,
    isCopied,
    cancelActiveRequestAndResetPanel,
    run,
    copy,
    setIsCopied,
  };
}
