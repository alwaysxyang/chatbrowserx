import { describe, expect, it, vi } from 'vitest';
import { selectionCancelType, selectionRequestType } from '../../../src/shared/types/selection';

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

