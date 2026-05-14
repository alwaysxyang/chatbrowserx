import { describe, expect, it } from 'vitest';
import {
  createDefaultToolRegistry,
  createToolRegistry,
  registerTool,
  type LlmToolModule,
} from '../../../src/llm/tools/tool-registry';

describe('tool registry', () => {
  it('returns definitions and resolves tools by name', async () => {
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

    const registry = createToolRegistry();
    registry.addTool(echoTool);

    await expect(registry.getDefinitions()).resolves.toEqual([echoTool.definition()]);
    expect(registry.getTool('echo')).toBe(echoTool);
    expect(registry.getTool('missing')).toBeUndefined();
  });

  it('filters out null tool definitions', async () => {
    const hiddenTool: LlmToolModule = {
      name: () => 'hidden',
      definition: async () => null,
      invoke: async () => 'hidden',
    };

    const registry = createToolRegistry();
    registry.addTool(hiddenTool);

    await expect(registry.getDefinitions()).resolves.toEqual([]);
    expect(registry.getTool('hidden')).toBe(hiddenTool);
  });

  it('defaults to an empty registry', async () => {
    const registry = createToolRegistry();

    await expect(registry.getDefinitions()).resolves.toEqual([]);
    expect(registry.getTool('anything')).toBeUndefined();
  });

  it('registers default tool modules', async () => {
    const registry = createDefaultToolRegistry();

    expect(registry.getTool('get_current_page_content')).toBeUndefined();
    expect(registry.getTool('get_current_page_interactables')).toBeUndefined();
    expect(registry.getTool('get_current_page_elements')).toBeDefined();
    expect(registry.getTool('page_click')).toBeDefined();
    expect(registry.getTool('page_type')).toBeDefined();
    expect(registry.getTool('page_scroll')).toBeDefined();
    expect(registry.getTool('tavily_search')).toBeDefined();

    const definitions = await registry.getDefinitions();
    expect(definitions.map((definition) => definition.function.name)).not.toContain('get_current_page_content');
    expect(definitions.map((definition) => definition.function.name)).not.toContain('get_current_page_interactables');
    expect(definitions.map((definition) => definition.function.name)).toContain('get_current_page_elements');
    expect(definitions.map((definition) => definition.function.name)).not.toContain('tavily_search');
  });

  it('allows tool modules to register themselves into the global registry', async () => {
    registerTool({
      name: () => 'echo_registered',
      definition: () => ({
        type: 'function',
        function: {
          name: 'echo_registered',
          description: 'Echoes registered text',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      }),
      invoke: async () => 'ok',
    });

    const registry = createDefaultToolRegistry();

    expect(registry.getTool('echo_registered')).toBeDefined();
    await expect(registry.getTool('echo_registered')?.invoke({})).resolves.toBe('ok');
  });
});
