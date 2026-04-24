import {
  pageActionToolRequestType,
  type PageActionToolRequestPayload,
  type PageActionToolResult,
} from '../../shared/types/tool';
import { getActiveTabId } from './shared/active-tab';
import { registerTool, type LlmToolModule, type ToolDefinition } from './tool-registry';

/**
 * Reads a required string argument from a tool payload.
 *
 * @param args - The tool arguments object.
 * @param key - The argument key.
 * @returns The string value.
 */
function readRequiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }
  return value;
}

/**
 * Reads an optional boolean argument from a tool payload.
 *
 * @param args - The tool arguments object.
 * @param key - The argument key.
 * @returns The boolean value when present.
 */
function readOptionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }
  return value;
}

/**
 * Reads an optional string argument from a tool payload.
 *
 * @param args - The tool arguments object.
 * @param key - The argument key.
 * @returns The string value when present.
 */
function readOptionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }
  return value;
}

/**
 * Reads an optional positive numeric amount from a tool payload.
 *
 * @param args - The tool arguments object.
 * @returns The amount when present.
 */
function readOptionalAmount(args: Record<string, unknown>): number | undefined {
  const value = args.amount;
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('TOOL_ARGUMENT_INVALID:amount');
  }
  return value;
}

/**
 * Sends a page action request to the active tab content script.
 *
 * @param payload - The page action payload.
 * @returns The action result.
 */
async function invokePageAction(
  payload: PageActionToolRequestPayload,
): Promise<PageActionToolResult> {
  const tabId = await getActiveTabId();
  return await chrome.tabs.sendMessage(tabId, {
    type: pageActionToolRequestType,
    ...payload,
  }) as PageActionToolResult;
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
      sid: readRequiredString(args, 'sid'),
      ref: readRequiredString(args, 'ref'),
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
      sid: readRequiredString(args, 'sid'),
      ref: readRequiredString(args, 'ref'),
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
      sid: readRequiredString(args, 'sid'),
      ref: readRequiredString(args, 'ref'),
      text: readRequiredString(args, 'text'),
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
      const direction = readRequiredString(args, 'direction');
      if (!['up', 'down', 'left', 'right'].includes(direction)) {
        throw new Error('TOOL_ARGUMENT_INVALID:direction');
      }
      const payload: PageActionToolRequestPayload = {
        action: 'scroll',
        direction: direction as PageActionToolRequestPayload['direction'],
        amount: readOptionalAmount(args),
      };
      const sid = readOptionalString(args, 'sid');
      const ref = readOptionalString(args, 'ref');
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
      sid: readRequiredString(args, 'sid'),
      fromRef: readRequiredString(args, 'fromRef'),
      toRef: readRequiredString(args, 'toRef'),
    }),
  };
}

registerTool(createPageMouseMoveTool());
registerTool(createPageClickTool());
registerTool(createPageTypeTool());
registerTool(createPageScrollTool());
registerTool(createPageDragTool());
