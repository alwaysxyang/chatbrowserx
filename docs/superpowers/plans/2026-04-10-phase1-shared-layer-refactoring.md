# Phase 1: Shared Layer Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the shared layer type system by adding type guards, JSDoc documentation, and eliminating any type redundancy.

**Architecture:** Enhance existing type definitions in `shared/types/` without breaking changes. Add type guard functions for runtime type checking and comprehensive JSDoc comments for better IDE support.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Add Provider Type Guards to Settings

**Files:**
- Modify: `src/shared/types/settings.ts:1-58`
- Modify: `tests/shared/types/settings.test.ts:1-45`

- [ ] **Step 1: Write failing tests for type guard functions**

Add to `tests/shared/types/settings.test.ts` after line 43:

```typescript
  it('identifies openai provider correctly', () => {
    expect(isOpenAIProvider(baseSettings)).toBe(true);
    
    const codexSettings: ModelSettings = {
      ...baseSettings,
      provider: 'codex',
    };
    expect(isOpenAIProvider(codexSettings)).toBe(false);
  });

  it('identifies codex provider correctly', () => {
    expect(isCodexProvider(baseSettings)).toBe(false);
    
    const codexSettings: ModelSettings = {
      ...baseSettings,
      provider: 'codex',
    };
    expect(isCodexProvider(codexSettings)).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/shared/types/settings.test.ts`
Expected: FAIL with "isOpenAIProvider is not defined" and "isCodexProvider is not defined"

- [ ] **Step 3: Implement type guard functions**

Add to `src/shared/types/settings.ts` after line 57:

```typescript
/**
 * Type guard to check if the current provider is OpenAI.
 * @param settings - The model settings to check
 * @returns true if the provider is 'openai'
 */
export function isOpenAIProvider(settings: ModelSettings): boolean {
  return settings.provider === 'openai';
}

/**
 * Type guard to check if the current provider is Codex.
 * @param settings - The model settings to check
 * @returns true if the provider is 'codex'
 */
export function isCodexProvider(settings: ModelSettings): boolean {
  return settings.provider === 'codex';
}
```

- [ ] **Step 4: Update test imports**

Modify `tests/shared/types/settings.test.ts` line 2-7:

```typescript
import {
  getActiveProviderBaseUrl,
  getActiveProviderCredential,
  getActiveProviderModel,
  isOpenAIProvider,
  isCodexProvider,
  type ModelSettings,
} from '../../../src/shared/types/settings';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/shared/types/settings.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/settings.ts tests/shared/types/settings.test.ts
git commit -m "feat(types): add provider type guard functions

Add isOpenAIProvider and isCodexProvider type guards for runtime
provider type checking with comprehensive tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add JSDoc Documentation to Settings Types

**Files:**
- Modify: `src/shared/types/settings.ts:1-70`

- [ ] **Step 1: Add JSDoc to ChatProviderId type**

Modify `src/shared/types/settings.ts` line 1:

```typescript
/**
 * Supported chat provider identifiers.
 * - 'openai': OpenAI-compatible API providers
 * - 'codex': Codex-specific API providers
 */
export type ChatProviderId = 'openai' | 'codex';
```

- [ ] **Step 2: Add JSDoc to UiLanguage type**

Modify `src/shared/types/settings.ts` line 3-4:

```typescript
/**
 * UI language options.
 * - 'system': Follow browser/system language
 * - 'zh': Chinese
 * - 'en': English
 * - 'ja': Japanese
 */
export type UiLanguage = 'system' | 'zh' | 'en' | 'ja';
```

- [ ] **Step 3: Add JSDoc to OpenAIModelSettings interface**

Modify `src/shared/types/settings.ts` line 6-11:

```typescript
/**
 * OpenAI provider-specific configuration.
 */
