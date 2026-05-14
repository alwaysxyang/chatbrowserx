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
