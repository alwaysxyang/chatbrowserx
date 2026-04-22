# Selection Bubble (Translate / Ask AI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After selecting text on any page, show a bubble toolbar with Translate / Ask AI; clicking runs the current LLM via background with streaming output into a nearby result bubble that includes a copy button.

**Architecture:** Implement the UI in `src/ui/content/selection` (content script, DOM selection + bubble rendering) and route all LLM calls through `src/background/selection` which reuses `src/background/llm/LlmOrchestrator` for tab-scoped streaming/cancel. Define a dedicated message protocol in `src/shared/types/selection.ts` to avoid mixing streams with chat.

**Tech Stack:** TypeScript, React 18, Chrome extension MV3, Vitest, Testing Library

---

> Repo rule: this repository forbids creating git commits. Do NOT add any `git commit` steps when executing this plan.

## File Map (Create / Modify)

**Docs**
- Modify: `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`

**Shared**
- Create: `src/shared/types/selection.ts`
- Test: `tests/shared/types/selection.test.ts`

**Background**
- Modify: `src/background/llm/llm-orchestrator.ts`
- Modify: `src/background/chat/index.ts`
- Create: `src/background/selection/index.ts`
- Modify: `src/background/index.ts`
- Test: `tests/background/selection/index.test.ts`

**UI (content script)**
- Create: `src/ui/content/selection/selection-prompts.ts`
- Create: `src/ui/content/selection/page-content.ts`
- Create: `src/ui/content/selection/SelectionBubble.tsx`
- Create: `src/ui/content/selection/selection.css`
- Modify: `src/ui/content/styles.css`
- Modify: `src/ui/content/ContentApp.tsx`
- Test: `tests/ui/content/selection/selection-prompts.test.ts`

**i18n**
- Modify: `src/shared/i18n/message-catalog.ts`

---

### Task 1: Spec Sync For New Folders

**Files:**
- Modify: `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`

- [ ] **Step 1: Update the directory tree to include new folders**

Add:
- `src/background/selection/`
- `src/ui/content/selection/`

- [ ] **Step 1.1: Apply directory tree snippet**

In the `src/` tree section, insert these nodes (keep ordering consistent with nearby entries):

```text
src/
  background/
    chat/
    llm/
    selection/
    speech/
    index.ts
  ui/
    content/
      chat/
      pdf/
      selection/
      settings/
      speech/
```

- [ ] **Step 2: Apply responsibility text**

Add the following subsections:

```md
#### `src/background/selection`

- 负责选中文本相关的 runtime message 处理（`selection.*`）。
- 负责把 selection 请求路由到 `src/background/llm` 的 LLM 编排（如 `LlmOrchestrator`），并将流式 chunk 回推给 content script。
- 不承载 provider 细节，不包含 JSX。

#### `src/ui/content/selection`

- 负责监听页面 selection，并在选区附近渲染“气泡工具条 + 结果面板”。
- 负责 Ask AI 场景下的页面文本读取（不滚动，仅 `innerText` 的 best-effort 策略）。
- 不直接依赖 provider 实现；模型请求必须经由 background。
```

- [ ] **Step 3: Add spec index entry**

Add:
- `docs/superpowers/specs/2026-04-22-selection-bubble-translate-askai-design.md`

- [ ] **Step 3.1: Apply index entry text**

In the spec index, add:

```md
- `docs/superpowers/specs/2026-04-22-selection-bubble-translate-askai-design.md`
  - 类型：feature spec
  - 用途：选中文本“气泡工具条 + 翻译/Ask AI + 流式结果面板”的当前实现边界与链路说明
```

---

### Task 2: Define Selection Runtime Message Protocol

**Files:**
- Create: `src/shared/types/selection.ts`
- Test: `tests/shared/types/selection.test.ts`

- [ ] **Step 1: Write failing tests for message guards**

