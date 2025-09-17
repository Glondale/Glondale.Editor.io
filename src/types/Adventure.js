// Core adventure data structures - Enhanced for Phase 3
// No exports needed - just documentation for reference

/**
 * Adventure structure (Phase 3 Enhanced):
 * {
 *   id: string,
 *   title: string,
 *   author: string,
 *   version: string,
 *   description: string,
 *   scenes: Scene[],
 *   stats: StatDefinition[],
 *   inventory: InventoryItemDefinition[], // NEW: Inventory system
 *   startSceneId: string,
 *   
 *   // Phase 3 additions
 *   crossGameCompatibility?: CrossGameCompatibility,
 *   achievements?: Achievement[],
 *   flags?: FlagDefinition[],
 *   categories?: Category[],
 *   metadata?: AdventureMetadata
 * }
 * 
 * Scene structure (Phase 3 Enhanced):
 * {
 *   id: string,
 *   title: string,
 *   content: string,
 *   choices: Choice[],
 *   onEnter?: Action[],
 *   onExit?: Action[],
 *   
 *   // Phase 3 additions
 *   tags?: string[],
 *   category?: string,
 *   description?: string,
 *   requiredItems?: string[], // Items needed to enter scene
 *   secretUnlocks?: SecretUnlock[] // Secrets this scene can unlock
 * }
 * 
 * Choice structure (Phase 3 Enhanced):
 * {
 *   id: string,
 *   text: string,
 *   targetSceneId: string,
 *   conditions?: Condition[],
 *   actions?: Action[],
 *   
 *   // Enhanced visibility system
 *   isHidden?: boolean,        // Only show if conditions met
 *   isSecret?: boolean,        // NEW: Secret choice (permanently unlocks)
 *   isLocked?: boolean,        // NEW: Visible but disabled
 *   
 *   // Phase 3 additions
 *   requirements?: Requirement[], // NEW: Requirements to select choice
 *   lockReasons?: string[],      // NEW: Reasons why choice is locked
 *   secretConditions?: Condition[], // NEW: Conditions to discover secret
 *   priority?: number,           // NEW: Display order priority
 *   category?: string,           // NEW: Choice category
 *   consequences?: Consequence[], // NEW: Preview of choice outcomes
 *   oneTime?: boolean,           // NEW: Can only be selected once (equivalent to maxUses=1)
 *   maxUses?: number,            // NEW: Maximum number of times this choice can be selected (0 = unlimited)
 *   cooldown?: number           // NEW: Cooldown in milliseconds before it can be selected again
 * }
 * 
 * Condition structure (Phase 3 Enhanced):
 * {
 *   // Basic condition
 *   type: 'stat' | 'flag' | 'scene_visited' | 'has_item' | 'item_count' | 
 *         'inventory_category' | 'choice_made' | 'choice_made_count' |
 *         'scene_visit_count' | 'total_choices' | 'unique_scenes_visited' |
 *         'inventory_total' | 'inventory_weight' | 'inventory_value',
 *   operator: 'eq' | '==' | 'ne' | '!=' | 'gt' | '>' | 'gte' | '>=' | 
 *            'lt' | '<' | 'lte' | '<=' | 'contains' | 'not_contains' |
 *            'starts_with' | 'ends_with' | 'matches' | 'in' | 'not_in' |
 *            'between' | 'not_between',
 *   key: string,
 *   value: any,
 *   
 *   // Complex condition support
 *   logic?: 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR',
 *   conditions?: Condition[], // Nested conditions
 *   
 *   // Phase 3 additions
 *   description?: string,     // Human-readable description
 *   category?: string,        // Condition category
 *   weight?: number          // Importance weight for evaluation
 * }
 * 
 * Action structure (Phase 3 Enhanced):
 * {
 *   type: 'set_stat' | 'add_stat' | 'multiply_stat' | 'set_flag' | 'toggle_flag' |
 *         'add_inventory' | 'remove_inventory' | 'set_inventory' |
 *         'add_achievement' | 'unlock_secret' | 'trigger_event',
 *   key: string,
 *   value: any,
 *   
 *   // Phase 3 additions
 *   conditions?: Condition[], // Only execute if conditions met
 *   probability?: number,     // Chance of execution (0-1)
 *   delay?: number,          // Delay before execution (ms)
 *   description?: string,    // Human-readable description
 *   category?: string       // Action category
 * }
 * 
 * StatDefinition structure (Phase 3 Enhanced):
 * {
 *   id: string,
 *   name: string,
 *   type: 'number' | 'string' | 'boolean' | 'percentage' | 'currency' | 'time' | string,
 *   defaultValue: any,
 *   min?: number,
 *   max?: number,
 *   hidden?: boolean,
 *   
 *   // Phase 3 additions
 *   category?: string,        // Stat category for organization
 *   description?: string,     // Tooltip description
 *   unit?: string,           // Display unit (%, $, etc.)
 *   precision?: number,      // Decimal places for numbers
 *   noExport?: boolean,      // Exclude from cross-game exports
 *   tags?: string[],         // Organizational tags
 *   dependencies?: string[]  // Stats that affect this stat
 * }
 * 
 * InventoryItemDefinition structure (NEW):
 * {
 *   id: string,
 *   name: string,
 *   description?: string,
 *   category: string,
 *   
 *   // Item properties
 *   stackable?: boolean,     // Can have multiple copies
 *   maxStack?: number,       // Maximum stack size
 *   weight?: number,         // Item weight
 *   value?: number,          // Item value/cost
 *   rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary',
 *   
 *   // Visual properties
 *   icon?: string,           // Icon identifier
 *   color?: string,          // Display color
 *   
 *   // Functional properties
 *   effects?: ItemEffect[],  // Effects when used/equipped
 *   requirements?: Condition[], // Requirements to use item
 *   tags?: string[],         // Item tags
 *   
 *   // Cross-game properties
 *   exportable?: boolean,    // Can be exported to other adventures
 *   unique?: boolean        // Only one can exist
 * }
 * 
 * ItemEffect structure (NEW):
 * {
 *   type: 'stat_modifier' | 'flag_set' | 'unlock_choice' | 'unlock_scene' | 'custom',
 *   target?: string,         // Target stat/flag/choice/scene
 *   value?: any,            // Effect value
 *   duration?: number,      // Effect duration (permanent if not specified)
 *   conditions?: Condition[] // Conditions for effect to trigger
 * }
 * 
 * Requirement structure (NEW):
 * {
 *   type: 'stat' | 'flag' | 'item' | 'scene_visited' | 'choice_made' | 'custom',
 *   key: string,
 *   value?: any,
 *   operator?: string,
 *   description?: string,    // Human-readable requirement
 *   category?: string       // Requirement category
 * }
 * 
 * SecretUnlock structure (NEW):
 * {
 *   id: string,
 *   type: 'choice' | 'scene' | 'item' | 'achievement',
 *   targetId: string,
 *   conditions: Condition[],
 *   permanent?: boolean,     // Once unlocked, stays unlocked
 *   notification?: string   // Message to show when unlocked
 * }
 * 
 * Consequence structure (NEW):
 * {
 *   type: 'stat_change' | 'item_gain' | 'item_loss' | 'scene_unlock' | 'ending',
 *   description: string,
 *   severity?: 'minor' | 'moderate' | 'major' | 'critical',
 *   category?: string
 * }
 * 
 * Achievement structure (NEW):
 * {
 *   id: string,
 *   name: string,
 *   description: string,
 *   category?: string,
 *   icon?: string,
 *   conditions: Condition[],
 *   rewards?: Action[],      // Actions to execute when achieved
 *   points?: number,        // Achievement points value
 *   hidden?: boolean,       // Don't show until unlocked
 *   rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
 * }
 * 
 * FlagDefinition structure (NEW):
 * {
 *   id: string,
 *   name: string,
 *   description?: string,
 *   category?: string,
 *   defaultValue?: boolean,
 *   persistent?: boolean,    // Survives adventure restart
 *   exportable?: boolean    // Can be exported to other adventures
 * }
 * 
 * Category structure (NEW):
 * {
 *   id: string,
 *   name: string,
 *   description?: string,
 *   color?: string,         // Display color
 *   icon?: string,          // Category icon
 *   order?: number         // Display order
 * }
 * 
 * CrossGameCompatibility structure (NEW):
 * {
 *   version: string,
 *   exportableStats: string[],    // Stats that can be exported
 *   exportableFlags: string[],    // Flags that can be exported
 *   exportableItems: string[],    // Items that can be exported
 *   importRules?: ImportRule[],   // Rules for importing from other adventures
 *   compatibleAdventures?: string[] // Adventure IDs this is compatible with
 * }
 * 
 * ImportRule structure (NEW):
 * {
 *   sourceAdventureId?: string,  // Source adventure (null = any)
 *   statMappings?: {[key: string]: string}, // Stat name mappings
 *   flagMappings?: {[key: string]: string}, // Flag name mappings
 *   itemMappings?: {[key: string]: string}, // Item name mappings
 *   conditions?: Condition[],    // Conditions for import to succeed
 *   transformations?: Transformation[] // Value transformations
 * }
 * 
 * Transformation structure (NEW):
 * {
 *   type: 'scale' | 'clamp' | 'convert' | 'custom',
 *   source: string,         // Source field
 *   target: string,         // Target field
 *   parameters?: any       // Transformation parameters
 * }
 * 
 * AdventureMetadata structure (NEW):
 * {
 *   created: number,        // Creation timestamp
 *   modified: number,       // Last modification timestamp
 *   estimatedPlayTime?: number, // Estimated play time in minutes
 *   difficulty?: 'easy' | 'medium' | 'hard' | 'expert',
 *   genre?: string[],       // Genre tags
 *   language?: string,      // Primary language
 *   contentRating?: string, // Content rating (G, PG, PG-13, etc.)
 *   keywords?: string[],    // Search keywords
 *   previousVersions?: string[], // Previous version IDs
 *   changeLog?: string     // Change log for this version
 * }
 */

