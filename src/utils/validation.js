 
// Adventure validation
export function validateAdventure(adventure) {
  if (!adventure || typeof adventure !== 'object') return false;
  
  const required = ['id', 'title', 'author', 'version', 'scenes', 'stats', 'startSceneId'];
  if (!required.every(field => field in adventure)) return false;
  
  if (!Array.isArray(adventure.scenes) || !Array.isArray(adventure.stats)) return false;
  
  // Validate scenes
  if (!adventure.scenes.every(validateScene)) return false;
  
  // Validate start scene exists
  if (!adventure.scenes.some(s => s.id === adventure.startSceneId)) return false;
  
  // Validate stats
  if (!adventure.stats.every(validateStatDefinition)) return false;
  
  return true;
}

// Scene validation
export function validateScene(scene) {
  if (!scene || typeof scene !== 'object') return false;
  
  const required = ['id', 'title', 'content', 'choices'];
  if (!required.every(field => field in scene)) return false;
  
  if (!Array.isArray(scene.choices)) return false;
  
  return scene.choices.every(validateChoice);
}

// Choice validation
export function validateChoice(choice) {
  if (!choice || typeof choice !== 'object') return false;
  
  const required = ['id', 'text', 'targetSceneId'];
  return required.every(field => field in choice && typeof choice[field] === 'string');
}

// Stat definition validation
export function validateStatDefinition(stat) {
  if (!stat || typeof stat !== 'object') return false;
  
  const required = ['id', 'name', 'type', 'defaultValue'];
  if (!required.every(field => field in stat)) return false;
  
  const validTypes = ['number', 'string', 'boolean'];
  return validTypes.includes(stat.type);
}

// Save data validation
export function validateSaveData(save) {
  if (!save || typeof save !== 'object') return false;
  
  const required = ['version', 'adventureId', 'adventureVersion', 'timestamp', 'currentSceneId', 'stats', 'flags', 'visitedScenes', 'choiceHistory', 'playthroughId'];
  if (!required.every(field => field in save)) return false;
  
  if (typeof save.stats !== 'object' || typeof save.flags !== 'object') return false;
  if (!Array.isArray(save.visitedScenes) || !Array.isArray(save.choiceHistory)) return false;
  
  return true;
}