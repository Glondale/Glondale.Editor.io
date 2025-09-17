import assert from 'node:assert/strict';

const noop = () => {};

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

if (!(process?.env?.ENABLE_REAL_INTERVALS === 'true')) {
  globalThis.setInterval = () => ({ clear: () => {} });
  globalThis.clearInterval = () => {};
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
    location: { href: 'http://localhost/test' }
  };
} else {
  globalThis.window.addEventListener = globalThis.window.addEventListener || noop;
  globalThis.window.removeEventListener = globalThis.window.removeEventListener || noop;
  globalThis.window.dispatchEvent = globalThis.window.dispatchEvent || noop;
  globalThis.window.location = globalThis.window.location || { href: 'http://localhost/test' };
}

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'node-test' };
}
if (!globalThis.window.navigator) {
  globalThis.window.navigator = globalThis.navigator;
}

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, params = {}) {
      this.type = type;
      this.detail = params.detail;
    }
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };
}
if (!globalThis.window.localStorage) {
  globalThis.window.localStorage = globalThis.localStorage;
}

const [{ StoryEngine }, { StatsManager }] = await Promise.all([
  import('../StoryEngine.js'),
  import('../StatsManager.js')
]);

function createConfiguredEngine() {
  const engine = new StoryEngine();
  const statsManager = new StatsManager([
    {
      id: 'total_items',
      name: 'Total Items',
      type: 'number',
      defaultValue: 0,
      min: 0
    }
  ]);

  engine.statsManager = statsManager;
  engine.inventoryManager.statsManager = statsManager;
  statsManager.setInventoryManager(engine.inventoryManager);

  engine.inventoryManager.initializeInventory([
    { id: 'potion', name: 'Potion', maxStack: 5, value: 10 },
    { id: 'elixir', name: 'Elixir', unique: true, maxStack: 1 }
  ]);

  return engine;
}

function testSetInventoryCreatesOrUpdatesItems() {
  const engine = createConfiguredEngine();
  engine.executeActions([{ type: 'set_inventory', key: 'potion', value: 3 }]);

  assert.equal(engine.inventoryManager.getItemCount('potion'), 3, 'potion count should be set to 3');
  assert.equal(engine.statsManager.getStat('total_items'), 3, 'total_items stat should track new quantity');
}

function testSetInventoryRemovesItemsWhenZero() {
  const engine = createConfiguredEngine();
  engine.executeActions([{ type: 'set_inventory', key: 'potion', value: 2 }]);
  engine.executeActions([{ type: 'set_inventory', key: 'potion', value: 0 }]);

  assert.equal(engine.inventoryManager.getItemCount('potion'), 0, 'potion should be removed when quantity set to 0');
  assert.equal(engine.statsManager.getStat('total_items'), 0, 'total_items should be cleared when inventory emptied');
}

function testSetInventoryRespectsMaxStack() {
  const engine = createConfiguredEngine();
  engine.executeActions([{ type: 'set_inventory', key: 'potion', value: 10 }]);

  assert.equal(engine.inventoryManager.getItemCount('potion'), 5, 'potion should clamp to max stack of 5');
  assert.equal(engine.statsManager.getStat('total_items'), 5, 'total_items should reflect clamped value');
}

function testSetInventoryReportsFailures() {
  const engine = createConfiguredEngine();
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    engine.executeActions([{ type: 'set_inventory', key: 'unknown_item', value: 1 }]);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(engine.inventoryManager.getItemCount('unknown_item'), 0, 'unknown item should not be added');
  assert.ok(
    warnings.some((message) => message.includes('Failed to set inventory for unknown_item')),
    'failure should be logged to console'
  );
}

function testSetItemCountValidatesInput() {
  const engine = createConfiguredEngine();
  const result = engine.inventoryManager.setItemCount('potion', -5);

  assert.equal(result.success, false, 'negative quantity should fail');
  assert.equal(engine.inventoryManager.getItemCount('potion'), 0, 'inventory should remain unchanged on failure');
}

function runTests() {
  testSetInventoryCreatesOrUpdatesItems();
  testSetInventoryRemovesItemsWhenZero();
  testSetInventoryRespectsMaxStack();
  testSetInventoryReportsFailures();
  testSetItemCountValidatesInput();
}

try {
  runTests();
  console.log('✅ set_inventory action tests passed');
} catch (error) {
  console.error('❌ set_inventory action tests failed');
  console.error(error);
  process.exitCode = 1;
} finally {
  if (originalSetInterval) {
    globalThis.setInterval = originalSetInterval;
  }
  if (originalClearInterval) {
    globalThis.clearInterval = originalClearInterval;
  }
}
