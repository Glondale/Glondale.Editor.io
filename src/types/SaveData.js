// Save system data structures - Enhanced for Phase 3

/**
 * SaveData structure (Phase 3 Enhanced):
 * {
 *   // Core save data (v1.0)
 *   version: string,
 *   adventureId: string,
 *   adventureVersion: string,
 *   timestamp: number,
 *   playerName?: string,
 *   currentSceneId: string,
 *   stats: Record<string, any>,
 *   flags: Record<string, boolean>,
 *   visitedScenes: string[],
 *   choiceHistory: ChoiceRecord[],
 *   playthroughId: string,
 *   
 *   // Phase 3 additions
 *   secretsDiscovered: SecretDiscovery[],      // NEW: Discovered secrets
 *   secretChoicesAvailable: string[],         // NEW: Permanently unlocked secret choices
 *   inventory: InventoryItem[],               // NEW: Player inventory
 *   inventoryState: InventoryState,           // NEW: Inventory metadata
 *   achievements: Achievement[],              // NEW: Unlocked achievements
 *   
 *   // Analytics and export data
 *   exportableData: ExportableData,           // NEW: Cross-game compatible data
 *   gameplayMetrics: GameplayMetrics,         // NEW: Analytics data
 *   saveMetadata: SaveMetadata,               // NEW: Save file metadata
 *   
 *   // Cross-game compatibility
 *   crossGameImports?: CrossGameImport[],     // NEW: Data imported from other games
 *   originalAdventureId?: string,             // NEW: Original adventure if imported
 *   migrationHistory?: MigrationRecord[]      // NEW: Version migration history
 * }
 * 
 * ChoiceRecord structure (Enhanced):
 * {
 *   sceneId: string,
 *   choiceId: string,
 *   timestamp: number,
 *   
 *   // Phase 3 additions
 *   choiceText?: string,      // NEW: Choice text for analytics
 *   wasSecret?: boolean,      // NEW: Was this a secret choice
 *   wasLocked?: boolean,      // NEW: Was this choice previously locked
 *   executionTime?: number,   // NEW: Time taken to make choice
 *   contextData?: any        // NEW: Additional context data
 * }
 * 
 * SecretDiscovery structure (NEW):
 * {
 *   choiceId: string,
 *   sceneId: string,
 *   timestamp: number,
 *   choiceText: string,
 *   discoveryMethod?: string  // How it was discovered (condition_met, item_used, etc.)
 * }
 * 
 * InventoryItem structure (NEW):
 * {
 *   id: string,               // Item definition ID
 *   count: number,            // Quantity owned
 *   acquiredTimestamp?: number, // When first acquired
 *   lastUsedTimestamp?: number, // When last used
 *   customProperties?: Record<string, any>, // Item-specific data
 *   source?: string          // How item was acquired (found, purchased, etc.)
 * }
 * 
 * InventoryState structure (NEW):
 * {
 *   totalWeight: number,      // Current total weight
 *   totalValue: number,       // Current total value
 *   maxWeight?: number,       // Weight limit (if any)
 *   categories: Record<string, CategoryState>, // Per-category state
 *   lastModified: number     // Last inventory change timestamp
 * }
 * 
 * CategoryState structure (NEW):
 * {
 *   itemCount: number,        // Items in this category
 *   totalWeight: number,      // Total weight of category items
 *   totalValue: number,       // Total value of category items
 *   lastModified: number     // Last change in this category
 * }
 * 
 * Achievement structure (NEW):
 * {
 *   id: string,               // Achievement definition ID
 *   unlockedTimestamp: number, // When achievement was unlocked
 *   progress?: number,        // Progress toward achievement (0-1)
 *   metadata?: Record<string, any>, // Achievement-specific data
 *   notificationShown?: boolean // Whether unlock notification was shown
 * }
 * 
 * ExportableData structure (NEW):
 * {
 *   stats: Record<string, ExportableStat>,    // Exportable stats
 *   flags: Record<string, boolean>,           // Exportable flags
 *   inventory: ExportableInventoryItem[],     // Exportable inventory items
 *   achievements: string[],                   // Exportable achievement IDs
 *   metadata: ExportableMetadata             // Export metadata
 * }
 * 
 * ExportableStat structure (NEW):
 * {
 *   value: any,               // Current stat value
 *   type: string,             // Stat type
 *   name: string,             // Display name
 *   category: string,         // Stat category
 *   exportWeight?: number     // Importance weight for cross-game transfer
 * }
 * 
 * ExportableInventoryItem structure (NEW):
 * {
 *   id: string,               // Item ID
 *   count: number,            // Quantity
 *   rarity?: string,          // Item rarity
 *   category: string,         // Item category
 *   exportValue?: number     // Value for cross-game transfer
 * }
 * 
 * ExportableMetadata structure (NEW):
 * {
 *   adventureId: string,
 *   adventureTitle: string,
 *   completionPercentage: number,
 *   playTime: number,
 *   totalChoicesMade: number,
 *   scenesVisited: number,
 *   secretsFound: number,
 *   achievementsUnlocked: number,
 *   exportTimestamp: number,
 *   exportVersion: string
 * }
 * 
 * GameplayMetrics structure (NEW):
 * {
 *   totalChoicesMade: number,
 *   uniqueScenesVisited: number,
 *   secretsFound: number,
 *   achievementsUnlocked: number,
 *   estimatedPlayTime: number,
 *   averageChoicesPerScene: number,
 *   mostVisitedScenes: Array<{sceneId: string, count: number}>,
 *   completionPercentage: number,
 *   
 *   // Advanced metrics
 *   sessionCount: number,
 *   totalSessionTime: number,
 *   averageSessionTime: number,
 *   longestSession: number,
 *   choiceFrequency: Record<string, number>,
 *   progressionRate: number,
 *   backtracks: number,
 *   uniqueEndings: number
 * }
 * 
 * SaveMetadata structure (NEW):
 * {
 *   saveName: string,
 *   adventureTitle: string,
 *   adventureAuthor: string,
 *   currentSceneTitle: string,
 *   saveVersion: string,
 *   engineVersion: string,
 *   
 *   // Compatibility information
 *   compatibilityFlags: CompatibilityFlags,
 *   requiredFeatures: string[],
 *   
 *   // File information
 *   fileSize?: number,
 *   compressionRatio?: number,
 *   checksum?: string
 * }
 * 
 * CompatibilityFlags structure (NEW):
 * {
 *   hasInventory: boolean,
 *   hasSecrets: boolean,
 *   hasCrossGameData: boolean,
 *   hasAnalytics: boolean,
 *   hasAchievements: boolean,
 *   hasCustomStats: boolean,
 *   hasComplexConditions: boolean,
 *   minimumEngineVersion: string
 * }
 * 
 * CrossGameImport structure (NEW):
 * {
 *   sourceAdventureId: string,
 *   sourceAdventureTitle: string,
 *   importTimestamp: number,
 *   importedStats: Record<string, any>,
 *   importedFlags: Record<string, boolean>,
 *   importedItems: string[],
 *   importMethod: 'full' | 'selective' | 'transformed',
 *   transformations: string[],
 *   conflicts: string[],
 *   success: boolean
 * }
 * 
 * MigrationRecord structure (NEW):
 * {
 *   fromVersion: string,
 *   toVersion: string,
 *   migrationTimestamp: number,
 *   migratedFields: string[],
 *   addedFields: string[],
 *   removedFields: string[],
 *   transformations: string[],
 *   warnings: string[],
 *   success: boolean
 * }
 * 
 * SaveInfo structure (Enhanced):
 * {
 *   // Core info (v1.0)
 *   id: string,
 *   name: string,
 *   timestamp: number,
 *   adventureTitle: string,
 *   currentSceneTitle: string,
 *   
 *   // Phase 3 additions
 *   version: string,                    // Save data version
 *   adventureId: string,               // Adventure identifier
 *   completionPercentage: number,      // Progress percentage
 *   secretsFound: number,              // Number of secrets discovered
 *   choicesMade: number,               // Total choices made
 *   playTime?: number,                 // Estimated play time
 *   hasExportData: boolean,            // Can be exported for cross-game use
 *   canExportCrossGame: boolean,       // Compatible with cross-game system
 *   compatibilityFlags: CompatibilityFlags, // Feature compatibility
 *   
 *   // Save file metadata
 *   fileSize?: number,                 // Save file size in bytes
 *   isAutoSave?: boolean,              // Is this an auto-save
 *   lastModified?: number,             // Last modification timestamp
 *   backupCount?: number              // Number of backups available
 * }
 * 
 * SaveSlot structure (Enhanced):
 * {
 *   // Core slot (v1.0)
 *   id: string,
 *   name: string,
 *   data: SaveData,
 *   
 *   // Phase 3 additions
 *   created: number,                   // Creation timestamp
 *   modified: number,                  // Last modification timestamp
 *   version: string,                   // Save slot version
 *   isAutoSave?: boolean,              // Auto-save flag
 *   isQuickSave?: boolean,             // Quick-save flag
 *   backups?: SaveBackup[],            // Backup history
 *   tags?: string[],                   // User tags for organization
 *   notes?: string,                    // User notes about this save
 *   screenshot?: string               // Base64 encoded screenshot
 * }
 * 
 * SaveBackup structure (NEW):
 * {
 *   id: string,
 *   timestamp: number,
 *   reason: 'manual' | 'auto' | 'pre_load' | 'pre_migration',
 *   size: number,
 *   compressed: boolean
 * }
 * 
 * CrossGameSaveData structure (NEW):
 * {
 *   version: string,
 *   sourceAdventure: {
 *     id: string,
 *     title: string,
 *     author: string,
 *     version: string
 *   },
 *   exportTimestamp: number,
 *   compatibility: {
 *     engineVersion: string,
 *     dataVersion: string,
 *     supportedFeatures: string[]
 *   },
 *   playerData: {
 *     name?: string,
 *     playTime: number,
 *     completionPercentage: number
 *   },
 *   transferableData: ExportableData,
 *   validation: {
 *     checksum: string,
 *     signature?: string,
 *     verified: boolean
 *   }
 * }
 * 
 * ImportResult structure (NEW):
 * {
 *   success: boolean,
 *   importedStats: Record<string, any>,
 *   importedFlags: Record<string, boolean>,
 *   importedItems: string[],
 *   conflicts: string[],
 *   warnings: string[],
 *   errors: string[],
 *   summary: string
 * }
 * 
 * SaveValidationResult structure (NEW):
 * {
 *   valid: boolean,
 *   version: string,
 *   errors: string[],
 *   warnings: string[],
 *   requiredMigrations: string[],
 *   compatibilityIssues: string[],
 *   missingFeatures: string[]
 * }
 */

