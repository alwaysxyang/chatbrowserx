import {
  getPageInteractablesToolRequestType,
  type GetPageInteractablesToolPayload,
} from '../../shared/types/tools';
import { sendActiveTabToolMessage } from './shared/tab-message-tool';
import { createObjectToolDefinition } from './shared/tool-definition';
import { registerTool, type LlmToolModule } from './tool-registry';

/**
 * Creates the current-page interactables snapshot LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createGetPageInteractablesTool(): LlmToolModule {
  return {
    name: () => 'get_current_page_interactables',
    definition: () => createObjectToolDefinition(
      'get_current_page_interactables',
      'Return a compact read-only snapshot of interactable elements in the CURRENT viewport. Use it to identify visible controls before action planning. It does not click, type, scroll, or navigate. Output shape: { v:[viewportWidth,viewportHeight], sid:string, items:[[ref,role,name,[x,y,width,height],meta?]] }.',
    ),
    invoke: async () => {
      return await sendActiveTabToolMessage<GetPageInteractablesToolPayload>({
        type: getPageInteractablesToolRequestType,
      });
    },
  };
}

registerTool(createGetPageInteractablesTool());
