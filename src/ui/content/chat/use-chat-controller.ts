import { useEffect, useMemo, useRef, useState } from 'react';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../../shared/storage/chat-history-repository';
import type { ChatMessage, ChatRequestPayload } from '../../../shared/types/chat';
import {
  chatRequestType,
  type ChatRuntimeResponse,
} from '../../../shared/types/runtime-messages';

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

  useEffect(() => {
    loadChatHistory(hostname).then((history) => {
      if (!hasUserInteractedRef.current) {
        setMessages(history);
      }
      setIsHydrated(true);
    });
  }, [hostname]);

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
            throw new Error(response?.error || '发送失败');
          }

          const reply = response.data.reply;
          setMessages((currentMessages) => [...currentMessages, createMessage('assistant', reply)]);
          return reply;
        } catch (error) {
          const message = error instanceof Error ? error.message : '发送失败';
          setMessages((currentMessages) => [...currentMessages, createMessage('assistant', message, 'error')]);
          setErrorMessage(null);
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

  return {
    messages,
    isSending,
    errorMessage,
    clearHistory: api.clearHistory,
    sendMessage: api.sendMessage,
  };
}
