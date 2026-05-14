import { createRoot } from 'react-dom/client';
import { ContentApp } from './ContentApp';
import styles from './styles.css?inline';
import { registerTools } from '../tools';
import { chatSessionPortName } from '../../shared/types/chat';
import { installContentKeyboardEventIsolation } from './keyboard-event-isolation';

const hostId = 'chatbrowserx-root';
const sessionPort = chrome.runtime.connect({ name: chatSessionPortName });

window.addEventListener('pagehide', () => {
  sessionPort.disconnect();
}, { once: true });

function mountContentApp() {
  let host = document.getElementById(hostId);

  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
    document.body.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  installContentKeyboardEventIsolation(shadowRoot);

  if (!shadowRoot.getElementById('chatbrowserx-style')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'chatbrowserx-style';
    styleElement.textContent = styles;
    shadowRoot.appendChild(styleElement);
  }

  let appRoot = shadowRoot.getElementById('chatbrowserx-app');
  if (!appRoot) {
    appRoot = document.createElement('div');
    appRoot.id = 'chatbrowserx-app';
    shadowRoot.appendChild(appRoot);
  }

  createRoot(appRoot).render(<ContentApp />);
}

mountContentApp();
registerTools();
