import type { RuntimeMessage } from './runtime-messages';
import { hasRuntimeMessageType } from './runtime-messages';

/**
 * Message type identifier for panel control commands.
 */
export const panelCommandType = 'chatbrowserx.panel.command';

/**
 * Message sent to control panel behavior (toggle, open chat, open settings).
 */
export interface PanelCommandMessage extends RuntimeMessage<typeof panelCommandType> {
  payload: {
    command: 'toggle-chat' | 'open-chat' | 'open-settings';
  };
}

/**
 * Type guard that checks if an unknown value is a PanelCommandMessage.
 *
 * @param message - The value to check
 * @returns True if the message is a PanelCommandMessage
 */
export function isPanelCommandMessage(message: unknown): message is PanelCommandMessage {
  return hasRuntimeMessageType(message, panelCommandType);
}