Create `tests/shared/types/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  isSelectionCancelMessage,
  isSelectionRequestMessage,
  isSelectionStreamChunkMessage,
  selectionCancelType,
  selectionRequestType,
  selectionStreamChunkType,
} from '../../../src/shared/types/selection';

describe('selection message guards', () => {
  it('accepts selection request messages', () => {
    expect(isSelectionRequestMessage({
      type: selectionRequestType,
      payload: { requestId: 'r1', mode: 'translate', prompt: 'hello' },
    })).toBe(true);
  });

  it('rejects malformed selection request messages', () => {
    expect(isSelectionRequestMessage({ type: selectionRequestType, payload: {} })).toBe(false);
  });

  it('accepts selection stream chunk messages', () => {
    expect(isSelectionStreamChunkMessage({
      type: selectionStreamChunkType,
      payload: { requestId: 'r1', content: 'chunk' },
    })).toBe(true);
  });

  it('accepts selection cancel messages', () => {
    expect(isSelectionCancelMessage({ type: selectionCancelType })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `npm test -- tests/shared/types/selection.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/shared/types/selection.ts`**

Create `src/shared/types/selection.ts`:

```ts
import type { RuntimeMessage, RuntimeResponse } from './runtime-messages';
import { createRuntimeMessageGuard } from './runtime-messages';

export type SelectionMode = 'translate' | 'ask_ai';

export interface SelectionRequestPayload {
  requestId: string;
  mode: SelectionMode;
  prompt: string;
}

export interface SelectionResponsePayload {
  reply: string;
}

export const selectionRequestType = 'chatbrowserx.selection.request';
export const selectionStreamChunkType = 'chatbrowserx.selection.stream.chunk';
export const selectionCancelType = 'chatbrowserx.selection.cancel';

export interface SelectionRequestMessage extends RuntimeMessage<typeof selectionRequestType> {
  payload: SelectionRequestPayload;
}

export type SelectionRuntimeResponse = RuntimeResponse<SelectionResponsePayload>;

export interface SelectionStreamChunkMessage extends RuntimeMessage<typeof selectionStreamChunkType> {
  payload: {
    requestId: string;
    content: string;
  };
}

export interface SelectionCancelMessage extends RuntimeMessage<typeof selectionCancelType> {}

const isSelectionRequestMessageGuard = createRuntimeMessageGuard<SelectionRequestMessage>(selectionRequestType);
const isSelectionStreamChunkMessageGuard = createRuntimeMessageGuard<SelectionStreamChunkMessage>(selectionStreamChunkType);
const isSelectionCancelMessageGuard = createRuntimeMessageGuard<SelectionCancelMessage>(selectionCancelType);

export function isSelectionRequestMessage(message: unknown): message is SelectionRequestMessage {
  if (!isSelectionRequestMessageGuard(message)) return false;
  return Boolean(
    message.payload &&
    typeof message.payload === 'object' &&
    typeof (message.payload as SelectionRequestPayload).requestId === 'string' &&
    ((message.payload as SelectionRequestPayload).mode === 'translate' || (message.payload as SelectionRequestPayload).mode === 'ask_ai') &&
    typeof (message.payload as SelectionRequestPayload).prompt === 'string',
  );
}

export function isSelectionStreamChunkMessage(message: unknown): message is SelectionStreamChunkMessage {
  if (!isSelectionStreamChunkMessageGuard(message)) return false;
  return Boolean(
    message.payload &&
    typeof message.payload === 'object' &&
    typeof (message.payload as SelectionStreamChunkMessage['payload']).requestId === 'string' &&
    typeof (message.payload as SelectionStreamChunkMessage['payload']).content === 'string',
  );
}

