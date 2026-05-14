# Global Chat Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repository rule override: do not create git commits.

**Goal:** Move chat history, panel state, and running chat agent loop from hostname/tab scope to one profile-wide global chat session that survives page refresh and syncs to all content tabs.

**Architecture:** `background/chat` becomes the single owner of chat state and running requests. Content UI queries and subscribes to background state, while page tools continue targeting the current active tab through existing `llm/tools` routing. Chat page lifecycle disconnects no longer cancel running chat; explicit stop cancels it.

**Tech Stack:** TypeScript, React hooks, Chrome extension runtime messaging, `chrome.storage.local`, Vitest, Testing Library.

---

## File Structure

- Modify `src/shared/storage/chat-history-repository.ts`: global `chatbrowserx.history` repository.
- Modify `src/ui/content/content-panel-state.ts`: global `chatbrowserx.panel` key.
- Modify `src/shared/types/chat.ts`: add global state query/sync/clear messages and guarded stream chunk metadata.
- Modify `src/background/llm/llm-orchestrator.ts`: allow string session scopes while preserving numeric tab scopes for selection.
- Create `src/background/chat/chat-session-message.ts`: background-owned chat message ID and timestamp helpers.
- Create `src/background/chat/chat-session-broadcaster.ts`: broadcast runtime messages to all reachable content tabs.
- Create `src/background/chat/chat-session-coordinator.ts`: authoritative global chat state, request lifecycle, persistence, broadcast, cancel, and clear.
- Modify `src/background/chat/index.ts`: route chat messages through `ChatSessionCoordinator` and remove chat lifecycle port cancellation.
- Modify `src/ui/content/chat/use-chat-controller.ts`: query global state, subscribe to sync/chunk messages, send request/cancel/clear commands.
- Modify `src/ui/content/ContentApp.tsx`: remove hostname scope wiring.
- Modify `src/ui/content/use-content-shell.ts`: remove hostname argument and use the global panel key.
- Modify `docs/superpowers/specs/browser-agent-project-spec.md`: sync current implementation spec after code changes.
- Modify `docs/superpowers/specs/selection-bubble-feature-spec.md`: clarify selection still uses page lifecycle cancellation.
- Add/update tests under `tests/shared`, `tests/background`, and `tests/ui/content`.

## Task 1: Global Storage And Panel Keys

**Files:**
- Modify: `src/shared/storage/chat-history-repository.ts`
- Modify: `src/ui/content/content-panel-state.ts`
- Modify: `src/ui/content/ContentApp.tsx`
- Modify: `src/ui/content/use-content-shell.ts`
- Add: `tests/shared/storage/chat-history-repository.test.ts`
- Add: `tests/ui/content/content-panel-state.test.ts`
- Modify: `tests/ui/content/ContentApp.test.tsx`

- [ ] **Step 1: Write failing storage and panel key tests**

Create `tests/shared/storage/chat-history-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../../src/shared/storage/chat-history-repository';

describe('chat history repository', () => {
  it('stores chat history in one global key', async () => {
    await saveChatHistory([{ id: 'm1', role: 'assistant', content: 'stored reply' }]);

    const persisted = await chrome.storage.local.get('chatbrowserx.history');
    expect(persisted['chatbrowserx.history']).toEqual([{ id: 'm1', role: 'assistant', content: 'stored reply' }]);
    expect(await loadChatHistory()).toEqual([{ id: 'm1', role: 'assistant', content: 'stored reply' }]);

    await clearChatHistory();
    expect((await chrome.storage.local.get('chatbrowserx.history'))['chatbrowserx.history']).toBeUndefined();
  });
});
```

Create `tests/ui/content/content-panel-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getPanelStateStorageKey } from '../../../src/ui/content/content-panel-state';

describe('content panel state', () => {
  it('uses one global panel state key', () => {
    expect(getPanelStateStorageKey()).toBe('chatbrowserx.panel');
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx vitest run tests/shared/storage/chat-history-repository.test.ts tests/ui/content/content-panel-state.test.ts
```

Expected: FAIL because the repository and panel state APIs still require hostname arguments.

- [ ] **Step 3: Implement global storage keys**

Replace `src/shared/storage/chat-history-repository.ts` with:

