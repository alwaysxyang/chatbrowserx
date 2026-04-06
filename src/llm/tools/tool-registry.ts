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
  definition: () => ToolDefinition;
  invoke: (argumentsObject: Record<string, unknown>) => Promise<string> | string;
}

export interface ToolRegistry {
  getDefinitions: () => ToolDefinition[];
  getTool: (name: string) => LlmToolModule | undefined;
  addTool: (tool: LlmToolModule) => void;
}

export function createToolRegistry(): ToolRegistry {
  const toolMap = new Map<string, LlmToolModule>();

  return {
    getDefinitions: () => Array.from(toolMap.values()).map((tool) => tool.definition()),
    getTool: (name) => toolMap.get(name),
    addTool: (tool) => {
      toolMap.set(tool.name(), tool);
    },
  };
}

function getOrCreateDefaultToolRegistry(): ToolRegistry {
  const scopedGlobal = globalThis as typeof globalThis & {
    __chatbrowserxDefaultToolRegistry?: ToolRegistry;
  };

  if (!scopedGlobal.__chatbrowserxDefaultToolRegistry) {
    scopedGlobal.__chatbrowserxDefaultToolRegistry = createToolRegistry();
  }

  return scopedGlobal.__chatbrowserxDefaultToolRegistry;
}

export function getDefaultToolRegistry(): ToolRegistry {
  return getOrCreateDefaultToolRegistry();
}

export function registerTool(tool: LlmToolModule): void {
  getDefaultToolRegistry().addTool(tool);
}

export function createDefaultToolRegistry(): ToolRegistry {
  return getDefaultToolRegistry();
}

import './get-page-content-tool';
