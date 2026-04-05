import type { ChatRequestPayload, ChatResponsePayload } from './chat';

export const chatRequestType = 'chatbrowserx.chat.request';
export const panelCommandType = 'chatbrowserx.panel.command';

export interface ChatRequestMessage {
  type: typeof chatRequestType;
  payload: ChatRequestPayload;
}

export interface ChatSuccessResponse {
  ok: true;
  data: ChatResponsePayload;
}

export interface ChatErrorResponse {
  ok: false;
  error: string;
}

export type ChatRuntimeResponse = ChatSuccessResponse | ChatErrorResponse;

export interface PanelCommandMessage {
  type: typeof panelCommandType;
  payload: {
    command: 'toggle-chat' | 'open-chat' | 'open-settings';
  };
}

export function isChatRequestMessage(message: unknown): message is ChatRequestMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      (message as ChatRequestMessage).type === chatRequestType,
  );
}

export function isPanelCommandMessage(message: unknown): message is PanelCommandMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      (message as PanelCommandMessage).type === panelCommandType,
  );
}