```ts
import type { ChatMessage } from '../types/chat';
import { loadStoredValue, removeStoredValue, saveStoredValue } from './chrome-local-storage';

const chatHistoryStorageKey = 'chatbrowserx.history';

/**
 * Loads the profile-wide chat transcript.
 */
export async function loadChatHistory(): Promise<ChatMessage[]> {
  return loadStoredValue(chatHistoryStorageKey, [] as ChatMessage[]);
}

/**
 * Saves the profile-wide chat transcript.
 *
 * @param messages - The complete global chat transcript.
 */
export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  await saveStoredValue(chatHistoryStorageKey, messages);
}

/**
 * Clears the profile-wide chat transcript.
 */
export async function clearChatHistory(): Promise<void> {
  await removeStoredValue(chatHistoryStorageKey);
}
```

Replace `src/ui/content/content-panel-state.ts` with:

```ts
const panelStateStorageKey = 'chatbrowserx.panel';

/**
 * Returns the profile-wide panel state storage key.
 */
export function getPanelStateStorageKey(): string {
  return panelStateStorageKey;
}
```

In `src/ui/content/ContentApp.tsx`, remove hostname normalization and call:

```ts
const { messages, isSending, sendMessage, clearHistory, stop } = useChatController();
const {
  isOpen,
  activeView,
  isPinned,
  sidebarWidth,
  hasHydratedLanguage,
  screenshotSession,
  previewImageUrl,
  asideRef,
  setIsOpen,
  setActiveView,
  setIsPinned,
  setPreviewImageUrl,
  handleResizeStart,
  handleUiLanguageChange,
  startScreenshotSession,
  closeScreenshotSession,
  handleScreenshotComplete,
} = useContentShell();
```

In `src/ui/content/use-content-shell.ts`, remove the `hostname` parameter and use:

```ts
const panelStateStorageKey = useMemo(() => getPanelStateStorageKey(), []);
```

Update `tests/ui/content/ContentApp.test.tsx` to use:

```ts
const panelStateKey = 'chatbrowserx.panel';
```

- [ ] **Step 4: Run tests for Task 1**

Run:

```bash
npx vitest run tests/shared/storage/chat-history-repository.test.ts tests/ui/content/content-panel-state.test.ts tests/ui/content/ContentApp.test.tsx
```

Expected: PASS.

## Task 2: Chat Runtime Protocol

**Files:**
- Modify: `src/shared/types/chat.ts`
- Add: `tests/shared/types/chat.test.ts`
- Modify: `tests/shared/types/runtime-messages.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Create `tests/shared/types/chat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  chatClearType,
  chatStateQueryType,
  chatStateSyncType,
  chatStreamChunkType,
  isChatClearMessage,
  isChatStateQueryMessage,
  isChatStateSyncMessage,
  isChatStreamChunkMessage,
} from '../../../src/shared/types/chat';

