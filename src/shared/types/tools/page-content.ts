import type { RuntimeMessage } from '../runtime-messages';
import { createRuntimeMessageGuard } from '../runtime-messages';

/**
 * Payload containing current page text content for read-only LLM analysis.
 */
export interface GetPageContentToolPayload {
  title: string;
  url: string;
  content: string;
}

/**
 * Message type identifier for current page content tool requests.
 */
export const getPageContentToolRequestType = 'chatbrowserx.tool.get-page-content.request';

/**
 * Message sent by the LLM tool layer to request current page content from a content script.
 */
export interface GetPageContentToolRequestMessage extends RuntimeMessage<typeof getPageContentToolRequestType> {}

const isGetPageContentToolRequestMessageGuard = createRuntimeMessageGuard<GetPageContentToolRequestMessage>(
  getPageContentToolRequestType,
);

/**
 * Checks whether a runtime message is a current page content tool request.
 *
 * @param message - Runtime message candidate.
 * @returns True when the message requests current page content.
 */
export function isGetPageContentToolRequestMessage(message: unknown): message is GetPageContentToolRequestMessage {
  return isGetPageContentToolRequestMessageGuard(message);
}
