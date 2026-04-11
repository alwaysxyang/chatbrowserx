import { panelCommandType } from '../shared/types/runtime-messages';
import { initChatModule } from './chat';
import { initSpeechModule } from './speech';

initChatModule();
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
