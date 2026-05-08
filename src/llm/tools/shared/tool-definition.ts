import type { ToolDefinition } from '../tool-registry';

/**
 * Builds an object-parameter LLM function tool definition.
 *
 * @param name - Public LLM tool name.
 * @param description - Public LLM tool description.
 * @param properties - JSON schema properties for tool arguments.
 * @param required - Required argument names.
 * @returns A function tool definition.
 */
export function createObjectToolDefinition(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): ToolDefinition {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      },
    },
  };
}
