import {
  getPageContentToolRequestType,
  type GetPageContentToolPayload,
} from '../../../shared/types/tools';
import { sendToolMessage } from '../shared/tab-message-tool';
import { createObjectToolDefinition } from '../shared/tool-definition';
import { registerTool, type LlmToolModule } from '../tool-registry';

const getCurrentPageContentDescription = [
  'Read the current page title, URL, and visible text content from the invocation tab for read-only page analysis.',
  'Use this when the user asks to analyze, summarize, explain, extract from, review, or answer questions about the current page.',
  'The content script may scroll the page while reading text and should restore the original scroll position afterward.',
  'Do not call this tool when the user request involves page operations such as clicking, typing, selecting, dragging, scrolling, submitting forms, navigation, or action planning; use get_current_page_elements and page action tools for those tasks.',
  'This tool returns text only and does not return page HTML, screenshots, or image pixels.',
].join(' ');

/**
 * Creates the current-page content reader LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createGetPageContentTool(): LlmToolModule {
  return {
    name: () => 'get_current_page_content',
    definition: () => createObjectToolDefinition('get_current_page_content', getCurrentPageContentDescription),
    invoke: async (context) => {
      return await sendToolMessage<GetPageContentToolPayload>(context, {
        type: getPageContentToolRequestType,
      });
    },
  };
}

registerTool(createGetPageContentTool());