export interface OpenAIModelSettings {
  /** API key for authentication */
  apiKey: string;
  /** Model identifier (e.g., 'gpt-4', 'gpt-3.5-turbo') */
  model: string;
  /** Base URL for the OpenAI-compatible API endpoint */
  baseUrl: string;
}
```

- [ ] **Step 4: Add JSDoc to CodexModelSettings interface**

Modify `src/shared/types/settings.ts` line 13-18:

```typescript
/**
 * Codex provider-specific configuration.
 */
export interface CodexModelSettings {
  /** Access token for authentication */
  accessToken: string;
  /** Model identifier */
  model: string;
  /** Base URL for the Codex API endpoint */
  baseUrl: string;
}
```

- [ ] **Step 5: Add JSDoc to ModelSettings interface**

Modify `src/shared/types/settings.ts` line 20-34:

```typescript
/**
 * Model-related settings including provider configuration.
 * Each provider maintains its own independent configuration.
 */
export interface ModelSettings {
  /** Currently active provider */
  provider: ChatProviderId;
  /** 
   * Compatibility field: mirrors the active provider's model.
   * Used for backward compatibility with older data structures.
   */
  model: string;

  /** System prompt sent with every chat request */
  systemPrompt: string;
  /** Maximum number of historical messages to include in context */
  maxHistory: number;

  /** OpenAI provider configuration */
  openai: OpenAIModelSettings;
  /** Codex provider configuration */
  codex: CodexModelSettings;
}
```

- [ ] **Step 6: Add JSDoc to GeneralSettings interface**

Modify `src/shared/types/settings.ts` line 36-39:

```typescript
/**
 * General application settings.
 */
export interface GeneralSettings {
  /** UI language preference */
  uiLanguage: UiLanguage;
}
```

- [ ] **Step 7: Add JSDoc to Settings interface**

Modify `src/shared/types/settings.ts` line 41-44:

```typescript
/**
 * Complete application settings structure.
 */
export interface Settings {
  /** Model and provider configuration */
  model: ModelSettings;
  /** General UI and behavior settings */
  general: GeneralSettings;
}
```

- [ ] **Step 8: Add JSDoc to helper functions**

Modify `src/shared/types/settings.ts` line 46-57:

```typescript
/**
 * Get the base URL of the currently active provider.
 * @param settings - The model settings
 * @returns The base URL for the active provider
 */
export function getActiveProviderBaseUrl(settings: ModelSettings): string {
  return settings.provider === 'openai' ? settings.openai.baseUrl : settings.codex.baseUrl;
}

/**
 * Get the authentication credential of the currently active provider.
 * @param settings - The model settings
 * @returns API key for OpenAI or access token for Codex
 */
export function getActiveProviderCredential(settings: ModelSettings): string {
  return settings.provider === 'openai' ? settings.openai.apiKey : settings.codex.accessToken;
}

/**
 * Get the model identifier of the currently active provider.
 * @param settings - The model settings
 * @returns The model identifier for the active provider
 */
export function getActiveProviderModel(settings: ModelSettings): string {
  return settings.provider === 'openai' ? settings.openai.model : settings.codex.model;
}
```

- [ ] **Step 9: Verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 10: Run tests to ensure no breakage**

Run: `npm test -- tests/shared/types/settings.test.ts`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add src/shared/types/settings.ts
git commit -m "docs(types): add comprehensive JSDoc to settings types

Add detailed JSDoc comments to all settings types and helper functions
for better IDE support and code documentation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add JSDoc Documentation to Runtime Messages

**Files:**
- Modify: `src/shared/types/runtime-messages.ts:1-157`

- [ ] **Step 1: Add JSDoc to message type constants**

Modify `src/shared/types/runtime-messages.ts` line 3-9:

```typescript
/** Message type for chat requests from UI to background */
export const chatRequestType = 'chatbrowserx.chat.request';
/** Message type for streaming chat response chunks */
export const chatStreamChunkType = 'chatbrowserx.chat.stream.chunk';
/** Message type for canceling ongoing chat requests */
export const chatCancelType = 'chatbrowserx.chat.cancel';
/** Port name for chat session communication */
export const chatSessionPortName = 'chatbrowserx.chat.session';
/** Message type for screenshot capture requests */
export const screenshotCaptureRequestType = 'chatbrowserx.chat.screenshot.capture';
/** Message type for panel control commands */
export const panelCommandType = 'chatbrowserx.panel.command';
/** Message type for get-page-content tool requests */
export const getPageContentToolRequestType = 'chatbrowserx.tool.get-page-content.request';
```

- [ ] **Step 2: Add JSDoc to base message interfaces**

Modify `src/shared/types/runtime-messages.ts` line 11-25:

```typescript
/**
 * Base runtime message structure.
 * All messages exchanged between UI and background must include a type field.
 */
