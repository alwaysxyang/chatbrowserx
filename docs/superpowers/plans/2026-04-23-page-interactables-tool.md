# Page Interactables Snapshot Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only LLM tool `get_current_page_interactables` that returns a compact, token-bounded list of interactable elements in the current viewport without using `debugger` permission.

**Architecture:** The LLM tool in `src/llm/tools` resolves the active tab and requests a snapshot from the content script with `chrome.tabs.sendMessage`. The content-script implementation in `src/ui/tools` scans DOM candidates, uses `dom-accessibility-api` to compute accessible names, filters unusable candidates, and returns a compact tuple payload.

**Tech Stack:** TypeScript, Chrome Extension MV3 runtime messages, `dom-accessibility-api`, Vitest

---

### Task 1: Add Shared Message and Payload Types

**Files:**
- Modify: `src/shared/types/tool.ts`

- [x] Define `GetPageInteractablesToolPayload` with compact fields `v`, `sid`, and `items`.
- [x] Define `getPageInteractablesToolRequestType`.
- [x] Define `GetPageInteractablesToolRequestMessage`.
- [x] Define `isGetPageInteractablesToolRequestMessage()`.

### Task 2: Add Content-Script Snapshot Execution

**Files:**
- Create: `src/ui/tools/get-page-interactables-tool.ts`
- Modify: `src/ui/tools/index.ts`
- Test: `tests/ui/tools/get-page-interactables-tool.test.ts`
- Test: `tests/ui/tools/index.test.ts`

- [x] Use `computeAccessibleName()` from `dom-accessibility-api` for control names.
- [x] Scan only current DOM candidates relevant to interaction.
- [x] Filter disabled, hidden, offscreen, too-small, covered, and non-interactive role candidates.
- [x] Return compact tuple items `[ref, role, name, [x, y, width, height], meta?]`.
- [x] Register the listener through the existing `registerTools()` content entry point.

### Task 3: Refactor LLM Tool Wrapper

**Files:**
- Create/Modify: `src/llm/tools/get-page-interactables-tool.ts`
- Modify: `src/llm/tools/tool-registry.ts`
- Test: `tests/llm/tools/get-page-interactables-tool.test.ts`
- Test: `tests/llm/tools/tool-registry.test.ts`

- [x] Keep the public tool name `get_current_page_interactables`.
- [x] Remove CDP and `chrome.debugger` usage.
- [x] Request snapshots through `chrome.tabs.sendMessage`.
- [x] Describe the compact output shape in the tool definition.

### Task 4: Remove Debugger/CDP Artifacts and Sync Docs

**Files:**
- Modify: `manifest.config.ts`
- Modify: `tests/setup.ts`
- Modify: `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
- Modify: `docs/superpowers/specs/2026-04-23-page-interactables-tool-design.md`

- [x] Remove `debugger` from extension permissions.
- [x] Remove unused `chrome.debugger` test mock.
- [x] Remove CDP geometry helper files and tests.
- [x] Update specs to describe the content-script DOM snapshot design.

### Task 5: Verify

**Files:**
- All changed files

- [x] Run `npm test`.
- [x] Run `npm run build`.
