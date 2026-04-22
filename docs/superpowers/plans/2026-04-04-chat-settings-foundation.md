# Chat & Settings Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working ChatBrowserX browser-agent foundation with refactored chat and settings modules.

**Architecture:** Create a minimal browser extension skeleton around four boundaries: `ui`, `background`, `llm`, and `shared`. Implement the settings flow and chat flow first, keep `tools` as interface-only, and route all model requests through `background` into an OpenAI-compatible provider abstraction.

**Tech Stack:** TypeScript, React, Vite, CRXJS, Vitest, Testing Library

---

### Task 1: Create project and test foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `manifest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Add project and test configuration**
- [ ] **Step 2: Install dependencies with `npm install`**
- [ ] **Step 3: Run `npm test` to confirm missing implementation failures**

### Task 2: Add failing tests for settings and chat behavior

**Files:**
- Create: `tests/shared/storage/settings-repository.test.ts`
- Create: `tests/ui/content/settings/SettingsPanel.test.tsx`
- Create: `tests/ui/content/chat/ChatPanel.test.tsx`

- [ ] **Step 1: Write tests for settings load/save defaults**
- [ ] **Step 2: Write tests for settings form editing and submit**
- [ ] **Step 3: Write tests for chat send flow and loading state**
- [ ] **Step 4: Run `npm test` and verify failures are due to missing source modules**

### Task 3: Implement shared and LLM boundaries

**Files:**
- Create: `src/shared/types/settings.ts`
- Create: `src/shared/types/chat.ts`
- Create: `src/shared/storage/settings-repository.ts`
- Create: `src/shared/storage/chat-history-repository.ts`
- Create: `src/llm/model/chat.ts`
- Create: `src/llm/providers/openai-compatible-provider.ts`
- Create: `src/llm/services/chat-completion.ts`
- Create: `src/llm/tools/tool-registry.ts`

- [ ] **Step 1: Implement settings and chat storage repositories**
- [ ] **Step 2: Implement OpenAI-compatible provider abstraction**
- [ ] **Step 3: Implement chat completion service and tool registry boundary**
- [ ] **Step 4: Run `npm test` to confirm repository-level tests pass**

### Task 4: Implement background messaging flow

**Files:**
- Create: `src/background/messaging/messages.ts`
- Create: `src/background/llm/llm-orchestrator.ts`
- Create: `src/background/index.ts`

- [ ] **Step 1: Define message contracts between UI and background**
- [ ] **Step 2: Implement background chat orchestration**
- [ ] **Step 3: Register background message listener**
- [ ] **Step 4: Run `npm test` to verify chat flow integration still passes**

### Task 5: Implement refactored UI for settings and chat

**Files:**
- Create: `src/ui/content/styles.css`
- Create: `src/ui/content/index.tsx`
- Create: `src/ui/content/ContentApp.tsx`
- Create: `src/ui/content/chat/ChatPanel.tsx`
- Create: `src/ui/content/chat/MessageList.tsx`
- Create: `src/ui/content/chat/ChatComposer.tsx`
- Create: `src/ui/content/chat/use-chat-controller.ts`
- Create: `src/ui/content/settings/SettingsPanel.tsx`
- Create: `src/ui/content/settings/ChatSettingsForm.tsx`
- Create: `src/ui/popup/index.html`
- Create: `src/ui/popup/main.tsx`
- Create: `src/ui/popup/PopupApp.tsx`

- [ ] **Step 1: Implement content app shell and sidebar state**
- [ ] **Step 2: Implement settings panel and form**
- [ ] **Step 3: Implement chat panel and controller**
- [ ] **Step 4: Implement popup entry**
- [ ] **Step 5: Run `npm test` and verify all tests pass**

### Task 6: Verify build output

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run `npm run build`**
- [ ] **Step 2: Fix any TypeScript or bundling issues**
- [ ] **Step 3: Re-run `npm test` and `npm run build` until both pass**
