/**
 * AdvancedChoiceDialog.js - Enhanced choice editing with secret/locked features
 * 
 * Features:
 * - Secret and locked choice configuration
 * - Advanced condition builder integration
 * - Requirements vs conditions distinction
 * - Visual choice type indicators
 * - Real-time validation and preview
 * 
 * Integration Points:
 * - ConditionBuilder: Complex condition creation
 * - ChoiceEvaluator: Choice type logic
 * - SceneEditDialog: Enhanced choice editing
 * - EditorScreen: Choice management integration
 */

import React, { useState, useCallback, useMemo, useEffect } from 'https://esm.sh/react@18';
import ConditionBuilder from '../common/ConditionBuilder.js';

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
  availableAchievements = []
}) {
  const [choiceData, setChoiceData] = useState({
    id: '',
    text: '',
    targetSceneId: '',
    isHidden: false,
    isSecret: false,
    isLocked: false,
    conditions: [],
    requirements: [],
    actions: [],
    description: '',
    category: 'normal',
    oneTime: false,
    maxUses: 0,
    cooldown: 0
  });

  const [validationErrors, setValidationErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [showPreview, setShowPreview] = useState(false);

  // Initialize choice data when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (choice) {
        setChoiceData({
          id: choice.id || generateChoiceId(),
          text: choice.text || '',
          targetSceneId: choice.targetSceneId || '',
          isHidden: choice.isHidden || false,
          isSecret: choice.isSecret || false,
          isLocked: choice.isLocked || false,
          conditions: choice.conditions || [],
          requirements: choice.requirements || [],
          actions: choice.actions || [],
          description: choice.description || '',
          category: choice.category || 'normal',
          oneTime: !!choice.oneTime,
          maxUses: typeof choice.maxUses === 'number' ? choice.maxUses : 0,
          cooldown: typeof choice.cooldown === 'number' ? choice.cooldown : 0
        });
      } else {
        // New choice defaults
        setChoiceData({
          id: generateChoiceId(),
          text: '',
          targetSceneId: '',
          isHidden: false,
          isSecret: false,
          isLocked: false,
          conditions: [],
          requirements: [],
          actions: [],
          description: '',
          category: 'normal',
          oneTime: false,
          maxUses: 0,
          cooldown: 0
        });
      }
      setActiveTab('basic');
      setShowPreview(false);
      setValidationErrors([]);
    }
  }, [isOpen, choice]);

  // Validation
  const validation = useMemo(() => {
    const errors = [];
    const warnings = [];

    if (!choiceData.text.trim()) {
      errors.push('Choice text is required');
    }

    if (!choiceData.targetSceneId) {
      errors.push('Target scene is required');
    }

    // Choice type validation
    if (choiceData.isSecret && choiceData.isHidden) {
      warnings.push('Secret choices are automatically hidden until discovered');
    }

    if (choiceData.isLocked && !choiceData.requirements.length) {
      warnings.push('Locked choices should have requirements');
    }

    if (choiceData.isSecret && !choiceData.conditions.length) {
      warnings.push('Secret choices should have discovery conditions');
    }

    // Usage limits validation
    if (choiceData.oneTime && choiceData.maxUses && choiceData.maxUses > 0) {
      warnings.push('Both One-time and Max uses are set; One-time implies max uses = 1');
    }
    if (choiceData.maxUses < 0) {
      errors.push('Max uses cannot be negative');
    }
    if (choiceData.cooldown < 0) {
      errors.push('Cooldown cannot be negative');
    }

    // ID uniqueness
    const duplicate = existingChoices.find(c => c.id === choiceData.id && c !== choice);
    if (duplicate) {
      errors.push('Choice ID must be unique');
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }, [choiceData, existingChoices, choice]);

  // Update validation errors when validation changes
  useEffect(() => {
    setValidationErrors(validation.errors);
  }, [validation]);

  // Handle basic field changes
  const handleFieldChange = useCallback((field, value) => {
    setChoiceData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle choice type changes with automatic adjustments
  const handleChoiceTypeChange = useCallback((type, enabled) => {
    setChoiceData(prev => {
      const newData = { ...prev, [type]: enabled };

      // Auto-adjust conflicting settings
      if (type === 'isSecret' && enabled) {
        newData.isHidden = false; // Secret choices handle their own hiding
      }

      if (type === 'isLocked' && enabled && !prev.requirements.length) {
        // Auto-add a basic requirement template
        newData.requirements = [{
          type: 'stat',
          key: availableStats[0]?.id || 'health',
          operator: 'gte',
          value: 50
        }];
      }

      return newData;
    });
  }, [availableStats]);

  // Handle conditions change
  const handleConditionsChange = useCallback((newConditions) => {
    setChoiceData(prev => ({
      ...prev,
      conditions: newConditions
    }));
  }, []);

  // Handle requirements change
  const handleRequirementsChange = useCallback((newRequirements) => {
    setChoiceData(prev => ({
      ...prev,
      requirements: newRequirements
    }));
  }, []);

  // Handle actions change
  const handleActionsChange = useCallback((newActions) => {
    setChoiceData(prev => ({
      ...prev,
      actions: newActions
    }));
  }, []);

  // Toggle one-time from Actions tab convenience checkbox
  const handleToggleOneTime = useCallback((value) => {
    setChoiceData(prev => ({ ...prev, oneTime: !!value }));
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    if (validation.isValid) {
      onSave(choiceData);
    }
  }, [choiceData, validation.isValid, onSave]);

  // Generate choice preview
  const choicePreview = useMemo(() => {
    const type = choiceData.isSecret ? 'SECRET' : 
                 choiceData.isLocked ? 'LOCKED' : 
                 choiceData.isHidden ? 'HIDDEN' : 'NORMAL';

    const conditionsText = choiceData.conditions.length > 0 ? 
      ` (${choiceData.conditions.length} condition${choiceData.conditions.length > 1 ? 's' : ''})` : '';
    
    const requirementsText = choiceData.requirements.length > 0 ? 
      ` (${choiceData.requirements.length} requirement${choiceData.requirements.length > 1 ? 's' : ''})` : '';

    return {
      type,
      conditionsText,
      requirementsText,
      hasActions: choiceData.actions.length > 0
    };
  }, [choiceData]);

  if (!isOpen) return null;

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
  },
    React.createElement('div', {
      className: 'bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden'
    },
      // Header
      React.createElement('div', {
        className: 'flex justify-between items-center p-6 border-b'
      },
        React.createElement('h2', {
          className: 'text-xl font-semibold text-gray-900'
        }, choice ? 'Edit Choice' : 'Create Choice'),
        
        React.createElement('div', {
          className: 'flex items-center gap-3'
        },
          React.createElement('button', {
            onClick: () => setShowPreview(!showPreview),
            className: `px-3 py-1 text-sm rounded-md transition-colors ${
              showPreview ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`
          }, showPreview ? 'Hide Preview' : 'Show Preview'),
          
          React.createElement('button', {
            onClick: onCancel,
            className: 'text-gray-400 hover:text-gray-600'
          }, '✕')
        )
      ),

      React.createElement('div', {
        className: 'flex flex-1 overflow-hidden'
      },
        // Main content
        React.createElement('div', {
          className: 'flex-1 flex flex-col overflow-hidden'
        },
          // Tabs
          React.createElement('div', {
            className: 'flex border-b'
          },
            ['basic', 'conditions', 'requirements', 'actions'].map(tab =>
              React.createElement('button', {
                key: tab,
                onClick: () => setActiveTab(tab),
                className: `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`
              }, tab.charAt(0).toUpperCase() + tab.slice(1))
            )
          ),

          // Tab content
          React.createElement('div', {
            className: 'flex-1 overflow-y-auto p-6'
          },
            // Basic tab
            activeTab === 'basic' && React.createElement('div', {
              className: 'space-y-6'
            },
              // Choice text
              React.createElement('div', null,
                React.createElement('label', {
                  className: 'block text-sm font-medium text-gray-700 mb-2'
                }, 'Choice Text *'),
                React.createElement('textarea', {
                  value: choiceData.text,
                  onChange: (e) => handleFieldChange('text', e.target.value),
                  rows: 3,
                  className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical',
                  placeholder: 'Enter the choice text that players will see...'
                })
              ),

              // Target scene
              React.createElement('div', null,
                React.createElement('label', {
                  className: 'block text-sm font-medium text-gray-700 mb-2'
                }, 'Target Scene *'),
                React.createElement('select', {
                  value: choiceData.targetSceneId,
                  onChange: (e) => handleFieldChange('targetSceneId', e.target.value),
                  className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                },
                  React.createElement('option', { value: '' }, 'Select target scene...'),
                  availableScenes.map(scene =>
                    React.createElement('option', {
                      key: scene.id,
                      value: scene.id
                    }, scene.title)
                  )
                )
              ),

              // Choice type configuration
              React.createElement('div', null,
                React.createElement('label', {
                  className: 'block text-sm font-medium text-gray-700 mb-3'
                }, 'Choice Type'),
                
                React.createElement('div', {
                  className: 'grid grid-cols-1 md:grid-cols-3 gap-4'
                },
                  // Hidden choice
                  React.createElement('div', {
                    className: `border rounded-lg p-4 cursor-pointer transition-all ${
                      choiceData.isHidden ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`
                  },
                    React.createElement('label', {
                      className: 'flex items-start cursor-pointer'
                    },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: choiceData.isHidden,
                        onChange: (e) => handleChoiceTypeChange('isHidden', e.target.checked),
                        className: 'mt-1 mr-3'
                      }),
                      React.createElement('div', null,
                        React.createElement('div', {
                          className: 'font-medium text-sm'
                        }, '🫥 Hidden Choice'),
                        React.createElement('div', {
                          className: 'text-xs text-gray-600 mt-1'
                        }, 'Not shown until conditions are met')
                      )
                    )
                  ),

                  // Secret choice
                  React.createElement('div', {
                    className: `border rounded-lg p-4 cursor-pointer transition-all ${
                      choiceData.isSecret ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'
                    }`
                  },
                    React.createElement('label', {
                      className: 'flex items-start cursor-pointer'
                    },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: choiceData.isSecret,
                        onChange: (e) => handleChoiceTypeChange('isSecret', e.target.checked),
                        className: 'mt-1 mr-3'
                      }),
                      React.createElement('div', null,
                        React.createElement('div', {
                          className: 'font-medium text-sm'
                        }, '🗝️ Secret Choice'),
                        React.createElement('div', {
                          className: 'text-xs text-gray-600 mt-1'
                        }, 'Hidden until discovered, then permanent')
                      )
                    )
                  ),

                  // Locked choice
                  React.createElement('div', {
                    className: `border rounded-lg p-4 cursor-pointer transition-all ${
                      choiceData.isLocked ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-gray-400'
                    }`
                  },
                    React.createElement('label', {
                      className: 'flex items-start cursor-pointer'
                    },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: choiceData.isLocked,
                        onChange: (e) => handleChoiceTypeChange('isLocked', e.target.checked),
                        className: 'mt-1 mr-3'
                      }),
                      React.createElement('div', null,
                        React.createElement('div', {
                          className: 'font-medium text-sm'
                        }, '🔒 Locked Choice'),
                        React.createElement('div', {
                          className: 'text-xs text-gray-600 mt-1'
                        }, 'Visible but disabled until requirements met')
                      )
                    )
                  )
                )
              ),

              // Usage limits
              React.createElement('div', null,
                React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-3' }, 'Usage Limits'),
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                  // One-time checkbox
                  React.createElement('div', { className: `border rounded-lg p-4 ${choiceData.oneTime ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300'}` },
                    React.createElement('label', { className: 'flex items-start cursor-pointer' },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: choiceData.oneTime,
                        onChange: (e) => handleFieldChange('oneTime', e.target.checked),
                        className: 'mt-1 mr-3'
                      }),
                      React.createElement('div', null,
                        React.createElement('div', { className: 'font-medium text-sm' }, '⚡ One-time'),
                        React.createElement('div', { className: 'text-xs text-gray-600 mt-1' }, 'Can only be selected once')
                      )
                    )
                  ),
                  // Max uses number
                  React.createElement('div', { className: 'border rounded-lg p-4 border-gray-300' },
                    React.createElement('label', { className: 'block text-xs text-gray-600 mb-1' }, 'Max uses (0 = unlimited)'),
                    React.createElement('input', {
                      type: 'number',
                      min: 0,
                      value: choiceData.maxUses,
                      onChange: (e) => handleFieldChange('maxUses', Math.max(0, Number(e.target.value)) || 0),
                      className: 'w-full px-2 py-1 border rounded text-sm'
                    })
                  ),
                  // Cooldown ms
                  React.createElement('div', { className: 'border rounded-lg p-4 border-gray-300' },
                    React.createElement('label', { className: 'block text-xs text-gray-600 mb-1' }, 'Cooldown (ms)'),
                    React.createElement('input', {
                      type: 'number',
                      min: 0,
                      value: choiceData.cooldown,
                      onChange: (e) => handleFieldChange('cooldown', Math.max(0, Number(e.target.value)) || 0),
                      className: 'w-full px-2 py-1 border rounded text-sm'
                    })
                  )
                ),
                (choiceData.oneTime && choiceData.maxUses > 0) && React.createElement('div', { className: 'text-xs text-yellow-700 mt-2' }, 'Note: One-time overrides Max uses')
              ),

              // Description
              React.createElement('div', null,
                React.createElement('label', {
                  className: 'block text-sm font-medium text-gray-700 mb-2'
                }, 'Description (Optional)'),
                React.createElement('textarea', {
                  value: choiceData.description,
                  onChange: (e) => handleFieldChange('description', e.target.value),
                  rows: 2,
                  className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical',
                  placeholder: 'Internal description for editors...'
                })
              )
            ),

            // Conditions tab
            activeTab === 'conditions' && React.createElement('div', {
              className: 'space-y-4'
            },
              React.createElement('div', {
                className: 'bg-blue-50 border border-blue-200 rounded-lg p-4'
              },
                React.createElement('h4', {
                  className: 'font-medium text-blue-900 mb-2'
                }, 'Discovery Conditions'),
                React.createElement('p', {
                  className: 'text-sm text-blue-800'
                }, 'For hidden/secret choices: when should this choice become visible? For secret choices, once discovered it remains permanently available.')
              ),

              React.createElement(ConditionBuilder, {
                conditions: choiceData.conditions,
                onConditionsChange: handleConditionsChange,
                availableStats,
                availableFlags,
                availableItems,
                availableScenes,
                onInlineAddFlag
              })
            ),

            // Requirements tab
            activeTab === 'requirements' && React.createElement('div', {
              className: 'space-y-4'
            },
              React.createElement('div', {
                className: 'bg-orange-50 border border-orange-200 rounded-lg p-4'
              },
                React.createElement('h4', {
                  className: 'font-medium text-orange-900 mb-2'
                }, 'Selection Requirements'),
                React.createElement('p', {
                  className: 'text-sm text-orange-800'
                }, 'For locked choices: what requirements must be met for the choice to be selectable? The choice will be visible but grayed out until requirements are met.')
              ),

              React.createElement(ConditionBuilder, {
                conditions: choiceData.requirements,
                onConditionsChange: handleRequirementsChange,
                availableStats,
                availableFlags,
                availableItems,
                availableScenes,
                onInlineAddFlag
              })
            ),

            // Actions tab
            activeTab === 'actions' && React.createElement('div', {
              className: 'space-y-4'
            },
              React.createElement('div', {
                className: 'bg-green-50 border border-green-200 rounded-lg p-4'
              },
                React.createElement('h4', {
                  className: 'font-medium text-green-900 mb-2'
                }, 'Choice Actions'),
                React.createElement('p', {
                  className: 'text-sm text-green-800'
                }, 'Actions to execute when this choice is selected (modify stats, set flags, etc.).')
              ),

              React.createElement(ActionBuilder, {
                actions: choiceData.actions,
                onActionsChange: handleActionsChange,
                availableStats,
                availableFlags,
                availableItems,
                availableAchievements,
                onInlineAddFlag,
                isOneTime: !!choiceData.oneTime,
                onToggleOneTime: handleToggleOneTime
              })
            )
          )
        ),

        // Preview panel
        showPreview && React.createElement('div', {
          className: 'w-80 border-l bg-gray-50 p-4 overflow-y-auto'
        },
          React.createElement('h3', {
            className: 'font-medium mb-4'
          }, 'Choice Preview'),

          React.createElement('div', {
            className: 'space-y-3'
          },
            // Choice preview
            React.createElement('div', {
              className: `border rounded-lg p-3 bg-white ${
                choiceData.isSecret ? 'border-purple-300' :
                choiceData.isLocked ? 'border-orange-300' :
                choiceData.isHidden ? 'border-blue-300' : 'border-gray-300'
              }`
            },
              React.createElement('div', {
                className: 'flex items-start justify-between mb-2'
              },
                React.createElement('span', {
                  className: `text-xs px-2 py-1 rounded-full ${
                    choiceData.isSecret ? 'bg-purple-100 text-purple-800' :
                    choiceData.isLocked ? 'bg-orange-100 text-orange-800' :
                    choiceData.isHidden ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`
                }, choicePreview.type)
              ),
              
              React.createElement('div', {
                className: 'font-medium'
              }, choiceData.text || 'Choice text...'),
              
              React.createElement('div', {
                className: 'text-sm text-gray-600 mt-2'
              },
                `→ ${availableScenes.find(s => s.id === choiceData.targetSceneId)?.title || 'No target scene'}`
              )
            ),

            // Conditions summary
            choiceData.conditions.length > 0 && React.createElement('div', {
              className: 'text-sm'
            },
              React.createElement('div', {
                className: 'font-medium text-blue-700 mb-1'
              }, `Conditions ${choicePreview.conditionsText}`),
              React.createElement('div', {
                className: 'text-gray-600'
              }, 'Controls visibility/discovery')
            ),

            // Requirements summary
            choiceData.requirements.length > 0 && React.createElement('div', {
              className: 'text-sm'
            },
              React.createElement('div', {
                className: 'font-medium text-orange-700 mb-1'
              }, `Requirements ${choicePreview.requirementsText}`),
              React.createElement('div', {
                className: 'text-gray-600'
              }, 'Controls selectability')
            ),

            // Actions summary
            choicePreview.hasActions && React.createElement('div', {
              className: 'text-sm'
            },
              React.createElement('div', {
                className: 'font-medium text-green-700 mb-1'
              }, `${choiceData.actions.length} Action${choiceData.actions.length > 1 ? 's' : ''}`),
              React.createElement('div', {
                className: 'text-gray-600'
              }, 'Execute when selected')
            )
          )
        )
      ),

      // Footer
      React.createElement('div', {
        className: 'flex justify-between items-center p-6 border-t bg-gray-50'
      },
        // Validation status
        React.createElement('div', {
          className: 'flex-1'
        },
          validation.errors.length > 0 && React.createElement('div', {
            className: 'text-sm text-red-600'
          },
            `${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''}: ${validation.errors[0]}`
          ),
          
          validation.warnings.length > 0 && validation.errors.length === 0 && React.createElement('div', {
            className: 'text-sm text-yellow-600'
          },
            `${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}: ${validation.warnings[0]}`
          )
        ),

        // Action buttons
        React.createElement('div', {
          className: 'flex gap-3'
        },
          React.createElement('button', {
            onClick: onCancel,
            className: 'px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
          }, 'Cancel'),
          
          React.createElement('button', {
            onClick: handleSave,
            disabled: !validation.isValid,
            className: `px-4 py-2 bg-blue-600 text-white rounded-md transition-colors ${
              validation.isValid 
                ? 'hover:bg-blue-700' 
                : 'opacity-50 cursor-not-allowed'
            }`
          }, 'Save Choice')
        )
      )
    )
  );
}

