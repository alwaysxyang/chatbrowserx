import {
  getPageElementsToolRequestType,
  type GetPageElementsToolPayload,
} from '../../shared/types/tools';
import { sendToolMessage } from './shared/tab-message-tool';
import { createObjectToolDefinition } from './shared/tool-definition';
import { registerTool, type LlmToolModule } from './tool-registry';

/**
 * Creates the current-page element snapshot LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createGetPageElementsTool(): LlmToolModule {
  return {
    name: () => 'get_current_page_elements',
    definition: () => createObjectToolDefinition(
      'get_current_page_elements',
      'Return a compact snapshot of visible elements in the CURRENT viewport, including readable roles such as heading/text and action capability flags in meta such as op=true for operable targets, w=true for writable targets, and s for scrollable areas. For page analysis, treat this as what is currently visible like a human reading the page. Do not click navigation, outline, menu, toolbar, or AI summary controls just to discover content. If the snapshot contains only visible navigation or outline entries and not enough body text, scroll the relevant scrollarea instead of clicking those entries. Avoid unnecessary repeated snapshots for the same unchanged viewport. Refresh after page actions such as page_scroll, page_click, page_type, or page_drag, when enough time has passed for async updates, or when a fresh snapshot is necessary for correctness. For whole-page or document-level analysis, do not conclude from one partial viewport when the page or a scrollarea may continue. If the current snapshot is not enough to answer and a page or scrollarea can continue, use page_scroll, then call this tool again before concluding. For specific targeted questions, continue this observe-scroll-observe loop until scrolling no longer reveals new relevant content or the requested answer is found. For whole-page or document-level analysis requests such as analyzing, summarizing, or reading the current page, do not produce the final answer while the latest page_scroll result still has canScrollMore=true; keep scrolling and refreshing until you have bottom proof from page_scroll: canScrollMore=false or scrolled=false, unless the user explicitly asks only about the current viewport or a specific visible answer. During linear page analysis, keep a stable scan direction and do not bounce between down and up unless the user asks to go back or you must return to a previously seen target. Use this before page actions, and call page_scroll yourself when more content may be offscreen. This tool does not click, type, scroll, navigate, or auto-scroll. Output shape: { v:[viewportWidth,viewportHeight], sid:string, items:[[ref,role,name,[x,y,width,height],meta?]] }.',
    ),
    invoke: async (context) => {
      return await sendToolMessage<GetPageElementsToolPayload>(context, {
        type: getPageElementsToolRequestType,
      });
    },
  };
}

registerTool(createGetPageElementsTool());
