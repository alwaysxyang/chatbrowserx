import type { RuntimeMessage } from '../../shared/types/runtime-messages';

type BroadcastRuntimeMessage = RuntimeMessage<string> & Record<string, unknown>;

/**
 * Broadcasts a runtime message to all tabs that can receive the content script.
 *
 * @param message - The message to send.
 */
export async function broadcastToContentTabs(message: BroadcastRuntimeMessage): Promise<void> {
  const tabs = await Promise.resolve(chrome.tabs.query({})).catch(() => []);

  await Promise.all((tabs ?? []).map(async (tab) => {
    if (tab.id == null) {
      return;
    }

    await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
  }));
}
