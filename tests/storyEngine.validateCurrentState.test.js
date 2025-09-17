import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser-like globals for modules that expect a DOM environment
if (!globalThis.window) {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  };
}

if (!globalThis.localStorage) {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };
}

if (!globalThis.navigator) {
  globalThis.navigator = { userAgent: 'node-test' };
}

if (!globalThis.location) {
  globalThis.location = { href: 'http://localhost/test' };
}

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

Object.assign(globalThis.window, {
  location: globalThis.location,
  localStorage: globalThis.localStorage,
  navigator: globalThis.navigator
});

const { StoryEngine } = await import('../src/engine/StoryEngine.js');

test('validateCurrentState provides combined stats and flags to validator', async (t) => {
  t.after(() => {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  const engine = new StoryEngine();
  engine.setValidationEnabled(true);

  engine.adventure = {
    id: 'adventure-test',
    title: 'Adventure Test'
  };

  engine.currentScene = { id: 'start-scene' };

  engine.statsManager.setStat('health', 42);
  engine.statsManager.setFlag('questComplete', true);

  const expectedResult = { errors: [], warnings: [], info: [] };
  let receivedOptions;

  engine.validationService = {
    async validate(adventure, options) {
      receivedOptions = options;
      return expectedResult;
    }
  };

  const result = await engine.validateCurrentState();

  assert.strictEqual(result, expectedResult);
  assert.ok(receivedOptions, 'validation should receive options');
  assert.deepStrictEqual(receivedOptions.stats, {
    stats: { health: 42 },
    flags: { questComplete: true }
  });
  assert.strictEqual(receivedOptions.currentScene, 'start-scene');
});