export interface RuntimeMessage<TType extends string = string> {
  type: TType;
}

/**
 * Successful runtime response envelope.
 */
export interface RuntimeSuccessResponse<TData> {
  ok: true;
  data: TData;
}

/**
 * Failed runtime response envelope.
 */
export interface RuntimeErrorResponse {
  ok: false;
  error: string;
}

/**
 * Runtime response envelope that can be either success or error.
 */
export type RuntimeResponse<TData> = RuntimeSuccessResponse<TData> | RuntimeErrorResponse;
```

- [ ] **Step 3: Add JSDoc to chat message interfaces**

Modify `src/shared/types/runtime-messages.ts` line 27-49:

```typescript
/**
 * Chat request message sent from UI to background.
 */
export interface ChatRequestMessage {
  type: typeof chatRequestType;
  payload: ChatRequestPayload;
}

/**
 * Successful chat response.
 */
export interface ChatSuccessResponse {
  ok: true;
  data: ChatResponsePayload;
}

/**
 * Failed chat response.
 */
export interface ChatErrorResponse {
  ok: false;
  error: string;
}

/**
 * Chat response envelope (success or error).
 */
export type ChatRuntimeResponse = ChatSuccessResponse | ChatErrorResponse;

/**
 * Streaming chat chunk message sent from background to UI.
 */
export interface ChatStreamChunkMessage {
  type: typeof chatStreamChunkType;
  payload: {
    content: string;
  };
}

/**
 * Chat cancellation message sent from UI to background.
 */
export interface ChatCancelMessage {
  type: typeof chatCancelType;
}
```

- [ ] **Step 4: Add JSDoc to screenshot message interfaces**

Modify `src/shared/types/runtime-messages.ts` line 55-73:

```typescript
/**
 * Screenshot capture request message.
 */
export interface ScreenshotCaptureRequestMessage {
  type: typeof screenshotCaptureRequestType;
}

/**
 * Successful screenshot capture response.
 */
export interface ScreenshotCaptureSuccessResponse {
  ok: true;
  data: {
    dataUrl: string;
  };
}

/**
 * Failed screenshot capture response.
 */
export interface ScreenshotCaptureErrorResponse {
  ok: false;
  error: string;
}

/**
 * Screenshot capture response envelope (success or error).
 */
export type ScreenshotCaptureRuntimeResponse =
  | ScreenshotCaptureSuccessResponse
  | ScreenshotCaptureErrorResponse;
```

- [ ] **Step 5: Add JSDoc to panel and tool message interfaces**

Modify `src/shared/types/runtime-messages.ts` line 75-90:

```typescript
/**
 * Panel control command message.
 */
export interface PanelCommandMessage {
  type: typeof panelCommandType;
  payload: {
    command: 'toggle-chat' | 'open-chat' | 'open-settings';
  };
}

/**
 * Get page content tool request message.
 */
export interface GetPageContentToolRequestMessage {
  type: typeof getPageContentToolRequestType;
}

/**
 * Page content data returned by the get-page-content tool.
 */
export interface GetPageContentToolPayload {
  title: string;
  url: string;
  content: string;
}
```

- [ ] **Step 6: Add JSDoc to helper functions**

Modify `src/shared/types/runtime-messages.ts` line 92-120:

```typescript
/**
 * Check if a message has a specific type.
 * @param message - The message to check
 * @param type - The expected message type
 * @returns true if the message has the specified type
 */
