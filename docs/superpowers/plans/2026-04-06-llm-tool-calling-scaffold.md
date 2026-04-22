# LLM Tool Calling Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the base LLM tool-calling loop so the provider can request registered tools and the service can execute them before returning the final assistant reply.

**Architecture:** Keep tool definitions and execution contracts inside `src/llm/tools`, keep provider logic focused on OpenAI-compatible request/response parsing, and implement the tool loop in `src/llm/services`. Leave UI and runtime messages unchanged so tool execution stays transparent to the current chat flow.

**Tech Stack:** TypeScript, Vitest, React, Vite

---

### Task 1: Add failing tests for the tool registry contract

**Files:**
- Create: `tests/llm/tools/tool-registry.test.ts`
- Modify: `src/llm/tools/tool-registry.ts`

- [ ] **Step 1: Write tests for empty registry behavior and registration-based lookup**
- [ ] **Step 2: Run `npm test -- tests/llm/tools/tool-registry.test.ts` and confirm the new expectations fail for missing registry APIs**
- [ ] **Step 3: Implement the minimal registry contract with definition listing and tool lookup**
- [ ] **Step 4: Re-run `npm test -- tests/llm/tools/tool-registry.test.ts` until it passes**

### Task 2: Add failing tests for service-level tool orchestration

**Files:**
- Create: `tests/llm/services/chat-completion.test.ts`
- Modify: `src/llm/services/chat-completion.ts`
- Modify: `src/llm/model/chat.ts`

- [ ] **Step 1: Write tests that prove the service can execute a requested tool and continue the conversation**
- [ ] **Step 2: Run `npm test -- tests/llm/services/chat-completion.test.ts` and confirm failures come from missing tool-call message types and orchestration behavior**
- [ ] **Step 3: Implement the minimal tool loop and LLM message/result types required by the test**
- [ ] **Step 4: Re-run `npm test -- tests/llm/services/chat-completion.test.ts` until it passes**

### Task 3: Add failing tests for OpenAI-compatible provider tool-call parsing

**Files:**
- Modify: `tests/llm/providers/openai-compatible-provider.test.ts`
- Modify: `src/llm/providers/openai-compatible-provider.ts`

- [ ] **Step 1: Extend provider tests to cover request payload tool definitions and streamed tool-call deltas**
- [ ] **Step 2: Run `npm test -- tests/llm/providers/openai-compatible-provider.test.ts` and confirm failures reflect missing structured tool-call parsing**
- [ ] **Step 3: Implement minimal provider changes to send `tools` and parse streamed/non-streamed assistant responses into structured results**
- [ ] **Step 4: Re-run `npm test -- tests/llm/providers/openai-compatible-provider.test.ts` until it passes**

### Task 4: Verify background integration still works with the new service signature

**Files:**
- Modify: `src/background/llm/llm-orchestrator.ts`
- Modify: `tests/background/index.test.ts`

- [ ] **Step 1: Update background integration tests if the service contract changes**
- [ ] **Step 2: Run `npm test -- tests/background/index.test.ts` and confirm any failures are due to the updated chat service contract**
- [ ] **Step 3: Apply the minimal background change so chat orchestration still returns the final reply string**
- [ ] **Step 4: Re-run `npm test -- tests/background/index.test.ts` until it passes**

### Task 5: Run focused verification and full build

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run `npm test -- tests/llm/tools/tool-registry.test.ts tests/llm/services/chat-completion.test.ts tests/llm/providers/openai-compatible-provider.test.ts tests/background/index.test.ts`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Fix any TypeScript or bundling regressions and re-run both commands until they pass**
