import {
  getPageContentToolRequestType,
  type GetPageContentToolPayload,
} from '../../shared/types/tool';
import { registerTool, type LlmToolModule } from './tool-registry';

async function getActiveTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;

  if (tabId == null) {
    throw new Error('TOOL_TAB_UNAVAILABLE');
  }

  return tabId;
}

export function createGetPageContentTool(
): LlmToolModule {
  return {
    name: () => 'get_current_page_content',
    definition: () => ({
      type: 'function',
      function: {
        name: 'get_current_page_content',
        description: 'Get the title, URL, and visible text content of the CURRENT browser tab that the user is viewing right now. Use this tool only for read-only analysis of the current page, such as summarizing, explaining, extracting, reviewing, or answering questions about content already shown on the page. Do not use this tool for page actions or action planning. If the task involves clicking, typing, selecting, dragging, opening menus, submitting forms, navigating, or any other page manipulation, do not call this tool for that purpose. ONLY use this tool when the user explicitly asks about "this page", "current page", "this website", or refers to content they are currently looking at in their browser. DO NOT use this tool for general search queries, web searches, or questions about websites other than the current page.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    }),
    invoke: async () => {
      const tabId = await getActiveTabId();
      const response = await chrome.tabs.sendMessage(tabId, {
        type: getPageContentToolRequestType,
      }) as GetPageContentToolPayload;

      return response;
    },
  };
}

registerTool(createGetPageContentTool());