// Example enhanced adventure structure:
export const SAMPLE_ENHANCED_ADVENTURE = {
    id: 'enhanced_adventure_sample',
    title: 'The Enhanced Quest',
    author: 'Adventure Engine',
    version: '2.0',
    description: 'A sample adventure showcasing Phase 3 features',
    
    // Enhanced scenes with new properties
    scenes: [
      {
        id: 'start',
        title: 'The Beginning',
        content: 'Your adventure begins here...',
        category: 'introduction',
        tags: ['tutorial', 'starting_area'],
        choices: [
          {
            id: 'choice_1',
            text: 'Explore the forest',
            targetSceneId: 'forest',
            priority: 1,
            consequences: [{
              type: 'scene_unlock',
              description: 'You will discover the mysterious forest',
              severity: 'minor'
            }]
          },
          {
            id: 'secret_choice_1',
            text: 'Look for hidden passages',
            targetSceneId: 'secret_area',
            isSecret: true,
            secretConditions: [{
              type: 'stat',
              key: 'perception',
              operator: 'gte',
              value: 5
            }],
            consequences: [{
              type: 'scene_unlock',
              description: 'You might find secret areas',
              severity: 'major'
            }]
          }
        ]
      }
    ],
    
    // Enhanced stats with new properties
    stats: [
      {
        id: 'health',
        name: 'Health',
        type: 'number',
        defaultValue: 100,
        min: 0,
        max: 100,
        category: 'vital',
        description: 'Your life force',
        unit: 'HP'
      },
      {
        id: 'gold',
        name: 'Gold',
        type: 'currency',
        defaultValue: 0,
        min: 0,
        category: 'resources',
        description: 'Currency for purchasing items'
      },
      {
        id: 'experience',
        name: 'Experience',
        type: 'percentage',
        defaultValue: 0,
        min: 0,
        max: 100,
        category: 'progression',
        description: 'Progress toward next level'
      }
    ],
    
    // New inventory system
    inventory: [
      {
        id: 'sword',
        name: 'Iron Sword',
        description: 'A sturdy iron sword',
        category: 'weapons',
        stackable: false,
        weight: 5,
        value: 50,
        rarity: 'common',
        effects: [{
          type: 'stat_modifier',
          target: 'attack',
          value: 10
        }],
        exportable: true
      },
      {
        id: 'health_potion',
        name: 'Health Potion',
        description: 'Restores 50 health points',
        category: 'consumables',
        stackable: true,
        maxStack: 10,
        weight: 0.5,
        value: 25,
        rarity: 'common',
        effects: [{
          type: 'stat_modifier',
          target: 'health',
          value: 50
        }],
        exportable: true
      }
    ],
    
    // Achievement system
    achievements: [
      {
        id: 'first_steps',
        name: 'First Steps',
        description: 'Complete the tutorial',
        category: 'progression',
        conditions: [{
          type: 'scene_visited',
          key: 'tutorial_complete',
          operator: 'eq',
          value: true
        }],
        points: 10
      }
    ],
    
    // Flag definitions
    flags: [
      {
        id: 'tutorial_complete',
        name: 'Tutorial Complete',
        description: 'Player has completed the tutorial',
        category: 'progression',
        defaultValue: false,
        persistent: true
      }
    ],
    
    // Categories for organization
    categories: [
      {
        id: 'vital',
        name: 'Vital Stats',
        color: '#ff0000',
        order: 1
      },
      {
        id: 'resources',
        name: 'Resources',
        color: '#ffd700',
        order: 2
      }
    ],
    
    // Cross-game compatibility
    crossGameCompatibility: {
      version: '2.0',
      exportableStats: ['health', 'gold', 'experience'],
      exportableFlags: ['tutorial_complete'],
      exportableItems: ['sword', 'health_potion'],
      compatibleAdventures: ['other_adventure_id']
    },
    
    // Adventure metadata
    metadata: {
      created: Date.now(),
      modified: Date.now(),
      estimatedPlayTime: 30,
      difficulty: 'medium',
      genre: ['fantasy', 'adventure'],
      language: 'en',
      contentRating: 'PG',
      keywords: ['magic', 'quest', 'exploration']
    },
    
    startSceneId: 'start'
  };