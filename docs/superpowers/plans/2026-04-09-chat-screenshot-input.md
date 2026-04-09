# Chat Screenshot Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chat screenshot capture so users can attach one or more screenshots to the composer and send them as multimodal chat input.

**Architecture:** `src/ui/content/chat` owns the screenshot overlay, selection UI, screenshot previews, and multimodal composer state. `src/background/chat/screenshot-capture.ts` owns the Chrome `tabs.captureVisibleTab` bridge, while `src/background/index.ts` only registers the handler. Shared runtime message types define the request/response contract.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, Chrome extension runtime APIs, Canvas image cropping/stitching.

---

### Task 1: Update Scope Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`

- [ ] **Step 1: Update the current scope**

Add screenshot input to the retained scope and narrow the previous exclusion so it no longer forbids this feature.

- [ ] **Step 2: Verify the spec still preserves boundaries**

Run: `rg -n "截图|图片上传|src/ui/content/chat|src/background/chat" docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`

Expected: The spec says screenshot input belongs to chat UI and capture bridging belongs to background chat, without reintroducing generic screenshot-analysis tools.

### Task 2: Background Screenshot Bridge

**Files:**
- Create: `src/background/chat/screenshot-capture.ts`
- Modify: `src/background/index.ts`
- Modify: `src/shared/types/runtime-messages.ts`
- Modify: `tests/setup.ts`
- Test: `tests/background/chat/screenshot-capture.test.ts`

- [ ] **Step 1: Write the failing background tests**

Add tests that expect a screenshot capture request to call `chrome.tabs.captureVisibleTab` with the sender window id and return a Data URL response.

- [ ] **Step 2: Run the background test to verify it fails**

Run: `npm test -- tests/background/chat/screenshot-capture.test.ts`

Expected: FAIL because the screenshot handler and message types do not exist yet.

- [ ] **Step 3: Add the runtime contract and handler**

Add `chatbrowserx.chat.screenshot.capture` message types and a `registerScreenshotCaptureHandler()` module under `src/background/chat/screenshot-capture.ts`.

- [ ] **Step 4: Register the handler from the background entry**

Import and call `registerScreenshotCaptureHandler()` from `src/background/index.ts`.

- [ ] **Step 5: Run the background test to verify it passes**

Run: `npm test -- tests/background/chat/screenshot-capture.test.ts`

Expected: PASS.

### Task 3: Chat Screenshot Composer UI

**Files:**
- Create: `src/ui/content/chat/ScreenshotOverlay.tsx`
- Create: `src/ui/content/chat/screenshot-capture.ts`
- Modify: `src/ui/content/ContentApp.tsx`
- Modify: `src/ui/content/chat/ChatPanel.tsx`
- Modify: `src/ui/content/chat/ChatComposer.tsx`
- Modify: `src/ui/content/chat/ChatToolbar.tsx`
- Modify: `src/ui/content/chat/chat.css`
- Modify: `src/shared/i18n/i18n.ts`
- Test: `tests/ui/content/chat/ChatPanel.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests that expect the scissors button tooltip to say screenshot, captured screenshots to appear as removable previews, and sent content to include `image_url` parts.

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `npm test -- tests/ui/content/chat/ChatPanel.test.tsx`

Expected: FAIL because screenshot capture, preview attachments, and multimodal composer submission are not implemented.

- [ ] **Step 3: Implement composer screenshot attachments**

Add screenshot attachment state in `ChatPanel`, preview rendering and delete-key removal in `ChatComposer`, and active scissors button wiring in `ChatToolbar`.

- [ ] **Step 4: Implement screenshot overlay and capture utilities**

Add the overlay with a transparent white-bordered selection, draggable/edge-resizable selection behavior, centered `全屏截图`, `长截图`, and green `截图完成` controls. While the user scrolls inside the selection, record the covered document range without hiding the overlay; on `截图完成`, hide the overlay once, capture non-overlapping chunks, and stitch them.

- [ ] **Step 5: Wire ContentApp panel hiding**

Render `ScreenshotOverlay` outside the sidebar, hide the sidebar during screenshot mode, restore it after completion or `Esc`, and call the composer attachment callback with the resulting Data URL.

- [ ] **Step 6: Run the UI test to verify it passes**

Run: `npm test -- tests/ui/content/chat/ChatPanel.test.tsx`

Expected: PASS.

### Task 4: Multimodal Send Path

**Files:**
- Modify: `src/ui/content/chat/use-chat-controller.ts`
- Test: `tests/ui/content/chat/use-chat-controller.test.tsx`

- [ ] **Step 1: Write the failing controller test**

Add a test that calls `sendMessage()` with text and image parts and expects the runtime payload `input` to preserve the image parts.

- [ ] **Step 2: Run the controller test to verify it fails**

Run: `npm test -- tests/ui/content/chat/use-chat-controller.test.tsx`

Expected: FAIL because `sendMessage` currently accepts only a string.

- [ ] **Step 3: Update the controller input type**

Change `sendMessage` and message creation to accept `ChatMessageContent`, while keeping previous history image-stripping behavior.

- [ ] **Step 4: Run the controller test to verify it passes**

Run: `npm test -- tests/ui/content/chat/use-chat-controller.test.tsx`

Expected: PASS for the new multimodal input test; pre-existing unrelated failures may still be reported in this file.

### Task 5: Focused Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- tests/background/chat/screenshot-capture.test.ts tests/ui/content/chat/ChatPanel.test.tsx tests/ui/content/chat/use-chat-controller.test.tsx
```

Expected: New screenshot tests pass. Any unrelated existing failing assertions are reported separately.

- [ ] **Step 2: Run static checks**

Run: `git diff --check`

Expected: no whitespace errors.
