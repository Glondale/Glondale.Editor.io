import React, { useState, useMemo, useEffect, useCallback } from "https://esm.sh/react@18";
import ConditionBuilder from '../common/ConditionBuilder.js';

const INPUT_TYPES = [
  { value: 'static', label: 'Static (default)' },
  { value: 'input_text', label: 'Player enters text' },
  { value: 'input_number', label: 'Player enters number' },
  { value: 'input_choice', label: 'Player selects option' }
];

const DEFAULT_INPUT_CONFIG = {
  input_text: { variable: '', placeholder: '', maxLength: 200 },
  input_number: { variable: '', min: null, max: null, step: 1 },
  input_choice: { variable: '', options: [{ id: generateOptionId(), label: '', value: '' }], allowCustom: false }
};

const DEFAULT_CHOICE = {
  id: '',
  text: '',
  targetSceneId: '',
  isHidden: false,
  isSecret: false,
  isLocked: false,
  isFake: false,
  inputType: 'static',
  inputConfig: {},
  conditions: [],
  selectableIf: [],
  requirements: [],
  actions: [],
  description: '',
  category: 'normal',
  oneTime: false,
  maxUses: 0,
  cooldown: 0
};

export function AdvancedChoiceDialog({
  choice = null,
  isOpen = false,
  onSave,
  onCancel,
  availableStats = [],
  availableFlags = [],
  availableItems = [],
  availableScenes = [],
  existingChoices = [],
  onInlineAddFlag = null,
  availableAchievements = [],
  isChoiceScriptMode = false
}) {
  const [choiceData, setChoiceData] = useState({ ...DEFAULT_CHOICE, id: generateChoiceId(), inputConfig: {} });
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState([]);

  const inputTypeOptions = useMemo(() => {
    if (isChoiceScriptMode) {
      return INPUT_TYPES.filter(option => option.value !== 'input_choice');
    }
    return INPUT_TYPES;
  }, [isChoiceScriptMode]);

  // Load choice data when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    const normalized = normalizeChoice(choice, { enforceChoiceScript: isChoiceScriptMode });
    setChoiceData(normalized);
    setActiveTab('basic');
    setErrors([]);
  }, [isOpen, choice, isChoiceScriptMode]);

  const validation = useMemo(() => validateChoice(choiceData, existingChoices, choice, availableScenes, { choiceScriptMode: isChoiceScriptMode }), [choiceData, existingChoices, choice, availableScenes, isChoiceScriptMode]);

  useEffect(() => {
    if (errors.length === 0) return;
    setErrors(validation.errors);
  }, [validation]);

  const handleFieldChange = useCallback((field, value) => {
    setChoiceData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleToggle = (field) => (event) => {
    const checked = event.target.checked;
    setChoiceData(prev => ({ ...prev, [field]: checked }));
  };

  const handleInputTypeChange = (event) => {
    const value = event.target.value;
    setChoiceData(prev => ({
      ...prev,
      inputType: value,
      inputConfig: value === 'static' ? {} : ensureInputConfig(value, prev.inputConfig)
    }));
  };

  const handleInputConfigChange = (field, value) => {
    setChoiceData(prev => ({
      ...prev,
      inputConfig: {
        ...ensureInputConfig(prev.inputType, prev.inputConfig),
        [field]: value
      }
    }));
  };

  const handleAddOption = () => {
    setChoiceData(prev => {
      const config = ensureInputConfig('input_choice', prev.inputConfig);
      return {
        ...prev,
        inputConfig: {
          ...config,
          options: [...config.options, { id: generateOptionId(), label: '', value: '' }]
        }
      };
    });
  };

  const handleOptionChange = (optionId, updates) => {
    setChoiceData(prev => {
      const config = ensureInputConfig('input_choice', prev.inputConfig);
      return {
        ...prev,
        inputConfig: {
          ...config,
          options: config.options.map(option => option.id === optionId ? { ...option, ...updates } : option)
        }
      };
    });
  };

  const handleRemoveOption = (optionId) => {
    setChoiceData(prev => {
      const config = ensureInputConfig('input_choice', prev.inputConfig);
      const options = config.options.filter(option => option.id !== optionId);
      return {
        ...prev,
        inputConfig: {
          ...config,
          options: options.length > 0 ? options : [{ id: generateOptionId(), label: '', value: '' }]
        }
      };
    });
  };

  const handleConditionsChange = (field) => (newConditions) => {
    setChoiceData(prev => ({ ...prev, [field]: newConditions }));
  };

  const handleRequirementToggle = (index) => (value) => {
    setChoiceData(prev => ({
      ...prev,
      requirements: prev.requirements.map((req, idx) => idx === index ? value : req)
    }));
  };

  const handleActionsChange = (actions) => {
    setChoiceData(prev => ({ ...prev, actions }));
  };

  const addAction = () => {
    setChoiceData(prev => ({
      ...prev,
      actions: [...prev.actions, createDefaultAction()]
    }));
  };

  const updateAction = (index, updates) => {
    setChoiceData(prev => ({
      ...prev,
      actions: prev.actions.map((action, idx) => idx === index ? { ...action, ...updates } : action)
    }));
  };

  const removeAction = (index) => {
    setChoiceData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, idx) => idx !== index)
    }));
  };

  const attemptSave = () => {
    if (!validation.isValid) {
      setErrors(validation.errors);
      setActiveTab(validation.focusTab || 'basic');
      return;
    }

    if (typeof onSave === 'function') {
      const normalized = finalizeChoice(choiceData);
      onSave(normalized);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    React.createElement('div', {
      className: 'fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50'
    }, React.createElement('div', {
      className: 'w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl bg-white flex flex-col'
    }, [
      React.createElement('div', {
        key: 'header',
        className: 'px-6 py-4 border-b flex items-center justify-between bg-gray-50'
      }, [
        React.createElement('h2', {
          key: 'title',
          className: 'text-lg font-semibold text-gray-900'
        }, choice ? 'Edit Choice' : 'Add Choice'),
        React.createElement('div', { key: 'buttons', className: 'space-x-2' }, [
          React.createElement('button', {
            key: 'cancel',
            className: 'px-3 py-1 text-sm border rounded-md text-gray-700 hover:bg-gray-100',
            onClick: onCancel
          }, 'Cancel'),
          React.createElement('button', {
            key: 'save',
            className: 'px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700',
            onClick: attemptSave
          }, 'Save Choice')
        ])
      ]),

      errors.length > 0 && React.createElement('div', {
        key: 'error-banner',
        className: 'px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700'
      }, errors.map((error, index) => React.createElement('div', { key: index }, error))),

      React.createElement('div', {
        key: 'tabs',
        className: 'px-6 pt-4 flex space-x-4 border-b bg-white'
      }, ['basic', 'behavior', 'conditions', 'requirements', 'actions', 'metadata'].map(tab =>
        React.createElement('button', {
          key: tab,
          onClick: () => setActiveTab(tab),
          className: `pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
        }, tab.charAt(0).toUpperCase() + tab.slice(1))
      )),

      React.createElement('div', {
        key: 'content',
        className: 'flex-1 overflow-y-auto px-6 py-4 space-y-6'
      }, [
        activeTab === 'basic' && renderBasicTab({ choiceData, availableScenes, handleFieldChange }),
        activeTab === 'behavior' && renderBehaviorTab({
          choiceData,
          handleToggle,
          handleFieldChange,
          handleInputTypeChange,
          handleInputConfigChange,
          handleAddOption,
          handleOptionChange,
          handleRemoveOption,
          isChoiceScriptMode,
          inputTypeOptions
        }),
        activeTab === 'conditions' && renderConditionsTab({
          choiceData,
          handleConditionsChange,
          availableStats,
          availableFlags,
          availableItems,
          availableScenes,
          onInlineAddFlag
        }),
        activeTab === 'requirements' && renderRequirementsTab({
          choiceData,
          handleConditionsChange,
          availableStats,
          availableFlags,
          availableItems,
          availableScenes,
          onInlineAddFlag
        }),
        activeTab === 'actions' && renderActionsTab({
          choiceData,
          availableStats,
          availableFlags,
          availableItems,
          availableAchievements,
          onInlineAddFlag,
          addAction,
          updateAction,
          removeAction
        }),
        activeTab === 'metadata' && renderMetadataTab({ choiceData, handleFieldChange })
      ])
    ]))
  );
}

function renderBasicTab({ choiceData, availableScenes, handleFieldChange }) {
  return React.createElement('div', { className: 'space-y-4' }, [
    React.createElement('div', { key: 'text' }, [
      React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Choice Text'),
      React.createElement('p', { className: 'text-xs text-gray-500 mb-2' }, 'Supports inline HTML for formatting. Plain text will be auto-escaped.'),
      React.createElement('textarea', {
        value: choiceData.text,
        onChange: (e) => handleFieldChange('text', e.target.value),
        className: 'w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
        rows: 4,
        placeholder: 'Describe the choice the player will see...'
      })
    ]),

    React.createElement('div', { key: 'target', className: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
      React.createElement('div', { key: 'scene-select' }, [
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Target Scene'),
        React.createElement('select', {
          value: choiceData.targetSceneId,
          onChange: (e) => handleFieldChange('targetSceneId', e.target.value),
          className: 'w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
        }, [
          React.createElement('option', { key: 'empty', value: '' }, 'Select target scene...'),
          ...availableScenes.map(scene => React.createElement('option', { key: scene.id, value: scene.id }, scene.title || scene.id))
        ])
      ]),

      React.createElement('div', { key: 'description' }, [
        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Short Description (optional)'),
        React.createElement('input', {
          value: choiceData.description,
          onChange: (e) => handleFieldChange('description', e.target.value),
          className: 'w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
          placeholder: 'Tooltip or additional metadata'
        })
      ])
    ])
  ]);
}

function renderBehaviorTab({
  choiceData,
  handleToggle,
  handleFieldChange,
  handleInputTypeChange,
  handleInputConfigChange,
  handleAddOption,
  handleOptionChange,
  handleRemoveOption,
  isChoiceScriptMode = false,
  inputTypeOptions = INPUT_TYPES
}) {
  const config = ensureInputConfig(choiceData.inputType, choiceData.inputConfig);
  const toggleDisabled = isChoiceScriptMode;

  return React.createElement('div', { className: 'space-y-6' }, [
    React.createElement('div', { key: 'toggles', className: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
      renderToggle('Hide by default', 'isHidden', choiceData.isHidden, handleToggle('isHidden'), 'Hidden choices require conditions to become visible.', toggleDisabled),
      renderToggle('Secret choice', 'isSecret', choiceData.isSecret, handleToggle('isSecret'), 'Secret choices auto-hide until discovered.', toggleDisabled),
      renderToggle('Locked choice', 'isLocked', choiceData.isLocked, handleToggle('isLocked'), 'Locked choices remain visible but unselectable until requirements are met.', toggleDisabled),
      renderToggle('Fake choice (no branching)', 'isFake', choiceData.isFake, handleToggle('isFake'), 'Fake choices continue within the same scene and ignore target scene.', false)
    ]),

    React.createElement('div', { key: 'input-type' }, [
      React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Player Interaction'),
      React.createElement('select', {
        value: choiceData.inputType,
        onChange: handleInputTypeChange,
        className: 'w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
      }, inputTypeOptions.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label)))
    ]),

    choiceData.inputType === 'input_text' && React.createElement('div', { key: 'text-config', className: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
      renderInputField('Store in variable', config.variable, (value) => handleInputConfigChange('variable', value), 'Variable name to store the text.'),
      renderInputField('Placeholder (optional)', config.placeholder, (value) => handleInputConfigChange('placeholder', value)),
      renderNumberField('Max length', config.maxLength, (value) => handleInputConfigChange('maxLength', value))
    ]),

    choiceData.inputType === 'input_number' && React.createElement('div', { key: 'number-config', className: 'grid grid-cols-1 md:grid-cols-4 gap-4' }, [
      renderInputField('Store in variable', config.variable, (value) => handleInputConfigChange('variable', value), 'Variable name to store the number.'),
      renderNumberField('Minimum', config.min, (value) => handleInputConfigChange('min', value)),
      renderNumberField('Maximum', config.max, (value) => handleInputConfigChange('max', value)),
      renderNumberField('Step', config.step, (value) => handleInputConfigChange('step', value || 1))
    ]),

    choiceData.inputType === 'input_choice' && !isChoiceScriptMode && React.createElement('div', { key: 'choice-config', className: 'space-y-3' }, [
      renderInputField('Store selected option in variable', config.variable, (value) => handleInputConfigChange('variable', value)),
      React.createElement('div', { key: 'options', className: 'space-y-2' }, [
        ...config.options.map(option => React.createElement('div', {
          key: option.id,
          className: 'grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border rounded-md bg-gray-50'
        }, [
          renderInputField('Label', option.label, (value) => handleOptionChange(option.id, { label: value })),
          renderInputField('Stored value', option.value, (value) => handleOptionChange(option.id, { value: value })),
          React.createElement('div', { key: 'remove', className: 'flex items-end justify-end' }, [
            React.createElement('button', {
              className: 'px-2 py-1 text-xs text-red-600 hover:text-red-800',
              onClick: () => handleRemoveOption(option.id)
            }, 'Remove option')
          ])
        ])),
        React.createElement('button', {
          key: 'add-option',
          className: 'px-3 py-2 text-sm border rounded-md hover:bg-gray-100',
          onClick: handleAddOption
        }, 'Add option')
      ])
    ]),

    React.createElement('div', { key: 'limits', className: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
      renderToggle('One-time use', 'oneTime', choiceData.oneTime, handleToggle('oneTime'), 'Choice can only be taken once.', isChoiceScriptMode),
      renderNumberField('Max uses', choiceData.maxUses, (value) => handleFieldChange('maxUses', value), '0 = unlimited', isChoiceScriptMode),
      renderNumberField('Cooldown (ms)', choiceData.cooldown, (value) => handleFieldChange('cooldown', value), undefined, isChoiceScriptMode)
    ])
  ]);
}

function renderConditionsTab({
  choiceData,
  handleConditionsChange,
  availableStats,
  availableFlags,
  availableItems,
  availableScenes,
  onInlineAddFlag
}) {
  return React.createElement('div', { className: 'space-y-6' }, [
    React.createElement('div', { key: 'visibility' }, [
      React.createElement('h3', { className: 'text-sm font-semibold text-gray-800 mb-2' }, 'Visibility Conditions'),
      React.createElement('p', { className: 'text-xs text-gray-500 mb-3' }, 'When these conditions pass, the choice becomes visible (unless hidden).'),
      React.createElement(ConditionBuilder, {
        conditions: choiceData.conditions,
        onConditionsChange: handleConditionsChange('conditions'),
        availableStats,
        availableFlags,
        availableItems,
        availableScenes,
        onInlineAddFlag
      })
    ]),
    React.createElement('div', { key: 'selectable-if' }, [
      React.createElement('h3', { className: 'text-sm font-semibold text-gray-800 mb-2' }, 'Selectable If'),
      React.createElement('p', { className: 'text-xs text-gray-500 mb-3' }, 'Use these conditions to keep the choice visible but disable selection until they are met.'),
      React.createElement(ConditionBuilder, {
        conditions: choiceData.selectableIf,
        onConditionsChange: handleConditionsChange('selectableIf'),
        availableStats,
        availableFlags,
        availableItems,
        availableScenes,
        onInlineAddFlag
      })
    ])
  ]);
}

function renderRequirementsTab({
  choiceData,
  handleConditionsChange,
  availableStats,
  availableFlags,
  availableItems,
  availableScenes,
  onInlineAddFlag
}) {
  return React.createElement('div', { className: 'space-y-3' }, [
    React.createElement('p', { key: 'intro', className: 'text-xs text-gray-500' }, 'Requirements represent hard gating criteria for locked choices.'),
    React.createElement(ConditionBuilder, {
      conditions: choiceData.requirements,
      onConditionsChange: handleConditionsChange('requirements'),
      availableStats,
      availableFlags,
      availableItems,
      availableScenes,
      onInlineAddFlag
    })
  ]);
}

function renderActionsTab({
  choiceData,
  availableStats,
  availableFlags,
  availableItems,
  availableAchievements,
  onInlineAddFlag,
  addAction,
  updateAction,
  removeAction
}) {
  return React.createElement('div', { className: 'space-y-4' }, [
    React.createElement('div', { key: 'actions-header', className: 'flex items-center justify-between' }, [
      React.createElement('h3', { className: 'text-sm font-semibold text-gray-800' }, 'Actions on selection'),
      React.createElement('button', {
        className: 'px-3 py-2 text-sm border rounded-md hover:bg-gray-100',
        onClick: addAction
      }, 'Add action')
    ]),
    choiceData.actions.length === 0 && React.createElement('div', { key: 'empty', className: 'text-sm text-gray-500 bg-gray-50 border rounded-md px-4 py-6 text-center' }, 'No actions configured.'),
    choiceData.actions.map((action, index) => React.createElement('div', {
      key: action.id || index,
      className: 'border rounded-md p-4 space-y-3 bg-gray-50'
    }, [
      React.createElement('div', { key: 'row-1', className: 'grid grid-cols-1 md:grid-cols-4 gap-3' }, [
        React.createElement('div', { key: 'type' }, [
          React.createElement('label', { className: 'text-xs uppercase tracking-wide text-gray-500 block mb-1' }, 'Action'),
          React.createElement('select', {
            value: action.type,
            onChange: (e) => updateAction(index, { type: e.target.value }),
            className: 'w-full border rounded-md px-2 py-1 text-sm'
          }, ACTION_OPTIONS.map(item => React.createElement('option', { key: item.value, value: item.value }, item.label)))
        ]),
        renderActionTargetField(action, index, updateAction, availableStats, availableFlags, availableItems, availableAchievements, onInlineAddFlag),
        renderActionValueField(action, index, updateAction)
      ]),
      React.createElement('div', { key: 'row-2', className: 'flex justify-between items-center text-xs text-gray-500' }, [
        React.createElement('button', {
          className: 'text-red-600 hover:text-red-800',
          onClick: () => removeAction(index)
        }, 'Remove action')
      ])
    ]))
  ]);
}

function renderMetadataTab({ choiceData, handleFieldChange }) {
  return React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
    React.createElement('div', { key: 'category' }, [
      React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Category'),
      React.createElement('input', {
        value: choiceData.category,
        onChange: (e) => handleFieldChange('category', e.target.value),
        className: 'w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
      })
    ]),
    React.createElement('div', { key: 'id' }, [
      React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Choice ID'),
      React.createElement('input', {
        value: choiceData.id,
        onChange: (e) => handleFieldChange('id', e.target.value),
        className: 'w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
      })
    ])
  ]);
}

function renderToggle(label, field, checked, onChange, helperText, disabled = false) {
  const className = disabled
    ? 'flex items-start space-x-3 border p-3 rounded-md bg-gray-100 opacity-60 cursor-not-allowed'
    : 'flex items-start space-x-3 border p-3 rounded-md bg-gray-50';

  return React.createElement('label', { className }, [
    React.createElement('input', {
      type: 'checkbox',
      className: 'mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded',
      checked,
      onChange,
      disabled
    }),
    React.createElement('div', { className: 'flex-1' }, [
      React.createElement('span', { className: 'block text-sm font-medium text-gray-700' }, label),
      helperText && React.createElement('span', { className: 'text-xs text-gray-500' }, helperText),
      disabled && React.createElement('span', { className: 'block text-xs text-red-500 mt-1' }, 'Not available in ChoiceScript mode.')
    ])
  ]);
}

function renderInputField(label, value, onChange, helperText, disabled = false) {
  const className = disabled
    ? 'border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500 cursor-not-allowed'
    : 'border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return React.createElement('div', { className: 'flex flex-col space-y-1' }, [
    label && React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, label),
    React.createElement('input', {
      value: value ?? '',
      onChange: (e) => onChange(e.target.value),
      className,
      disabled
    }),
    helperText && React.createElement('span', { className: 'text-xs text-gray-400' }, helperText)
  ]);
}

function renderNumberField(label, value, onChange, helperText, disabled = false) {
  const className = disabled
    ? 'border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500 cursor-not-allowed'
    : 'border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return React.createElement('div', { className: 'flex flex-col space-y-1' }, [
    label && React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, label),
    React.createElement('input', {
      type: 'number',
      value: value ?? '',
      onChange: (e) => onChange(e.target.value === '' ? null : Number(e.target.value)),
      className,
      disabled
    }),
    helperText && React.createElement('span', { className: 'text-xs text-gray-400' }, helperText)
  ]);
}
const ACTION_OPTIONS = [
  { value: 'set_stat', label: 'Set stat' },
  { value: 'add_stat', label: 'Add to stat' },
  { value: 'multiply_stat', label: 'Multiply stat' },
  { value: 'set_flag', label: 'Set flag' },
  { value: 'toggle_flag', label: 'Toggle flag' },
  { value: 'add_inventory', label: 'Add item' },
  { value: 'remove_inventory', label: 'Remove item' },
  { value: 'set_inventory', label: 'Set inventory quantity' },
  { value: 'add_achievement', label: 'Unlock achievement' }
];

function renderActionTargetField(action, index, updateAction, availableStats, availableFlags, availableItems, availableAchievements, onInlineAddFlag) {
  switch (action.type) {
    case 'set_flag':
    case 'toggle_flag':
      return React.createElement('div', { key: 'flag', className: 'flex flex-col space-y-1' }, [
        React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, 'Flag'),
        React.createElement('div', { className: 'flex space-x-2' }, [
          React.createElement('select', {
            value: action.key || '',
            onChange: (e) => updateAction(index, { key: e.target.value }),
            className: 'flex-1 border rounded px-2 py-1 text-sm'
          }, [
            React.createElement('option', { key: 'empty', value: '' }, 'Select flag...'),
            ...availableFlags.map(flag => React.createElement('option', { key: flag.id, value: flag.id }, flag.name || flag.id))
          ]),
          typeof onInlineAddFlag === 'function' && React.createElement('button', {
            key: 'add-flag-inline',
            className: 'px-2 py-1 text-xs border rounded text-green-700 border-green-400 hover:bg-green-50',
            onClick: () => onInlineAddFlag((newFlag) => updateAction(index, { key: newFlag.id }))
          }, '+')
        ])
      ]);
    case 'add_inventory':
    case 'remove_inventory':
    case 'set_inventory':
      return React.createElement('div', { key: 'inventory', className: 'flex flex-col space-y-1' }, [
        React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, 'Item'),
        React.createElement('select', {
          value: action.key || '',
          onChange: (e) => updateAction(index, { key: e.target.value }),
          className: 'border rounded px-2 py-1 text-sm'
        }, [
          React.createElement('option', { key: 'empty', value: '' }, 'Select item...'),
          ...availableItems.map(item => React.createElement('option', { key: item.id, value: item.id }, item.name || item.id))
        ])
      ]);
    case 'add_achievement':
      return React.createElement('div', { key: 'achievements', className: 'flex flex-col space-y-1' }, [
        React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, 'Achievement'),
        React.createElement('select', {
          value: action.key || '',
          onChange: (e) => updateAction(index, { key: e.target.value }),
          className: 'border rounded px-2 py-1 text-sm'
        }, [
          React.createElement('option', { key: 'empty', value: '' }, 'Select achievement...'),
          ...availableAchievements.map(achievement => React.createElement('option', { key: achievement.id, value: achievement.id }, achievement.name || achievement.id))
        ])
      ]);
    default:
      return React.createElement('div', { key: 'stat', className: 'flex flex-col space-y-1' }, [
        React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, 'Stat'),
        React.createElement('select', {
          value: action.key || '',
          onChange: (e) => updateAction(index, { key: e.target.value }),
          className: 'border rounded px-2 py-1 text-sm'
        }, [
          React.createElement('option', { key: 'empty', value: '' }, 'Select stat...'),
          ...availableStats.map(stat => React.createElement('option', { key: stat.id, value: stat.id }, stat.name || stat.id))
        ])
      ]);
  }
}

function renderActionValueField(action, index, updateAction) {
  switch (action.type) {
    case 'set_flag':
      return React.createElement('div', { key: 'value', className: 'flex flex-col space-y-1' }, [
        React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, 'Value'),
        React.createElement('select', {
          value: action.value === true ? 'true' : 'false',
          onChange: (e) => updateAction(index, { value: e.target.value === 'true' }),
          className: 'border rounded px-2 py-1 text-sm'
        }, [
          React.createElement('option', { value: 'true' }, 'True'),
          React.createElement('option', { value: 'false' }, 'False')
        ])
      ]);
    case 'toggle_flag':
    case 'add_achievement':
      return React.createElement('div', { key: 'spacer' });
    default:
      return React.createElement('div', { key: 'value', className: 'flex flex-col space-y-1' }, [
        React.createElement('label', { className: 'text-xs font-semibold text-gray-600 uppercase tracking-wide' }, 'Value'),
        React.createElement('input', {
          type: 'number',
          value: action.value ?? 0,
          onChange: (e) => updateAction(index, { value: e.target.value === '' ? null : Number(e.target.value) }),
          className: 'border rounded px-2 py-1 text-sm'
        })
      ]);
  }
}

function normalizeChoice(choice, { enforceChoiceScript = false } = {}) {
  const baseChoice = choice || {};
  const inputType = baseChoice.inputType || 'static';
  const inputConfig = inputType === 'static' ? {} : ensureInputConfig(inputType, baseChoice.inputConfig);

  const normalized = {
    ...DEFAULT_CHOICE,
    ...baseChoice,
    id: baseChoice.id || generateChoiceId(),
    inputType,
    inputConfig,
    isFake: !!baseChoice.isFake,
    selectableIf: Array.isArray(baseChoice.selectableIf) ? baseChoice.selectableIf : []
  };

  if (enforceChoiceScript) {
    const allowedInputTypes = new Set(['static', 'input_text', 'input_number']);
    if (!allowedInputTypes.has(normalized.inputType)) {
      normalized.inputType = 'static';
      normalized.inputConfig = {};
    } else {
      normalized.inputConfig = ensureInputConfig(normalized.inputType, normalized.inputConfig);
    }
    normalized.isHidden = false;
    normalized.isSecret = false;
    normalized.isLocked = false;
    normalized.oneTime = false;
    normalized.maxUses = 0;
    normalized.cooldown = 0;
  }

  return normalized;
}
function ensureInputConfig(type, config = {}) {
  if (type === 'static') return {};
  const defaults = DEFAULT_INPUT_CONFIG[type] || {};
  return { ...defaults, ...config };
}

function createDefaultAction() {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'set_stat',
    key: '',
    value: 0
  };
}

function validateChoice(choiceData, existingChoices, originalChoice, availableScenes, { choiceScriptMode = false } = {}) {
  const errors = [];
  const warnings = [];

  if (!choiceData.text.trim()) {
    errors.push('Choice text is required.');
  }

  if (!choiceData.isFake && !choiceData.targetSceneId) {
    errors.push('Target scene is required unless the choice is marked as fake.');
  }

  if (choiceData.targetSceneId && !availableScenes.some(scene => scene.id === choiceData.targetSceneId)) {
    warnings.push('Target scene does not exist in the current adventure.');
  }

  if (choiceData.inputType !== 'static') {
    const config = ensureInputConfig(choiceData.inputType, choiceData.inputConfig);

    if (!config.variable?.trim()) {
      errors.push('Input choices must define a variable to store player input.');
    }

    if (choiceData.inputType === 'input_number') {
      if (config.min != null && config.max != null && Number(config.min) > Number(config.max)) {
        errors.push('Number input: minimum cannot be greater than maximum.');
      }
    }

    if (choiceData.inputType === 'input_choice') {
      const populated = config.options.filter(option => option.label.trim() && option.value.trim());
      if (populated.length === 0) {
        errors.push('Add at least one option for player selection.');
      }
      if (choiceScriptMode) {
        errors.push('ChoiceScript mode does not support inline option inputs.');
      }
    }
  }

  if (choiceScriptMode && (choiceData.maxUses > 0 || choiceData.cooldown > 0)) {
    warnings.push('Usage limits are ignored in ChoiceScript mode.');
  }

  if (choiceData.maxUses < 0) {
    errors.push('Max uses cannot be negative.');
  }

  if (choiceData.cooldown < 0) {
    errors.push('Cooldown must be zero or positive.');
  }

  if (choiceData.isLocked && choiceData.requirements.length === 0) {
    warnings.push('Locked choices should define at least one requirement.');
  }

  if (choiceData.isSecret && choiceData.conditions.length === 0) {
    warnings.push('Secret choices typically include discovery conditions.');
  }

  const duplicateId = existingChoices
    .filter(existing => !originalChoice || existing.id !== originalChoice.id)
    .some(existing => existing.id === choiceData.id);

  if (duplicateId) {
    errors.push('Choice ID must be unique within the scene.');
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
    focusTab: errors.length > 0 ? 'basic' : undefined
  };
}
function finalizeChoice(choiceData) {
  const payload = {
    ...choiceData,
    text: choiceData.text.trim(),
    description: choiceData.description?.trim() || '',
    maxUses: Number(choiceData.maxUses) || 0,
    cooldown: Number(choiceData.cooldown) || 0,
    selectableIf: choiceData.selectableIf || []
  };

  if (choiceData.inputType === 'static') {
    payload.inputConfig = {};
  } else {
    payload.inputConfig = ensureInputConfig(choiceData.inputType, choiceData.inputConfig);
  }

  return payload;
}

function generateChoiceId() {
  return `choice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateOptionId() {
  return `opt_${Math.random().toString(36).slice(2, 8)}`;
}

function generateActionId() {
  return `action_${Math.random().toString(36).slice(2, 8)}`;
}

export default AdvancedChoiceDialog;







































