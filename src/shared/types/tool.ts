import type { RuntimeMessage } from './runtime-messages';
import { createRuntimeMessageGuard } from './runtime-messages';

/**
 * Payload containing extracted page content information.
 */
export interface GetPageContentToolPayload {
  title: string;
  url: string;
  content: string;
}

/**
 * Message type identifier for page content extraction tool requests.
 */
export const getPageContentToolRequestType = 'chatbrowserx.tool.get-page-content.request';

/**
 * Message sent to request page content extraction for tool use.
 */
export interface GetPageContentToolRequestMessage extends RuntimeMessage<typeof getPageContentToolRequestType> {}

const isGetPageContentToolRequestMessageGuard = createRuntimeMessageGuard<GetPageContentToolRequestMessage>(
  getPageContentToolRequestType,
);

/**
 * Type guard that checks if an unknown value is a GetPageContentToolRequestMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a GetPageContentToolRequestMessage
 */
export function isGetPageContentToolRequestMessage(message: unknown): message is GetPageContentToolRequestMessage {
  return isGetPageContentToolRequestMessageGuard(message);
}

/**
 * Compact payload containing interactable elements in the current viewport.
 */
export interface GetPageInteractablesToolPayload {
  v: [number, number];
  sid: string;
  items: Array<[
    ref: string,
    role: string,
    name: string,
    rect: [number, number, number, number],
    meta?: {
      h?: string;
      t?: string;
      checked?: boolean;
      expanded?: boolean;
      pressed?: boolean;
      s?: 'x' | 'y' | 'xy';
    },
  ]>;
  d?: {
    ver: string;
    q: {
      total: number;
      owned: number;
      hidden: number;
      disabled: number;
      noRole: number;
      small: number;
      covered: number;
      kept: number;
      writable: number;
      wrappers: number;
      p: number;
    };
    samples?: Array<{
      tag?: string;
      id?: string;
      cls?: string;
      role?: string;
      reason?: string;
      text?: string;
      rect?: [number, number, number, number];
    }>;
  };
}

/**
 * Message type identifier for page interactables snapshot tool requests.
 */
export const getPageInteractablesToolRequestType = 'chatbrowserx.tool.get-page-interactables.request';

/**
 * Message sent to request current viewport interactables for tool use.
 */
export interface GetPageInteractablesToolRequestMessage extends RuntimeMessage<typeof getPageInteractablesToolRequestType> {}

const isGetPageInteractablesToolRequestMessageGuard = createRuntimeMessageGuard<GetPageInteractablesToolRequestMessage>(
  getPageInteractablesToolRequestType,
);

/**
 * Type guard that checks if an unknown value is a GetPageInteractablesToolRequestMessage.
 *
 * @param message - The value to check.
 * @returns True if the message is a GetPageInteractablesToolRequestMessage.
 */
export function isGetPageInteractablesToolRequestMessage(message: unknown): message is GetPageInteractablesToolRequestMessage {
  return isGetPageInteractablesToolRequestMessageGuard(message);
}

export type PageActionName = 'mouse_move' | 'click' | 'type' | 'scroll' | 'drag';

/**
 * Payload sent from LLM page action tools to the content-script executor.
 */
export interface PageActionToolRequestPayload {
  action: PageActionName;
  sid?: string;
  ref?: string;
  fromRef?: string;
  toRef?: string;
  text?: string;
  clear?: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

/**
 * Measurable state captured around a page action target.
 */
export interface PageActionElementState {
  checked?: boolean;
  expanded?: boolean;
  pressed?: boolean;
  value?: string;
  text?: string;
}

/**
 * Scroll telemetry returned after a page scroll action.
 */
export interface PageActionScrollState {
  target: 'window' | 'element';
  ref?: string;
  fallback?: boolean;
  leftBefore: number;
  leftAfter: number;
  topBefore: number;
  topAfter: number;
  scrolled: boolean;
}

/**
 * Result returned by content-script page action execution.
 */
export interface PageActionToolResult {
  ok: boolean;
  action: PageActionName;
  ref?: string;
  error?: string;
  changed?: boolean;
  stateBefore?: PageActionElementState;
  stateAfter?: PageActionElementState;
  scroll?: PageActionScrollState;
}

/**
 * Message type identifier for page action tool requests.
 */
export const pageActionToolRequestType = 'chatbrowserx.tool.page-action.request';

/**
 * Message sent to execute a minimal page action in the content script.
 */
export interface PageActionToolRequestMessage
  extends RuntimeMessage<typeof pageActionToolRequestType>, PageActionToolRequestPayload {}

const isPageActionToolRequestMessageGuard = createRuntimeMessageGuard<PageActionToolRequestMessage>(
  pageActionToolRequestType,
);

/**
 * Type guard that checks if an unknown value is a PageActionToolRequestMessage.
 *
 * @param message - The value to check.
 * @returns True if the message is a PageActionToolRequestMessage.
 */
export function isPageActionToolRequestMessage(message: unknown): message is PageActionToolRequestMessage {
  return isPageActionToolRequestMessageGuard(message);
}
