import { createRoot, type Root } from 'react-dom/client';
import { ContentApp } from './ContentApp';
import styles from './styles.css?inline';
import { registerTools } from '../tools';
import { chatSessionPortName } from '../../shared/types/chat';
import { installContentKeyboardEventIsolation } from './keyboard-event-isolation';

const hostId = 'chatbrowserx-root';
const sessionPort = chrome.runtime.connect({ name: chatSessionPortName });
let appRootElement: HTMLElement | null = null;
let reactRoot: Root | null = null;
let hostObserver: MutationObserver | null = null;

/**
 * Ensures the extension host exists in the current document body.
 */
function ensureContentHost(): HTMLElement | null {
  if (!document.body) {
    return null;
  }

  let host = document.getElementById(hostId);

  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
    document.body.appendChild(host);
  }

  return host;
}

/**
 * Ensures the Shadow DOM app container and style element exist under the host.
 */
function ensureAppRoot(host: HTMLElement): HTMLElement {
  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  installContentKeyboardEventIsolation(shadowRoot);

  if (!shadowRoot.getElementById('chatbrowserx-style')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'chatbrowserx-style';
    styleElement.textContent = styles;
    shadowRoot.appendChild(styleElement);
  }

  let nextAppRoot = shadowRoot.getElementById('chatbrowserx-app');
  if (!nextAppRoot) {
    nextAppRoot = document.createElement('div');
    nextAppRoot.id = 'chatbrowserx-app';
    shadowRoot.appendChild(nextAppRoot);
  }

  return nextAppRoot;
}

/**
 * Mounts the content app into the current document host.
 */
function mountContentApp(): void {
  const host = ensureContentHost();

  if (!host) {
    return;
  }

  const nextAppRoot = ensureAppRoot(host);

  if (appRootElement !== nextAppRoot) {
    reactRoot?.unmount();
    appRootElement = nextAppRoot;
    reactRoot = createRoot(appRootElement);
  }

  reactRoot?.render(<ContentApp />);
}

/**
 * Watches the host document for page-driven removal of the extension host.
 */
function watchContentHost(): void {
  if (hostObserver) {
    return;
  }

  hostObserver = new MutationObserver(() => {
    if (document.getElementById(hostId)) {
      return;
    }

    mountContentApp();
  });

  hostObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

window.addEventListener('pagehide', () => {
  hostObserver?.disconnect();
  reactRoot?.unmount();
  sessionPort.disconnect();
}, { once: true });

mountContentApp();
watchContentHost();
registerTools();
