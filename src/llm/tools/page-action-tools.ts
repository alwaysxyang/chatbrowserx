import {
  pageActionToolRequestType,
  type PageActionToolRequestPayload,
  type PageActionToolResult,
} from '../../shared/types/tools';
import {
  readOptionalBoolean,
  readOptionalPositiveNumber,
  readOptionalRawString,
  readRequiredRawString,
} from './shared/tool-arguments';
import { sendActiveTabToolMessage } from './shared/tab-message-tool';
import { registerTool, type LlmToolModule, type ToolDefinition } from './tool-registry';

/**
 * Sends a page action request to the active tab content script.
 *
 * @param payload - The page action payload.
 * @returns The action result.
 */
async function invokePageAction(
  payload: PageActionToolRequestPayload,
): Promise<PageActionToolResult> {
  return await sendActiveTabToolMessage<PageActionToolResult>({
    type: pageActionToolRequestType,
    ...payload,
  });
}

/**
 * Builds a page action tool definition.
 *
 * @param name - The public LLM tool name.
 * @param description - The public LLM tool description.
 * @param properties - The JSON schema properties.
 * @param required - Required property names.
 * @returns A tool definition.
 */
function buildDefinition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

/**
 * Creates the virtual mouse move page action tool.
 *
 * @returns The LLM tool module.
 */
export function createPageMouseMoveTool(): LlmToolModule {
  return {
    name: () => 'page_mouse_move',
    definition: () => buildDefinition(
      'page_mouse_move',
      'Move the visible virtual mouse to a current-page interactable by snapshot id and ref. Use sid and refs from get_current_page_interactables. Does not click or type.',
      { sid: { type: 'string' }, ref: { type: 'string' } },
      ['sid', 'ref'],
    ),
    invoke: async (args) => invokePageAction({
      action: 'mouse_move',
      sid: readRequiredRawString(args, 'sid'),
      ref: readRequiredRawString(args, 'ref'),
    }),
  };
}

/**
 * Creates the ref-based page click tool.
 *
 * @returns The LLM tool module.
 */
export function createPageClickTool(): LlmToolModule {
  return {
    name: () => 'page_click',
    definition: () => buildDefinition(
      'page_click',
      'Click a current-page interactable by snapshot id and ref. Use sid and refs from get_current_page_interactables. Returns measurable before/after state when available, such as checked/expanded/pressed, so use the result to verify whether the click worked. Does not accept raw coordinates.',
      { sid: { type: 'string' }, ref: { type: 'string' } },
      ['sid', 'ref'],
    ),
    invoke: async (args) => invokePageAction({
      action: 'click',
      sid: readRequiredRawString(args, 'sid'),
      ref: readRequiredRawString(args, 'ref'),
    }),
  };
}

/**
 * Creates the ref-based page typing tool.
 *
 * @returns The LLM tool module.
 */
export function createPageTypeTool(): LlmToolModule {
  return {
    name: () => 'page_type',
    definition: () => buildDefinition(
      'page_type',
      'Type text into a current-page input-like element by snapshot id and ref. Use sid and refs from get_current_page_interactables. Set clear=true to replace existing content. Returns before/after input state when available, so use the result to verify whether text was written.',
      {
        sid: { type: 'string' },
        ref: { type: 'string' },
        text: { type: 'string' },
        clear: { type: 'boolean' },
      },
      ['sid', 'ref', 'text'],
    ),
    invoke: async (args) => invokePageAction({
      action: 'type',
      sid: readRequiredRawString(args, 'sid'),
      ref: readRequiredRawString(args, 'ref'),
      text: readRequiredRawString(args, 'text'),
      clear: readOptionalBoolean(args, 'clear'),
    }),
  };
}

/**
 * Creates the current-page scroll tool.
 *
 * @returns The LLM tool module.
 */
export function createPageScrollTool(): LlmToolModule {
  return {
    name: () => 'page_scroll',
    definition: () => buildDefinition(
      'page_scroll',
      'Scroll the current page or a target scrollarea by ref. Pass sid/ref from get_current_page_interactables when a scrollarea should be scrolled. Returns the actual scroll target, before/after scroll positions, and scrolled=true/false. After scrolling, call get_current_page_interactables again before choosing the next click/type/drag target, because visible refs may have changed. This tool does not accept raw coordinates.',
      {
        sid: { type: 'string' },
        ref: { type: 'string' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        amount: { type: 'number' },
      },
      ['direction'],
    ),
    invoke: async (args) => {
      const direction = readRequiredRawString(args, 'direction');
      if (!['up', 'down', 'left', 'right'].includes(direction)) {
        throw new Error('TOOL_ARGUMENT_INVALID:direction');
      }
      const payload: PageActionToolRequestPayload = {
        action: 'scroll',
        direction: direction as PageActionToolRequestPayload['direction'],
        amount: readOptionalPositiveNumber(args, 'amount'),
      };
      const sid = readOptionalRawString(args, 'sid');
      const ref = readOptionalRawString(args, 'ref');
      if (sid) payload.sid = sid;
      if (ref) payload.ref = ref;
      return invokePageAction(payload);
    },
  };
}

/**
 * Creates the ref-based page drag tool.
 *
 * @returns The LLM tool module.
 */
export function createPageDragTool(): LlmToolModule {
  return {
    name: () => 'page_drag',
    definition: () => buildDefinition(
      'page_drag',
      'Drag from one current-page interactable ref to another within the latest snapshot id. Use sid and refs from get_current_page_interactables. Does not accept raw coordinates.',
      {
        sid: { type: 'string' },
        fromRef: { type: 'string' },
        toRef: { type: 'string' },
      },
      ['sid', 'fromRef', 'toRef'],
    ),
    invoke: async (args) => invokePageAction({
      action: 'drag',
      sid: readRequiredRawString(args, 'sid'),
      fromRef: readRequiredRawString(args, 'fromRef'),
      toRef: readRequiredRawString(args, 'toRef'),
    }),
  };
}

registerTool(createPageMouseMoveTool());
registerTool(createPageClickTool());
registerTool(createPageTypeTool());
registerTool(createPageScrollTool());
registerTool(createPageDragTool());