export function isSelectionCancelMessage(message: unknown): message is SelectionCancelMessage {
  return isSelectionCancelMessageGuard(message);
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm test -- tests/shared/types/selection.test.ts`
Expected: PASS.

---

### Task 3: Refactor `LlmOrchestrator` To Support Custom Streaming

**Files:**
- Modify: `src/background/llm/llm-orchestrator.ts`
- Modify: `src/background/chat/index.ts`

- [ ] **Step 1: Update `LlmOrchestrator.complete` signature**

Change to:

```ts
async complete(
  tabId: number,
  payload: ChatRequestPayload,
  onChunk?: (chunk: string) => void,
): Promise<ChatResponsePayload>
```

and remove direct dependency on `chatStreamChunkType`.

- [ ] **Step 2: Guard streaming callback to prevent stale chunks**

When calling `service.complete(...)`, wrap the chunk callback:

```ts
(chunk) => {
  const current = this.sessions.get(tabId);
  if (current?.requestId !== requestId) return;
  onChunk?.(chunk);
}
```

- [ ] **Step 2.1: Apply the full `LlmOrchestrator` update**

Replace `src/background/llm/llm-orchestrator.ts` with:

```ts
import { ChatCompletionService } from '../../llm/services/chat-completion';
import { loadSettings } from '../../shared/storage/settings-repository';
import type { ChatRequestPayload, ChatResponsePayload } from '../../shared/types/chat';

interface TabSession {
  requestId: number;
  controller: AbortController;
  onChunk?: (chunk: string) => void;
}

/**
 * Orchestrates LLM chat completion requests for background modules.
 *
 * - One in-flight request per tab.
 * - New requests cancel older ones for the same tab.
 * - Streaming callbacks are guarded to avoid stale chunks after replacement/cancel.
 */
export class LlmOrchestrator {
  private sessions = new Map<number, TabSession>();
  private nextRequestId = 1;

  /**
   * Runs a chat completion request for a tab and optionally streams chunks.
   *
   * @param tabId - The tab ID making the request.
   * @param payload - Chat payload including history and input.
   * @param onChunk - Optional streaming callback for incremental output.
   * @returns The final reply text.
   */
  async complete(tabId: number, payload: ChatRequestPayload, onChunk?: (chunk: string) => void): Promise<ChatResponsePayload> {
    // Enforce "single in-flight per tab": stop the previous request if any.
    this.cancel(tabId);

    const requestId = this.nextRequestId++;
    const settings = await loadSettings();
    const controller = new AbortController();
    const service = new ChatCompletionService({ settings: settings.model });

    this.sessions.set(tabId, { requestId, controller, onChunk });

    try {
      const reply = await service.complete(
        payload.history,
        payload.input,
        (chunk) => {
          const current = this.sessions.get(tabId);
          if (current?.requestId !== requestId) return;
          current.onChunk?.(chunk);
        },
        controller.signal,
      );

      return { reply };
    } finally {
      const current = this.sessions.get(tabId);
      if (current?.requestId === requestId) {
        this.sessions.delete(tabId);
      }
    }
  }

  /**
   * Cancels the current in-flight request (if any) for a tab.
   *
   * @param tabId - The tab ID to cancel.
   */
  cancel(tabId: number): void {
    const session = this.sessions.get(tabId);
    if (!session) return;

    session.controller.abort();
    this.sessions.delete(tabId);
  }
}
```

- [ ] **Step 3: Update chat module to pass its chunk forwarder**

In `src/background/chat/index.ts`, provide:

```ts
void toRuntimeResponse(llmOrchestrator.complete(tabId, message.payload, (chunk) => {
  void chrome.tabs.sendMessage(tabId, { type: chatStreamChunkType, payload: { content: chunk } }).catch(() => undefined);
})).then(sendResponse);
```

- [ ] **Step 4: Run background tests**

Run: `npm test -- tests/background/index.test.ts`
Expected: PASS.

---

### Task 4: Implement Background Selection Module

**Files:**
- Create: `src/background/selection/index.ts`
- Modify: `src/background/index.ts`
- Test: `tests/background/selection/index.test.ts`

- [ ] **Step 1: Write a failing test for selection module wiring**

Create `tests/background/selection/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { selectionRequestType, selectionCancelType } from '../../../src/shared/types/selection';

describe('background selection module', () => {
  it('routes selection requests to LlmOrchestrator and cancels on request', async () => {
    vi.resetModules();
    const cancelMock = vi.fn();
    const completeMock = vi.fn().mockResolvedValue({ reply: 'ok' });

    vi.doMock('../../../src/background/llm/llm-orchestrator', () => ({
      LlmOrchestrator: vi.fn().mockImplementation(() => ({
        complete: completeMock,
        cancel: cancelMock,
      })),
    }));

    const { initSelectionModule } = await import('../../../src/background/selection');
    initSelectionModule();

    const listeners = (chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);
    const sender = { tab: { id: 99 } } as chrome.runtime.MessageSender;
    const sendResponse = vi.fn();

    // Request
    for (const listener of listeners) {
      const result = listener({ type: selectionRequestType, payload: { requestId: 'r1', mode: 'translate', prompt: 'hi' } }, sender, sendResponse);
      if (result === true) break;
    }
    await Promise.resolve();

    expect(completeMock).toHaveBeenCalledWith(99, { history: [], input: 'hi' }, expect.any(Function));

    // Cancel
    for (const listener of listeners) {
      listener({ type: selectionCancelType }, sender, vi.fn());
    }
    expect(cancelMock).toHaveBeenCalledWith(99);
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `npm test -- tests/background/selection/index.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/background/selection/index.ts`**

Create `src/background/selection/index.ts`:

```ts
import { LlmOrchestrator } from '../llm/llm-orchestrator';
import { runtimeErrorResponse, toRuntimeResponse } from '../../shared/types/runtime-messages';
import { chatSessionPortName } from '../../shared/types/chat';
import {
  isSelectionCancelMessage,
  isSelectionRequestMessage,
  selectionStreamChunkType,
  type SelectionResponsePayload,
  type SelectionRuntimeResponse,
} from '../../shared/types/selection';

const llmOrchestrator = new LlmOrchestrator();

export function initSelectionModule(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isSelectionRequestMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse(runtimeErrorResponse('No tab ID'));
      return true;
    }

    const { requestId, prompt } = message.payload;

    void toRuntimeResponse<SelectionResponsePayload>(
      llmOrchestrator.complete(
        tabId,
        { history: [], input: prompt },
        (chunk) => {
          void chrome.tabs
            .sendMessage(tabId, { type: selectionStreamChunkType, payload: { requestId, content: chunk } })
            .catch(() => undefined);
        },
      ).then((reply) => ({ reply: reply.reply })),
    ).then((response) => {
      sendResponse(response satisfies SelectionRuntimeResponse);
    });

    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!isSelectionCancelMessage(message)) {
      return undefined;
    }

    const tabId = sender.tab?.id;
    if (tabId != null) {
      llmOrchestrator.cancel(tabId);
    }

    return undefined;
  });

  // Reuse the existing page-lifecycle port to ensure selection requests stop on navigation.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== chatSessionPortName) return;
    const tabId = port.sender?.tab?.id;
    if (tabId == null) return;

    port.onDisconnect.addListener(() => {
      llmOrchestrator.cancel(tabId);
    });
  });
}
```

- [ ] **Step 4: Wire module into background entry**

Modify `src/background/index.ts`:

```ts
import { initSelectionModule } from './selection';
// ...
initSelectionModule();
```

- [ ] **Step 5: Re-run the new test**

Run: `npm test -- tests/background/selection/index.test.ts`
Expected: PASS.

---

### Task 5: Add Prompt Builders (Translate / Ask AI)

**Files:**
- Create: `src/ui/content/selection/selection-prompts.ts`
- Test: `tests/ui/content/selection/selection-prompts.test.ts`

- [ ] **Step 1: Write failing tests for language resolution and prompt shape**

Create `tests/ui/content/selection/selection-prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildAskAiPrompt, buildTranslatePrompt, resolveTargetLanguage } from '../../../src/ui/content/selection/selection-prompts';

describe('selection prompts', () => {
  it('maps system language using browser language', () => {
    expect(resolveTargetLanguage({ uiLanguage: 'system', browserLanguage: 'zh-CN' })).toEqual({ locale: 'zh', name: 'Chinese' });
    expect(resolveTargetLanguage({ uiLanguage: 'system', browserLanguage: 'ja-JP' })).toEqual({ locale: 'ja', name: 'Japanese' });
    expect(resolveTargetLanguage({ uiLanguage: 'system', browserLanguage: 'fr-FR' })).toEqual({ locale: 'en', name: 'English' });
  });

  it('builds translate prompt containing target language and selected text', () => {
    const prompt = buildTranslatePrompt({ selectedText: 'Hello', targetLanguageName: 'Japanese' });
    expect(prompt).toContain('Japanese');
    expect(prompt).toContain('Hello');
  });

  it('builds ask-ai prompt containing page content and selected text', () => {
    const prompt = buildAskAiPrompt({
      selectedText: 'S',
      pageTitle: 'T',
      pageUrl: 'U',
      pageText: 'P',
      targetLanguageName: 'English',
      maxPageChars: 10,
    });
    expect(prompt).toContain('Selected Text');
    expect(prompt).toContain('Page Content');
    expect(prompt).toContain('S');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npm test -- tests/ui/content/selection/selection-prompts.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/ui/content/selection/selection-prompts.ts`**

Create `src/ui/content/selection/selection-prompts.ts`:

```ts
import type { UiLanguage } from '../../../shared/types/settings';

export type TargetLocale = 'zh' | 'en' | 'ja';

export function resolveTargetLanguage(params: { uiLanguage: UiLanguage; browserLanguage: string | undefined }): { locale: TargetLocale; name: string } {
  const { uiLanguage, browserLanguage } = params;
  if (uiLanguage === 'zh') return { locale: 'zh', name: 'Chinese' };
  if (uiLanguage === 'ja') return { locale: 'ja', name: 'Japanese' };
  if (uiLanguage === 'en') return { locale: 'en', name: 'English' };

  const lang = (browserLanguage || '').toLowerCase();
  if (lang.startsWith('zh')) return { locale: 'zh', name: 'Chinese' };
  if (lang.startsWith('ja')) return { locale: 'ja', name: 'Japanese' };
  return { locale: 'en', name: 'English' };
}

export function buildTranslatePrompt(params: { selectedText: string; targetLanguageName: string }): string {
  return [
    `Translate the text below into ${params.targetLanguageName}.`,
    `Output only the translation. Do not add explanations.`,
    `Preserve paragraph breaks when possible.`,
    `---`,
    params.selectedText,
  ].join('\n');
}

export function buildAskAiPrompt(params: {
  selectedText: string;
  pageTitle: string;
  pageUrl: string;
  pageText: string;
  targetLanguageName: string;
  maxPageChars: number;
}): string {
  const pageText = params.pageText.length > params.maxPageChars ? params.pageText.slice(0, params.maxPageChars) : params.pageText;
  return [
    `Analyze the Selected Text using the Page Content as context.`,
    `Answer in ${params.targetLanguageName}.`,
    ``,
    `Page Title: ${params.pageTitle}`,
    `Page URL: ${params.pageUrl}`,
    ``,
    `Page Content:`,
    pageText,
    ``,
    `Selected Text:`,
    params.selectedText,
  ].join('\n');
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm test -- tests/ui/content/selection/selection-prompts.test.ts`
Expected: PASS.

---

### Task 6: Implement Page Content Extraction (No Scroll)

**Files:**
- Create: `src/ui/content/selection/page-content.ts`

- [ ] **Step 1: Implement helpers for selection UI**

Create `src/ui/content/selection/page-content.ts`:

```ts
/**
 * Reads the current page content for Ask AI without scrolling.
 * This is best-effort and intentionally avoids complex crawling.
 */
export function readCurrentPageText(maxChars: number): { title: string; url: string; text: string } {
  const title = document.title || '';
  const url = window.location.href || '';
  const raw = document.body?.innerText || '';
  const text = raw.length > maxChars ? raw.slice(0, maxChars) : raw;
  return { title, url, text };
}
```

- [ ] **Step 2: Run a quick focused build**

Run: `npm run -s build`
Expected: PASS.

---

### Task 7: Implement Selection Bubble UI (Toolbar + Streaming Result + Copy)

**Files:**
- Create: `src/ui/content/selection/SelectionBubble.tsx`
- Create: `src/ui/content/selection/selection.css`
- Modify: `src/ui/content/styles.css`
- Modify: `src/ui/content/ContentApp.tsx`
- Modify: `src/shared/i18n/message-catalog.ts`

- [ ] **Step 1: Add i18n keys for labels**

Add message keys:
- `selection.toolbar.translate`
- `selection.toolbar.askAi`

Example:

```ts
  | 'selection.toolbar.translate'
  | 'selection.toolbar.askAi'
```

and in `messages`:

```ts
  'selection.toolbar.translate': { zh: '翻译', en: 'Translate', ja: '翻訳' },
  'selection.toolbar.askAi': { zh: 'Ask AI', en: 'Ask AI', ja: 'Ask AI' },
```

- [ ] **Step 2: Add CSS import and bubble styles**

In `src/ui/content/styles.css` add:

```css
@import "./selection/selection.css";
```

Create `src/ui/content/selection/selection.css` defining:
- `.selection-bubble-root` (position: fixed; z-index; font)
- `.selection-toolbar` (pill buttons)
- `.selection-panel` (result box with max width/height + scroll)
- `.selection-panel-footer` (divider + copy button area)

- [ ] **Step 2.1: Implement `src/ui/content/selection/selection.css`**

Create `src/ui/content/selection/selection.css`:

```css
.selection-bubble-root {
  position: fixed;
  z-index: 2147483646;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #0f172a;
}

.selection-bubble-root[data-placement="above"] {
  transform: translate(-50%, calc(-100% - 10px));
}

.selection-bubble-root[data-placement="below"] {
  transform: translate(-50%, 10px);
}

.selection-bubble-stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  max-width: 420px;
}

.selection-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 14px 34px rgba(2, 6, 23, 0.22);
}

.selection-toolbar-button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.96);
  border-radius: 999px;
  padding: 7px 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.selection-toolbar-button:hover {
  background: rgba(255, 255, 255, 0.18);
}

.selection-toolbar-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.selection-panel {
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 48px rgba(2, 6, 23, 0.18);
  overflow: hidden;
}

.selection-panel-body {
  padding: 12px 12px 10px;
  font-size: 12px;
  line-height: 1.55;
  color: rgba(15, 23, 42, 0.88);
  max-height: min(44vh, 320px);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.selection-panel-divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.1);
}

.selection-panel-footer {
  padding: 8px 10px;
  display: flex;
  justify-content: flex-end;
}

.selection-copy-button {
  border: none;
  padding: 0;
  margin: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.04);
  color: #64748b;
  cursor: pointer;
}

.selection-copy-button:hover {
  color: #334155;
  background: rgba(15, 23, 42, 0.08);
}

.selection-copy-icon-success {
  color: #16a34a;
}
```

- [ ] **Step 3: Implement `SelectionBubble` component**

Create `src/ui/content/selection/SelectionBubble.tsx` that:
- Listens to `mouseup` and `keyup` to capture selection text and range rect.
- Shows a small toolbar near the selection.
- On Translate/Ask AI click:
  - Generates a `requestId`.
  - Builds the prompt (uses `loadSettings()` for `general.uiLanguage`, `navigator.language` for system mapping).
  - For Ask AI, reads page text using `readCurrentPageText(40000)`.
  - Starts streaming state, sends `chrome.runtime.sendMessage({ type: selectionRequestType, payload: ... })`.
  - Listens to `selectionStreamChunkType` via `chrome.runtime.onMessage`.
  - Updates displayed text as chunks arrive, and finalizes when response arrives.
- Copy button:
  - Reuse chat copy logic: call `copyMessageContent(resultText)` and toggle `isCopied` with the same `data-tooltip` texts (`chat.message.copy` / `chat.message.copied`) and same `Copy`/`Check` icons.

- [ ] **Step 3.1: Implement `src/ui/content/selection/SelectionBubble.tsx`**

Create `src/ui/content/selection/SelectionBubble.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { loadSettings, defaultSettings } from '../../../shared/storage/settings-repository';
import { translateMessage } from '../../../shared/i18n/i18n';
import { copyMessageContent } from '../chat/copy-message-content';
import { getRuntimeResponseData } from '../../../shared/types/runtime-messages';
import type { SelectionMode, SelectionRuntimeResponse } from '../../../shared/types/selection';
import {
  isSelectionStreamChunkMessage,
  selectionCancelType,
  selectionRequestType,
} from '../../../shared/types/selection';
import { buildAskAiPrompt, buildTranslatePrompt, resolveTargetLanguage } from './selection-prompts';
import { readCurrentPageText } from './page-content';

type BubblePlacement = 'above' | 'below';

interface BubbleAnchor {
  left: number;
  top: number;
  placement: BubblePlacement;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isInsideChatBrowserX(node: Node | null): boolean {
  const host = document.getElementById('chatbrowserx-root');
  const shadowRoot = host?.shadowRoot;
  if (!shadowRoot || !node) return false;

  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element && shadowRoot.contains(element));
}

function readSelectionSnapshot(): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  if (isInsideChatBrowserX(selection.anchorNode)) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  let rect = range.getBoundingClientRect();
  if ((rect.width === 0 || rect.height === 0) && range.getClientRects().length) {
    rect = range.getClientRects()[0];
  }

  if (rect.width === 0 && rect.height === 0) return null;
  return { text, rect };
}

function computeAnchor(rect: DOMRect): BubbleAnchor {
  const centerX = rect.left + rect.width / 2;
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;

  const left = clamp(centerX, 16, viewportWidth - 16);
  const preferAbove = rect.top > 90;
  const placement: BubblePlacement = preferAbove ? 'above' : 'below';
  const top = placement === 'above' ? rect.top : Math.min(viewportHeight - 16, rect.bottom);

  return { left, top, placement };
}

function createRequestId(): string {
  return `sel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SelectionBubble() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  const [selectionText, setSelectionText] = useState<string>('');
  const [anchor, setAnchor] = useState<BubbleAnchor | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [content, setContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const hasSelection = Boolean(anchor && selectionText);

  const close = useCallback(() => {
    if (activeRequestIdRef.current) {
      void chrome.runtime.sendMessage({ type: selectionCancelType }).catch(() => undefined);
    }
    activeRequestIdRef.current = null;
    setIsSending(false);
    setIsPanelOpen(false);
    setContent('');
    setIsCopied(false);
  }, []);

  const refreshFromSelection = useCallback(() => {
    const snapshot = readSelectionSnapshot();
    if (!snapshot) {
      close();
      setSelectionText('');
      setAnchor(null);
      return;
    }

    setSelectionText(snapshot.text);
    setAnchor(computeAnchor(snapshot.rect));
    setIsCopied(false);
  }, [close]);

  useEffect(() => {
    const onMouseUp = () => refreshFromSelection();
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      refreshFromSelection();
    };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [close, refreshFromSelection]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      if (path.includes(root)) return;
      close();
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [close]);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (!isSelectionStreamChunkMessage(message)) return;
      if (message.payload.requestId !== activeRequestIdRef.current) return;
      if (!message.payload.content) return;

      setContent((prev) => prev + message.payload.content);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const buildPrompt = useCallback(async (mode: SelectionMode) => {
    const settings = await loadSettings().catch(() => defaultSettings);
    const { name: targetLanguageName } = resolveTargetLanguage({
      uiLanguage: settings.general.uiLanguage,
      browserLanguage: typeof navigator !== 'undefined' ? navigator.language : undefined,
    });

    if (mode === 'translate') {
      return buildTranslatePrompt({ selectedText: selectionText, targetLanguageName });
    }

    const page = readCurrentPageText(40000);
    return buildAskAiPrompt({
      selectedText: selectionText,
      pageTitle: page.title,
      pageUrl: page.url,
      pageText: page.text,
      targetLanguageName,
      maxPageChars: 40000,
    });
  }, [selectionText]);

  const run = useCallback(async (mode: SelectionMode) => {
    if (!hasSelection || !selectionText) return;

    // Cancel older request to reduce background churn.
    if (activeRequestIdRef.current) {
      void chrome.runtime.sendMessage({ type: selectionCancelType }).catch(() => undefined);
    }

    const requestId = createRequestId();
    activeRequestIdRef.current = requestId;
    setIsSending(true);
    setIsPanelOpen(true);
    setContent('');
    setIsCopied(false);

    try {
      const prompt = await buildPrompt(mode);
      const response = (await chrome.runtime.sendMessage({
        type: selectionRequestType,
        payload: { requestId, mode, prompt },
      })) as SelectionRuntimeResponse;

      const reply = getRuntimeResponseData(response, translateMessage('error.request.failed')).reply;
      if (activeRequestIdRef.current === requestId) {
        setContent(reply);
      }
    } catch (error) {
      if (activeRequestIdRef.current === requestId) {
        setContent(error instanceof Error ? error.message : translateMessage('error.request.failed'));
      }
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsSending(false);
      }
    }
  }, [buildPrompt, hasSelection, selectionText]);

  const copy = useCallback(async () => {
    try {
      await copyMessageContent(content);
      setIsCopied(true);
    } catch {
      // ignore clipboard errors in unsupported environments
    }
  }, [content]);

  const rootStyle = useMemo(() => {
    if (!anchor) return undefined;
    return { left: `${anchor.left}px`, top: `${anchor.top}px` } as const;
  }, [anchor]);

  if (!hasSelection || !anchor) return null;

  return (
    <div ref={rootRef} className="selection-bubble-root" data-placement={anchor.placement} style={rootStyle}>
      <div className="selection-bubble-stack">
        <div className="selection-toolbar" role="toolbar" aria-label="Selection toolbar">
          <button
            type="button"
            className="selection-toolbar-button"
            disabled={isSending}
            onClick={() => void run('translate')}
          >
            {translateMessage('selection.toolbar.translate')}
          </button>
          <button
            type="button"
            className="selection-toolbar-button"
            disabled={isSending}
            onClick={() => void run('ask_ai')}
          >
            {translateMessage('selection.toolbar.askAi')}
          </button>
        </div>

        {isPanelOpen ? (
          <div className="selection-panel" role="dialog" aria-label="Selection result">
            <div className="selection-panel-body">{content || translateMessage('chat.loading')}</div>
            <div className="selection-panel-divider" />
            <div className="selection-panel-footer">
              <button
                type="button"
                className="selection-copy-button"
                aria-label={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
                data-tooltip={isCopied ? translateMessage('chat.message.copied') : translateMessage('chat.message.copy')}
                onMouseLeave={() => setIsCopied(false)}
                onClick={() => void copy()}
              >
                {isCopied ? (
                  <Check className="h-3 w-3 selection-copy-icon-success" strokeWidth={2.2} />
                ) : (
                  <Copy className="h-3 w-3" strokeWidth={2.0} />
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Render `SelectionBubble` from `ContentApp`**

In `src/ui/content/ContentApp.tsx`, render it outside the sidebar condition so it is always active:

```tsx
import { SelectionBubble } from './selection/SelectionBubble';
// ...
<SelectionBubble />
```

- [ ] **Step 5: Run full test suite and build**

Run: `npm test`
Expected: PASS.

Run: `npm run -s build`
Expected: PASS.
