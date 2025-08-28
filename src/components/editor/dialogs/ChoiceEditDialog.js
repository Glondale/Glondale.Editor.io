// ChoiceEditDialog.js - Modal for editing choices, targets, and conditions
// Handles: choice text, target scene, conditions, actions, requirements

import { Button } from '../../common/Button.js';

const { useState, useEffect, useRef } = React;

export default function ChoiceEditDialog({
  isOpen = false,
  choice = null,
  availableScenes = [],
  adventureStats = [],
  onSave = () => {},
  onCancel = () => {},
  onDelete = () => {}
}) {
  const [formData, setFormData] = useState({
    text: '',
    targetSceneId: '',
    conditions: [],
    actions: [],
    isHidden: false,
    isSecret: false
  });
  const [activeTab, setActiveTab] = useState('basic');
  const dialogRef = useRef(null);
  const textInputRef = useRef(null);

  // Initialize form data when choice changes
  useEffect(() => {
    if (choice) {
      setFormData({
        text: choice.text || '',
        targetSceneId: choice.targetSceneId || '',
        conditions: [...(choice.conditions || [])],
        actions: [...(choice.actions || [])],
        isHidden: choice.isHidden || false,
        isSecret: choice.isSecret || false
      });
    }
  }, [choice]);

  // Focus text input when dialog opens
  useEffect(() => {
    if (isOpen && textInputRef.current) {
      setTimeout(() => textInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle condition operations
  const addCondition = () => {
    const newCondition = {
      id: `condition_${Date.now()}`,
      type: 'stat',
      operator: 'gte',
      key: '',
      value: ''
    };
    handleFieldChange('conditions', [...formData.conditions, newCondition]);
  };

  const updateCondition = (conditionId, updates) => {
    const updatedConditions = formData.conditions.map(condition =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    );
    handleFieldChange('conditions', updatedConditions);
  };

  const removeCondition = (conditionId) => {
    const filteredConditions = formData.conditions.filter(condition => condition.id !== conditionId);
    handleFieldChange('conditions', filteredConditions);
  };

  // Handle action operations
  const addAction = () => {
    const newAction = {
      id: `action_${Date.now()}`,
      type: 'set_stat',
      key: '',
      value: ''
    };
    handleFieldChange('actions', [...formData.actions, newAction]);
  };

  const updateAction = (actionId, updates) => {
    const updatedActions = formData.actions.map(action =>
      action.id === actionId ? { ...action, ...updates } : action
    );
    handleFieldChange('actions', updatedActions);
  };

  const removeAction = (actionId) => {
    const filteredActions = formData.actions.filter(action => action.id !== actionId);
    handleFieldChange('actions', filteredActions);
  };

  // Handle save
  const handleSave = () => {
    const updatedChoice = {
      ...choice,
      ...formData
    };
    onSave(updatedChoice);
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  const renderConditionEditor = () => {
    return React.createElement('div', {
      className: 'space-y-3'
    }, [
      React.createElement('div', {
        key: 'conditions-header',
        className: 'flex items-center justify-between'
      }, [
        React.createElement('h4', {
          key: 'conditions-title',
          className: 'font-medium text-gray-900'
        }, 'Display Conditions'),
        React.createElement(Button, {
          key: 'add-condition-btn',
          onClick: addCondition,
          variant: 'secondary',
          size: 'xs'
        }, '+ Add Condition')
      ]),

      React.createElement('div', {
        key: 'conditions-help',
        className: 'text-sm text-gray-600 bg-blue-50 p-3 rounded'
      }, 'Choice will only be shown if ALL conditions are met. Leave empty to always show.'),

      React.createElement('div', {
        key: 'conditions-list',
        className: 'space-y-2'
      }, formData.conditions.map((condition, index) =>
        React.createElement('div', {
          key: condition.id || index,
          className: 'p-3 bg-gray-50 rounded border border-gray-200'
        }, [
          React.createElement('div', {
            key: 'condition-controls',
            className: 'grid grid-cols-12 gap-2 items-center'
          }, [
            React.createElement('select', {
              key: 'condition-type',
              value: condition.type || 'stat',
              onChange: (e) => updateCondition(condition.id, { type: e.target.value }),
              className: 'col-span-2 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }, [
              React.createElement('option', { key: 'stat', value: 'stat' }, 'Stat'),
              React.createElement('option', { key: 'flag', value: 'flag' }, 'Flag'),
              React.createElement('option', { key: 'scene_visited', value: 'scene_visited' }, 'Visited')
            ]),

            React.createElement('input', {
              key: 'condition-key',
              type: 'text',
              value: condition.key || '',
              onChange: (e) => updateCondition(condition.id, { key: e.target.value }),
              placeholder: condition.type === 'scene_visited' ? 'Scene ID' : 'Stat/Flag name',
              className: 'col-span-3 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }),

            condition.type !== 'flag' && React.createElement('select', {
              key: 'condition-operator',
              value: condition.operator || 'gte',
              onChange: (e) => updateCondition(condition.id, { operator: e.target.value }),
              className: 'col-span-2 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }, [
              React.createElement('option', { key: 'eq', value: 'eq' }, 'equals'),
              React.createElement('option', { key: 'ne', value: 'ne' }, 'not equal'),
              React.createElement('option', { key: 'gt', value: 'gt' }, 'greater'),
              React.createElement('option', { key: 'gte', value: 'gte' }, 'greater/equal'),
              React.createElement('option', { key: 'lt', value: 'lt' }, 'less'),
              React.createElement('option', { key: 'lte', value: 'lte' }, 'less/equal')
            ]),

            condition.type === 'flag' ? React.createElement('select', {
              key: 'flag-value',
              value: condition.value === true ? 'true' : 'false',
              onChange: (e) => updateCondition(condition.id, { value: e.target.value === 'true' }),
              className: 'col-span-4 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }, [
              React.createElement('option', { key: 'true', value: 'true' }, 'True'),
              React.createElement('option', { key: 'false', value: 'false' }, 'False')
            ]) : React.createElement('input', {
              key: 'condition-value',
              type: condition.type === 'scene_visited' ? 'hidden' : 'text',
              value: condition.type === 'scene_visited' ? '' : (condition.value || ''),
              onChange: (e) => updateCondition(condition.id, { value: e.target.value }),
              placeholder: 'Value',
              className: 'col-span-4 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }),

            React.createElement('button', {
              key: 'remove-condition',
              onClick: () => removeCondition(condition.id),
              className: 'col-span-1 text-red-600 hover:text-red-800 text-sm'
            }, '×')
          ])
        ])
      )),

      formData.conditions.length === 0 && React.createElement('div', {
        key: 'no-conditions',
        className: 'text-center text-gray-500 text-sm py-4'
      }, 'No conditions - choice always visible')
    ]);
  };

  const renderActionEditor = () => {
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
        }, 'Actions on Select'),
        React.createElement(Button, {
          key: 'add-action-btn',
          onClick: addAction,
          variant: 'secondary',
          size: 'xs'
        }, '+ Add Action')
      ]),

      React.createElement('div', {
        key: 'actions-help',
        className: 'text-sm text-gray-600 bg-green-50 p-3 rounded'
      }, 'Actions are executed when the player selects this choice.'),

      React.createElement('div', {
        key: 'actions-list',
        className: 'space-y-2'
      }, formData.actions.map((action, index) =>
        React.createElement('div', {
          key: action.id || index,
          className: 'p-3 bg-gray-50 rounded border border-gray-200'
        }, [
          React.createElement('div', {
            key: 'action-controls',
            className: 'grid grid-cols-12 gap-2 items-center'
          }, [
            React.createElement('select', {
              key: 'action-type',
              value: action.type || 'set_stat',
              onChange: (e) => updateAction(action.id, { type: e.target.value }),
              className: 'col-span-3 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }, [
              React.createElement('option', { key: 'set_stat', value: 'set_stat' }, 'Set Stat'),
              React.createElement('option', { key: 'add_stat', value: 'add_stat' }, 'Add to Stat'),
              React.createElement('option', { key: 'set_flag', value: 'set_flag' }, 'Set Flag')
            ]),

            React.createElement('input', {
              key: 'action-key',
              type: 'text',
              value: action.key || '',
              onChange: (e) => updateAction(action.id, { key: e.target.value }),
              placeholder: 'Stat/Flag name',
              className: 'col-span-4 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }),

            React.createElement('input', {
              key: 'action-value',
              type: action.type === 'set_flag' ? 'checkbox' : 'text',
              value: action.type === 'set_flag' ? undefined : (action.value || ''),
              checked: action.type === 'set_flag' ? action.value : undefined,
              onChange: (e) => updateAction(action.id, { 
                value: action.type === 'set_flag' ? e.target.checked : e.target.value 
              }),
              placeholder: 'Value',
              className: `${action.type === 'set_flag' ? 'col-span-2' : 'col-span-4'} px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`
            }),

            React.createElement('button', {
              key: 'remove-action',
              onClick: () => removeAction(action.id),
              className: 'col-span-1 text-red-600 hover:text-red-800 text-sm'
            }, '×')
          ])
        ])
      )),

      formData.actions.length === 0 && React.createElement('div', {
        key: 'no-actions',
        className: 'text-center text-gray-500 text-sm py-4'
      }, 'No actions defined')
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
  }, React.createElement('div', {
    ref: dialogRef,
    className: 'bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col'
  }, [
    // Header
    React.createElement('div', {
      key: 'dialog-header',
      className: 'px-6 py-4 border-b border-gray-200 flex items-center justify-between'
    }, [
      React.createElement('h2', {
        key: 'dialog-title',
        className: 'text-xl font-semibold text-gray-900'
      }, choice ? 'Edit Choice' : 'New Choice'),
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
      React.createElement('button', {
        key: 'basic-tab',
        onClick: () => setActiveTab('basic'),
        className: `pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === 'basic' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`
      }, 'Basic'),
      React.createElement('button', {
        key: 'conditions-tab',
        onClick: () => setActiveTab('conditions'),
        className: `pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === 'conditions' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`
      }, `Conditions ${formData.conditions.length > 0 ? `(${formData.conditions.length})` : ''}`),
      React.createElement('button', {
        key: 'actions-tab',
        onClick: () => setActiveTab('actions'),
        className: `pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === 'actions' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`
      }, `Actions ${formData.actions.length > 0 ? `(${formData.actions.length})` : ''}`)
    ])),

    // Content area
    React.createElement('div', {
      key: 'dialog-content',
      className: 'flex-1 overflow-y-auto p-6'
    }, [
      // Basic tab
      activeTab === 'basic' && React.createElement('div', {
        key: 'basic-form',
        className: 'space-y-4'
      }, [
        React.createElement('div', {
          key: 'text-field'
        }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Choice Text'),
          React.createElement('input', {
            ref: textInputRef,
            type: 'text',
            value: formData.text,
            onChange: (e) => handleFieldChange('text', e.target.value),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            placeholder: 'Enter choice text...'
          })
        ]),

        React.createElement('div', {
          key: 'target-field'
        }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Target Scene'),
          React.createElement('select', {
            value: formData.targetSceneId,
            onChange: (e) => handleFieldChange('targetSceneId', e.target.value),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          }, [
            React.createElement('option', { key: 'none', value: '' }, 'Select target scene...'),
            ...availableScenes.map(scene =>
              React.createElement('option', {
                key: scene.id,
                value: scene.id
              }, scene.title || 'Untitled Scene')
            )
          ])
        ]),

        React.createElement('div', {
          key: 'options-field',
          className: 'space-y-2'
        }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700'
          }, 'Options'),
          React.createElement('div', {
            className: 'space-y-2'
          }, [
            React.createElement('label', {
              key: 'hidden-option',
              className: 'flex items-center'
            }, [
              React.createElement('input', {
                key: 'hidden-checkbox',
                type: 'checkbox',
                checked: formData.isHidden,
                onChange: (e) => handleFieldChange('isHidden', e.target.checked),
                className: 'mr-2'
              }),
              React.createElement('span', {
                key: 'hidden-label',
                className: 'text-sm text-gray-700'
              }, 'Hidden until conditions met')
            ]),
            React.createElement('label', {
              key: 'secret-option',
              className: 'flex items-center'
            }, [
              React.createElement('input', {
                key: 'secret-checkbox',
                type: 'checkbox',
                checked: formData.isSecret,
                onChange: (e) => handleFieldChange('isSecret', e.target.checked),
                className: 'mr-2'
              }),
              React.createElement('span', {
                key: 'secret-label',
                className: 'text-sm text-gray-700'
              }, 'Secret choice (unlocks permanently)')
            ])
          ])
        ])
      ]),

      // Conditions tab
      activeTab === 'conditions' && renderConditionEditor(),

      // Actions tab
      activeTab === 'actions' && renderActionEditor()
    ]),

    // Footer
    React.createElement('div', {
      key: 'dialog-footer',
      className: 'px-6 py-4 border-t border-gray-200 flex items-center justify-between'
    }, [
      React.createElement('div', {
        key: 'footer-left'
      }, choice && React.createElement(Button, {
        onClick: () => onDelete(choice.id),
        variant: 'danger',
        size: 'sm'
      }, 'Delete Choice')),

      React.createElement('div', {
        key: 'footer-right',
        className: 'flex space-x-3'
      }, [
        React.createElement(Button, {
          key: 'cancel-btn',
          onClick: onCancel,
          variant: 'secondary'
        }, 'Cancel'),
        React.createElement(Button, {
          key: 'save-btn',
          onClick: handleSave,
          variant: 'primary'
        }, 'Save Choice')
      ])
    ])
  ]));
}