// Simple action builder component
function ActionBuilder({ actions = [], onActionsChange, availableStats = [], availableFlags = [], availableItems = [], availableAchievements = [], onInlineAddFlag = null, isOneTime = false, onToggleOneTime = () => {} }) {
  const handleAddAction = React.useCallback(() => {
    const newAction = {
      id: generateActionId(),
      type: 'set_stat',
      key: availableStats[0]?.id || '',
      value: 0
    };
    onActionsChange([...actions, newAction]);
  }, [actions, onActionsChange, availableStats]);

  const handleActionUpdate = React.useCallback((index, updates) => {
    const updatedActions = actions.map((action, i) => 
      i === index ? { ...action, ...updates } : action
    );
    onActionsChange(updatedActions);
  }, [actions, onActionsChange]);

  const handleActionDelete = React.useCallback((index) => {
    const updatedActions = actions.filter((_, i) => i !== index);
    onActionsChange(updatedActions);
  }, [actions, onActionsChange]);

  return React.createElement('div', {
    className: 'space-y-3'
  },
    // One-time convenience toggle
    React.createElement('div', { className: 'flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded' }, [
      React.createElement('label', { key: 'label', className: 'text-sm text-yellow-800 font-medium' }, 'One-time choice (disable after first use)'),
      React.createElement('input', {
        key: 'checkbox',
        type: 'checkbox',
        checked: !!isOneTime,
        onChange: (e) => onToggleOneTime(e.target.checked),
        className: 'w-4 h-4'
      })
    ]),
    React.createElement('div', {
      className: 'flex justify-between items-center'
    },
      React.createElement('h4', {
        className: 'font-medium'
      }, 'Actions'),
      React.createElement('button', {
        onClick: handleAddAction,
        className: 'px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
      }, '+ Add Action')
    ),

    actions.length === 0 ?
      React.createElement('div', {
        className: 'text-center py-4 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg'
      }, 'No actions configured') :
      
      actions.map((action, index) =>
        React.createElement('div', {
          key: action.id || index,
          className: 'border rounded-lg p-3 bg-white'
        },
          React.createElement('div', {
            className: 'flex items-center gap-3'
          },
            React.createElement('select', {
              value: action.type,
              onChange: (e) => handleActionUpdate(index, { type: e.target.value }),
              className: 'px-2 py-1 border rounded text-sm'
            },
              React.createElement('option', { value: 'set_stat' }, 'Set Stat'),
              React.createElement('option', { value: 'add_stat' }, 'Add to Stat'),
              React.createElement('option', { value: 'multiply_stat' }, 'Multiply Stat'),
              React.createElement('option', { value: 'set_flag' }, 'Set Flag'),
              React.createElement('option', { value: 'toggle_flag' }, 'Toggle Flag'),
              React.createElement('option', { value: 'add_inventory' }, 'Add Inventory'),
              React.createElement('option', { value: 'remove_inventory' }, 'Remove Inventory'),
              React.createElement('option', { value: 'set_inventory' }, 'Set Inventory'),
              React.createElement('option', { value: 'add_achievement' }, 'Unlock Achievement')
            ),

            // Key selector: stats vs flags
            action.type === 'set_flag' || action.type === 'toggle_flag' ?
              React.createElement('div', { className: 'flex-1 flex items-center gap-2' }, [
                React.createElement('select', {
                  key: 'flag-select',
                  value: action.key || '',
                  onChange: (e) => handleActionUpdate(index, { key: e.target.value }),
                  className: 'flex-1 px-2 py-1 border rounded text-sm'
                }, [
                  React.createElement('option', { key: 'empty', value: '' }, 'Select flag...'),
                  ...availableFlags.map(f => React.createElement('option', { key: f.id, value: f.id }, f.name || f.id))
                ]),
                React.createElement('button', {
                  key: 'add-flag-inline',
                  className: 'px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200',
                  onClick: () => {
                    if (typeof onInlineAddFlag === 'function') {
                      onInlineAddFlag((newFlag) => {
                        handleActionUpdate(index, { key: newFlag.id });
                      });
                    }
                  },
                  title: 'Create a new flag'
                }, '+ Add Flag')
              ])
            : action.type === 'add_inventory' || action.type === 'remove_inventory' || action.type === 'set_inventory' ?
              React.createElement('select', {
                value: action.key || '',
                onChange: (e) => handleActionUpdate(index, { key: e.target.value }),
                className: 'flex-1 px-2 py-1 border rounded text-sm'
              }, [
                React.createElement('option', { key: 'empty', value: '' }, 'Select item...'),
                ...availableItems.map(item => React.createElement('option', { key: item.id, value: item.id }, item.name))
              ])
            : action.type === 'add_achievement' ?
              React.createElement('select', {
                value: action.key || '',
                onChange: (e) => handleActionUpdate(index, { key: e.target.value }),
                className: 'flex-1 px-2 py-1 border rounded text-sm'
              }, [
                React.createElement('option', { key: 'empty', value: '' }, 'Select achievement...'),
                ...availableAchievements.map(a => React.createElement('option', { key: a.id, value: a.id }, a.name || a.id))
              ])
            :
              React.createElement('select', {
                value: action.key,
                onChange: (e) => handleActionUpdate(index, { key: e.target.value }),
                className: 'flex-1 px-2 py-1 border rounded text-sm'
              },
                React.createElement('option', { value: '' }, 'Select...'),
                (action.type.includes('stat') ? availableStats : availableFlags).map(item =>
                  React.createElement('option', {
                    key: item.id,
                    value: item.id
                  }, item.name)
                )
              ),

            // Value field cadence by action type
            action.type === 'set_flag' ?
              React.createElement('select', {
                value: action.value,
                onChange: (e) => handleActionUpdate(index, { value: e.target.value === 'true' }),
                className: 'w-20 px-2 py-1 border rounded text-sm'
              },
                React.createElement('option', { value: 'true' }, 'True'),
                React.createElement('option', { value: 'false' }, 'False')
              )
            : action.type === 'toggle_flag' || action.type === 'add_achievement' ? null
            : (action.type === 'set_stat' || action.type === 'add_stat' || action.type === 'multiply_stat' || action.type === 'set_inventory' || action.type === 'add_inventory' || action.type === 'remove_inventory') ?
              React.createElement('input', {
                type: 'number',
                value: action.value,
                onChange: (e) => handleActionUpdate(index, { value: Number(e.target.value) }),
                className: 'w-20 px-2 py-1 border rounded text-sm'
              }) : null,

            React.createElement('button', {
              onClick: () => handleActionDelete(index),
              className: 'p-1 text-red-600 hover:text-red-800'
            }, '🗑️')
          )
        )
      )
  );
}

const generateChoiceId = () => {
  return `choice_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
};

const generateActionId = () => {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
};

export default AdvancedChoiceDialog;

