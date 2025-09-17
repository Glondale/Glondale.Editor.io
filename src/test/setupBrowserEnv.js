const ensureWindow = () => {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {}
    };
  } else {
    globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {});
    globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {});
    globalThis.window.dispatchEvent = globalThis.window.dispatchEvent || (() => {});
  }
};

const ensureLocalStorage = () => {
  if (typeof globalThis.localStorage === 'undefined') {
    const storage = new Map();
    globalThis.localStorage = {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear()
    };
  }
};

const ensureNavigator = () => {
  if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { userAgent: 'test-suite' };
  }
};

const ensureLocation = () => {
  if (typeof globalThis.location === 'undefined') {
    globalThis.location = { href: 'http://localhost/test' };
  }
};

const ensureCustomEvent = () => {
  if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };
  }
};

const wireWindowGlobals = () => {
  if (typeof globalThis.window !== 'undefined') {
    globalThis.window.localStorage = globalThis.window.localStorage || globalThis.localStorage;
    globalThis.window.navigator = globalThis.window.navigator || globalThis.navigator;
    globalThis.window.location = globalThis.window.location || globalThis.location;
  }
};

ensureWindow();
ensureLocalStorage();
ensureNavigator();
ensureLocation();
ensureCustomEvent();
wireWindowGlobals();

