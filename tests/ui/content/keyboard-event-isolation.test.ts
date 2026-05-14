import { describe, expect, it, vi } from 'vitest';
import { installContentKeyboardEventIsolation } from '../../../src/ui/content/keyboard-event-isolation';

/**
 * Creates an isolated ShadowRoot for keyboard event boundary tests.
 *
 * @returns The shadow root and its host element.
 */
function createShadowRootFixture(): { host: HTMLElement; shadowRoot: ShadowRoot } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return {
    host,
    shadowRoot: host.attachShadow({ mode: 'open' }),
  };
}

describe('content keyboard event isolation', () => {
  it('keeps select-all scoped to textarea content inside the content shadow root', () => {
    const { shadowRoot } = createShadowRootFixture();
    const textarea = document.createElement('textarea');
    textarea.value = 'hello';
    shadowRoot.appendChild(textarea);
    const pageKeydownListener = vi.fn();
    document.addEventListener('keydown', pageKeydownListener);

    const uninstall = installContentKeyboardEventIsolation(shadowRoot);

    try {
      textarea.focus();
      textarea.setSelectionRange(2, 2);
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        composed: true,
        ctrlKey: true,
        key: 'a',
      });

      expect(textarea.dispatchEvent(event)).toBe(false);
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(5);
      expect(pageKeydownListener).not.toHaveBeenCalled();
    } finally {
      uninstall();
      document.removeEventListener('keydown', pageKeydownListener);
    }
  });

  it('lets target key handlers run before stopping propagation to the host page', () => {
    const { shadowRoot } = createShadowRootFixture();
    const textarea = document.createElement('textarea');
    shadowRoot.appendChild(textarea);
    const targetKeydownListener = vi.fn();
    const pageKeydownListener = vi.fn();
    textarea.addEventListener('keydown', targetKeydownListener);
    document.addEventListener('keydown', pageKeydownListener);

    const uninstall = installContentKeyboardEventIsolation(shadowRoot);

    try {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: 'Enter',
      });

      expect(textarea.dispatchEvent(event)).toBe(true);
      expect(targetKeydownListener).toHaveBeenCalledTimes(1);
      expect(pageKeydownListener).not.toHaveBeenCalled();
    } finally {
      uninstall();
      document.removeEventListener('keydown', pageKeydownListener);
    }
  });
});
