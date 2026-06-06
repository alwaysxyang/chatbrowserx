import type { RuntimeMessage } from '../runtime-messages';
import { hasRuntimeMessageType } from '../runtime-messages';

/**
 * Compact payload containing visible page elements in the current viewport.
 */
export interface GetPageElementsToolPayload {
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
      op?: boolean;
      w?: boolean;
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
 * Message type identifier for page element snapshot tool requests.
 */
export const getPageElementsToolRequestType = 'chatbrowserx.tool.get-page-elements.request';

/**
 * Message sent to request current viewport page elements for tool use.
 */
export interface GetPageElementsToolRequestMessage extends RuntimeMessage<typeof getPageElementsToolRequestType> {}

/**
 * Type guard that checks if an unknown value is a GetPageElementsToolRequestMessage.
 *
 * @param message - The value to check.
 * @returns True if the message is a GetPageElementsToolRequestMessage.
 */
export function isGetPageElementsToolRequestMessage(message: unknown): message is GetPageElementsToolRequestMessage {
  return hasRuntimeMessageType(message, getPageElementsToolRequestType);
}
