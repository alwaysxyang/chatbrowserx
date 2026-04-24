# Page Action Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add minimal ref-based page action tools for mouse move, click, type, scroll, and drag, with visible virtual mouse feedback.

**Architecture:** `src/llm/tools` exposes action tool definitions and routes calls to the active tab. `src/ui/tools` resolves refs from the latest interactables snapshot, executes DOM events, and drives a non-interactive virtual mouse overlay. Shared request/result types live in `src/shared/types/tool.ts`.

**Tech Stack:** TypeScript, Chrome Extension MV3 runtime messages, DOM events, Vitest

---

### Task 1: Shared Protocol

**Files:**
- Modify: `src/shared/types/tool.ts`

- [x] Add page action request/result types and type guards.

### Task 2: LLM Tool Wrappers

**Files:**
- Create: `src/llm/tools/page-action-tools.ts`
- Modify: `src/llm/tools/tool-registry.ts`
- Test: `tests/llm/tools/page-action-tools.test.ts`
- Test: `tests/llm/tools/tool-registry.test.ts`

- [x] Register `page_mouse_move`, `page_click`, `page_type`, `page_scroll`, and `page_drag`.
- [x] Route all actions through active-tab `chrome.tabs.sendMessage`.

### Task 3: Content-Side Executor

**Files:**
- Create: `src/ui/tools/page-action-tool.ts`
- Modify: `src/ui/tools/get-page-interactables-tool.ts`
- Modify: `src/ui/tools/index.ts`
- Test: `tests/ui/tools/page-action-tool.test.ts`
- Test: `tests/ui/tools/index.test.ts`

- [x] Maintain latest snapshot refs from `get_current_page_interactables`.
- [x] Resolve refs, validate visibility, and execute click/type/move/drag/scroll.
- [x] Return structured success and error payloads.

### Task 4: Virtual Mouse Overlay

**Files:**
- Create: `src/ui/tools/page-action-overlay.ts`
- Test: `tests/ui/tools/page-action-overlay.test.ts`

- [x] Render a pointer-events-none overlay.
- [x] Show move, click ripple, type focus, drag path, and scroll cue.

### Task 5: Docs and Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
- Modify: `docs/superpowers/specs/2026-04-23-page-interactables-tool-design.md`

- [x] Run `npm test`.
- [x] Run `npm run build`.
