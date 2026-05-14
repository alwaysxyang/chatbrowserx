import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatClearType,
  chatCancelType,
  chatRequestType,
  chatStateQueryType,
  getChatMessageTextContent,
  isChatStateSyncMessage,
  isChatStreamChunkMessage,
  type ChatMessage,
  type ChatMessageContent,
  type ChatRequestPayload,
  type ChatRuntimeResponse,
  type ChatSessionState,
  type ChatStateRuntimeResponse,
} from '../../../shared/types/chat';
import { translateMessage } from '../../../shared/i18n/i18n';
import { getRuntimeResponseData } from '../../../shared/types/runtime-messages';

/**
 * Checks whether a runtime payload has the global chat state shape.
 *
 * @param value - The runtime payload to check.
 * @returns True when the payload can hydrate chat UI state.
 */
function isChatSessionState(value: unknown): value is ChatSessionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as ChatSessionState;
  return Array.isArray(candidate.messages)
    && typeof candidate.isRunning === 'boolean'
    && (candidate.requestId === null || typeof candidate.requestId === 'number')
    && (candidate.activeAssistantMessageId === null || typeof candidate.activeAssistantMessageId === 'string');
}

/**
 * Coordinates chat UI state with the background-owned global chat session.
 *
 * @returns Chat UI state and command handlers.
 */
export function useChatController() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const requestIdRef = useRef<number | null>(null);
  const activeAssistantMessageIdRef = useRef<string | null>(null);

  const applyState = useCallback((state: ChatSessionState) => {
    requestIdRef.current = state.requestId;
    activeAssistantMessageIdRef.current = state.activeAssistantMessageId;
    setMessages(state.messages);
    setIsSending(state.isRunning);
  }, []);

  useEffect(() => {
    const listener = (message: unknown, _sender: chrome.runtime.MessageSender) => {
      if (isChatStateSyncMessage(message)) {
        applyState(message.payload);
        return;
      }

      if (!isChatStreamChunkMessage(message)) return;
      if (!message.payload?.content) return;
      if (message.payload.requestId !== requestIdRef.current) return;
      if (message.payload.messageId !== activeAssistantMessageIdRef.current) return;

      const chunk = message.payload.content;
      const messageId = message.payload.messageId;

      setMessages((prevMessages) => {
        let messageIndex = -1;
        for (let index = prevMessages.length - 1; index >= 0; index -= 1) {
          if (prevMessages[index].id === messageId) {
            messageIndex = index;
            break;
          }
        }
        if (messageIndex < 0) {
          return prevMessages;
        }

        const nextMessages = [...prevMessages];
        const targetMessage = nextMessages[messageIndex];
        nextMessages[messageIndex] = {
          ...targetMessage,
          content: getChatMessageTextContent(targetMessage.content) + chunk,
        };
        return nextMessages;
      });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [applyState]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = (await chrome.runtime.sendMessage({ type: chatStateQueryType })) as ChatStateRuntimeResponse;
        const state = getRuntimeResponseData(response, translateMessage('error.message.sendFailed'));
        if (isMounted && isChatSessionState(state)) {
          applyState(state);
        }
      } catch {
        // Content UI can still mount on pages where the background is temporarily unavailable.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [applyState]);

  const sendMessage = useCallback(async (input: ChatMessageContent) => {
    setIsSending(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: chatRequestType,
        payload: {
          input,
          history: [],
        } satisfies ChatRequestPayload,
      })) as ChatRuntimeResponse;

      getRuntimeResponseData(response, translateMessage('error.message.sendFailed'));
    } finally {
      setIsSending(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: chatClearType });
  }, []);

  const stop = useCallback(async () => {
    if (!isSending) return;
    await chrome.runtime.sendMessage({ type: chatCancelType });
  }, [isSending]);

  return {
    messages,
    isSending,
    clearHistory,
    sendMessage,
    stop,
  };
}
