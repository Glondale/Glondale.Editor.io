 
// Save system data structures - documentation only

/**
 * SaveData structure:
 * {
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
 *   playthroughId: string
 * }
 * 
 * ChoiceRecord structure:
 * {
 *   sceneId: string,
 *   choiceId: string,
 *   timestamp: number
 * }
 * 
 * SaveInfo structure:
 * {
 *   id: string,
 *   name: string,
 *   timestamp: number,
 *   adventureTitle: string,
 *   currentSceneTitle: string
 * }
 * 
 * SaveSlot structure:
 * {
 *   id: string,
 *   name: string,
 *   data: SaveData
 * }
 */