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