describe('chat runtime messages', () => {
  it('guards global chat state messages', () => {
    expect(isChatStateQueryMessage({ type: chatStateQueryType })).toBe(true);
    expect(isChatStateSyncMessage({
      type: chatStateSyncType,
      payload: {
        messages: [],
        isRunning: true,
        requestId: 1,
        activeAssistantMessageId: 'assistant-1',
      },
    })).toBe(true);
    expect(isChatClearMessage({ type: chatClearType })).toBe(true);
  });

  it('accepts stream chunks with request and message identifiers', () => {
    expect(isChatStreamChunkMessage({
      type: chatStreamChunkType,
      payload: {
        requestId: 1,
        messageId: 'assistant-1',
        content: 'hello',
      },
    })).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing protocol tests**

Run:

```bash
npx vitest run tests/shared/types/chat.test.ts tests/shared/types/runtime-messages.test.ts
```

Expected: FAIL because the new constants, interfaces, and guards do not exist.

- [ ] **Step 3: Add chat state protocol types**

In `src/shared/types/chat.ts`, add these exports near the existing chat message constants:

```ts
/**
 * Message type identifier for querying the global chat session state.
 */
export const chatStateQueryType = 'chatbrowserx.chat.state.query';

/**
 * Message type identifier for broadcasting the global chat session state.
 */
export const chatStateSyncType = 'chatbrowserx.chat.state.sync';

/**
 * Message type identifier for clearing the global chat session.
 */
export const chatClearType = 'chatbrowserx.chat.clear';
```

Add:

```ts
/**
 * Snapshot of the authoritative global chat session state.
 */
export interface ChatSessionState {
  messages: ChatMessage[];
  isRunning: boolean;
  requestId: number | null;
  activeAssistantMessageId: string | null;
}

/**
 * Message sent to query the current global chat session state.
 */
export interface ChatStateQueryMessage extends RuntimeMessage<typeof chatStateQueryType> {}

/**
 * Message sent to synchronize global chat session state to content UIs.
 */
export interface ChatStateSyncMessage extends RuntimeMessage<typeof chatStateSyncType> {
  payload: ChatSessionState;
}

/**
 * Message sent to clear the global chat session.
 */
export interface ChatClearMessage extends RuntimeMessage<typeof chatClearType> {}

/**
 * Runtime response envelope for global chat state queries.
 */
export type ChatStateRuntimeResponse = RuntimeResponse<ChatSessionState>;
```

Change `ChatStreamChunkMessage` payload to:

```ts
payload: {
  requestId: number;
  messageId: string;
  content: string;
};
```

Create guards:

```ts
const isChatStateQueryMessageGuard = createRuntimeMessageGuard<ChatStateQueryMessage>(chatStateQueryType);
const isChatStateSyncMessageGuard = createRuntimeMessageGuard<ChatStateSyncMessage>(chatStateSyncType);
const isChatClearMessageGuard = createRuntimeMessageGuard<ChatClearMessage>(chatClearType);
```

Export guard functions with English JSDoc:

```ts
export function isChatStateQueryMessage(message: unknown): message is ChatStateQueryMessage {
  return isChatStateQueryMessageGuard(message);
}

export function isChatStateSyncMessage(message: unknown): message is ChatStateSyncMessage {
  return isChatStateSyncMessageGuard(message);
}

export function isChatClearMessage(message: unknown): message is ChatClearMessage {
  return isChatClearMessageGuard(message);
}
```

- [ ] **Step 4: Run protocol tests**

Run:

```bash
npx vitest run tests/shared/types/chat.test.ts tests/shared/types/runtime-messages.test.ts
```

Expected: PASS.

## Task 3: Scope-Aware LLM Orchestrator

**Files:**
- Modify: `src/background/llm/llm-orchestrator.ts`
- Add: `tests/background/llm/llm-orchestrator.test.ts`
- Verify: `tests/background/selection/index.test.ts`

- [ ] **Step 1: Write failing orchestrator scope tests**

Create `tests/background/llm/llm-orchestrator.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { LlmOrchestrator } from '../../../src/background/llm/llm-orchestrator';

const completeMock = vi.fn();

vi.mock('../../../src/shared/storage/settings-repository', () => ({
  loadSettings: vi.fn(async () => ({
    model: {
      provider: 'openai',
      maxHistory: 10,
      systemPrompt: '',
      tavilyApiKey: '',
      openai: { baseUrl: 'https://example.com', apiKey: 'key', model: 'gpt-test' },
      codex: { baseUrl: '', accessToken: '', model: '', effort: 'medium' },
    },
  })),
}));

vi.mock('../../../src/llm/services/chat-completion', () => ({
  ChatCompletionService: vi.fn().mockImplementation(() => ({
    complete: completeMock,
  })),
}));

describe('LlmOrchestrator', () => {
  it('allows independent numeric and string request scopes', async () => {
    completeMock
      .mockResolvedValueOnce('global reply')
      .mockResolvedValueOnce('selection reply');

    const orchestrator = new LlmOrchestrator();

    await expect(orchestrator.complete('global-chat', { history: [], input: 'hi' })).resolves.toEqual({ reply: 'global reply' });
    await expect(orchestrator.complete(12, { history: [], input: 'selection' })).resolves.toEqual({ reply: 'selection reply' });
  });

  it('cancels only the requested scope', async () => {
    const abortSignals: AbortSignal[] = [];
    completeMock.mockImplementation((_history, _input, _onChunk, signal: AbortSignal) => {
      abortSignals.push(signal);
      return new Promise(() => undefined);
    });

    const orchestrator = new LlmOrchestrator();
    void orchestrator.complete('global-chat', { history: [], input: 'hi' });
    void orchestrator.complete(12, { history: [], input: 'selection' });

    await Promise.resolve();
    orchestrator.cancel('global-chat');

    expect(abortSignals[0]?.aborted).toBe(true);
    expect(abortSignals[1]?.aborted).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing orchestrator tests**

Run:

```bash
npx vitest run tests/background/llm/llm-orchestrator.test.ts tests/background/selection/index.test.ts
```

Expected: FAIL because `LlmOrchestrator.complete` and `cancel` only accept `number`.

- [ ] **Step 3: Implement scope-aware sessions**

In `src/background/llm/llm-orchestrator.ts`, introduce:

```ts
export type LlmSessionScope = number | string;
```

Change:

```ts
private sessions = new Map<number, TabSession>();
```

to:

```ts
private sessions = new Map<LlmSessionScope, TabSession>();
```

Rename `TabSession` to `LlmSession`, update JSDoc to say “scope” instead of “tab”, and change method signatures:

```ts
async complete(scope: LlmSessionScope, payload: ChatRequestPayload, onChunk?: (chunk: string) => void): Promise<ChatResponsePayload>
cancel(scope: LlmSessionScope): void
```

Inside `complete`, replace all `tabId` map lookups with `scope`. Preserve existing replacement behavior within the same scope.

- [ ] **Step 4: Run orchestrator tests**

Run:

```bash
npx vitest run tests/background/llm/llm-orchestrator.test.ts tests/background/selection/index.test.ts
```

Expected: PASS.

## Task 4: Background Global Chat Session

**Files:**
- Create: `src/background/chat/chat-session-message.ts`
- Create: `src/background/chat/chat-session-broadcaster.ts`
- Create: `src/background/chat/chat-session-coordinator.ts`
- Modify: `src/background/chat/index.ts`
- Add: `tests/background/chat/chat-session-coordinator.test.ts`
- Modify: `tests/background/index.test.ts`

- [ ] **Step 1: Write failing coordinator tests**

Create `tests/background/chat/chat-session-coordinator.test.ts` with these behaviors:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ChatSessionCoordinator } from '../../../src/background/chat/chat-session-coordinator';

function createOrchestrator(reply = 'final reply') {
  return {
    complete: vi.fn(async (_scope, _payload, onChunk?: (chunk: string) => void) => {
      onChunk?.('stream ');
      return { reply };
    }),
    cancel: vi.fn(),
  };
}

describe('ChatSessionCoordinator', () => {
  it('starts one global request, streams chunks, persists history, and broadcasts state', async () => {
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();
    const tabsQueryMock = globalThis.__chromeTestUtils.getTabsQueryMock();
    tabsQueryMock.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    tabsSendMessageMock.mockResolvedValue(undefined);
    const orchestrator = createOrchestrator();
    const coordinator = new ChatSessionCoordinator(orchestrator);

    await expect(coordinator.request({ input: 'hello', history: [] })).resolves.toEqual({ reply: 'final reply' });

    expect(orchestrator.complete).toHaveBeenCalledWith('global-chat', expect.objectContaining({ input: 'hello' }), expect.any(Function));
    expect(tabsSendMessageMock).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'chatbrowserx.chat.stream.chunk' }));
    expect(tabsSendMessageMock).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'chatbrowserx.chat.stream.chunk' }));
    expect((await chrome.storage.local.get('chatbrowserx.history'))['chatbrowserx.history']).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: 'hello' }),
      expect.objectContaining({ role: 'assistant', content: 'final reply', status: 'completed' }),
    ]));
  });

  it('rejects concurrent requests without canceling the running request', async () => {
    const orchestrator = {
      complete: vi.fn(() => new Promise(() => undefined)),
      cancel: vi.fn(),
    };
    const coordinator = new ChatSessionCoordinator(orchestrator);

    void coordinator.request({ input: 'first', history: [] });
    await Promise.resolve();

    await expect(coordinator.request({ input: 'second', history: [] })).rejects.toThrow('CHAT_SESSION_BUSY');
    expect(orchestrator.cancel).not.toHaveBeenCalled();
  });

  it('returns current running state to new content tabs', async () => {
    const orchestrator = {
      complete: vi.fn(() => new Promise(() => undefined)),
      cancel: vi.fn(),
    };
    const coordinator = new ChatSessionCoordinator(orchestrator);

    void coordinator.request({ input: 'first', history: [] });
    await Promise.resolve();

    await expect(coordinator.getState()).resolves.toMatchObject({
      isRunning: true,
      requestId: 1,
      messages: [
        expect.objectContaining({ role: 'user', content: 'first' }),
        expect.objectContaining({ role: 'assistant', status: 'streaming' }),
      ],
    });
  });

  it('cancels the global request only on explicit stop', async () => {
    const orchestrator = createOrchestrator();
    const coordinator = new ChatSessionCoordinator(orchestrator);

    await coordinator.cancel();

    expect(orchestrator.cancel).toHaveBeenCalledWith('global-chat');
  });
});
```

- [ ] **Step 2: Run failing coordinator tests**

Run:

```bash
npx vitest run tests/background/chat/chat-session-coordinator.test.ts tests/background/index.test.ts
```

Expected: FAIL because the coordinator files do not exist and `background/chat` still cancels on port disconnect.

- [ ] **Step 3: Create background message helper**

Create `src/background/chat/chat-session-message.ts`:

```ts
import type { ChatMessage, ChatMessageContent } from '../../shared/types/chat';

const chatMessageTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Creates a chat message owned by the background global session.
 *
 * @param role - The message role.
 * @param content - The message content.
 * @param status - The message lifecycle status.
 */
export function createSessionChatMessage(
  role: ChatMessage['role'],
  content: ChatMessageContent,
  status: ChatMessage['status'] = 'completed',
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    status,
    createdAt: chatMessageTimeFormatter.format(new Date()),
  };
}
```

- [ ] **Step 4: Create broadcast helper**

Create `src/background/chat/chat-session-broadcaster.ts`:

```ts
import type { RuntimeMessage } from '../../shared/types/runtime-messages';

/**
 * Broadcasts a runtime message to all tabs that can receive the content script.
 *
 * @param message - The message to send.
 */
export async function broadcastToContentTabs(message: RuntimeMessage<string>): Promise<void> {
  const tabs = await chrome.tabs.query({});

  await Promise.all(tabs.map(async (tab) => {
    if (tab.id == null) {
      return;
    }

    await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
  }));
}
```

- [ ] **Step 5: Create `ChatSessionCoordinator`**

Create `src/background/chat/chat-session-coordinator.ts` with:

```ts
import { LlmOrchestrator } from '../llm/llm-orchestrator';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../../shared/storage/chat-history-repository';
import {
  chatStateSyncType,
  chatStreamChunkType,
  type ChatMessage,
  type ChatRequestPayload,
  type ChatResponsePayload,
  type ChatSessionState,
} from '../../shared/types/chat';
import { getChatMessageTextContent } from '../../shared/types/chat';
import { createSessionChatMessage } from './chat-session-message';
import { broadcastToContentTabs } from './chat-session-broadcaster';

const globalChatScope = 'global-chat';

/**
 * Owns the profile-wide chat transcript and running request lifecycle.
 */
export class ChatSessionCoordinator {
  private messages: ChatMessage[] = [];
  private isHydrated = false;
  private hydratePromise: Promise<void> | null = null;
  private requestId: number | null = null;
  private activeAssistantMessageId: string | null = null;
  private nextRequestId = 1;
  private cancelRequested = false;

  constructor(private readonly llmOrchestrator = new LlmOrchestrator()) {}

  /**
   * Returns the current global chat state.
   */
  async getState(): Promise<ChatSessionState> {
    await this.hydrate();
    return this.buildState();
  }

  /**
   * Starts a new global chat request when no request is running.
   *
   * @param payload - The request input. History is owned by this coordinator.
   */
  async request(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    await this.hydrate();
    if (this.requestId !== null) {
      throw new Error('CHAT_SESSION_BUSY');
    }

    const currentRequestId = this.nextRequestId++;
    const userMessage = createSessionChatMessage('user', payload.input);
    const assistantMessage = createSessionChatMessage('assistant', '', 'streaming');
    const requestHistory = this.buildRequestHistory();

    this.messages = [...this.messages, userMessage, assistantMessage];
    this.requestId = currentRequestId;
    this.activeAssistantMessageId = assistantMessage.id;
    this.cancelRequested = false;

    await this.persistAndBroadcastState();

    try {
      const response = await this.llmOrchestrator.complete(
        globalChatScope,
        { input: payload.input, history: requestHistory },
        (chunk) => {
          void this.acceptChunk(currentRequestId, assistantMessage.id, chunk);
        },
      );

      this.updateAssistantMessage(assistantMessage.id, {
        content: response.reply,
        status: 'completed',
        errorMessage: undefined,
      });
      return response;
    } catch (error) {
      this.updateAssistantMessage(assistantMessage.id, {
        status: this.cancelRequested ? 'interrupted' : 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (this.requestId === currentRequestId) {
        this.requestId = null;
        this.activeAssistantMessageId = null;
        this.cancelRequested = false;
      }
      await this.persistAndBroadcastState();
    }
  }

  /**
   * Cancels the currently running global chat request.
   */
  async cancel(): Promise<void> {
    this.cancelRequested = true;
    this.llmOrchestrator.cancel(globalChatScope);
  }

  /**
   * Clears the global chat state when no request is running.
   */
  async clear(): Promise<void> {
    await this.hydrate();
    if (this.requestId !== null) {
      throw new Error('CHAT_SESSION_BUSY');
    }
    this.messages = [];
    await clearChatHistory();
    await this.broadcastState();
  }

  private async hydrate(): Promise<void> {
    if (this.isHydrated) {
      return;
    }
    this.hydratePromise ??= loadChatHistory().then((history) => {
      this.messages = history.map((message) => {
        if (message.role === 'assistant' && message.status === 'streaming') {
          return { ...message, status: 'error', errorMessage: '后台会话已结束，当前请求已中断。' };
        }
        return message;
      });
      this.isHydrated = true;
    });
    await this.hydratePromise;
  }

  private buildRequestHistory(): ChatMessage[] {
    return this.messages
      .filter((message) => !(message.role === 'assistant' && message.status === 'error'))
      .map((message) => ({
        ...message,
        content: getChatMessageTextContent(message.content),
      }));
  }

  private buildState(): ChatSessionState {
    return {
      messages: this.messages,
      isRunning: this.requestId !== null,
      requestId: this.requestId,
      activeAssistantMessageId: this.activeAssistantMessageId,
    };
  }

  private updateAssistantMessage(id: string, patch: Partial<ChatMessage>): void {
    this.messages = this.messages.map((message) => (
      message.id === id ? { ...message, ...patch } : message
    ));
  }

  private async acceptChunk(requestId: number, messageId: string, chunk: string): Promise<void> {
    if (!chunk || this.requestId !== requestId || this.activeAssistantMessageId !== messageId) {
      return;
    }

    this.messages = this.messages.map((message) => (
      message.id === messageId
        ? { ...message, content: getChatMessageTextContent(message.content) + chunk }
        : message
    ));
    await saveChatHistory(this.messages);
    await broadcastToContentTabs({
      type: chatStreamChunkType,
      payload: { requestId, messageId, content: chunk },
    });
  }

  private async persistAndBroadcastState(): Promise<void> {
    await saveChatHistory(this.messages);
    await this.broadcastState();
  }

  private async broadcastState(): Promise<void> {
    await broadcastToContentTabs({
      type: chatStateSyncType,
      payload: this.buildState(),
    });
  }
}
```

- [ ] **Step 6: Wire `background/chat/index.ts`**

Use one coordinator instance. Route:

- `chat.request` to `coordinator.request`.
- `chat.state.query` to `coordinator.getState`.
- `chat.cancel` to `coordinator.cancel`.
- `chat.clear` to `coordinator.clear`.

Remove the `chrome.runtime.onConnect` chat cancellation listener from `src/background/chat/index.ts`. Keep screenshot handler registration.

- [ ] **Step 7: Update background tests**

In `tests/background/index.test.ts`, replace the old port disconnect cancellation test with a test that imports `initChatModule` and asserts no chat cancel happens on `chatSessionPortName` disconnect:

```ts
it('does not cancel in-flight chat when the content runtime port disconnects', async () => {
  vi.resetModules();
  const cancelMock = vi.fn();

  vi.doMock('../../src/background/chat/chat-session-coordinator', () => ({
    ChatSessionCoordinator: vi.fn().mockImplementation(() => ({
      cancel: cancelMock,
      request: vi.fn(),
      getState: vi.fn(),
      clear: vi.fn(),
    })),
  }));

  const { initChatModule } = await import('../../src/background/chat');
  initChatModule();

  const port = globalThis.__chromeTestUtils.createRuntimePort({
    name: 'chatbrowserx.chat.session',
    tabId: 37,
  });
  port.__disconnect();

  expect(cancelMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 8: Run background tests**

Run:

```bash
npx vitest run tests/background/chat/chat-session-coordinator.test.ts tests/background/index.test.ts tests/background/selection/index.test.ts
```

Expected: PASS.

## Task 5: Content Chat Controller Synchronization

**Files:**
- Modify: `src/ui/content/chat/use-chat-controller.ts`
- Modify: `src/ui/content/chat/ChatPanel.tsx`
- Modify: `tests/ui/content/chat/use-chat-controller.test.tsx`

- [ ] **Step 1: Write failing content sync tests**

In `tests/ui/content/chat/use-chat-controller.test.tsx`, add:

```ts
it('queries global chat state on mount and renders a running task', async () => {
  const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
  sendMessageMock.mockResolvedValueOnce({
    ok: true,
    data: {
      messages: [
        { id: 'u1', role: 'user', content: '正在执行' },
        { id: 'a1', role: 'assistant', content: '处理中', status: 'streaming' },
      ],
      isRunning: true,
      requestId: 7,
      activeAssistantMessageId: 'a1',
    },
  });

  const { result } = renderHook(() => useChatController());

  await waitFor(() => {
    expect(result.current.isSending).toBe(true);
    expect(result.current.messages).toHaveLength(2);
  });

  expect(sendMessageMock).toHaveBeenCalledWith({ type: 'chatbrowserx.chat.state.query' });
});

it('ignores stream chunks for stale request ids', async () => {
  const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
  sendMessageMock.mockResolvedValueOnce({
    ok: true,
    data: {
      messages: [{ id: 'a1', role: 'assistant', content: '处理中', status: 'streaming' }],
      isRunning: true,
      requestId: 7,
      activeAssistantMessageId: 'a1',
    },
  });

  const { result } = renderHook(() => useChatController());

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(1);
  });

  await act(async () => {
    globalThis.__chromeTestUtils.dispatchRuntimeMessage({
      type: 'chatbrowserx.chat.stream.chunk',
      payload: { requestId: 8, messageId: 'a1', content: ' stale' },
    });
  });

  expect(result.current.messages[0].content).toBe('处理中');
});
```

- [ ] **Step 2: Run failing content tests**

Run:

```bash
npx vitest run tests/ui/content/chat/use-chat-controller.test.tsx
```

Expected: FAIL because `useChatController` still requires hostname, reads storage directly, and expects chunks without ids.

- [ ] **Step 3: Implement state query and subscriptions**

In `src/ui/content/chat/use-chat-controller.ts`:

- Remove imports from `chat-history-repository`.
- Change signature to `export function useChatController()`.
- Track `requestIdRef` and `activeAssistantMessageIdRef`.
- On mount, send `{ type: chatStateQueryType }`, unwrap `ChatStateRuntimeResponse`, and set `messages` / `isSending`.
- Listen for `chatStateSyncType` and replace all state from payload.
- Listen for `chatStreamChunkType` and append only when `payload.requestId` and `payload.messageId` match refs.
- `clearHistory` sends `{ type: chatClearType }`.
- `stop` sends `{ type: chatCancelType }` if `isSending`.
- `sendMessage` returns the final reply from `chat.request`, but local state is overwritten by sync messages.

The chunk append branch should use:

```ts
if (message.payload.requestId !== requestIdRef.current) return;
if (message.payload.messageId !== activeAssistantMessageIdRef.current) return;
```

- [ ] **Step 4: Disable sending during running state**

`ChatPanel` already checks `isSending` before submit. Ensure `ChatComposer` receives `disabled={isSending}` and `isSending={isSending}` as it does today. Do not add a second independent local running flag.

- [ ] **Step 5: Update older hook tests**

Change all `renderHook(() => useChatController('example.com'))` to `renderHook(() => useChatController())`.

For tests that seed storage directly under `chatbrowserx.history.example.com`, either:

- seed `chatbrowserx.history` and mock the initial `chat.state.query`, or
- rewrite them as background coordinator tests if they verify persistence.

Keep UI hook tests focused on runtime query, sync, chunk matching, send, stop, and clear message dispatch.

- [ ] **Step 6: Run content hook tests**

Run:

```bash
npx vitest run tests/ui/content/chat/use-chat-controller.test.tsx tests/ui/content/chat/ChatPanel.test.tsx
```

Expected: PASS.

## Task 6: Content App And Lifecycle Wiring

**Files:**
- Modify: `src/ui/content/ContentApp.tsx`
- Modify: `src/ui/content/use-content-shell.ts`
- Modify: `src/ui/content/index.tsx`
- Modify: `tests/ui/content/ContentApp.test.tsx`
- Modify: `tests/ui/content/index.test.tsx`

- [ ] **Step 1: Write failing lifecycle assertion**

In `tests/background/index.test.ts` or a dedicated chat module test, assert that disconnecting `chatSessionPortName` does not call chat cancel. Selection cancellation remains covered in `tests/background/selection/index.test.ts`.

- [ ] **Step 2: Keep content port only for selection lifecycle**

Do not remove the content `chatSessionPortName` port from `src/ui/content/index.tsx` in this task. It is still used by `background/selection` for page lifecycle cleanup. The chat module simply stops listening to that port.

- [ ] **Step 3: Update app tests for global panel state**

In `tests/ui/content/ContentApp.test.tsx`, remove local hostname normalization helper and use:

```ts
const panelStateKey = 'chatbrowserx.panel';
```

Verify existing pin/open tests now read and write `chatbrowserx.panel`.

- [ ] **Step 4: Run content app tests**

Run:

```bash
npx vitest run tests/ui/content/ContentApp.test.tsx tests/ui/content/index.test.tsx tests/background/index.test.ts
```

Expected: PASS.

## Task 7: Spec Synchronization

**Files:**
- Modify: `docs/superpowers/specs/browser-agent-project-spec.md`
- Modify: `docs/superpowers/specs/selection-bubble-feature-spec.md`

- [ ] **Step 1: Update main spec storage and lifecycle text**

In `docs/superpowers/specs/browser-agent-project-spec.md`, update:

- `src/ui/content` panel state: `chatbrowserx.panel` is profile-wide.
- `src/background/chat`: owns one profile-wide chat session, broadcasts sync/chunks to content tabs, rejects concurrent `chat.request` with `CHAT_SESSION_BUSY`.
- `src/background/llm`: supports scoped in-flight sessions; chat uses `global-chat`, selection uses tab id.
- key runtime chain: refresh/new tab queries `chat.state.query`; stream/state sync uses broadcast.
- message protocol: include `chatbrowserx.chat.state.query`, `chatbrowserx.chat.state.sync`, and `chatbrowserx.chat.clear`.
- storage protocol: `chatbrowserx.history` and `chatbrowserx.panel` are profile-wide, not hostname scoped.

- [ ] **Step 2: Update selection spec lifecycle text**

In `docs/superpowers/specs/selection-bubble-feature-spec.md`, keep selection page lifecycle cancellation explicit:

```md
content script 断开 `chatSessionPortName` 端口时，`background/selection` 会取消 selection 请求；该端口断开不再取消 chat 请求。
```

- [ ] **Step 3: Run doc consistency search**

Run:

```bash
rg -n "hostname scope|按 hostname|chatbrowserx\\.history .*hostname|chatbrowserx\\.panel .*hostname|tab 维度会话控制" docs/superpowers/specs src
```

Expected: no stale normative statement remains for chat history, panel state, or chat in-flight ownership. Historical “current implementation” text in design docs may remain if clearly labeled.

## Task 8: Full Verification

**Files:**
- Verify all changed source, tests, and docs.

- [ ] **Step 1: Run focused test groups**

Run:

```bash
npx vitest run tests/shared/storage/chat-history-repository.test.ts tests/ui/content/content-panel-state.test.ts tests/shared/types/chat.test.ts tests/background/llm/llm-orchestrator.test.ts tests/background/chat/chat-session-coordinator.test.ts tests/ui/content/chat/use-chat-controller.test.tsx tests/ui/content/ContentApp.test.tsx tests/background/index.test.ts tests/background/selection/index.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run repository check**

Run:

```bash
npm run check
```

Expected: `tsc --noEmit --noUnusedLocals --noUnusedParameters` succeeds and all Vitest tests pass.

- [ ] **Step 3: Inspect diff without committing**

Run:

```bash
git status --short
git diff -- docs/superpowers/designs/2026-05-14-global-chat-session-design.md docs/superpowers/plans/2026-05-14-global-chat-session.md docs/superpowers/specs/browser-agent-project-spec.md docs/superpowers/specs/selection-bubble-feature-spec.md src tests
```

Expected: changed files match this plan. Do not create a git commit.

## Self-Review

- Spec coverage: storage keys, panel state, global background ownership, state query/sync, stream chunk identity, broadcast, refresh behavior, concurrent request rejection, active tab tools, selection lifecycle, and spec synchronization are covered.
- Placeholder scan: this plan contains concrete file paths, commands, expected outcomes, and code snippets for new APIs.
- Type consistency: `ChatSessionState`, `chatStateQueryType`, `chatStateSyncType`, `chatClearType`, `requestId`, `activeAssistantMessageId`, and `CHAT_SESSION_BUSY` are named consistently across tasks.
