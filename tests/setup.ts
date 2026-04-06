import '@testing-library/jest-dom/vitest';

type LocalStore = Record<string, unknown>;
type RuntimeMessageListener = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => void | boolean;
type ActionClickListener = (tab: chrome.tabs.Tab) => void;

declare global {
  var __chromeTestUtils: {
    dispatchRuntimeMessage: (message: unknown, sender?: chrome.runtime.MessageSender) => void;
    dispatchActionClick: (tab: chrome.tabs.Tab) => void;
  };
}

const storageState: LocalStore = {};
const runtimeMessageListeners = new Set<RuntimeMessageListener>();
const actionClickListeners = new Set<ActionClickListener>();

const asyncCallback = (callback?: () => void) => {
  if (callback) {
    queueMicrotask(callback);
  }
};

const getValue = (keys?: string | string[] | Record<string, unknown> | null) => {
  if (keys == null) {
    return { ...storageState };
  }

  if (typeof keys === 'string') {
    return { [keys]: storageState[keys] };
  }

  if (Array.isArray(keys)) {
    return keys.reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = storageState[key];
      return accumulator;
    }, {});
  }

  return Object.keys(keys).reduce<Record<string, unknown>>((accumulator, key) => {
    accumulator[key] = storageState[key] ?? keys[key];
    return accumulator;
  }, {});
};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys?: string | string[] | Record<string, unknown> | null, callback?: (items: Record<string, unknown>) => void) => {
        const result = getValue(keys);
        if (callback) {
          queueMicrotask(() => callback(result));
          return undefined;
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(storageState, items);
        asyncCallback(callback);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[], callback?: () => void) => {
        const values = Array.isArray(keys) ? keys : [keys];
        values.forEach((key) => {
          delete storageState[key];
        });
        asyncCallback(callback);
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn((listener: RuntimeMessageListener) => {
        runtimeMessageListeners.add(listener);
      }),
      removeListener: vi.fn((listener: RuntimeMessageListener) => {
        runtimeMessageListeners.delete(listener);
      }),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    reload: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
  action: {
    onClicked: {
      addListener: vi.fn((listener: ActionClickListener) => {
        actionClickListeners.add(listener);
      }),
      removeListener: vi.fn((listener: ActionClickListener) => {
        actionClickListeners.delete(listener);
      }),
    },
  },
};

Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
});

beforeEach(() => {
  Object.keys(storageState).forEach((key) => {
    delete storageState[key];
  });
  runtimeMessageListeners.clear();
  actionClickListeners.clear();
  chromeMock.runtime.sendMessage.mockReset();
  chromeMock.tabs.query.mockReset();
  chromeMock.tabs.sendMessage.mockReset();
  chromeMock.tabs.reload.mockReset();
  chromeMock.scripting.executeScript.mockReset();
  chromeMock.runtime.onMessage.addListener.mockClear();
  chromeMock.runtime.onMessage.removeListener.mockClear();
  chromeMock.action.onClicked.addListener.mockClear();
  chromeMock.action.onClicked.removeListener.mockClear();
});

Object.defineProperty(globalThis, '__chromeTestUtils', {
  value: {
    dispatchRuntimeMessage(message: unknown, sender: chrome.runtime.MessageSender = {}) {
      runtimeMessageListeners.forEach((listener) => {
        listener(message, sender, vi.fn());
      });
    },
    dispatchActionClick(tab: chrome.tabs.Tab) {
      actionClickListeners.forEach((listener) => {
        listener(tab);
      });
    },
  },
  writable: true,
});
