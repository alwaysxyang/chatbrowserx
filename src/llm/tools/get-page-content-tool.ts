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
        description: 'Get the title, URL, and visible text content of the CURRENT browser tab that the user is viewing right now. ONLY use this tool when the user explicitly asks about "this page", "current page", "this website", or refers to content they are currently looking at in their browser. DO NOT use this tool for general search queries, web searches, or questions about other websites.',
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

      return JSON.stringify(response);
    },
  };
}

registerTool(createGetPageContentTool());
