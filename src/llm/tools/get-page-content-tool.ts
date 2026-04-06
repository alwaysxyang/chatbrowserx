import {
  getPageContentToolRequestType,
  type GetPageContentToolPayload,
} from '../../shared/types/runtime-messages';
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
        description: 'Get the current webpage title, url, and visible text content.',
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
