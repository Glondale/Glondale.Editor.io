import test from 'node:test';
import assert from 'node:assert/strict';

import { InventoryManager } from '../src/engine/InventoryManager.js';
import { ConditionParser } from '../src/engine/ConditionParser.js';

const createInventoryManager = () => {
  const statsManagerStub = {
    getStat: () => 0,
    hasFlag: () => false,
    getVersion: () => 0,
    hasStatDefinition: () => false,
    setStat: () => {}
  };

  const itemDefinitions = [
    { id: 'sword', name: 'Sword', category: 'weapon', value: 50, weight: 5 },
    { id: 'potion', name: 'Potion', category: 'consumable', value: 10, weight: 1, consumable: true },
    { id: 'cloak', name: 'Cloak', category: 'armor', value: 25, weight: 3, hidden: true }
  ];

  const inventoryManager = new InventoryManager(statsManagerStub, itemDefinitions);

  inventoryManager.addItem('sword', 2);
  inventoryManager.addItem('potion', 3);
  inventoryManager.addItem('cloak', 1);

  return { inventoryManager, statsManagerStub };
};

test('InventoryManager category helpers return expected items', () => {
  const { inventoryManager } = createInventoryManager();

  const weapons = inventoryManager.getItemsByCategory('weapon');
  assert.equal(weapons.length, 1);
  assert.equal(weapons[0].quantity, 2);

  const armorHidden = inventoryManager.getItemsByCategory('armor');
  assert.equal(armorHidden.length, 1);

  const armorVisibleOnly = inventoryManager.getItemsByCategory('armor', false);
  assert.equal(armorVisibleOnly.length, 0);
});

test('InventoryManager aggregate helpers mirror inventory state changes', () => {
  const { inventoryManager } = createInventoryManager();

  assert.equal(inventoryManager.getTotalItemCount(), 6);
  assert.equal(inventoryManager.getTotalWeight(), 16);
  assert.equal(inventoryManager.getTotalValue(), 155);

  inventoryManager.addItem('potion', 1);

  assert.equal(inventoryManager.getTotalItemCount(), 7);
  assert.equal(inventoryManager.getTotalWeight(), 17);
  assert.equal(inventoryManager.getTotalValue(), 165);
});

test('ConditionParser evaluates inventory conditions without errors', () => {
  const { inventoryManager, statsManagerStub } = createInventoryManager();
  const parser = new ConditionParser(statsManagerStub, [], inventoryManager, []);

  assert.equal(
    parser.evaluateCondition({ type: 'inventory_category', operator: '>=', key: 'weapon', value: 1 }),
    true
  );

  assert.equal(
    parser.evaluateCondition({ type: 'inventory_total', operator: '>=', value: 6 }),
    true
  );

  assert.equal(
    parser.evaluateCondition({ type: 'inventory_weight', operator: '>', value: 15 }),
    true
  );

  assert.equal(
    parser.evaluateCondition({ type: 'inventory_value', operator: '==', value: 155 }),
    true
  );
});
