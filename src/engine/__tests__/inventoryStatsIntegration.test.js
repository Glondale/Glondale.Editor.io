import '../../test/setupBrowserEnv.js';
import { beforeAll, describe, expect, it } from 'bun:test';

let StoryEngine;

beforeAll(async () => {
  ({ StoryEngine } = await import('../StoryEngine.js'));
});

const createAdventureWithTotalItemsStat = () => ({
  title: 'Inventory Stat Adventure',
  startSceneId: 'start',
  scenes: [
    {
      id: 'start',
      title: 'Start',
      content: 'Start',
      choices: [
        {
          id: 'gain_item',
          text: 'Gain item',
          targetSceneId: 'afterGain',
          actions: [
            { type: 'add_inventory', key: 'potion', value: 2 }
          ]
        }
      ]
    },
    {
      id: 'afterGain',
      title: 'After Gain',
      content: 'After gain',
      choices: [
        {
          id: 'remove_item',
          text: 'Remove item',
          targetSceneId: 'end',
          actions: [
            { type: 'remove_inventory', key: 'potion', value: 1 }
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
  stats: [
    { id: 'total_items', name: 'Total Items', type: 'number', defaultValue: 0, min: 0 }
  ],
  inventory: [
    { id: 'potion', name: 'Potion', maxStack: 10 }
  ]
});

const createAdventureWithoutTotalItemsStat = () => ({
  title: 'Inventory Adventure',
  startSceneId: 'start',
  scenes: [
    {
      id: 'start',
      title: 'Start',
      content: 'Start',
      choices: [
        {
          id: 'gain_item',
          text: 'Gain item',
          targetSceneId: 'end',
          actions: [
            { type: 'add_inventory', key: 'potion', value: 1 }
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
  stats: [],
  inventory: [
    { id: 'potion', name: 'Potion', maxStack: 10 }
  ]
});

describe('StoryEngine inventory and stats integration', () => {
  it('keeps total_items stat in sync when adding and removing items during gameplay', async () => {
    const engine = new StoryEngine();
    engine.validationEnabled = false;

    await engine.loadAdventure(createAdventureWithTotalItemsStat());

    expect(() => engine.makeChoice('gain_item')).not.toThrow();

    expect(engine.inventoryManager.getItemCount('potion')).toBe(2);
    expect(engine.statsManager.getStat('total_items')).toBe(2);

    expect(() => engine.makeChoice('remove_item')).not.toThrow();

    expect(engine.inventoryManager.getItemCount('potion')).toBe(1);
    expect(engine.statsManager.getStat('total_items')).toBe(1);
  });

  it('does not throw when inventory changes and no total_items stat is defined', async () => {
    const engine = new StoryEngine();
    engine.validationEnabled = false;

    await engine.loadAdventure(createAdventureWithoutTotalItemsStat());

    expect(() => engine.makeChoice('gain_item')).not.toThrow();
    expect(engine.inventoryManager.getItemCount('potion')).toBe(1);
    expect(engine.statsManager.getStat('total_items')).toBeUndefined();
  });
});
