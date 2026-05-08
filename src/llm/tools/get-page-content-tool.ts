import {
  getPageContentToolRequestType,
  type GetPageContentToolPayload,
} from '../../shared/types/tools';
import { sendActiveTabToolMessage } from './shared/tab-message-tool';
import { createObjectToolDefinition } from './shared/tool-definition';
import { registerTool, type LlmToolModule } from './tool-registry';

const getCurrentPageContentDescription = [
  'Get the title, URL, and visible text content of the CURRENT browser tab that the user is viewing right now.',
  'Use this tool only for read-only analysis of the current page, such as summarizing, explaining, extracting, reviewing, or answering questions about content already shown on the page.',
  'Do not use this tool for page actions or action planning.',
  'If the task involves clicking, typing, selecting, dragging, opening menus, submitting forms, navigating, or any other page manipulation, do not call this tool for that purpose.',
  'ONLY use this tool when the user explicitly asks about "this page", "current page", "this website", or refers to content they are currently looking at in their browser.',
  'DO NOT use this tool for general search queries, web searches, or questions about websites other than the current page.',
].join(' ');

/**
 * Creates the current-page content reader LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createGetPageContentTool(
): LlmToolModule {
  return {
    name: () => 'get_current_page_content',
    definition: () => createObjectToolDefinition('get_current_page_content', getCurrentPageContentDescription),
    invoke: async () => {
      const response = await sendActiveTabToolMessage<GetPageContentToolPayload>({
        type: getPageContentToolRequestType,
      });

      return response;
    },
  };
}

registerTool(createGetPageContentTool());
