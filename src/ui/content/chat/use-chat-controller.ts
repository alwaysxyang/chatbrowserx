import { useEffect, useMemo, useRef, useState } from 'react';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../../shared/storage/chat-history-repository';
import { getChatMessageTextContent, type ChatMessage, type ChatRequestPayload } from '../../../shared/types/chat';
import {
  chatRequestType,
  chatCancelType,
  type ChatRuntimeResponse,
  isChatStreamChunkMessage,
} from '../../../shared/types/runtime-messages';
import { translateMessage } from '../../../shared/i18n/i18n';

const createMessage = (
  role: ChatMessage['role'],
  content: string,
  status: ChatMessage['status'] = 'completed',
): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  status,
  createdAt: new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date()),
});

/**
 * 从完整的 messages 列表中构造「用于发送给大模型」的历史：
 * - 保留所有正常的 user / assistant 消息；
 * - 对保留下来的消息，统一只保留文本内容，不携带图片；
 * - 对于 status === 'error' 的 assistant 消息：
 *   - 丢弃这条 assistant；
 *   - 同时丢弃它对应的 user 消息（最近且尚未被其他 assistant 消费的那条）。
 *
 * 这样可以保证：
 * - UI 与本地持久化仍然保留原始消息（包括图片）；
 * - 但发给大模型的 history 不带图片，失败轮次也不会进入后续上下文。
 */
const buildHistoryFromMessages = (source: ChatMessage[]): ChatMessage[] => {
  const result: ChatMessage[] = [];

  for (const message of source) {
    const isAssistantError = message.role === 'assistant' && message.status === 'error';

    if (!isAssistantError) {
      result.push({
        ...message,
        content: getChatMessageTextContent(message.content),
      });
      continue;
    }

    // 当前 assistant 是错误气泡：
    // 1. 丢弃自己；
    // 2. 尝试移除最近一条尚未被 assistant 消费的 user 消息。
    for (let i = result.length - 1; i >= 0; i -= 1) {
      const candidate = result[i];
      if (candidate.role === 'assistant') {
        // 遇到上一轮助手回复，说明对应 user 已经被消费，停止回溯。
        break;
      }
      if (candidate.role === 'user') {
        result.splice(i, 1);
        break;
      }
    }
  }

  return result;
};

const buildErrorMessage = (message: ChatMessage, errorMessage: string): ChatMessage => {
  const result: ChatMessage = {
    ...message,
    status: 'error',
    errorMessage,
  };

  if (typeof result.content === 'string') {
    if (!result.content) {
      result.content = errorMessage;
    }
  } else if (Array.isArray(result.content) && result.content.length === 0) {
    result.content = errorMessage;
  }

  return result;
};

const mapStreamingMessage = (
  messages: ChatMessage[],
  id: string | null,
  mapFn: (message: ChatMessage) => ChatMessage,
): ChatMessage[] => {
  if (!id) return messages;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].id === id) {
      const next = [...messages];
      next[i] = mapFn(next[i]);
      return next;
    }
  }
  return messages;
};

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
          return buildErrorMessage(message, translateMessage('error.message.pageRefreshInterrupted'))
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
        return mapStreamingMessage(prevMessages, streamingAssistantIdRef.current, (message) => {
          return {
            ...message,
            content: getChatMessageTextContent(message.content) + chunk,
          }
        })
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
    void saveChatHistory(hostname, messages);
  }, [hostname, isHydrated, messages]);

  const api = useMemo(
    () => ({
      async sendMessage(input: string) {
        setIsSending(true);
        hasUserInteractedRef.current = true;
        streamingAssistantIdRef.current = null;

        const userMessage = createMessage('user', input);
        const assistantPlaceholder: ChatMessage = createMessage('assistant', '', 'streaming');

        streamingAssistantIdRef.current = assistantPlaceholder.id;

        setMessages([...messages, userMessage, assistantPlaceholder]);

        try {
          const response = (await chrome.runtime.sendMessage({
            type: chatRequestType,
            payload: {
              input,
              // 发送给后台的历史同样排除错误轮次，保证失败的 user/assistant pair 不进入后续上下文。
              history: buildHistoryFromMessages(messages),
            } satisfies ChatRequestPayload,
          })) as ChatRuntimeResponse;

          if (!response?.ok) {
            throw new Error(response?.error || translateMessage('error.message.sendFailed'));
          }

          const reply = response.data.reply;
          // 将占位的 assistant 消息更新为「已完成」状态，并写入最终回复内容
          setMessages((prevMessages) => {
            return mapStreamingMessage(prevMessages, streamingAssistantIdRef.current, (message) => {
              return {
                ...message,
                content: reply,
                status: 'completed',
              }
            });
          });

          return reply;
        } catch (error) {
          const fallbackSend = translateMessage('error.message.sendFailed');
          const misconfigured = translateMessage('error.model.misconfigured');
          let errorText: string;
          if (error instanceof Error && error.message === 'MODEL_MISCONFIGURED') {
            // 模型配置缺失：使用当前 UI 语言下的「请先在设置中填写…」文案
            errorText = misconfigured;
          } else {
            // 底层报什么，错误原因就是什么（包括 AbortError / BodyStreamBuffer 等）
            errorText = error instanceof Error ? error.message || fallbackSend : fallbackSend;
          }
          const id = streamingAssistantIdRef.current;
          setMessages((prevMessages) => {
            return mapStreamingMessage(prevMessages, id, (message) => {
              return buildErrorMessage(message, errorText);
            })
          });
          throw error;
        } finally {
          streamingAssistantIdRef.current = null;
          setIsSending(false);
        }
      },
      async clearHistory() {
        hasUserInteractedRef.current = true;
        setMessages([]);
        await clearChatHistory(hostname);
      },
    }),
    [hostname, messages],
  );

  const stop = async () => {
    if (!isSending) return;
    // 不对打断做 UI 上的特殊处理：只中断后台请求，错误由 sendMessage 的 catch 统一处理。
    await chrome.runtime.sendMessage({ type: chatCancelType });
  };

  return {
    messages,
    isSending,
    clearHistory: api.clearHistory,
    sendMessage: api.sendMessage,
    stop,
  };
}
