import { describe, expect, it } from 'vitest';
import { createToolRegistry, type LlmToolModule } from '../../../src/llm/tools/tool-registry';

describe('tool registry', () => {
  it('returns definitions and resolves tools by name', () => {
    const echoTool: LlmToolModule = {
      name: () => 'echo',
      definition: () => ({
        type: 'function',
        function: {
          name: 'echo',
          description: 'Echoes text back',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string' },
            },
            required: ['text'],
          },
        },
      }),
      invoke: async ({ text }) => JSON.stringify({ echoed: text }),
    };

    const registry = createToolRegistry([echoTool]);

    expect(registry.getDefinitions()).toEqual([echoTool.definition()]);
    expect(registry.getTool('echo')).toBe(echoTool);
    expect(registry.getTool('missing')).toBeUndefined();
  });

  it('defaults to an empty registry', () => {
    const registry = createToolRegistry();

    expect(registry.getDefinitions()).toEqual([]);
    expect(registry.getTool('anything')).toBeUndefined();
  });
});
