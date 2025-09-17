import '../../test/setupBrowserEnv.js';
import { beforeAll, describe, expect, it } from 'bun:test';

let StoryEngine;

beforeAll(async () => {
  ({ StoryEngine } = await import('../StoryEngine.js'));
});

const baseInventory = [
  { id: 'potion', name: 'Potion', maxStack: 5 }
];

const totalItemsStat = [
  { id: 'total_items', name: 'Total Items', type: 'number', defaultValue: 0, min: 0 }
];

describe('StoryEngine set_inventory action', () => {
  it('sets inventory counts directly and updates stats', async () => {
    const engine = new StoryEngine();
    engine.validationEnabled = false;

    await engine.loadAdventure({
      title: 'Set Inventory Adventure',
      startSceneId: 'start',
      scenes: [
        {
          id: 'start',
          title: 'Start',
          content: 'Start',
          choices: [
            {
              id: 'set_to_three',
              text: 'Set to three',
              targetSceneId: 'end',
              actions: [
                { type: 'set_inventory', key: 'potion', value: 3 }
              ]
            }
          ]
        },
        {
          id: 'end',
          title: 'End',
          content: 'End',
          choices: []
        }
      ],
      stats: totalItemsStat,
      inventory: baseInventory
    });

    expect(engine.inventoryManager.getItemCount('potion')).toBe(0);
    expect(engine.statsManager.getStat('total_items')).toBe(0);

    expect(() => engine.makeChoice('set_to_three')).not.toThrow();

    expect(engine.inventoryManager.getItemCount('potion')).toBe(3);
    expect(engine.statsManager.getStat('total_items')).toBe(3);
  });

  it('removes entries when quantity is set to zero', async () => {
    const engine = new StoryEngine();
    engine.validationEnabled = false;

    await engine.loadAdventure({
      title: 'Set Inventory Adventure',
      startSceneId: 'start',
      scenes: [
        {
          id: 'start',
          title: 'Start',
          content: 'Start',
          choices: [
            {
              id: 'prime_inventory',
              text: 'Prime inventory',
              targetSceneId: 'mid',
              actions: [
                { type: 'set_inventory', key: 'potion', value: 4 }
              ]
            }
          ]
        },
        {
          id: 'mid',
          title: 'Mid',
          content: 'Mid',
          choices: [
            {
              id: 'clear_inventory',
              text: 'Clear inventory',
              targetSceneId: 'end',
              actions: [
                { type: 'set_inventory', key: 'potion', value: 0 }
              ]
            }
          ]
        },
        {
          id: 'end',
          title: 'End',
          content: 'End',
          choices: []
        }
      ],
      stats: totalItemsStat,
      inventory: baseInventory
    });

    expect(() => engine.makeChoice('prime_inventory')).not.toThrow();
    expect(engine.inventoryManager.getItemCount('potion')).toBe(4);
    expect(engine.statsManager.getStat('total_items')).toBe(4);

    expect(() => engine.makeChoice('clear_inventory')).not.toThrow();
    expect(engine.inventoryManager.getItemCount('potion')).toBe(0);
    expect(engine.inventoryManager.hasItem('potion')).toBe(false);
    expect(engine.statsManager.getStat('total_items')).toBe(0);
  });

  it('clamps counts to the item max stack', async () => {
    const engine = new StoryEngine();
    engine.validationEnabled = false;

    await engine.loadAdventure({
      title: 'Clamp Inventory Adventure',
      startSceneId: 'start',
      scenes: [
        {
          id: 'start',
          title: 'Start',
          content: 'Start',
          choices: [
            {
              id: 'overfill_inventory',
              text: 'Overfill inventory',
              targetSceneId: 'end',
              actions: [
                { type: 'set_inventory', key: 'potion', value: 12 }
              ]
            }
          ]
        },
        {
          id: 'end',
          title: 'End',
          content: 'End',
          choices: []
        }
      ],
      stats: totalItemsStat,
      inventory: baseInventory
    });

    expect(() => engine.makeChoice('overfill_inventory')).not.toThrow();
    expect(engine.inventoryManager.getItemCount('potion')).toBe(5);
    expect(engine.statsManager.getStat('total_items')).toBe(5);
  });

  it('rejects negative quantities without changing inventory', async () => {
    const engine = new StoryEngine();
    engine.validationEnabled = false;

    await engine.loadAdventure({
      title: 'Negative Inventory Adventure',
      startSceneId: 'start',
      scenes: [
        {
          id: 'start',
          title: 'Start',
          content: 'Start',
          choices: [
            {
              id: 'seed_inventory',
              text: 'Seed inventory',
              targetSceneId: 'mid',
              actions: [
                { type: 'set_inventory', key: 'potion', value: 2 }
              ]
            }
          ]
        },
        {
          id: 'mid',
          title: 'Mid',
          content: 'Mid',
          choices: [
            {
              id: 'negative_inventory',
              text: 'Negative inventory',
              targetSceneId: 'end',
              actions: [
                { type: 'set_inventory', key: 'potion', value: -1 }
              ]
            }
          ]
        },
        {
          id: 'end',
          title: 'End',
          content: 'End',
          choices: []
        }
      ],
      stats: totalItemsStat,
      inventory: baseInventory
    });

    expect(() => engine.makeChoice('seed_inventory')).not.toThrow();
    expect(engine.inventoryManager.getItemCount('potion')).toBe(2);
    expect(engine.statsManager.getStat('total_items')).toBe(2);

    expect(() => engine.makeChoice('negative_inventory')).not.toThrow();
    expect(engine.inventoryManager.getItemCount('potion')).toBe(2);
    expect(engine.statsManager.getStat('total_items')).toBe(2);
  });
});

