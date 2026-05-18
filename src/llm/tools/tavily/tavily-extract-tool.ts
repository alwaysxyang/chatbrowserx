import { registerTool, type LlmToolModule } from '../tool-registry';
import {
  invokeTavilyEndpoint,
  resolveTavilyToolDefinition,
} from './tavily-request';
import {
  readOptionalEnum,
  readOptionalStringArray,
} from '../shared/tool-arguments';

const tavilyExtractDefinition = {
  type: 'function' as const,
  function: {
    name: 'tavily_extract',
    description:
      'Extract readable content from one or more exact URLs with Tavily. Use this after you already know which pages matter, such as URLs found from search or URLs named by the user. Do not use this tool to discover new pages.',
    parameters: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'The exact URLs whose content should be extracted.',
        },
        extractDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'Use advanced when the extracted content needs deeper parsing.',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'text'],
          description: 'Preferred content format for the extracted body.',
        },
      },
      required: ['urls'],
      additionalProperties: false,
    },
  },
};

/**
 * Create the Tavily extract tool module.
 */
export function createTavilyExtractTool(): LlmToolModule {
  return {
    name: () => tavilyExtractDefinition.function.name,
    definition: () => resolveTavilyToolDefinition(tavilyExtractDefinition),
    invoke: async (_context, argumentsObject = {}) => {
      const urls = readOptionalStringArray(argumentsObject, 'urls');

      if (!urls?.length) {
        throw new Error('INVALID_TOOL_ARGUMENT: urls');
      }

      const extractDepth = readOptionalEnum(argumentsObject, 'extractDepth', ['basic', 'advanced'] as const) ?? 'basic';
      const format = readOptionalEnum(argumentsObject, 'format', ['markdown', 'text'] as const) ?? 'markdown';

      return invokeTavilyEndpoint('/extract', {
        urls,
        extract_depth: extractDepth,
        format,
        include_images: false,
      });
    },
  };
}

registerTool(createTavilyExtractTool());
