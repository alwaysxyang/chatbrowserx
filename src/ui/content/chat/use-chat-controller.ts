import { useEffect, useMemo, useRef, useState } from 'react';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../../shared/storage/chat-history-repository';
import type { ChatMessage, ChatRequestPayload } from '../../../shared/types/chat';
import {
  chatRequestType,
  chatStreamChunkType,
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

export function useChatController(hostname: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasUserInteractedRef = useRef(false);
  const [streamingContent, setStreamingContent] = useState('');
  const streamingRef = useRef('');
  const isSendingRef = useRef(false);

  useEffect(() => {
    loadChatHistory(hostname).then((history) => {
      if (!hasUserInteractedRef.current) {
        setMessages(history);
      }
      setIsHydrated(true);
    });
  }, [hostname]);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  // 监听来自后台的流式增量响应，实时更新最后一条 assistant 消息内容
  useEffect(() => {
    const listener = (message: unknown, _sender: chrome.runtime.MessageSender) => {
      if (!isChatStreamChunkMessage(message)) return;
      if (!message.payload?.content) return;

      const chunk = message.payload.content;

      // 将流式内容累积到单独的 streamingContent 中，
      // 由 MessageList 的 loading 气泡负责展示
      if (!isSendingRef.current) return;
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

    void saveChatHistory(hostname, messages);
  }, [hostname, isHydrated, messages]);

  const api = useMemo(
    () => ({
      async sendMessage(input: string) {
        setIsSending(true);
        setErrorMessage(null);
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
              history: messages,
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

          setMessages((currentMessages) => {
            const contentSoFar = streamingRef.current.trim();

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

          setErrorMessage(null);
          setStreamingContent('');
          streamingRef.current = '';
          throw error;
        } finally {
          setIsSending(false);
        }
      },
      async clearHistory() {
        hasUserInteractedRef.current = true;
        setErrorMessage(null);
        setMessages([]);
        await clearChatHistory(hostname);
      },
    }),
    [hostname, messages],
  );

  const stop = async () => {
    if (!isSendingRef.current) return;
    // 不对打断做 UI 上的特殊处理：只中断后台请求，错误由 sendMessage 的 catch 统一处理。
    await chrome.runtime.sendMessage({ type: chatCancelType });
  };

  return {
    messages,
    isSending,
    errorMessage,
    streamingContent,
    clearHistory: api.clearHistory,
    sendMessage: api.sendMessage,
    stop,
  };
}
