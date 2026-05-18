import { registerTool, type LlmToolModule } from '../tool-registry';
import {
  invokeTavilyEndpoint,
  resolveTavilyToolDefinition,
} from './tavily-request';
import {
  readOptionalEnum,
  readOptionalInteger,
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
} from '../shared/tool-arguments';

const tavilyCrawlDefinition = {
  type: 'function' as const,
  function: {
    name: 'tavily_crawl',
    description:
      'Crawl a website from a starting URL with Tavily and collect content across linked pages. Use this for site-wide or docs-wide discovery when one page is not enough. Prefer adding instructions to narrow which pages should be followed.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The starting URL for the crawl.',
        },
        instructions: {
          type: 'string',
          description: 'Optional natural-language guidance that narrows which pages should be followed.',
        },
        maxDepth: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          description: 'Maximum link depth to follow from the starting page.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of crawled pages to return.',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'text'],
          description: 'Preferred content format for each crawled page.',
        },
        selectPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional regex-like path patterns to include.',
        },
        excludePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional regex-like path patterns to skip.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
};

/**
 * Create the Tavily crawl tool module.
 */
export function createTavilyCrawlTool(): LlmToolModule {
  return {
    name: () => tavilyCrawlDefinition.function.name,
    definition: () => resolveTavilyToolDefinition(tavilyCrawlDefinition),
    invoke: async (_context, argumentsObject = {}) => {
      const url = readRequiredString(argumentsObject, 'url');
      const instructions = readOptionalString(argumentsObject, 'instructions');
      const maxDepth = readOptionalInteger(argumentsObject, 'maxDepth', 1, 5) ?? 1;
      const limit = readOptionalInteger(argumentsObject, 'limit', 1, 20) ?? 10;
      const format = readOptionalEnum(argumentsObject, 'format', ['markdown', 'text'] as const) ?? 'markdown';
      const selectPaths = readOptionalStringArray(argumentsObject, 'selectPaths');
      const excludePaths = readOptionalStringArray(argumentsObject, 'excludePaths');

      return invokeTavilyEndpoint('/crawl', {
        url,
        instructions,
        max_depth: maxDepth,
        limit,
        format,
        select_paths: selectPaths,
        exclude_paths: excludePaths,
        extract_depth: 'basic',
      });
    },
  };
}

registerTool(createTavilyCrawlTool());
