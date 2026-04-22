import { panelCommandType } from '../shared/types/ui';
import { initChatModule } from './chat';
import { initSelectionModule } from './selection';
import { initSpeechModule } from './speech';

initChatModule();
initSelectionModule();
initSpeechModule();

chrome.action.onClicked.addListener((tab) => {
  const tabId = tab.id;

  if (tabId == null) {
    return;
  }

  void chrome.tabs
    .sendMessage(tabId, {
      type: panelCommandType,
      payload: { command: 'toggle-chat' },
    })
    .catch(() => undefined);
});
