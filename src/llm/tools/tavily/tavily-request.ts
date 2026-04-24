import { loadSettings } from '../../../shared/storage/settings-repository';
import type { ToolDefinition } from '../tool-registry';

const tavilyApiBaseUrl = 'https://api.tavily.com';

interface TavilyErrorPayload {
  detail?: string | { message?: string };
  message?: string;
  error?: string;
}

/**
 * Return the configured Tavily API key or throw when the key is unavailable.
 */
export async function loadRequiredTavilyApiKey(): Promise<string> {
  const settings = await loadSettings();
  const apiKey = settings.model.tavilyApiKey.trim();

  if (!apiKey) {
    throw new Error('TAVILY_API_KEY_MISSING');
  }

  return apiKey;
}

/**
 * Only expose a Tavily tool definition when the Tavily key is configured.
 */
export async function resolveTavilyToolDefinition(definition: ToolDefinition): Promise<ToolDefinition | null> {
  const settings = await loadSettings();
  return settings.model.tavilyApiKey.trim() ? definition : null;
}

/**
 * Build a Tavily endpoint URL from the shared base URL.
 */
export function getTavilyEndpoint(path: string): string {
  return `${tavilyApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Execute a Tavily JSON request and return the parsed JSON payload when available.
 */
export async function invokeTavilyEndpoint(path: string, body: Record<string, unknown>): Promise<unknown> {
  const apiKey = await loadRequiredTavilyApiKey();
  const response = await fetch(getTavilyEndpoint(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const rawBody = await response.text();
  const parsedBody = parseJsonSafely(rawBody);

  if (!response.ok) {
    throw new Error(resolveTavilyErrorMessage(response.status, parsedBody, rawBody));
  }

  if (parsedBody !== undefined) {
    return parsedBody;
  }

  return rawBody || '{}';
}

/**
 * Parse a JSON payload without throwing.
 */
function parseJsonSafely(rawBody: string): unknown {
  if (!rawBody) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Convert Tavily error responses into a stable error message.
 */
function resolveTavilyErrorMessage(status: number, parsedBody: unknown, rawBody: string): string {
  if (parsedBody && typeof parsedBody === 'object') {
    const errorPayload = parsedBody as TavilyErrorPayload;
    const detail =
      typeof errorPayload.detail === 'string'
        ? errorPayload.detail
        : typeof errorPayload.detail?.message === 'string'
          ? errorPayload.detail.message
          : errorPayload.message ?? errorPayload.error;

    if (detail) {
      return detail;
    }
  }

  return rawBody || `TAVILY_REQUEST_FAILED: ${status}`;
}
