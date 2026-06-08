export type ToolInvokeResult = unknown;

export interface InvokeContext {
  /** Fixed tab id used by browser page tools during this tool invocation. */
  pageToolTabId?: number;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmToolModule {
  name: () => string;
  definition: () => Promise<ToolDefinition | null> | ToolDefinition | null;
  invoke: (
    context: InvokeContext | undefined,
    argumentsObject: Record<string, unknown>,
  ) => Promise<ToolInvokeResult> | ToolInvokeResult;
}

export interface ToolRegistry {
  getDefinitions: () => Promise<ToolDefinition[]>;
  getTool: (name: string) => LlmToolModule | undefined;
  addTool: (tool: LlmToolModule) => void;
}

/**
 * Creates an isolated in-memory registry for LLM tools.
 *
 * @returns A registry that can collect definitions and dispatch tool modules by name.
 */
export function createToolRegistry(): ToolRegistry {
  const toolMap = new Map<string, LlmToolModule>();

  return {
    getDefinitions: async () => {
      const definitions = await Promise.all(Array.from(toolMap.values()).map((tool) => tool.definition()));
      return definitions.filter((definition): definition is ToolDefinition => definition !== null);
    },
    getTool: (name) => toolMap.get(name),
    addTool: (tool) => {
      toolMap.set(tool.name(), tool);
    },
  };
}

/**
 * Returns the existing default registry or creates it for this process.
 *
 * @returns The process-wide default registry instance.
 */
function getOrCreateDefaultToolRegistry(): ToolRegistry {
  const scopedGlobal = globalThis as typeof globalThis & {
    __chatbrowserxDefaultToolRegistry?: ToolRegistry;
  };

  if (!scopedGlobal.__chatbrowserxDefaultToolRegistry) {
    scopedGlobal.__chatbrowserxDefaultToolRegistry = createToolRegistry();
  }

  return scopedGlobal.__chatbrowserxDefaultToolRegistry;
}

/**
 * Returns the process-wide default tool registry.
 *
 * @returns The default registry shared by tool module side-effect registration.
 */
export function getDefaultToolRegistry(): ToolRegistry {
  return getOrCreateDefaultToolRegistry();
}

/**
 * Registers one LLM tool in the default registry.
 *
 * @param tool - The tool module to expose to the orchestrator.
 */
export function registerTool(tool: LlmToolModule): void {
  getDefaultToolRegistry().addTool(tool);
}

/**
 * Returns the default registry after tool modules have registered themselves.
 *
 * @returns The default registry instance.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  return getDefaultToolRegistry();
}

import './get-page-elements';
import './get-page-content';
import './page-actions';
import './browser-tabs';
import './tavily';
