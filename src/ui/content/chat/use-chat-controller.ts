import { useEffect, useMemo, useRef, useState } from 'react';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../../shared/storage/chat-history-repository';
import type { ChatMessage, ChatRequestPayload } from '../../../shared/types/chat';
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
 * 从完整的 messages 列表中构造「用于上下文与持久化」的历史：
 * - 保留所有正常的 user / assistant 消息；
 * - 对于 status === 'error' 的 assistant 消息：
 *   - 丢弃这条 assistant；
 *   - 同时丢弃它对应的 user 消息（最近且尚未被其他 assistant 消费的那条）。
 *
 * 这样可以保证：
 * - UI 仍然可以展示错误气泡；
 * - 但失败轮次不会进入 history（既不会持久化，也不会参与后续请求的 history）。
 */
const buildHistoryFromMessages = (source: ChatMessage[]): ChatMessage[] => {
  const result: ChatMessage[] = [];

  for (const message of source) {
    const isAssistantError = message.role === 'assistant' && message.status === 'error';

    if (!isAssistantError) {
      result.push(message);
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

export function useChatController(hostname: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasUserInteractedRef = useRef(false);
  const [streamingContent, setStreamingContent] = useState('');
  const streamingRef = useRef('');

  useEffect(() => {
    loadChatHistory(hostname).then((history) => {
      if (!hasUserInteractedRef.current) {
        setMessages(history);
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

      // 将流式内容累积到单独的 streamingContent 中，
      // 由 MessageList 的 loading 气泡负责展示
      setStreamingContent((prev) => {
        const next = prev + chunk;
        streamingRef.current = next;
        return next;
      });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

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
        // 每次发送前重置流式内容
        setStreamingContent('');
        streamingRef.current = '';

        const nextMessages = [...messages, createMessage('user', input)];
        setMessages(nextMessages);

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
          // 流式阶段只更新 loading 气泡中的 streamingContent，
          // 完成后将完整回复落盘为一条 assistant 消息
          setMessages((currentMessages) => [...currentMessages, createMessage('assistant', reply)]);
          setStreamingContent('');
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
          const contentSoFar = streamingRef.current.trim();
          setMessages((currentMessages) => {
            // 没有任何 SSE 文本：气泡内容直接显示错误原因
            if (!contentSoFar) {
              return [...currentMessages, createMessage('assistant', errorText, 'error')];
            }

            // 已经有部分 SSE 文本：
            // - 气泡内容保留已生成文本；
            // - 使用红色错误样式与错误头像；
            // - 错误原因放到右侧感叹号的 tooltip 中（一次对话只保留一个气泡）。
            const base = createMessage('assistant', contentSoFar, 'error');
            const messageWithError: ChatMessage = {
              ...base,
              errorMessage: errorText,
            };
            return [...currentMessages, messageWithError];
          });
          setStreamingContent('');
          streamingRef.current = '';
          throw error;
        } finally {
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
    streamingContent,
    clearHistory: api.clearHistory,
    sendMessage: api.sendMessage,
    stop,
  };
}
