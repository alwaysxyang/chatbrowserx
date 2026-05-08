import {
  isPageActionDirection,
  pageActionToolRequestType,
  pageActionDirections,
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
import { createObjectToolDefinition } from './shared/tool-definition';
import { registerTool, type LlmToolModule } from './tool-registry';

type ToolArgumentReader = (args: Record<string, unknown>) => PageActionToolRequestPayload;

interface PageActionToolConfig {
  name: string;
  description: string;
  properties: Record<string, unknown>;
  required: string[];
  readPayload: ToolArgumentReader;
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
  return await sendActiveTabToolMessage<PageActionToolResult>({
    type: pageActionToolRequestType,
    ...payload,
  });
}

/**
 * Creates an LLM tool module from a page action configuration.
 *
 * @param config - The tool definition and argument reader.
 * @returns The LLM tool module.
 */
function createPageActionTool(config: PageActionToolConfig): LlmToolModule {
  return {
    name: () => config.name,
    definition: () => createObjectToolDefinition(config.name, config.description, config.properties, config.required),
    invoke: async (args) => invokePageAction(config.readPayload(args)),
  };
}

/**
 * Reads sid/ref arguments for ref-based page actions.
 *
 * @param args - Raw tool arguments.
 * @param action - The page action name.
 * @returns The page action request payload.
 */
function readRefActionPayload(args: Record<string, unknown>, action: PageActionToolRequestPayload['action']): PageActionToolRequestPayload {
  return {
    action,
    sid: readRequiredRawString(args, 'sid'),
    ref: readRequiredRawString(args, 'ref'),
  };
}

/**
 * Creates the virtual mouse move page action tool.
 *
 * @returns The LLM tool module.
 */
export function createPageMouseMoveTool(): LlmToolModule {
  return createPageActionTool({
    name: 'page_mouse_move',
    description: 'Move the visible virtual mouse to a current-page interactable by snapshot id and ref. Use sid and refs from get_current_page_interactables. Does not click or type.',
    properties: { sid: { type: 'string' }, ref: { type: 'string' } },
    required: ['sid', 'ref'],
    readPayload: (args) => readRefActionPayload(args, 'mouse_move'),
  });
}

/**
 * Creates the ref-based page click tool.
 *
 * @returns The LLM tool module.
 */
export function createPageClickTool(): LlmToolModule {
  return createPageActionTool({
    name: 'page_click',
    description: 'Click a current-page interactable by snapshot id and ref. Use sid and refs from get_current_page_interactables. Returns measurable before/after state when available, such as checked/expanded/pressed, so use the result to verify whether the click worked. Does not accept raw coordinates.',
    properties: { sid: { type: 'string' }, ref: { type: 'string' } },
    required: ['sid', 'ref'],
    readPayload: (args) => readRefActionPayload(args, 'click'),
  });
}

/**
 * Creates the ref-based page typing tool.
 *
 * @returns The LLM tool module.
 */
export function createPageTypeTool(): LlmToolModule {
  return createPageActionTool({
    name: 'page_type',
    description: 'Type text into a current-page input-like element by snapshot id and ref. Use sid and refs from get_current_page_interactables. Set clear=true to replace existing content. Returns before/after input state when available, so use the result to verify whether text was written.',
    properties: {
      sid: { type: 'string' },
      ref: { type: 'string' },
      text: { type: 'string' },
      clear: { type: 'boolean' },
    },
    required: ['sid', 'ref', 'text'],
    readPayload: (args) => ({
      action: 'type',
      sid: readRequiredRawString(args, 'sid'),
      ref: readRequiredRawString(args, 'ref'),
      text: readRequiredRawString(args, 'text'),
      clear: readOptionalBoolean(args, 'clear'),
    }),
  });
}

/**
 * Reads scroll tool arguments into a page action payload.
 *
 * @param args - Raw tool arguments.
 * @returns The scroll action payload.
 */
function readScrollActionPayload(args: Record<string, unknown>): PageActionToolRequestPayload {
  const direction = readRequiredRawString(args, 'direction');
  if (!isPageActionDirection(direction)) {
    throw new Error('TOOL_ARGUMENT_INVALID:direction');
  }
  const payload: PageActionToolRequestPayload = {
    action: 'scroll',
    direction,
    amount: readOptionalPositiveNumber(args, 'amount'),
  };
  const sid = readOptionalRawString(args, 'sid');
  const ref = readOptionalRawString(args, 'ref');
  if (sid) payload.sid = sid;
  if (ref) payload.ref = ref;
  return payload;
}

/**
 * Creates the current-page scroll tool.
 *
 * @returns The LLM tool module.
 */
export function createPageScrollTool(): LlmToolModule {
  return createPageActionTool({
    name: 'page_scroll',
    description: 'Scroll the current page or a target scrollarea by ref. Pass sid/ref from get_current_page_interactables when a scrollarea should be scrolled. Returns the actual scroll target, before/after scroll positions, and scrolled=true/false. After scrolling, call get_current_page_interactables again before choosing the next click/type/drag target, because visible refs may have changed. This tool does not accept raw coordinates.',
    properties: {
      sid: { type: 'string' },
      ref: { type: 'string' },
      direction: { type: 'string', enum: pageActionDirections },
      amount: { type: 'number' },
    },
    required: ['direction'],
    readPayload: readScrollActionPayload,
  });
}

/**
 * Creates the ref-based page drag tool.
 *
 * @returns The LLM tool module.
 */
export function createPageDragTool(): LlmToolModule {
  return createPageActionTool({
    name: 'page_drag',
    description: 'Drag from one current-page interactable ref to another within the latest snapshot id. Use sid and refs from get_current_page_interactables. Does not accept raw coordinates.',
    properties: {
      sid: { type: 'string' },
      fromRef: { type: 'string' },
      toRef: { type: 'string' },
    },
    required: ['sid', 'fromRef', 'toRef'],
    readPayload: (args) => ({
      action: 'drag',
      sid: readRequiredRawString(args, 'sid'),
      fromRef: readRequiredRawString(args, 'fromRef'),
      toRef: readRequiredRawString(args, 'toRef'),
    }),
  });
}

registerTool(createPageMouseMoveTool());
registerTool(createPageClickTool());
registerTool(createPageTypeTool());
registerTool(createPageScrollTool());
registerTool(createPageDragTool());
