// Core adventure data structures
// No exports needed - just documentation for reference

/**
 * Adventure structure:
 * {
 *   id: string,
 *   title: string,
 *   author: string,
 *   version: string,
 *   description: string,
 *   scenes: Scene[],
 *   stats: StatDefinition[],
 *   startSceneId: string
 * }
 * 
 * Scene structure:
 * {
 *   id: string,
 *   title: string,
 *   content: string,
 *   choices: Choice[],
 *   onEnter?: Action[],
 *   onExit?: Action[]
 * }
 * 
 * Choice structure:
 * {
 *   id: string,
 *   text: string,
 *   targetSceneId: string,
 *   conditions?: Condition[],
 *   actions?: Action[],
 *   isHidden?: boolean
 * }
 * 
 * Condition structure:
 * {
 *   type: 'stat' | 'flag' | 'scene_visited',
 *   operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte',
 *   key: string,
 *   value: any
 * }
 * 
 * Action structure:
 * {
 *   type: 'set_stat' | 'add_stat' | 'set_flag',
 *   key: string,
 *   value: any
 * }
 * 
 * StatDefinition structure:
 * {
 *   id: string,
 *   name: string,
 *   type: 'number' | 'string' | 'boolean',
 *   defaultValue: any,
 *   min?: number,
 *   max?: number,
 *   hidden?: boolean
 * }
 */