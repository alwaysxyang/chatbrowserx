import { describe, expect, it } from 'vitest';
import {
  createDefaultToolRegistry,
  createToolRegistry,
  registerTool,
  type LlmToolModule,
} from '../../../src/llm/tools/tool-registry';

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

    const registry = createToolRegistry();
    registry.addTool(echoTool);

    expect(registry.getDefinitions()).toEqual([echoTool.definition()]);
    expect(registry.getTool('echo')).toBe(echoTool);
    expect(registry.getTool('missing')).toBeUndefined();
  });

  it('defaults to an empty registry', () => {
    const registry = createToolRegistry();

    expect(registry.getDefinitions()).toEqual([]);
    expect(registry.getTool('anything')).toBeUndefined();
  });

  it('registers default tool modules', () => {
    const registry = createDefaultToolRegistry();

    expect(registry.getTool('get_current_page_content')).toBeDefined();
    expect(registry.getDefinitions().map((definition) => definition.function.name)).toContain('get_current_page_content');
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
