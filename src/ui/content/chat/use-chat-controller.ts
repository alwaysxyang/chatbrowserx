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

export function useChatController(hostname: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasUserInteractedRef = useRef(false);
  // 当前正在流式生成的 assistant 消息 id；每次 sendMessage 时创建占位消息并记录在这里
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

  // 监听来自后台的流式增量响应，实时更新最后一条 assistant 消息内容
  useEffect(() => {
    const listener = (message: unknown, _sender: chrome.runtime.MessageSender) => {
      if (!isChatStreamChunkMessage(message)) return;
      if (!message.payload?.content) return;

      const chunk = message.payload.content;

      // 将增量内容直接累积到「当前正在流式生成的 assistant 消息」中，
      // 不再使用单独的 streamingContent/pending 缓存。
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

    // 本地持久化保留原始对话（包括错误轮次），
    // 仅发送给大模型时使用过滤后的 history。
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
      const fallbackSend = translateMessage('error.message.sendFailed');
      const misconfigured = translateMessage('error.model.misconfigured');
      const errorText =
        error instanceof Error && error.message === 'MODEL_MISCONFIGURED'
          ? misconfigured
          : error instanceof Error
          ? error.message || fallbackSend
          : fallbackSend;

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
    // 不对打断做 UI 上的特殊处理：只中断后台请求，错误由 sendMessage 的 catch 统一处理。
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
