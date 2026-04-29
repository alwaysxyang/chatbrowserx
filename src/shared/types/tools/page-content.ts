import type { RuntimeMessage } from '../runtime-messages';
import { createRuntimeMessageGuard } from '../runtime-messages';

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
 * @param message - The value to check.
 * @returns True if the message is a GetPageContentToolRequestMessage.
 */
export function isGetPageContentToolRequestMessage(message: unknown): message is GetPageContentToolRequestMessage {
  return isGetPageContentToolRequestMessageGuard(message);
}
