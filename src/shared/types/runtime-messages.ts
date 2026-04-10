import type { ChatRequestPayload, ChatResponsePayload } from './chat';

export const chatRequestType = 'chatbrowserx.chat.request';
export const chatStreamChunkType = 'chatbrowserx.chat.stream.chunk';
export const chatCancelType = 'chatbrowserx.chat.cancel';
export const chatSessionPortName = 'chatbrowserx.chat.session';
export const screenshotCaptureRequestType = 'chatbrowserx.chat.screenshot.capture';
export const panelCommandType = 'chatbrowserx.panel.command';
export const getPageContentToolRequestType = 'chatbrowserx.tool.get-page-content.request';

export interface RuntimeMessage<TType extends string = string> {
  type: TType;
}

export interface RuntimeSuccessResponse<TData> {
  ok: true;
  data: TData;
}

export interface RuntimeErrorResponse {
  ok: false;
  error: string;
}

export type RuntimeResponse<TData> = RuntimeSuccessResponse<TData> | RuntimeErrorResponse;

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

export interface ScreenshotCaptureRequestMessage {
  type: typeof screenshotCaptureRequestType;
}

export interface ScreenshotCaptureSuccessResponse {
  ok: true;
  data: {
    dataUrl: string;
  };
}

export interface ScreenshotCaptureErrorResponse {
  ok: false;
  error: string;
}

export type ScreenshotCaptureRuntimeResponse =
  | ScreenshotCaptureSuccessResponse
  | ScreenshotCaptureErrorResponse;

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

export function hasRuntimeMessageType<TType extends string>(message: unknown, type: TType): message is RuntimeMessage<TType> {
  return Boolean(message && typeof message === 'object' && 'type' in message && (message as RuntimeMessage<TType>).type === type);
}

export function createRuntimeMessageGuard<TMessage extends RuntimeMessage<string>>(type: TMessage['type']) {
  return (message: unknown): message is TMessage => hasRuntimeMessageType(message, type);
}

export function getRuntimeResponseData<TData>(response: RuntimeResponse<TData> | undefined, fallbackError: string): TData {
  if (!response?.ok) {
    throw new Error(response?.error || fallbackError);
  }

  return response.data;
}

const isChatRequestMessageGuard = createRuntimeMessageGuard<ChatRequestMessage>(chatRequestType);
const isChatStreamChunkMessageGuard = createRuntimeMessageGuard<ChatStreamChunkMessage>(chatStreamChunkType);
const isChatCancelMessageGuard = createRuntimeMessageGuard<ChatCancelMessage>(chatCancelType);
const isScreenshotCaptureRequestMessageGuard = createRuntimeMessageGuard<ScreenshotCaptureRequestMessage>(
  screenshotCaptureRequestType,
);
const isPanelCommandMessageGuard = createRuntimeMessageGuard<PanelCommandMessage>(panelCommandType);
const isGetPageContentToolRequestMessageGuard = createRuntimeMessageGuard<GetPageContentToolRequestMessage>(
  getPageContentToolRequestType,
);


export function isChatRequestMessage(message: unknown): message is ChatRequestMessage {
  return isChatRequestMessageGuard(message);
}

export function isChatStreamChunkMessage(message: unknown): message is ChatStreamChunkMessage {
  return isChatStreamChunkMessageGuard(message);
}

export function isChatCancelMessage(message: unknown): message is ChatCancelMessage {
  return isChatCancelMessageGuard(message);
}

export function isScreenshotCaptureRequestMessage(message: unknown): message is ScreenshotCaptureRequestMessage {
  return isScreenshotCaptureRequestMessageGuard(message);
}

export function isPanelCommandMessage(message: unknown): message is PanelCommandMessage {
  return isPanelCommandMessageGuard(message);
}

export function isGetPageContentToolRequestMessage(message: unknown): message is GetPageContentToolRequestMessage {
  return isGetPageContentToolRequestMessageGuard(message);
}
