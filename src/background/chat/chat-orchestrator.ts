import { completeChat } from '../../llm/services/chat-completion';
import { loadSettings } from '../../shared/storage/settings-repository';
import type { ChatRequestPayload, ChatResponsePayload } from '../../shared/types/chat';

export async function handleChatRequest(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
  const settings = await loadSettings();
  const reply = await completeChat(settings, payload.history, payload.input);

  return { reply };
}
