import sanitizeHtml from '../../utils/sanitizeHtml.js';

const JSZIP_URL = 'https://esm.sh/jszip@3.10.1';

export async function exportAdventureToChoiceScript(adventure = {}, options = {}) {
  const normalized = normalizeAdventure(adventure, options);
  const module = await import(JSZIP_URL);
  const JSZip = module.default || module;
  const zip = new JSZip();

  Object.entries(normalized.files).forEach(([name, content]) => {
    zip.file(name, content);
  });

  const archive = await zip.generateAsync({ type: 'uint8array' });
  return {
    data: archive,
    warnings: normalized.warnings
  };
}

function normalizeAdventure(adventure, options) {
  const warnings = [];
  const scenes = Array.isArray(adventure.scenes) ? adventure.scenes : [];
  const sceneIdMap = new Map();
  const usedIds = new Set();

  scenes.forEach((scene, index) => {
    const proposed = scene?.id || scene?.title || scene_;
    const sanitized = makeUniqueIdentifier(proposed, usedIds, scene_);
    sceneIdMap.set(scene?.id || sanitized, sanitized);
  });

  const sanitizedScenes = scenes.map((scene, index) => {
    const originalId = scene?.id || scene_;
    const csId = sceneIdMap.get(originalId) || makeUniqueIdentifier(originalId, usedIds, originalId);
    const contentText = convertContentToText(scene?.content);
    const contentLines = contentText ? contentText.split('\n') : [];

    const normalizedChoices = Array.isArray(scene?.choices) ? scene.choices.map((choice, choiceIndex) => {
      const choiceWarnings = [];
      const text = convertChoiceText(choice?.text) || Option ;
      const targetOriginal = choice?.targetSceneId;
      const target = targetOriginal ? sceneIdMap.get(targetOriginal) || sanitizeIdentifier(targetOriginal) : null;
      if (targetOriginal && !target) {
        choiceWarnings.push(Choice "" targets missing scene ''. Using *finish.);
      }

      const inputType = choice?.inputType || 'static';
      const inputConfig = choice?.inputConfig || {};
      let inputVariable = null;
      let inputMin = null;
      let inputMax = null;

      if (inputType === 'input_text' || inputType === 'input_number') {
        inputVariable = sanitizeIdentifier(inputConfig.variable || ${csId}_choice_);
        if (!inputConfig.variable) {
          choiceWarnings.push(Choice "" missing input variable; using ''.);
        }
        if (inputType === 'input_number') {
          inputMin = Number.isFinite(inputConfig.min) ? Number(inputConfig.min) : 0;
          inputMax = Number.isFinite(inputConfig.max) ? Number(inputConfig.max) : 100;
          if (inputMin > inputMax) {
            [inputMin, inputMax] = [inputMax, inputMin];
            choiceWarnings.push(Choice "" had min greater than max; values swapped.);
          }
        }
      } else if (inputType === 'input_choice') {
        choiceWarnings.push(Choice "" uses input_choice which is not supported by ChoiceScript; exporting as static choice.);
      }

      if (choice && choice.conditions && choice.conditions.length > 0) {
        choiceWarnings.push(Choice "" has visibility conditions which are not exported; consider using selectable_if manually in ChoiceScript.);
      }
      if (choice && choice.requirements && choice.requirements.length > 0) {
        choiceWarnings.push(Choice "" has requirements which are not exported.);
      }
      if (choice && choice.actions && choice.actions.length > 0) {
        choiceWarnings.push(Choice "" has actions; convert them to ChoiceScript commands manually.);
      }

      warnings.push(...choiceWarnings);

      return {
        id: choice?.id || choice_,
        text,
        target,
        inputType,
        inputVariable,
        inputMin,
        inputMax,
        notes: choiceWarnings,
        isFake: !!choice?.isFake
      };
    }) : [];

    return {
      originalId,
      csId,
      contentLines,
      choices: normalizedChoices
    };
  });

  const startSceneId = adventure?.startSceneId ? (sceneIdMap.get(adventure.startSceneId) || sanitizeIdentifier(adventure.startSceneId)) : sanitizedScenes[0]?.csId || null;
  if (!adventure?.startSceneId) {
    warnings.push('Adventure missing startSceneId; defaulting to first scene.');
  }

  const stats = Array.isArray(adventure?.stats) ? adventure.stats : [];
  const statDeclarations = [];
  const statChart = [];
  const statIdSet = new Set();

  stats.forEach((stat, index) => {
    const rawId = stat?.id || stat_;
    const id = makeUniqueIdentifier(rawId, statIdSet, stat_);
    const defaultValue = formatDefaultStatValue(stat);
    statDeclarations.push(*create  );
    statChart.push({ id, type: determineStatType(stat) });
  });

  const extraVariables = new Map();
  sanitizedScenes.forEach(scene => {
    scene.choices.forEach(choice => {
      if (choice.inputVariable) {
        if (!extraVariables.has(choice.inputVariable)) {
          extraVariables.set(choice.inputVariable, choice.inputType === 'input_number' ? 'number' : 'string');
        }
      }
    });
  });

  extraVariables.forEach((type, variableId) => {
    if (!statDeclarations.some(line => line.includes(  ))) {
      const defaultValue = type === 'number' ? 0 : '""';
      statDeclarations.push(*create  );
      statChart.push({ id: variableId, type: type === 'number' ? 'number' : 'string' });
    }
  });

  const files = {
    'startup.txt': buildStartupFile(adventure, sanitizedScenes, statDeclarations, startSceneId),
    'choicescript_stats.txt': buildStatsFile(statChart),
    'scenes.txt': buildSceneIndex(sanitizedScenes)
  };

  sanitizedScenes.forEach(scene => {
    files[${scene.csId}.txt] = buildSceneFile(scene);
  });

  return {
    files,
    warnings
  };
}

