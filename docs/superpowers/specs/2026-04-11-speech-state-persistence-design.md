# Speech State Persistence and Lifecycle Management Design

## Document Identity

- Document Type: Feature Spec
- Constraint Level: Below main spec, above archived documents
- Applicable Scope: `src/background/speech`, `src/ui/content/speech`, `src/shared/storage/speech-state-repository.ts`, `src/shared/types/runtime-messages.ts`
- Parent Document: `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
- Related Document: `docs/superpowers/specs/2026-04-10-realtime-voice-feature-design.md`

## 1. Problem Statement

Current speech recognition implementation has the following issues:

1. Recording state is lost when the page refreshes
2. Recording stops when the chat panel is closed
3. Recording state is not persisted across page navigations
4. Each tab cannot maintain its own independent recording state

## 2. Requirements

1. **User manually stops or tab closes**: Only these actions should stop recording
2. **Chat panel closure**: Recording should continue when chat panel is closed
3. **Page refresh**: Recording should persist and UI should restore to recording state
4. **Page navigation**: Detect refresh/navigation events, hide subtitle temporarily, and resume recording after page loads

## 3. Design Approach

### 3.1 Chosen Approach: Background-Driven + Storage Persistence

**Core Concept**:
- Background maintains recording state for each tab (in-memory Map)
- State changes are synchronized to chrome.storage.local (indexed by tabId)
- Content script queries background for current tab state on startup
- During page refresh, background recording session remains active while new content script reconnects

**Why This Approach**:
- Single source of truth (background) prevents UI/background inconsistency
- Recording truly persists during page refresh (background session uninterrupted)
- Chat panel closure does not affect background recording
- Relatively simple implementation

**Trade-offs**:
- Brief audio data loss during page refresh (content script re-injection takes time, typically < 1 second)
- Requires content script reconnection logic

## 4. Architecture Design

### 4.1 State Storage

**New Repository: speech-state-repository.ts**

```typescript
interface SpeechState {
  isRecording: boolean;
  timestamp: number;
}

// Storage structure: { [tabId: string]: SpeechState }

// API:
- getSpeechState(tabId: number): Promise<SpeechState | null>
- setSpeechState(tabId: number, isRecording: boolean): Promise<void>
- removeSpeechState(tabId: number): Promise<void>
- getAllSpeechStates(): Promise<Record<string, SpeechState>>
```

**Background Memory State**:
- `SpeechOrchestrator` already maintains `sessions: Map<tabId, TabSession>`
- This Map represents "active recording sessions"
- Synchronize to storage when state changes

**Synchronization Timing**:
- Recording starts → Write to storage `{ isRecording: true }`
- Recording stops (user manual) → Write to storage `{ isRecording: false }`
- Tab closes → Remove from storage

### 4.2 Page Lifecycle Handling

**Background Tab Event Listeners**:

1. `chrome.tabs.onRemoved` (existing):
   - Stop recording and clean up storage when tab closes

2. `chrome.webNavigation.onBeforeNavigate` (new):
   - Detect page refresh/navigation
   - Check if top-level frame (frameId === 0)
   - If tab is recording, keep background session running
   - Do not stop recording

3. `chrome.webNavigation.onCommitted` (new):
   - Page navigation completed
   - Content script will be re-injected
   - Wait for new content script to send "restore state" request

**Content Script Startup Flow**:

1. Content script loads, immediately sends `speechStateQuery` message to background
2. Background returns current tab's recording state
3. If state is `isRecording: true`:
   - UI displays subtitle overlay (listening state)
   - Re-establish message listener with background
   - Background recording session already running, continue receiving `speechResult`

**Chat Panel Closure Handling**:
- Chat panel closure only hides UI, content script remains active
- Subtitle overlay is independent of chat panel, continues to display
- Background recording session unaffected

### 4.3 Message Protocol Extension

**New Message Types**:

```typescript
// Query current tab's recording state
const speechStateQueryType = 'chatbrowserx.speech.state.query';

interface SpeechStateQueryMessage {
  type: typeof speechStateQueryType;
}

