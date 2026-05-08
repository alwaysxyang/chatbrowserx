import type { RuntimeMessage } from '../runtime-messages';
import { createRuntimeMessageGuard } from '../runtime-messages';

export type PageActionName = 'mouse_move' | 'click' | 'type' | 'scroll' | 'drag';

/**
 * Allowed scroll directions for page action protocol messages and LLM tool schemas.
 */
export const pageActionDirections = ['up', 'down', 'left', 'right'] as const;

export type PageActionDirection = typeof pageActionDirections[number];

/**
 * Checks whether an unknown value is a supported page action scroll direction.
 *
 * @param value - The value to inspect.
 * @returns True when the value is a PageActionDirection.
 */
export function isPageActionDirection(value: unknown): value is PageActionDirection {
  return typeof value === 'string' && pageActionDirections.includes(value as PageActionDirection);
}

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
  direction?: PageActionDirection;
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
