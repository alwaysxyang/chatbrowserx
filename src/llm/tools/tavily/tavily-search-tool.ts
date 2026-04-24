import { registerTool, type LlmToolModule } from '../tool-registry';
import {
  invokeTavilyEndpoint,
  resolveTavilyToolDefinition,
} from './tavily-request';
import {
  readOptionalEnum,
  readOptionalInteger,
  readOptionalStringArray,
  readRequiredString,
} from '../shared/tool-arguments';

const tavilySearchDefinition = {
  type: 'function' as const,
  function: {
    name: 'tavily_search',
    description:
      'Search the public web with Tavily. Use this when the user needs external information, recent developments, source URLs, or facts that are not guaranteed to be on the current page. Returns a concise answer plus ranked source snippets. Do not use this when the user already provided exact URLs to read.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The natural-language web search query.',
        },
        topic: {
          type: 'string',
          enum: ['general', 'news', 'finance'],
          description: 'Choose news for fresh reporting, finance for market or company finance queries, otherwise general.',
        },
        searchDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'Use advanced when better recall is worth more latency and API cost.',
        },
        maxResults: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Maximum number of ranked results to return.',
        },
        includeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional domain allowlist, such as ["docs.tavily.com"].',
        },
        excludeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional domain blocklist.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/**
 * Create the Tavily search tool module.
 */
export function createTavilySearchTool(): LlmToolModule {
  return {
    name: () => tavilySearchDefinition.function.name,
    definition: () => resolveTavilyToolDefinition(tavilySearchDefinition),
    invoke: async (argumentsObject) => {
      const query = readRequiredString(argumentsObject, 'query');
      const topic = readOptionalEnum(argumentsObject, 'topic', ['general', 'news', 'finance'] as const) ?? 'general';
      const searchDepth = readOptionalEnum(argumentsObject, 'searchDepth', ['basic', 'advanced'] as const) ?? 'basic';
      const maxResults = readOptionalInteger(argumentsObject, 'maxResults', 1, 10) ?? 5;
      const includeDomains = readOptionalStringArray(argumentsObject, 'includeDomains');
      const excludeDomains = readOptionalStringArray(argumentsObject, 'excludeDomains');

      return invokeTavilyEndpoint('/search', {
        query,
        topic,
        search_depth: searchDepth,
        max_results: maxResults,
        include_domains: includeDomains,
        exclude_domains: excludeDomains,
        include_answer: 'advanced',
        include_images: false,
        include_raw_content: false,
      });
    },
  };
}

registerTool(createTavilySearchTool());
