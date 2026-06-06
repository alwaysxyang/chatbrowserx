import {
  isPageActionDirection,
  pageActionToolRequestType,
  pageActionDirections,
  type PageActionToolRequestPayload,
  type PageActionToolResult,
} from '../../../shared/types/tools';
import {
  readOptionalBoolean,
  readOptionalPositiveNumber,
  readOptionalRawString,
  readRequiredRawString,
} from '../shared/tool-arguments';
import { sendToolMessage } from '../shared/tab-message-tool';
import { createObjectToolDefinition } from '../shared/tool-definition';
import { registerTool, type InvokeContext, type LlmToolModule } from '../tool-registry';

type ToolArgumentReader = (args: Record<string, unknown>) => PageActionToolRequestPayload;

interface PageActionToolConfig {
  name: string;
  description: string;
  properties: Record<string, unknown>;
  required: string[];
  readPayload: ToolArgumentReader;
}

/**
 * Sends a page action request to the context tab or active tab fallback.
 *
 * @param context - Optional tool invocation context.
 * @param payload - The page action payload.
 * @returns The action result.
 */
async function invokePageAction(
  context: InvokeContext | undefined,
  payload: PageActionToolRequestPayload,
): Promise<PageActionToolResult> {
  return await sendToolMessage<PageActionToolResult>(context, {
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
    invoke: async (context, args = {}) => invokePageAction(context, config.readPayload(args)),
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
    description: 'Move the visible virtual mouse to a current-page operable element by snapshot id and ref. Use only refs from get_current_page_elements items whose meta has op=true. Does not click or type.',
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
    description: 'Click a current-page operable element by snapshot id and ref. Use only refs from get_current_page_elements items whose meta has op=true; heading/text items are read-only and will be rejected. For read-only page analysis, do not click navigation, outline, menu, toolbar, or AI summary controls just to discover content; use get_current_page_elements and page_scroll instead. If this tool returns PAGE_ACTION_SNAPSHOT_EXPIRED, call get_current_page_elements and retry with the latest sid/ref only if the action is still necessary. Returns measurable before/after state when available, such as checked/expanded/pressed, and treats removed or hidden popup targets as changed=true so use the result to verify whether the click worked. Does not accept raw coordinates.',
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
    description: 'Type text into a current-page writable element by snapshot id and ref. Use only refs from get_current_page_elements items whose meta has w=true. Do not type into comboboxes or readonly picker surfaces; click them to open choices. Set clear=true to replace existing content. Returns before/after input state when available, so use the result to verify whether text was written.',
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
    description: 'Scroll the current page or a target scrollarea by ref. Pass sid/ref from get_current_page_elements when a scrollarea should be scrolled. Without a ref, this scrolls the container under the viewport center or the window; with a ref, fallback follows that target ancestor chain and does not switch to unrelated scrollareas. For dropdown/listbox/menu/cascader/picker option searches, scroll the popup/list scrollarea when the desired option is not visible; refresh elements after each scroll, and stop instead of clicking nearby options when scrolled=false or canScrollMore=false. Prefer omitting amount so the content script scrolls a human-sized portion of the visible area. If amount is provided, infer it from the current viewport or target scrollarea visible height and avoid jumping past content. Returns the actual scroll target, before/after scroll positions, scrolled=true/false, and canScrollMore=true/false for the requested direction. After scrolling, call get_current_page_elements again before choosing the next click/type/drag target, because visible refs may have changed. If scrolled=true, do not answer from the pre-scroll snapshot; refresh the elements first and continue analysis from the new viewport. After scrolled=false, refreshing is usually unnecessary unless async content may have changed, enough time has passed, another action changes the page, or a fresh snapshot is needed for correctness. For whole-page analysis, keep a stable scan direction and continue the observe-scroll-observe loop while canScrollMore=true; treat canScrollMore=false as the end for that direction. For whole-page or document-level analysis requests, do not produce the final answer while canScrollMore=true; keep scrolling and refreshing until page_scroll returns bottom proof: canScrollMore=false or scrolled=false, unless the user explicitly asks only about the current viewport or a specific visible answer. During linear page analysis, do not alternate between down and up. Use the opposite direction only when the user explicitly asks to go back, when returning to a previously seen target, or when the task is specifically above the viewport. This tool does not accept raw coordinates.',
    properties: {
      sid: { type: 'string' },
      ref: { type: 'string' },
      direction: { type: 'string', enum: pageActionDirections },
      amount: {
        type: 'number',
        description: 'Optional. Prefer omitting amount. When setting it, infer a human-sized distance from the current viewport or target scrollarea visible height, and avoid jumping past content.',
      },
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
    description: 'Drag from one current-page operable element ref to another within the latest snapshot id. Use only refs from get_current_page_elements items whose meta has op=true. Does not accept raw coordinates.',
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