function buildStartupFile(adventure, scenes, statDeclarations, startSceneId) {
  const lines = [];
  const title = (adventure?.title || 'Untitled Adventure').trim();
  if (title) {
    lines.push(*title );
  }
  if (adventure?.author) {
    lines.push(*author );
  }
  lines.push('*comment Exported from Glondale Editor in ChoiceScript mode');
  lines.push('');

  if (statDeclarations.length > 0) {
    statDeclarations.forEach(line => lines.push(line));
    lines.push('');
  }

  lines.push('*scene_list');
  scenes.forEach(scene => {
    lines.push(  );
  });
  lines.push('');

  if (startSceneId) {
    lines.push(*goto );
  } else {
    lines.push('*finish');
  }

  lines.push('');
  return lines.join('\n');
}

function buildStatsFile(statChart) {
  const lines = [];
  if (statChart.length === 0) {
    lines.push('*comment No stats defined.');
    lines.push('*comment Add entries here to display stats in the ChoiceScript stats screen.');
    return lines.join('\n');
  }

  lines.push('*stat_chart');
  statChart.forEach(stat => {
    if (stat.type === 'number') {
      lines.push(  percent );
    } else {
      lines.push(  text );
    }
  });
  lines.push('');
  return lines.join('\n');
}

function buildSceneIndex(scenes) {
  const names = scenes.map(scene => scene.csId);
  return ['startup', 'choicescript_stats', ...names].join('\n');
}

function buildSceneFile(scene) {
  const lines = [];
  lines.push(*label );
  lines.push('');

  if (scene.contentLines.length > 0) {
    scene.contentLines.forEach(line => lines.push(line));
    lines.push('');
  }

  if (scene.choices.length === 0) {
    lines.push('*finish');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('*choice');
  scene.choices.forEach(choice => {
    lines.push(  #);
    if (choice.notes.length > 0) {
      choice.notes.forEach(note => lines.push(    *comment ));
    }
    if (choice.inputType === 'input_text' && choice.inputVariable) {
      lines.push(    *input_text );
    } else if (choice.inputType === 'input_number' && choice.inputVariable != null) {
      const min = choice.inputMin != null ? choice.inputMin : 0;
      const max = choice.inputMax != null ? choice.inputMax : 100;
      lines.push(    *input_number   );
    }
    const target = choice.target;
    if (target) {
      lines.push(    *goto );
    } else if (choice.isFake) {
      lines.push(    *goto );
    } else {
      lines.push('    *finish');
    }
  });
  lines.push('');
  return lines.join('\n');
}

function makeUniqueIdentifier(value, usedSet, fallback) {
  let id = sanitizeIdentifier(value) || sanitizeIdentifier(fallback);
  let counter = 1;
  while (usedSet.has(id)) {
    counter += 1;
    id = ${sanitizeIdentifier(value || fallback)}_;
  }
  usedSet.add(id);
  return id;
}

function sanitizeIdentifier(value) {
  if (!value && value !== 0) return '';
  let str = String(value).trim().toLowerCase();
  str = str.replace(/[^a-z0-9_]/g, '_');
  if (!str) return '';
  if (!/^[a-z]/.test(str)) {
    str = _;
  }
  return str;
}

function convertChoiceText(text) {
  const plain = convertContentToText(text);
  return plain.replace(/\s+/g, ' ').trim();
}

function convertContentToText(content) {
  if (!content) return '';
  let sanitized = sanitizeHtml(content);
  sanitized = sanitized.replace(/\r\n/g, '\n');
  sanitized = sanitized.replace(/<br\s*\/?\s*>/gi, '\n');
  sanitized = sanitized.replace(/<\/p>/gi, '\n\n');
  sanitized = sanitized.replace(/<[^>]+>/g, '');
  return decodeEntities(sanitized).split('\n').map(line => line.replace(/\s+$/g, '')).join('\n').trim();
}

function decodeEntities(value) {
  if (typeof window !== 'undefined' && window.document) {
    const textarea = window.document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function formatDefaultStatValue(stat) {
  if (!stat) return 0;
  const type = determineStatType(stat);
  const value = stat?.defaultValue;
  if (type === 'number') {
    return Number.isFinite(value) ? Number(value) : 0;
  }
  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (type === 'string') {
    const str = value != null ? String(value) : '';
    return \"\";
  }
  return value != null ? value : 0;
}

function determineStatType(stat) {
  const type = stat?.type;
  if (type === 'number' || type === 'percentage' || typeof stat?.defaultValue === 'number') {
    return 'number';
  }
  if (type === 'boolean') {
    return 'boolean';
  }
  return 'string';
}