interface SpeechStateQueryResponse extends RuntimeResponse<{
  isRecording: boolean;
}> {}
```

**Message Flow**:

1. **Content script startup**:
   - Send `speechStateQuery` → Background returns `{ isRecording: true/false }`
   - Decide whether to show listening state based on response

2. **User clicks start recording**:
   - Content script sends `speechStart` → Background starts recording
   - Background writes to storage `{ isRecording: true }`
   - Returns success response

3. **User clicks stop recording**:
   - Content script sends `speechStop` → Background stops recording
   - Background writes to storage `{ isRecording: false }`
   - Returns success response

4. **Page refresh**:
   - New content script sends `speechStateQuery`
   - Background returns `{ isRecording: true }` (read from storage)
   - Content script restores UI state, continues receiving `speechResult`

### 4.4 Per-Tab State Isolation

**Design**:
- Each tab maintains independent recording state
- Tab A starts recording → Tab B remains stopped by default
- Switching back to Tab A → Recording state preserved

**Implementation**:
- Storage uses tabId as key: `{ "123": { isRecording: true }, "456": { isRecording: false } }`
- Background `sessions` Map uses tabId as key
- Content script only queries its own tab's state

## 5. Error Handling and Edge Cases

### 5.1 Audio Continuity During Page Refresh

- Background's `AudioCapture` and `SpeechRecognitionService` sessions remain active
- But `speechResult` messages will fail to send before content script re-injection
- Recognition results during this period will be lost (typically < 1 second)
- This is an acceptable trade-off; seamless continuity requires complex buffering

### 5.2 Tab Close vs Page Refresh Distinction

- `chrome.tabs.onRemoved` - Actual tab closure, stop recording and clean up storage
- `chrome.webNavigation.onBeforeNavigate` - Page navigation, keep recording
- No additional heartbeat mechanism needed, rely on Chrome API events

### 5.3 Storage Read/Write Failures

- When storage operations fail, fall back to in-memory state
- State will be lost after page refresh, but does not affect current session
- Log errors, do not block main flow

### 5.4 Content Script Duplicate Injection

- If content script is injected multiple times on same page (theoretically should not happen)
- Background's `sessions` Map uses tabId as key, naturally deduplicated
- Multiple content scripts can all receive `speechResult`, but UI state controlled by last one

### 5.5 Service Worker Suspension

- Chrome may suspend idle service workers
- Recording session will be interrupted (Manifest V3 limitation)
- Next time content script queries state, will find background has no session but storage shows `isRecording: true`
- Automatically restart recording session in this case

## 6. Implementation Scope

### 6.1 New Files

- `src/shared/storage/speech-state-repository.ts` - Recording state persistence

### 6.2 Modified Files

- `src/shared/types/runtime-messages.ts` - Add `speechStateQuery` message type
- `src/background/speech/index.ts` - Add `webNavigation` listeners and state query handler
- `src/background/speech/speech-orchestrator.ts` - Synchronize storage on start/stop
- `src/ui/content/speech/use-subtitle-controller.ts` - Query state on startup and restore
- `manifest.config.ts` - Add `webNavigation` permission

### 6.3 Unchanged Parts

- Core logic of `AudioCapture` and `SpeechRecognitionService` unchanged
- Subtitle overlay rendering logic unchanged
- Existing `speechStart`/`speechStop`/`speechResult` message protocol unchanged

## 7. Testing Scenarios

1. Start recording → Refresh page → Verify recording continues and UI restores
2. Start recording → Close chat panel → Verify recording continues
3. Start recording → Close tab → Verify storage cleanup
4. Tab A starts recording → Switch to Tab B → Verify Tab B is stopped by default
5. Start recording → Wait for service worker suspension → Refresh page → Verify automatic recovery

## 8. Spec Updates

This design will be integrated into `docs/superpowers/specs/2026-04-10-realtime-voice-feature-design.md`:
- Add state persistence section
- Add lifecycle management section
- Add message protocol extension section
- Update current implementation boundary

## 9. Future Considerations

**Not in Current Scope**:
- Recording history/playback
- Cross-session state persistence (browser restart)
- Multi-window state synchronization
- Recording pause/resume functionality
- Audio buffering during content script reconnection

These features may be considered in future iterations if needed.
