 
// Game state management

// Initial state
export const initialGameState = {
  adventure: null,
  currentScene: null,
  stats: {},
  flags: {},
  visitedScenes: [],
  choiceHistory: [],
  isLoading: false,
  error: null,
};

/**
 * GameState structure:
 * {
 *   adventure: Adventure | null,
 *   currentScene: Scene | null,
 *   stats: Record<string, any>,
 *   flags: Record<string, boolean>,
 *   visitedScenes: string[],
 *   choiceHistory: Array<{sceneId: string, choiceId: string, timestamp: number}>,
 *   isLoading: boolean,
 *   error: string | null
 * }
 * 
 * GameAction types:
 * - { type: 'LOAD_ADVENTURE', payload: Adventure }
 * - { type: 'SET_SCENE', payload: Scene }
 * - { type: 'UPDATE_STAT', payload: { key: string, value: any } }
 * - { type: 'ADD_TO_STAT', payload: { key: string, amount: number } }
 * - { type: 'SET_FLAG', payload: { key: string, value: boolean } }
 * - { type: 'RECORD_CHOICE', payload: { sceneId: string, choiceId: string } }
 * - { type: 'LOAD_SAVE', payload: SaveData }
 * - { type: 'SET_LOADING', payload: boolean }
 * - { type: 'SET_ERROR', payload: string | null }
 * - { type: 'RESET_GAME' }
 */