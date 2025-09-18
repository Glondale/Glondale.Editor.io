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

function normalizeAdventure(adventure = {}, options = {}) {
  const warnings = [];
  const scenes = Array.isArray(adventure.scenes) ? adventure.scenes : [];
  const usedSceneIds = new Set();
  const sceneIdMap = new Map();
  const sceneWrappers = scenes.map((scene, index) => {
    const fallbackId = `scene_${index + 1}`;
    const proposed = scene?.id ?? scene?.title ?? fallbackId;
    const csId = makeUniqueIdentifier(proposed, usedSceneIds, fallbackId);
    const originalKey = scene?.id ?? fallbackId;
    sceneIdMap.set(originalKey, csId);
    sceneIdMap.set(csId, csId);
    return { scene, csId, originalKey };
  });

  const sanitizedScenes = sceneWrappers.map(({ scene, csId, originalKey }, index) => {
    const originalId = scene?.id ?? originalKey;
    const contentText = convertContentToText(scene?.content);
    const contentLines = contentText ? contentText.split('\n') : [];

    const normalizedChoices = Array.isArray(scene?.choices)
      ? scene.choices.map((choice, choiceIndex) => {
          const choiceWarnings = [];
          const text = convertChoiceText(choice?.text) || `Option ${choiceIndex + 1}`;
          const targetOriginal = choice?.targetSceneId;
          let target = null;

          if (targetOriginal) {
            const mapped = sceneIdMap.get(targetOriginal) ?? sanitizeIdentifier(targetOriginal);
            if (mapped) {
              target = mapped;
            }
            if (!sceneIdMap.has(targetOriginal)) {
              choiceWarnings.push(`Choice "${text}" targets missing scene "${targetOriginal}". Exporting as *finish.`);
            }
          }

          const inputType = choice?.inputType || 'static';
          const inputConfig = choice?.inputConfig || {};
          let inputVariable = null;
          let inputMin = null;
          let inputMax = null;

          if (inputType === 'input_text' || inputType === 'input_number') {
            const fallbackVar = `${csId}_choice_${choiceIndex + 1}`;
            inputVariable = sanitizeIdentifier(inputConfig.variable || fallbackVar) || fallbackVar;
            if (!inputConfig.variable) {
              choiceWarnings.push(`Choice "${text}" missing input variable; using "${inputVariable}".`);
            }
            if (inputType === 'input_number') {
              inputMin = Number.isFinite(inputConfig.min) ? Number(inputConfig.min) : 0;
              inputMax = Number.isFinite(inputConfig.max) ? Number(inputConfig.max) : 100;
              if (inputMin > inputMax) {
                [inputMin, inputMax] = [inputMax, inputMin];
                choiceWarnings.push(`Choice "${text}" had min greater than max; values swapped.`);
              }
            }
          } else if (inputType === 'input_choice') {
            choiceWarnings.push(
              `Choice "${text}" uses input_choice which is not supported by ChoiceScript; exporting as static choice.`
            );
          }

          if (Array.isArray(choice?.conditions) && choice.conditions.length > 0) {
            choiceWarnings.push(
              `Choice "${text}" has visibility conditions which are not exported; consider using selectable_if manually.`
            );
          }
          if (Array.isArray(choice?.requirements) && choice.requirements.length > 0) {
            choiceWarnings.push(`Choice "${text}" has requirements which are not exported.`);
          }
          if (Array.isArray(choice?.actions) && choice.actions.length > 0) {
            choiceWarnings.push(`Choice "${text}" has actions; convert them to ChoiceScript commands manually.`);
          }

          warnings.push(...choiceWarnings);

          return {
            id: choice?.id || `choice_${choiceIndex + 1}`,
            text,
            target,
            inputType,
            inputVariable,
            inputMin,
            inputMax,
            notes: choiceWarnings,
            isFake: Boolean(choice?.isFake)
          };
        })
      : [];

    return {
      originalId,
      csId,
      contentLines,
      choices: normalizedChoices
    };
  });

  const firstSceneId = sceneWrappers[0]?.csId || null;
  const startSceneId = adventure?.startSceneId
    ? sceneIdMap.get(adventure.startSceneId) || sanitizeIdentifier(adventure.startSceneId)
    : firstSceneId;
  if (!adventure?.startSceneId && firstSceneId) {
    warnings.push('Adventure missing startSceneId; defaulting to first scene.');
  }

  const stats = Array.isArray(adventure?.stats) ? adventure.stats : [];
  const statDeclarations = [];
  const statChart = [];
  const statIdSet = new Set();

  stats.forEach((stat, index) => {
    const fallbackId = `stat_${index + 1}`;
    const rawId = stat?.id ?? fallbackId;
    const id = makeUniqueIdentifier(rawId, statIdSet, fallbackId);
    const defaultValue = formatDefaultStatValue(stat);
    statDeclarations.push(`*create ${id} ${defaultValue}`);
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
    if (!statDeclarations.some(line => line.startsWith(`*create ${variableId} `))) {
      const defaultValue = type === 'number' ? 0 : '""';
      statDeclarations.push(`*create ${variableId} ${defaultValue}`);
      statChart.push({ id: variableId, type: type === 'number' ? 'number' : 'string' });
    }
  });

  const files = {
    'startup.txt': buildStartupFile(adventure, sanitizedScenes, statDeclarations, startSceneId),
    'choicescript_stats.txt': buildStatsFile(statChart),
    'scenes.txt': buildSceneIndex(sanitizedScenes)
  };

  sanitizedScenes.forEach(scene => {
    files[`${scene.csId}.txt`] = buildSceneFile(scene);
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
    lines.push(`*title ${title}`);
  }
  if (adventure?.author) {
    lines.push(`*author ${adventure.author}`);
  }
  lines.push('*comment Exported from Glondale Editor in ChoiceScript mode');
  lines.push('');

  if (statDeclarations.length > 0) {
    statDeclarations.forEach(line => lines.push(line));
    lines.push('');
  }

  lines.push('*scene_list');
  scenes.forEach(scene => {
    lines.push(`  ${scene.csId}`);
  });
  lines.push('');

  if (startSceneId) {
    lines.push(`*goto ${startSceneId}`);
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
      lines.push(`  percent ${stat.id}`);
    } else {
      lines.push(`  text ${stat.id}`);
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
  lines.push(`*label ${scene.csId}`);
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
    lines.push(`  #${choice.text}`);
    if (choice.notes.length > 0) {
      choice.notes.forEach(note => lines.push(`    *comment ${note}`));
    }
    if (choice.inputType === 'input_text' && choice.inputVariable) {
      lines.push(`    *input_text ${choice.inputVariable}`);
    } else if (choice.inputType === 'input_number' && choice.inputVariable != null) {
      const min = choice.inputMin != null ? choice.inputMin : 0;
      const max = choice.inputMax != null ? choice.inputMax : 100;
      lines.push(`    *input_number ${choice.inputVariable} ${min} ${max}`);
    }
    const target = choice.target;
    if (target) {
      lines.push(`    *goto ${target}`);
    } else if (choice.isFake) {
      lines.push(`    *goto ${scene.csId}`);
    } else {
      lines.push('    *finish');
    }
  });
  lines.push('');
  return lines.join('\n');
}

function makeUniqueIdentifier(value, usedSet, fallback) {
  const baseRaw = sanitizeIdentifier(value) || sanitizeIdentifier(fallback) || 'entry';
  let base = baseRaw;
  if (!base) {
    base = 'entry';
  }
  let id = base;
  let counter = 2;
  while (usedSet.has(id) || !id) {
    id = `${base}_${counter}`;
    counter += 1;
  }
  usedSet.add(id);
  return id;
}

function sanitizeIdentifier(value) {
  if (value === undefined || value === null) return '';
  let str = String(value).trim().toLowerCase();
  str = str.replace(/[^a-z0-9_]/g, '_');
  str = str.replace(/_+/g, '_');
  str = str.replace(/^_+/, '');
  if (!str) return '';
  if (!/^[a-z]/.test(str)) {
    str = `s_${str}`;
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
  const decoded = decodeEntities(sanitized);
  return decoded
    .split('\n')
    .map(line => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
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

function escapeChoiceScriptString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
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
    return `"${escapeChoiceScriptString(str)}"`;
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
