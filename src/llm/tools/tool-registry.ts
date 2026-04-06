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
}

export function createToolRegistry(tools: LlmToolModule[] = []): ToolRegistry {
  const toolMap = new Map<string, LlmToolModule>();

  tools.forEach((tool) => {
    toolMap.set(tool.name(), tool);
  });

  return {
    getDefinitions: () => tools.map((tool) => tool.definition()),
    getTool: (name) => toolMap.get(name),
  };
}