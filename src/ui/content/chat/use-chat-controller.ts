import { useCallback, useEffect, useRef, useState } from 'react';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../../shared/storage/chat-history-repository';
import { getChatMessageTextContent, type ChatMessage, type ChatMessageContent, type ChatRequestPayload } from '../../../shared/types/chat';
import {
  getRuntimeResponseData,
} from '../../../shared/types/runtime-messages';
import {
  chatRequestType,
  chatCancelType,
  type ChatRuntimeResponse,
  isChatStreamChunkMessage,
} from '../../../shared/types/chat';
import { translateMessage } from '../../../shared/i18n/i18n';
import {
  buildChatErrorMessage,
  buildChatRequestHistory,
  createChatMessage,
  updateChatMessageById,
} from './message/chat-message-state';

/**
 * Converts a send failure into the text shown in the assistant error message.
 *
 * @param error - The caught send error.
 * @returns Localized error text for the chat transcript.
 */
function resolveSendErrorText(error: unknown): string {
  const fallbackSend = translateMessage('error.message.sendFailed');
  const misconfigured = translateMessage('error.model.misconfigured');

  if (!(error instanceof Error)) return fallbackSend;
  if (error.message === 'MODEL_MISCONFIGURED') return misconfigured;
  return error.message || fallbackSend;
}

/**
 * Coordinates chat history, streaming chunks, runtime requests, and cancellation for one hostname.
 *
 * @param hostname - Hostname-scoped chat history key.
 * @returns Chat UI state and command handlers.
 */
export function useChatController(hostname: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasUserInteractedRef = useRef(false);
  const streamingAssistantIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadChatHistory(hostname).then((history) => {
      if (!hasUserInteractedRef.current) {
        setMessages(history.map<ChatMessage>((message) => {
          if (message.role !== 'assistant' || message.status !== 'streaming') {
            return message;
          }
          return buildChatErrorMessage(message, translateMessage('error.message.pageRefreshInterrupted'));
        }));
      }
      setIsHydrated(true);
    });
  }, [hostname]);

  useEffect(() => {
    const listener = (message: unknown, _sender: chrome.runtime.MessageSender) => {
      if (!isChatStreamChunkMessage(message)) return;
      if (!message.payload?.content) return;

      const chunk = message.payload.content;

      setMessages((prevMessages) => {
        return updateChatMessageById(prevMessages, streamingAssistantIdRef.current, (message) => {
          return {
            ...message,
            content: getChatMessageTextContent(message.content) + chunk,
          };
        });
      });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [hostname]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!messages.length) {
      void clearChatHistory(hostname);
      return;
    }

    saveChatHistory(hostname, messages).catch((error) => {
      console.error('[ChatBrowserX] Failed to save chat history:', error);
    });
  }, [hostname, isHydrated, messages]);

  const sendMessage = useCallback(async (input: ChatMessageContent) => {
    setIsSending(true);
    hasUserInteractedRef.current = true;
    streamingAssistantIdRef.current = null;

    const userMessage = createChatMessage('user', input);
    const assistantPlaceholder: ChatMessage = createChatMessage('assistant', '', 'streaming');

    streamingAssistantIdRef.current = assistantPlaceholder.id;
    const currentId = assistantPlaceholder.id;
    setMessages([...messages, userMessage, assistantPlaceholder]);

    try {
      const response = (await chrome.runtime.sendMessage({
        type: chatRequestType,
        payload: {
          input,
          history: buildChatRequestHistory(messages),
        } satisfies ChatRequestPayload,
      })) as ChatRuntimeResponse;

      const reply = getRuntimeResponseData(response, translateMessage('error.message.sendFailed')).reply;
      setMessages((prevMessages) => {
        return updateChatMessageById(prevMessages, currentId, (message) => ({
          ...message,
          content: reply,
          status: 'completed',
        }));
      });

      return reply;
    } catch (error) {
      const errorText = resolveSendErrorText(error);

      setMessages((prevMessages) => {
        return updateChatMessageById(prevMessages, currentId, (message) => {
          return buildChatErrorMessage(message, errorText);
        });
      });
      throw error;
    } finally {
      streamingAssistantIdRef.current = null;
      setIsSending(false);
    }
  }, [messages]);

  const clearHistory = useCallback(async () => {
    hasUserInteractedRef.current = true;
    setMessages([]);
    await clearChatHistory(hostname);
  }, [hostname]);

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
