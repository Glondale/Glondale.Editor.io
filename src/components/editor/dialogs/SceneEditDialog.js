// SceneEditDialog.js - Enhanced with Phase 3 advanced features
import { Button } from '../../common/Button.js';
import ConditionBuilder from './ConditionBuilder.js';
import { AdvancedChoiceDialog } from '../AdvancedChoiceDialog.js';

import React, { useState, useEffect, useRef } from "https://esm.sh/react@18";

export default function SceneEditDialog({
  isOpen = false,
  scene = null,
  adventureStats = [],
  adventureInventory = [],
  adventureFlags = [],
  availableScenes = [],
  onSave = () => {},
  onCancel = () => {},
  onDelete = () => {}
}) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    description: '',
    category: 'general',
    tags: [],
    onEnter: [],
    onExit: [],
    requiredItems: [],
    secretUnlocks: []
  });
  const [activeTab, setActiveTab] = useState('content');
  const [newTag, setNewTag] = useState('');
  const [showConditionBuilder, setShowConditionBuilder] = useState(false);
  const [conditionTarget, setConditionTarget] = useState(null);
  const [showAdvancedChoiceDialog, setShowAdvancedChoiceDialog] = useState(false);
  const [editingChoice, setEditingChoice] = useState(null);
  const dialogRef = useRef(null);
  const titleInputRef = useRef(null);

  // Initialize form data when scene changes
  useEffect(() => {
    if (scene) {
      setFormData({
        title: scene.title || '',
        content: scene.content || '',
        description: scene.description || '',
        category: scene.category || 'general',
        tags: [...(scene.tags || [])],
        onEnter: [...(scene.onEnter || [])],
        onExit: [...(scene.onExit || [])],
        requiredItems: [...(scene.requiredItems || [])],
        secretUnlocks: [...(scene.secretUnlocks || [])],
        choices: [...(scene.choices || [])]
      });
    }
  }, [scene]);

  // Focus title input when dialog opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle tag operations
  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !formData.tags.includes(tag)) {
      handleFieldChange('tags', [...formData.tags, tag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    handleFieldChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  // Enhanced action operations with Phase 3 support
  const addAction = (actionType) => {
    const newAction = {
      id: `action_${Date.now()}`,
      type: 'set_stat',
      key: '',
      value: '',
      conditions: [],
      probability: 1.0,
      description: ''
    };
    handleFieldChange(actionType, [...formData[actionType], newAction]);
  };

  const updateAction = (actionType, actionId, updates) => {
    const updatedActions = formData[actionType].map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    );
    handleFieldChange(actionType, updatedActions);
  };

  const removeAction = (actionType, actionId) => {
    const filteredActions = formData[actionType].filter(action => action.id !== actionId);
    handleFieldChange(actionType, filteredActions);
  };

  // Required items management
  const addRequiredItem = () => {
    const itemId = prompt('Enter item ID:');
    if (itemId && !formData.requiredItems.includes(itemId)) {
      handleFieldChange('requiredItems', [...formData.requiredItems, itemId]);
    }
  };

  const removeRequiredItem = (itemId) => {
    handleFieldChange('requiredItems', formData.requiredItems.filter(id => id !== itemId));
  };

  // Secret unlock management
  const addSecretUnlock = () => {
    const newUnlock = {
      id: `unlock_${Date.now()}`,
      type: 'choice',
      targetId: '',
      conditions: [],
      permanent: true,
      notification: 'Secret unlocked!'
    };
    handleFieldChange('secretUnlocks', [...formData.secretUnlocks, newUnlock]);
  };

  const updateSecretUnlock = (unlockId, updates) => {
    const updatedUnlocks = formData.secretUnlocks.map(unlock =>
      unlock.id === unlockId ? { ...unlock, ...updates } : unlock
    );
    handleFieldChange('secretUnlocks', updatedUnlocks);
  };

  const removeSecretUnlock = (unlockId) => {
    handleFieldChange('secretUnlocks', formData.secretUnlocks.filter(unlock => unlock.id !== unlockId));
  };

  // Choice management with advanced features
  const addChoice = () => {
    const newChoice = {
      id: `choice_${Date.now()}`,
      text: 'New Choice',
      targetSceneId: '',
      conditions: [],
      actions: [],
      isHidden: false,
      isSecret: false,
      isLocked: false,
      requirements: [],
      consequences: [],
      priority: 0
    };
    handleFieldChange('choices', [...(formData.choices || []), newChoice]);
  };

  const editChoice = (choiceId) => {
    const choice = formData.choices?.find(c => c.id === choiceId);
    if (choice) {
      setEditingChoice(choice);
      setShowAdvancedChoiceDialog(true);
    }
  };

  const saveChoice = (updatedChoice) => {
    const updatedChoices = formData.choices.map(choice =>
      choice.id === updatedChoice.id ? updatedChoice : choice
    );
    handleFieldChange('choices', updatedChoices);
    setShowAdvancedChoiceDialog(false);
    setEditingChoice(null);
  };

  const deleteChoice = (choiceId) => {
    if (confirm('Delete this choice?')) {
      handleFieldChange('choices', formData.choices.filter(choice => choice.id !== choiceId));
    }
  };

  // Condition builder integration
  const openConditionBuilder = (target, currentConditions = []) => {
    setConditionTarget({ ...target, conditions: currentConditions });
    setShowConditionBuilder(true);
  };

  const saveConditions = (conditions) => {
    if (conditionTarget) {
      if (conditionTarget.type === 'action') {
        updateAction(conditionTarget.actionType, conditionTarget.actionId, { conditions });
      } else if (conditionTarget.type === 'secretUnlock') {
        updateSecretUnlock(conditionTarget.unlockId, { conditions });
      }
    }
    setShowConditionBuilder(false);
    setConditionTarget(null);
  };

  // Handle save
  const handleSave = () => {
    const updatedScene = {
      ...scene,
      ...formData,
      tags: formData.tags.filter(tag => tag.trim())
    };
    onSave(updatedScene);
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !showConditionBuilder && !showAdvancedChoiceDialog) {
      onCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  // Enhanced action editor with Phase 3 features
  const renderActionEditor = (actionType, actions) => {
    const actionTypeOptions = [
      { value: 'set_stat', label: 'Set Stat' },
      { value: 'add_stat', label: 'Add to Stat' },
      { value: 'multiply_stat', label: 'Multiply Stat' },
      { value: 'set_flag', label: 'Set Flag' },
      { value: 'toggle_flag', label: 'Toggle Flag' },
      { value: 'add_inventory', label: 'Add Item' },
      { value: 'remove_inventory', label: 'Remove Item' },
      { value: 'set_inventory', label: 'Set Item Count' },
      { value: 'unlock_secret', label: 'Unlock Secret' },
      { value: 'add_achievement', label: 'Add Achievement' },
      { value: 'trigger_event', label: 'Trigger Event' }
    ];

    return React.createElement('div', {
      className: 'space-y-3'
    }, [
      React.createElement('div', {
        key: 'actions-header',
        className: 'flex items-center justify-between'
      }, [
        React.createElement('h4', {
          key: 'actions-title',
          className: 'font-medium text-gray-900'
        }, `${actionType === 'onEnter' ? 'On Enter' : 'On Exit'} Actions`),
        React.createElement(Button, {
          key: 'add-action-btn',
          onClick: () => addAction(actionType),
          variant: 'secondary',
          size: 'xs'
        }, '+ Add Action')
      ]),

      React.createElement('div', {
        key: 'actions-list',
        className: 'space-y-3'
      }, actions.map((action, index) =>
        React.createElement('div', {
          key: action.id || index,
          className: 'p-4 bg-gray-50 rounded-lg border border-gray-200'
        }, [
          React.createElement('div', {
            key: 'action-main',
            className: 'grid grid-cols-12 gap-2 items-center mb-2'
          }, [
            React.createElement('select', {
              key: 'action-type',
              value: action.type || 'set_stat',
              onChange: (e) => updateAction(actionType, action.id, { type: e.target.value }),
              className: 'col-span-3 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }, actionTypeOptions.map(option =>
              React.createElement('option', { key: option.value, value: option.value }, option.label)
            )),

            React.createElement('input', {
              key: 'action-key',
              type: 'text',
              value: action.key || '',
              onChange: (e) => updateAction(actionType, action.id, { key: e.target.value }),
              placeholder: 'Target name',
              className: 'col-span-4 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }),

            React.createElement('input', {
              key: 'action-value',
              type: ['set_flag', 'toggle_flag'].includes(action.type) ? 'checkbox' : 'text',
              value: ['set_flag', 'toggle_flag'].includes(action.type) ? undefined : (action.value || ''),
              checked: ['set_flag', 'toggle_flag'].includes(action.type) ? action.value : undefined,
              onChange: (e) => updateAction(actionType, action.id, { 
                value: ['set_flag', 'toggle_flag'].includes(action.type) ? e.target.checked : e.target.value 
              }),
              placeholder: 'Value',
              className: `col-span-3 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`
            }),

            React.createElement('div', {
              key: 'action-controls',
              className: 'col-span-2 flex space-x-1'
            }, [
              React.createElement('button', {
                key: 'conditions-btn',
                onClick: () => openConditionBuilder(
                  { type: 'action', actionType, actionId: action.id },
                  action.conditions || []
                ),
                className: 'px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200',
                title: 'Edit Conditions'
              }, 'C'),
              React.createElement('button', {
                key: 'remove-action',
                onClick: () => removeAction(actionType, action.id),
                className: 'px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200'
              }, '×')
            ])
          ]),

          // Probability and description
          React.createElement('div', {
            key: 'action-extra',
            className: 'grid grid-cols-2 gap-2 mt-2'
          }, [
            React.createElement('div', {
              key: 'probability',
              className: 'flex items-center space-x-2'
            }, [
              React.createElement('label', {
                key: 'prob-label',
                className: 'text-xs text-gray-600'
              }, 'Probability:'),
              React.createElement('input', {
                key: 'prob-input',
                type: 'number',
                min: '0',
                max: '1',
                step: '0.1',
                value: action.probability || 1.0,
                onChange: (e) => updateAction(actionType, action.id, { probability: parseFloat(e.target.value) }),
                className: 'w-16 px-1 py-1 border border-gray-300 rounded text-xs'
              })
            ]),
            React.createElement('input', {
              key: 'description',
              type: 'text',
              value: action.description || '',
              onChange: (e) => updateAction(actionType, action.id, { description: e.target.value }),
              placeholder: 'Action description...',
              className: 'px-2 py-1 border border-gray-300 rounded text-xs'
            })
          ]),

          // Conditions summary
          action.conditions && action.conditions.length > 0 && React.createElement('div', {
            key: 'conditions-summary',
            className: 'mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded'
          }, `${action.conditions.length} condition${action.conditions.length !== 1 ? 's' : ''} set`)
        ])
      )),

      actions.length === 0 && React.createElement('div', {
        key: 'no-actions',
        className: 'text-center text-gray-500 text-sm py-4'
      }, `No ${actionType === 'onEnter' ? 'enter' : 'exit'} actions defined`)
    ]);
  };

  const renderChoiceList = () => {
    return React.createElement('div', {
      className: 'space-y-3'
    }, [
      React.createElement('div', {
        key: 'choices-header',
        className: 'flex items-center justify-between'
      }, [
        React.createElement('h4', {
          key: 'choices-title',
          className: 'font-medium text-gray-900'
        }, 'Scene Choices'),
        React.createElement(Button, {
          key: 'add-choice-btn',
          onClick: addChoice,
          variant: 'secondary',
          size: 'xs'
        }, '+ Add Choice')
      ]),

      React.createElement('div', {
        key: 'choices-list',
        className: 'space-y-2'
      }, (formData.choices || []).map((choice, index) =>
        React.createElement('div', {
          key: choice.id,
          className: `p-3 rounded-lg border ${
            choice.isSecret ? 'bg-purple-50 border-purple-200' :
            choice.isLocked ? 'bg-gray-50 border-gray-300' :
            'bg-white border-gray-200'
          }`
        }, [
          React.createElement('div', {
            key: 'choice-header',
            className: 'flex items-center justify-between'
          }, [
            React.createElement('div', {
              key: 'choice-info',
              className: 'flex-1'
            }, [
              React.createElement('div', {
                key: 'choice-text',
                className: 'font-medium text-sm'
              }, choice.text || 'Untitled Choice'),
              React.createElement('div', {
                key: 'choice-meta',
                className: 'text-xs text-gray-500 mt-1'
              }, [
                choice.targetSceneId && React.createElement('span', {
                  key: 'target'
                }, `→ ${availableScenes.find(s => s.id === choice.targetSceneId)?.title || choice.targetSceneId}`),
                choice.isSecret && React.createElement('span', {
                  key: 'secret',
                  className: 'ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded'
                }, '✨ Secret'),
                choice.isLocked && React.createElement('span', {
                  key: 'locked',
                  className: 'ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded'
                }, '🔒 Locked'),
                choice.conditions && choice.conditions.length > 0 && React.createElement('span', {
                  key: 'conditions',
                  className: 'ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded'
                }, `${choice.conditions.length} conditions`)
              ])
            ]),
            React.createElement('div', {
              key: 'choice-actions',
              className: 'flex space-x-1'
            }, [
              React.createElement('button', {
                key: 'edit-choice',
                onClick: () => editChoice(choice.id),
                className: 'px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200'
              }, 'Edit'),
              React.createElement('button', {
                key: 'delete-choice',
                onClick: () => deleteChoice(choice.id),
                className: 'px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200'
              }, '×')
            ])
          ])
        ])
      )),

      (formData.choices || []).length === 0 && React.createElement('div', {
        key: 'no-choices',
        className: 'text-center text-gray-500 text-sm py-4'
      }, 'No choices defined for this scene')
    ]);
  };

  if (!isOpen) return null;

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    onClick: (e) => {
      if (e.target === e.currentTarget) onCancel();
    },
    onKeyDown: handleKeyDown,
    tabIndex: -1
  }, [
    React.createElement('div', {
      key: 'dialog',
      ref: dialogRef,
      className: 'bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col'
    }, [
      // Header
      React.createElement('div', {
        key: 'dialog-header',
        className: 'px-6 py-4 border-b border-gray-200 flex items-center justify-between'
      }, [
        React.createElement('h2', {
          key: 'dialog-title',
          className: 'text-xl font-semibold text-gray-900'
        }, scene ? 'Edit Scene' : 'New Scene'),
        React.createElement('button', {
          key: 'close-btn',
          onClick: onCancel,
          className: 'text-gray-400 hover:text-gray-600 text-2xl'
        }, '×')
      ]),

      // Tab navigation
      React.createElement('div', {
        key: 'tab-nav',
        className: 'px-6 pt-4 border-b border-gray-200'
      }, React.createElement('div', {
        className: 'flex space-x-6'
      }, [
        { id: 'content', label: 'Content' },
        { id: 'choices', label: 'Choices' },
        { id: 'actions', label: 'Actions' },
        { id: 'advanced', label: 'Advanced' },
        { id: 'meta', label: 'Metadata' }
      ].map(tab =>
        React.createElement('button', {
          key: tab.id,
          onClick: () => setActiveTab(tab.id),
          className: `pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === tab.id 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`
        }, tab.label)
      ))),

      // Content area
      React.createElement('div', {
        key: 'dialog-content',
        className: 'flex-1 overflow-y-auto p-6'
      }, [
        // Content tab
        activeTab === 'content' && React.createElement('div', {
          key: 'content-form',
          className: 'space-y-4'
        }, [
          React.createElement('div', {
            key: 'title-field'
          }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-1'
            }, 'Scene Title'),
            React.createElement('input', {
              ref: titleInputRef,
              type: 'text',
              value: formData.title,
              onChange: (e) => handleFieldChange('title', e.target.value),
              className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
              placeholder: 'Enter scene title...'
            })
          ]),

          React.createElement('div', {
            key: 'description-field'
          }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-1'
            }, 'Description (Optional)'),
            React.createElement('input', {
              type: 'text',
              value: formData.description,
              onChange: (e) => handleFieldChange('description', e.target.value),
              className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
              placeholder: 'Brief scene description for organization...'
            })
          ]),

          React.createElement('div', {
            key: 'content-field'
          }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-1'
            }, 'Scene Content'),
            React.createElement('textarea', {
              value: formData.content,
              onChange: (e) => handleFieldChange('content', e.target.value),
              className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
              rows: 12,
              placeholder: 'Write your scene content here...\n\nYou can use multiple paragraphs and describe the setting, atmosphere, and what the player sees.'
            })
          ])
        ]),

        // Choices tab
        activeTab === 'choices' && renderChoiceList(),

        // Actions tab
        activeTab === 'actions' && React.createElement('div', {
          key: 'actions-form',
          className: 'space-y-8'
        }, [
          renderActionEditor('onEnter', formData.onEnter),
          renderActionEditor('onExit', formData.onExit)
        ]),

        // Advanced tab
        activeTab === 'advanced' && React.createElement('div', {
          key: 'advanced-form',
          className: 'space-y-6'
        }, [
          // Required Items
          React.createElement('div', {
            key: 'required-items'
          }, [
            React.createElement('div', {
              key: 'required-items-header',
              className: 'flex items-center justify-between mb-3'
            }, [
              React.createElement('h4', {
                key: 'title',
                className: 'font-medium text-gray-900'
              }, 'Required Items'),
              React.createElement(Button, {
                key: 'add-btn',
                onClick: addRequiredItem,
                variant: 'secondary',
                size: 'xs'
              }, '+ Add Item')
            ]),
            React.createElement('div', {
              key: 'items-list',
              className: 'flex flex-wrap gap-2'
            }, formData.requiredItems.map(itemId =>
              React.createElement('span', {
                key: itemId,
                className: 'inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full'
              }, [
                React.createElement('span', { key: 'text' }, itemId),
                React.createElement('button', {
                  key: 'remove',
                  onClick: () => removeRequiredItem(itemId),
                  className: 'ml-1 text-orange-600 hover:text-orange-800'
                }, '×')
              ])
            ))
          ]),

          // Secret Unlocks
          React.createElement('div', {
            key: 'secret-unlocks'
          }, [
            React.createElement('div', {
              key: 'header',
              className: 'flex items-center justify-between mb-3'
            }, [
              React.createElement('h4', {
                key: 'title',
                className: 'font-medium text-gray-900'
              }, 'Secret Unlocks'),
              React.createElement(Button, {
                key: 'add-btn',
                onClick: addSecretUnlock,
                variant: 'secondary',
                size: 'xs'
              }, '+ Add Unlock')
            ]),
            React.createElement('div', {
              key: 'unlocks-list',
              className: 'space-y-2'
            }, formData.secretUnlocks.map(unlock =>
              React.createElement('div', {
                key: unlock.id,
                className: 'p-3 bg-purple-50 border border-purple-200 rounded'
              }, [
                React.createElement('div', {
                  key: 'unlock-controls',
                  className: 'grid grid-cols-12 gap-2 items-center'
                }, [
                  React.createElement('select', {
                    key: 'type',
                    value: unlock.type,
                    onChange: (e) => updateSecretUnlock(unlock.id, { type: e.target.value }),
                    className: 'col-span-2 px-2 py-1 border border-gray-300 rounded text-sm'
                  }, [
                    React.createElement('option', { key: 'choice', value: 'choice' }, 'Choice'),
                    React.createElement('option', { key: 'scene', value: 'scene' }, 'Scene'),
                    React.createElement('option', { key: 'item', value: 'item' }, 'Item')
                  ]),
                  React.createElement('input', {
                    key: 'target',
                    type: 'text',
                    value: unlock.targetId,
                    onChange: (e) => updateSecretUnlock(unlock.id, { targetId: e.target.value }),
                    placeholder: 'Target ID',
                    className: 'col-span-3 px-2 py-1 border border-gray-300 rounded text-sm'
                  }),
                  React.createElement('input', {
                    key: 'notification',
                    type: 'text',
                    value: unlock.notification,
                    onChange: (e) => updateSecretUnlock(unlock.id, { notification: e.target.value }),
                    placeholder: 'Unlock message',
                    className: 'col-span-5 px-2 py-1 border border-gray-300 rounded text-sm'
                  }),
                  React.createElement('div', {
                    key: 'controls',
                    className: 'col-span-2 flex space-x-1'
                  }, [
                    React.createElement('button', {
                      key: 'conditions',
                      onClick: () => openConditionBuilder(
                        { type: 'secretUnlock', unlockId: unlock.id },
                        unlock.conditions || []
                      ),
                      className: 'px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded'
                    }, 'C'),
                    React.createElement('button', {
                      key: 'remove',
                      onClick: () => removeSecretUnlock(unlock.id),
                      className: 'px-2 py-1 text-xs bg-red-100 text-red-700 rounded'
                    }, '×')
                  ])
                ])
              ])
            ))
          ])
        ]),

        // Metadata tab
        activeTab === 'meta' && React.createElement('div', {
          key: 'meta-form',
          className: 'space-y-4'
        }, [
          React.createElement('div', {
            key: 'category-field'
          }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-1'
            }, 'Category'),
            React.createElement('select', {
              value: formData.category,
              onChange: (e) => handleFieldChange('category', e.target.value),
              className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            }, [
              React.createElement('option', { key: 'general', value: 'general' }, 'General'),
              React.createElement('option', { key: 'introduction', value: 'introduction' }, 'Introduction'),
              React.createElement('option', { key: 'exploration', value: 'exploration' }, 'Exploration'),
              React.createElement('option', { key: 'combat', value: 'combat' }, 'Combat'),
              React.createElement('option', { key: 'dialogue', value: 'dialogue' }, 'Dialogue'),
              React.createElement('option', {  key: 'puzzle', value: 'puzzle' }, 'Puzzle'),
              React.createElement('option', { key: 'ending',value: 'ending'}, 'Ending')
            ])
          ]),

          // Tags section
          React.createElement('div', {
            key: 'tags-field'
          }, [
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 mb-1'
            }, 'Tags'),
            React.createElement('div', {
              className: 'flex space-x-2'
            }, [
              React.createElement('input', {
                type: 'text',
                value: newTag,
                onChange: (e) => setNewTag(e.target.value),
                onKeyPress: (e) => e.key === 'Enter' && addTag(),
                className: 'flex-1 px-3 py-2 border border-gray-300 rounded-md',
                placeholder: 'Add tag...'
              }),
              React.createElement(Button, {
                onClick: addTag,
                disabled: !newTag.trim(),
                variant: 'secondary'
              }, 'Add')
            ]),
            React.createElement('div', {
              className: 'flex flex-wrap gap-2 mt-2'
            }, formData.tags.map(tag =>
              React.createElement('span', {
                key: tag,
                className: 'inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded-full'
              }, [
                tag,
                React.createElement('button', {
                  onClick: () => removeTag(tag),
                  className: 'ml-1 text-gray-600 hover:text-gray-800'
                }, '×')
              ])
            ))
          ])
        ])
      ]),

      // Footer
      React.createElement('div', {
        key: 'dialog-footer',
        className: 'px-6 py-4 border-t border-gray-200 flex items-center justify-between'
      }, [
        React.createElement('div', {
          key: 'left-buttons'
        }, scene && React.createElement(Button, {
          onClick: onDelete,
          variant: 'danger'
        }, 'Delete Scene')),
        React.createElement('div', {
          key: 'right-buttons',
          className: 'flex space-x-2'
        }, [
          React.createElement(Button, {
            key: 'cancel',
            onClick: onCancel,
            variant: 'secondary'
          }, 'Cancel'),
          React.createElement(Button, {
            key: 'save',
            onClick: handleSave,
            disabled: !formData.title.trim()
          }, 'Save Scene')
        ])
      ])
    ]),

    // Condition Builder Dialog
    showConditionBuilder && React.createElement(ConditionBuilder, {
      key: 'condition-builder',
      isOpen: showConditionBuilder,
      conditions: conditionTarget?.conditions || [],
      availableStats: adventureStats,
      availableFlags: adventureFlags,
      availableItems: adventureInventory,
      onSave: saveConditions,
      onCancel: () => {
        setShowConditionBuilder(false);
        setConditionTarget(null);
      }
    }),

    // Advanced Choice Dialog
    showAdvancedChoiceDialog && React.createElement(AdvancedChoiceDialog, {
      key: 'choice-dialog',
      isOpen: showAdvancedChoiceDialog,
      choice: editingChoice,
      availableScenes: availableScenes,
      availableStats: adventureStats,
      availableFlags: adventureFlags,
      availableItems: adventureInventory,
      onSave: saveChoice,
      onCancel: () => {
        setShowAdvancedChoiceDialog(false);
        setEditingChoice(null);
      }
    })
  ]);
}