// Default save data template for Phase 3
export const DEFAULT_SAVE_DATA = {
    version: '2.0',
    adventureId: '',
    adventureVersion: '1.0',
    timestamp: 0,
    playerName: null,
    currentSceneId: '',
    stats: {},
    flags: {},
    visitedScenes: [],
    choiceHistory: [],
    playthroughId: '',
    
    // Phase 3 defaults
    secretsDiscovered: [],
    secretChoicesAvailable: [],
    inventory: [],
    inventoryState: {
      totalWeight: 0,
      totalValue: 0,
      categories: {},
      lastModified: 0
    },
    achievements: [],
    exportableData: null,
    gameplayMetrics: null,
    saveMetadata: null,
    crossGameImports: [],
    migrationHistory: []
  };
  
  // Save data version compatibility matrix
  export const SAVE_VERSION_COMPATIBILITY = {
    '1.0': {
      canUpgradeTo: ['2.0'],
      requiresMigration: true,
      supportedFeatures: ['basic_saves', 'stats', 'flags', 'choice_history']
    },
    '2.0': {
      canUpgradeTo: [],
      requiresMigration: false,
      supportedFeatures: [
        'basic_saves', 'stats', 'flags', 'choice_history',
        'inventory', 'secrets', 'achievements', 'cross_game_saves',
        'analytics', 'advanced_conditions'
      ]
    }
  };
  
  // Cross-game save compatibility levels
  export const CROSS_GAME_COMPATIBILITY_LEVELS = {
    NONE: 0,        // No cross-game compatibility
    BASIC: 1,       // Basic stats and flags only
    STANDARD: 2,    // Stats, flags, and simple inventory
    ADVANCED: 3,    // Full feature compatibility
    CUSTOM: 4       // Custom compatibility rules
  };
  
  // Save file size limits (in bytes)
  export const SAVE_SIZE_LIMITS = {
    QUICK_SAVE: 1024 * 50,      // 50KB for quick saves
    REGULAR_SAVE: 1024 * 200,   // 200KB for regular saves
    CROSS_GAME_SAVE: 1024 * 100, // 100KB for cross-game saves
    BACKUP_SAVE: 1024 * 500     // 500KB for backup saves
  };
  
  // Save validation rules
  export const SAVE_VALIDATION_RULES = {
    REQUIRED_FIELDS: [
      'version', 'adventureId', 'timestamp', 'currentSceneId',
      'stats', 'flags', 'visitedScenes', 'choiceHistory', 'playthroughId'
    ],
    OPTIONAL_FIELDS_V2: [
      'secretsDiscovered', 'secretChoicesAvailable', 'inventory',
      'inventoryState', 'achievements', 'exportableData',
      'gameplayMetrics', 'saveMetadata'
    ],
    MAX_ARRAY_SIZES: {
      visitedScenes: 10000,
      choiceHistory: 50000,
      secretsDiscovered: 1000,
      inventory: 1000,
      achievements: 500
    }
  };