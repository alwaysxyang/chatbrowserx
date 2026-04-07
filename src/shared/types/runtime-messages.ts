import type { ChatRequestPayload, ChatResponsePayload } from './chat';

export const chatRequestType = 'chatbrowserx.chat.request';
export const chatStreamChunkType = 'chatbrowserx.chat.stream.chunk';
export const chatCancelType = 'chatbrowserx.chat.cancel';
export const chatSessionPortName = 'chatbrowserx.chat.session';
export const panelCommandType = 'chatbrowserx.panel.command';
export const getPageContentToolRequestType = 'chatbrowserx.tool.get-page-content.request';

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

export interface ChatStreamChunkMessage {
  type: typeof chatStreamChunkType;
  payload: {
    content: string;
  };
}

export interface ChatCancelMessage {
  type: typeof chatCancelType;
}

export interface PanelCommandMessage {
  type: typeof panelCommandType;
  payload: {
    command: 'toggle-chat' | 'open-chat' | 'open-settings';
  };
}

export interface GetPageContentToolRequestMessage {
  type: typeof getPageContentToolRequestType;
}

export interface GetPageContentToolPayload {
  title: string;
  url: string;
  content: string;
}


export function isChatRequestMessage(message: unknown): message is ChatRequestMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      (message as ChatRequestMessage).type === chatRequestType,
  );
}

export function isChatStreamChunkMessage(message: unknown): message is ChatStreamChunkMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      (message as ChatStreamChunkMessage).type === chatStreamChunkType,
  );
}

export function isChatCancelMessage(message: unknown): message is ChatCancelMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      (message as ChatCancelMessage).type === chatCancelType,
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

export function isGetPageContentToolRequestMessage(message: unknown): message is GetPageContentToolRequestMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      (message as GetPageContentToolRequestMessage).type === getPageContentToolRequestType,
  );
}
