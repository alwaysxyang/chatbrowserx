import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Languages, Sparkles } from 'lucide-react';
import { loadSettings, defaultSettings } from '../../../shared/storage/settings-repository';
import { translateMessage } from '../../../shared/i18n/i18n';
import { copyMessageContent } from '../../content/chat/copy-message-content';
import { MessageMarkdown } from '../../shared/MessageMarkdown';
import { getRuntimeResponseData } from '../../../shared/types/runtime-messages';
import type { SelectionMode, SelectionRuntimeResponse } from '../../../shared/types/selection';
import {
  isSelectionStreamChunkMessage,
  selectionCancelType,
  selectionRequestType,
} from '../../../shared/types/selection';
import { buildAskAiPrompt, buildTranslatePrompt, resolveTargetLanguage } from './selection-prompts';
import { readCurrentPageText } from './page-content';

type BubblePlacement = 'above' | 'below';

interface BubbleAnchor {
  left: number;
  top: number;
  placement: BubblePlacement;
}

/**
 * Clamps a number between a minimum and maximum.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns true when the given node is inside ChatBrowserX's ShadowRoot.
 * This avoids showing the selection bubble when selecting text in the extension UI itself.
 */
function isInsideChatBrowserX(node: Node | null): boolean {
  const host = document.getElementById('chatbrowserx-root');
  const shadowRoot = host?.shadowRoot;
  if (!shadowRoot || !node) return false;

  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element && shadowRoot.contains(element));
}

/**
 * Reads the current selection text and its bounding rect.
 * Returns null if selection is empty or should be ignored.
 */
function readSelectionSnapshot(): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  if (isInsideChatBrowserX(selection.anchorNode)) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  let rect = range.getBoundingClientRect();
  if ((rect.width === 0 || rect.height === 0) && range.getClientRects().length) {
    rect = range.getClientRects()[0];
  }

  if (rect.width === 0 && rect.height === 0) return null;
  return { text, rect };
}

/**
 * Computes a near-selection anchor with basic viewport clamping.
 */
function computeAnchor(rect: DOMRect): BubbleAnchor {
  const centerX = rect.left + rect.width / 2;
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;

  const left = clamp(centerX, 16, viewportWidth - 16);
  const preferAbove = rect.top > 90;
  const placement: BubblePlacement = preferAbove ? 'above' : 'below';
  const top = placement === 'above' ? rect.top : Math.min(viewportHeight - 16, rect.bottom);

  return { left, top, placement };
}

/**
 * Creates a client-side request id for correlating streaming chunks.
 */
function createRequestId(): string {
  return `sel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Checks whether an event originated inside the active selection bubble.
 *
 * @param event - The document-level event to inspect.
 * @param root - The bubble root element.
 * @returns True when the event path includes the bubble root.
 */
function isEventInsideBubble(event: Event, root: HTMLElement | null): boolean {
  if (!root) return false;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path.includes(root);
}

/**
 * Selection-driven bubble UI for Translate / Ask AI with streaming output.
 */
export function SelectionBubble() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  const [selectionText, setSelectionText] = useState<string>('');
  const [anchor, setAnchor] = useState<BubbleAnchor | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [content, setContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const hasSelection = Boolean(anchor && selectionText);

  /**
   * Cancels the current background request (if any) and resets the panel state.
   * Keeps the current selection anchor so the toolbar can remain visible.
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

  /**
   * Hides the entire bubble UI and cancels any in-flight request.
   */
  const hideBubble = useCallback(() => {
    cancelActiveRequestAndResetPanel();
    setSelectionText('');
    setAnchor(null);
  }, [cancelActiveRequestAndResetPanel]);

  const refreshFromSelection = useCallback(() => {
    const snapshot = readSelectionSnapshot();
    if (!snapshot) {
      hideBubble();
      return;
    }

    // If the selection changed, close the old panel and cancel its request.
    if (snapshot.text !== selectionText) {
      cancelActiveRequestAndResetPanel();
      setSelectionText(snapshot.text);
    }

    setAnchor(computeAnchor(snapshot.rect));
    setIsCopied(false);
  }, [cancelActiveRequestAndResetPanel, hideBubble, selectionText]);

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (isEventInsideBubble(event, rootRef.current)) return;
      refreshFromSelection();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideBubble();
        return;
      }
      if (isPanelOpen) return;
      if (isEventInsideBubble(event, rootRef.current)) return;
      refreshFromSelection();
    };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [hideBubble, isPanelOpen, refreshFromSelection]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (isEventInsideBubble(event, rootRef.current)) return;
      hideBubble();
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [hideBubble]);

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

  const buildPrompt = useCallback(async (mode: SelectionMode) => {
    const settings = await loadSettings().catch(() => defaultSettings);
    const { name: targetLanguageName } = resolveTargetLanguage({
      uiLanguage: settings.general.uiLanguage,
      browserLanguage: typeof navigator !== 'undefined' ? navigator.language : undefined,
    });

    if (mode === 'translate') {
      return buildTranslatePrompt({ selectedText: selectionText, targetLanguageName });
    }

    const page = readCurrentPageText(40000);
    return buildAskAiPrompt({
      selectedText: selectionText,
      pageTitle: page.title,
      pageUrl: page.url,
      pageText: page.text,
      targetLanguageName,
      maxPageChars: 40000,
    });
  }, [selectionText]);

  const run = useCallback(async (mode: SelectionMode) => {
    if (!hasSelection || !selectionText) return;

    // Cancel older request to reduce background churn.
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
      const prompt = await buildPrompt(mode);
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
  }, [buildPrompt, hasSelection, selectionText]);

  const copy = useCallback(async () => {
    try {
      await copyMessageContent(content);
      setIsCopied(true);
    } catch {
      // ignore clipboard errors in unsupported environments
    }
  }, [content]);

  const rootStyle = useMemo(() => {
    if (!anchor) return undefined;
    return { left: `${anchor.left}px`, top: `${anchor.top}px` } as const;
  }, [anchor]);

  if (!hasSelection || !anchor) return null;

  return (
    <div ref={rootRef} className="selection-bubble-root" data-placement={anchor.placement} style={rootStyle}>
      <div className="selection-bubble-stack">
        {!isPanelOpen ? (
          <div className="selection-toolbar" role="toolbar" aria-label="Selection toolbar">
            <button
              type="button"
              className="selection-toolbar-button"
              disabled={isSending}
              onClick={() => void run('translate')}
            >
              <Languages className="selection-toolbar-icon" strokeWidth={2.1} />
              <span>{translateMessage('selection.toolbar.translate')}</span>
            </button>
            <button
              type="button"
              className="selection-toolbar-button"
              disabled={isSending}
              onClick={() => void run('ask_ai')}
            >
              <Sparkles className="selection-toolbar-icon" strokeWidth={2.1} />
              <span>{translateMessage('selection.toolbar.askAi')}</span>
            </button>
          </div>
        ) : null}

        {isPanelOpen ? (
          <div className="selection-panel" role="dialog" aria-label="Selection result">
            <div className="selection-panel-body">
              <MessageMarkdown content={content || translateMessage('chat.loading')} />
            </div>
            <div className="selection-panel-divider" />
            <div className="selection-panel-footer">
              <button
                type="button"
                className="selection-copy-button"
                aria-label={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
                data-tooltip={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
                onMouseLeave={() => setIsCopied(false)}
                onClick={() => void copy()}
              >
                {isCopied ? (
                  <Check className="h-3 w-3 selection-copy-icon-success" strokeWidth={2.2} />
                ) : (
                  <Copy className="h-3 w-3" strokeWidth={2.0} />
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
