import { vi } from 'vitest';

// In-memory store for chrome.storage.local mock
const localStore: Record<string, any> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[] | Record<string, any>) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: localStore[keys] });
        }
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach((k) => {
            result[k] = localStore[k];
          });
          return Promise.resolve(result);
        }
        return Promise.resolve(localStore);
      }),
      set: vi.fn((items: Record<string, any>) => {
        Object.assign(localStore, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((k) => delete localStore[k]);
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    openOptionsPage: vi.fn(),
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn(),
  },
  tabs: {
    create: vi.fn(),
  },
};

(globalThis as any).chrome = chromeMock;
