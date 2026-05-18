import { getActiveTabId } from './active-tab';
import type { InvokeContext } from '../tool-registry';

export type ToolTabResolver = (context?: InvokeContext) => Promise<number>;

export type ToolMessageSender = <TResponse>(
  context: InvokeContext | undefined,
  message: Record<string, unknown>,
) => Promise<TResponse>;

/**
 * Resolves the page tool tab from invocation context, falling back to the active tab.
 *
 * @param context - Tool invocation context.
 * @returns The tab id to receive the page tool message.
 */
export async function resolveToolTabId(context?: InvokeContext): Promise<number> {
  return context?.pageToolTabId ?? await getActiveTabId();
}

/**
 * Creates a tool message sender backed by a tab resolver.
 *
 * @param resolveTabId - Resolver that returns the target tab for the current tool context.
 * @returns A message sender that targets the resolved tab.
 */
export function createToolMessageSender(resolveTabId: ToolTabResolver): ToolMessageSender {
  return async <TResponse>(
    context: InvokeContext | undefined,
    message: Record<string, unknown>,
  ): Promise<TResponse> => {
    const tabId = await resolveTabId(context);
    return await chrome.tabs.sendMessage(tabId, message) as TResponse;
  };
}

/**
 * Sends a tool request message to the invocation-context tab or active tab fallback.
 *
 * @param context - Optional tool invocation context.
 * @param message - Runtime message payload for the content script.
 * @returns The typed content-script response.
 */
export const sendToolMessage = createToolMessageSender(resolveToolTabId);
