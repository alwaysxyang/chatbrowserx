import {type GetPageInteractablesToolPayload, getPageInteractablesToolRequestType,} from '../../shared/types/tool';
import {getActiveTabId} from './shared/active-tab';
import {type LlmToolModule, registerTool} from './tool-registry';

/**
 * Creates the current-page interactables snapshot LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createGetPageInteractablesTool(): LlmToolModule {
  return {
    name: () => 'get_current_page_interactables',
    definition: () => ({
      type: 'function',
      function: {
        name: 'get_current_page_interactables',
        description:
          'Return a compact read-only snapshot of interactable elements in the CURRENT viewport. Use it to identify visible controls before action planning. It does not click, type, scroll, or navigate. Output shape: { v:[viewportWidth,viewportHeight], sid:string, items:[[ref,role,name,[x,y,width,height],meta?]] }.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    }),
    invoke: async () => {
      const tabId = await getActiveTabId();
      return await chrome.tabs.sendMessage(tabId, {
        type: getPageInteractablesToolRequestType,
      }) as GetPageInteractablesToolPayload;
    },
  };
}

registerTool(createGetPageInteractablesTool());
