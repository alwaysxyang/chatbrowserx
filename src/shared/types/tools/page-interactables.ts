import type { RuntimeMessage } from '../runtime-messages';
import { createRuntimeMessageGuard } from '../runtime-messages';

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