export function hasRuntimeMessageType<TType extends string>(message: unknown, type: TType): message is RuntimeMessage<TType> {
  return Boolean(message && typeof message === 'object' && 'type' in message && (message as RuntimeMessage<TType>).type === type);
}

/**
 * Create a type guard function for a specific message type.
 * @param type - The message type to guard against
 * @returns A type guard function
 */
export function createRuntimeMessageGuard<TMessage extends RuntimeMessage<string>>(type: TMessage['type']) {
  return (message: unknown): message is TMessage => hasRuntimeMessageType(message, type);
}

/**
 * Extract data from a runtime response or throw an error.
 * @param response - The runtime response to unwrap
 * @param fallbackError - Error message to use if response is undefined or failed
 * @returns The response data
 * @throws Error if the response is not ok
 */
export function getRuntimeResponseData<TData>(response: RuntimeResponse<TData> | undefined, fallbackError: string): TData {
  if (!response?.ok) {
    throw new Error(response?.error || fallbackError);
  }

  return response.data;
}

/**
 * Wrap an async task in a runtime response envelope.
 * @param task - The async task to wrap
 * @returns A runtime response (success or error)
 */
export async function toRuntimeResponse<TData>(task: Promise<TData>): Promise<RuntimeResponse<TData>> {
  try {
    return {
      ok: true,
      data: await task,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

- [ ] **Step 7: Add JSDoc to exported type guard functions**

Modify `src/shared/types/runtime-messages.ts` line 134-156:

```typescript
/**
 * Type guard for chat request messages.
 */
export function isChatRequestMessage(message: unknown): message is ChatRequestMessage {
  return isChatRequestMessageGuard(message);
}

/**
 * Type guard for chat stream chunk messages.
 */
export function isChatStreamChunkMessage(message: unknown): message is ChatStreamChunkMessage {
  return isChatStreamChunkMessageGuard(message);
}

/**
 * Type guard for chat cancel messages.
 */
export function isChatCancelMessage(message: unknown): message is ChatCancelMessage {
  return isChatCancelMessageGuard(message);
}

/**
 * Type guard for screenshot capture request messages.
 */
export function isScreenshotCaptureRequestMessage(message: unknown): message is ScreenshotCaptureRequestMessage {
  return isScreenshotCaptureRequestMessageGuard(message);
}

/**
 * Type guard for panel command messages.
 */
export function isPanelCommandMessage(message: unknown): message is PanelCommandMessage {
  return isPanelCommandMessageGuard(message);
}

/**
 * Type guard for get-page-content tool request messages.
 */
export function isGetPageContentToolRequestMessage(message: unknown): message is GetPageContentToolRequestMessage {
  return isGetPageContentToolRequestMessageGuard(message);
}
```

- [ ] **Step 8: Verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 9: Run tests to ensure no breakage**

Run: `npm test -- tests/shared/types/runtime-messages.test.ts`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/shared/types/runtime-messages.ts
git commit -m "docs(types): add comprehensive JSDoc to runtime messages

Add detailed JSDoc comments to all runtime message types, response
envelopes, and helper functions for better IDE support.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Add JSDoc Documentation to Chat Types

**Files:**
- Modify: `src/shared/types/chat.ts:1-57`

- [ ] **Step 1: Add JSDoc to ChatRole type**

Modify `src/shared/types/chat.ts` line 1:

```typescript
/**
 * Chat message role.
 * - 'user': Message from the user
 * - 'assistant': Message from the AI assistant
 */
export type ChatRole = 'user' | 'assistant';
```

- [ ] **Step 2: Add JSDoc to content part interfaces**

Modify `src/shared/types/chat.ts` line 3-15:

```typescript
/**
 * Text content part in a multimodal message.
 */
export interface ChatTextContentPart {
  type: 'text';
  text: string;
}

/**
 * Image content part in a multimodal message.
 */
export interface ChatImageContentPart {
  type: 'image_url';
  image_url: {
    /** Image URL (can be remote URL or data URL) */
    url: string;
  };
}

/**
 * Union of all supported content part types.
 */
export type ChatContentPart = ChatTextContentPart | ChatImageContentPart;

/**
 * Message content can be either plain text or an array of multimodal parts.
 */
export type ChatMessageContent = string | ChatContentPart[];
```

- [ ] **Step 3: Add JSDoc to content helper functions**

Modify `src/shared/types/chat.ts` line 19-32:

```typescript
/**
 * Convert message content to an array of content parts.
 * If content is a string, wraps it in a text content part.
 * @param content - The message content
 * @returns Array of content parts
 */
export function getChatMessageContentParts(content: ChatMessageContent): ChatContentPart[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content;
}

/**
 * Extract all text content from a message, joining multiple text parts with newlines.
 * @param content - The message content
 * @returns Concatenated text content
 */
export function getChatMessageTextContent(content: ChatMessageContent): string {
  return getChatMessageContentParts(content)
    .filter((part): part is ChatTextContentPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}
```

- [ ] **Step 4: Add JSDoc to ChatMessage interface**

Modify `src/shared/types/chat.ts` line 34-47:

```typescript
/**
 * Chat message structure used in the UI layer.
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Message role (user or assistant) */
  role: ChatRole;
  /** Message content (text or multimodal) */
  content: ChatMessageContent;
  /** ISO timestamp of message creation */
  createdAt?: string;
  /**
   * Message status:
   * - 'completed': Normal completion
   * - 'streaming': Currently being generated
   * - 'error': Generation failed
   * - 'interrupted': Actively canceled by user
   */
  status?: 'completed' | 'streaming' | 'error' | 'interrupted';
  /** Detailed error message for status === 'error' */
  errorMessage?: string;
}
```

- [ ] **Step 5: Add JSDoc to request/response payloads**

Modify `src/shared/types/chat.ts` line 49-57:

```typescript
/**
 * Chat request payload sent from UI to background.
 */
export interface ChatRequestPayload {
  /** User's input message content */
  input: ChatMessageContent;
  /** Previous chat messages for context */
  history: ChatMessage[];
}

/**
 * Chat response payload sent from background to UI.
 */
export interface ChatResponsePayload {
  /** Assistant's reply text */
  reply: string;
}
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Run all tests to ensure no breakage**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/shared/types/chat.ts
git commit -m "docs(types): add comprehensive JSDoc to chat types

Add detailed JSDoc comments to all chat message types, content parts,
and helper functions for better IDE support.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Add JSDoc Documentation to LLM Model Types

**Files:**
- Modify: `src/llm/model/chat.ts:1-55`

- [ ] **Step 1: Add JSDoc to LLM message interfaces**

Modify `src/llm/model/chat.ts` line 4-34:

```typescript
/**
 * System message for LLM requests.
 * Contains instructions or context for the model.
 */
export interface LlmSystemMessage {
  role: 'system';
  content: string;
}

/**
 * User message for LLM requests.
 * Supports both plain text and multimodal content.
 */
export interface LlmUserMessage {
  role: 'user';
  content: string | ChatContentPart[];
}

/**
 * Tool call structure in LLM responses.
 */
export interface LlmToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Tool call type (currently only 'function' is supported) */
  type: 'function';
  function: {
    /** Name of the function to call */
    name: string;
    /** JSON-encoded function arguments */
    arguments: string;
  };
}

/**
 * Assistant message in LLM conversation.
 * May include tool calls that need to be executed.
 */
export interface LlmAssistantMessage {
  role: 'assistant';
  /** Assistant's text response */
  content: string;
  /** Optional tool calls requested by the assistant */
  toolCalls?: LlmToolCall[];
}

/**
 * Tool result message sent back to the LLM.
 * Contains the result of executing a tool call.
 */
export interface LlmToolMessage {
  role: 'tool';
  /** ID of the tool call this result corresponds to */
  toolCallId: string;
  /** Name of the tool that was executed */
  name: string;
  /** Tool execution result (typically JSON-encoded) */
  content: string;
}

/**
 * Union of all LLM message types.
 */
export type LlmChatMessage = LlmSystemMessage | LlmUserMessage | LlmAssistantMessage | LlmToolMessage;
```

- [ ] **Step 2: Add JSDoc to chat completion interfaces**

Modify `src/llm/model/chat.ts` line 38-54:

```typescript
/**
 * Input for chat completion requests.
 */
export interface ChatCompletionInput {
  /** Conversation history including system, user, assistant, and tool messages */
  messages: LlmChatMessage[];
  /** Model identifier to use for completion */
  model: string;
  /** Optional tool definitions available for the model to call */
  tools?: ToolDefinition[];
}

/**
 * Result of a chat completion request.
 */
export interface ChatCompletionResult {
  /** The assistant's response message */
  message: LlmAssistantMessage;
}

/**
 * Chat completion provider interface.
 * Implementations handle communication with specific LLM APIs.
 */
export interface ChatCompletionProvider {
  /**
   * Complete a chat conversation.
   * @param input - The chat completion input
   * @param onChunk - Optional callback for streaming response chunks
   * @param signal - Optional abort signal for cancellation
   * @returns The completed assistant message
   */
  completeChat(
    input: ChatCompletionInput,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatCompletionResult>;
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run all tests to ensure no breakage**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/llm/model/chat.ts
git commit -m "docs(types): add comprehensive JSDoc to LLM model types

Add detailed JSDoc comments to all LLM message types, chat completion
interfaces, and provider contract for better IDE support.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Verify Type System and Run Full Test Suite

**Files:**
- All modified files in previous tasks

- [ ] **Step 1: Clean build**

Run: `rm -rf dist && npm run build`
Expected: Build succeeds with no errors or warnings

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Check for TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify no unused exports**

Manually review the modified files to ensure all exported functions and types are used somewhere in the codebase.

- [ ] **Step 5: Create summary commit if needed**

If any minor fixes were needed in steps 1-4, commit them:

```bash
git add -A
git commit -m "fix(types): address type system issues found in verification

Minor fixes to ensure type system consistency and test coverage.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Update Project Spec with Phase 1 Completion

**Files:**
- Modify: `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`

- [ ] **Step 1: Add Phase 1 completion note**

Add to the end of `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`:

```markdown

## 12. Refactoring History

### Phase 1: Shared Layer Refactoring (2026-04-10)

**Completed:**
- Added type guard functions (`isOpenAIProvider`, `isCodexProvider`) to `shared/types/settings.ts`
- Added comprehensive JSDoc documentation to all shared types:
  - `shared/types/settings.ts` - Settings and provider types
  - `shared/types/runtime-messages.ts` - Runtime message protocol
  - `shared/types/chat.ts` - Chat message types
  - `llm/model/chat.ts` - LLM domain types
- All tests passing, no breaking changes

**Benefits:**
- Better IDE autocomplete and inline documentation
- Runtime type checking for provider selection
- Improved code maintainability

**Next Phase:** Phase 2 - LLM Layer Refactoring (Provider and Services)
```

- [ ] **Step 2: Commit spec update**

```bash
git add docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md
git commit -m "docs(spec): record Phase 1 refactoring completion

Document completion of shared layer type system optimization including
type guards and JSDoc documentation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No new ESLint warnings
- [ ] All type guard functions have tests
- [ ] All public APIs have JSDoc comments
- [ ] Project spec updated with Phase 1 completion
- [ ] All commits follow conventional commit format
- [ ] No breaking changes to existing APIs

---

## Next Steps

After Phase 1 completion:

1. Review the implementation with the user
2. Create Phase 2 implementation plan (LLM Layer Refactoring)
3. Continue with gradual refactoring approach

**Phase 2 Preview:**
- Extract common provider logic
- Split large provider files (codex-stream.ts, codex-wire-format.ts)
- Reorganize provider directory structure
- Optimize services layer
