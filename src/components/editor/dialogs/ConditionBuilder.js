// ConditionBuilder.js - Visual condition creation interface
// Handles: condition type selection, operator UI, value inputs, preview logic

import { Button } from '../../common/Button.js';

const { useState, useEffect } = React;

export default function ConditionBuilder({
  conditions = [],
  adventureStats = [],
  availableScenes = [],
  onChange = () => {},
  className = ''
}) {
  const [expandedCondition, setExpandedCondition] = useState(null);

  // Generate unique condition ID
  const generateConditionId = () => {
    return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add new condition
  const addCondition = (type = 'stat') => {
    const newCondition = {
      id: generateConditionId(),
      type: type,
      operator: type === 'flag' ? 'eq' : 'gte',
      key: '',
      value: type === 'flag' ? true : type === 'scene_visited' ? true : ''
    };
    onChange([...conditions, newCondition]);
    setExpandedCondition(newCondition.id);
  };

  // Update condition
  const updateCondition = (conditionId, updates) => {
    const updatedConditions = conditions.map(condition =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    );
    onChange(updatedConditions);
  };

  // Remove condition
  const removeCondition = (conditionId) => {
    const filteredConditions = conditions.filter(condition => condition.id !== conditionId);
    onChange(filteredConditions);
    if (expandedCondition === conditionId) {
      setExpandedCondition(null);
    }
  };

  // Get condition type options
  const getConditionTypes = () => [
    { value: 'stat', label: 'Stat Comparison', icon: '📊' },
    { value: 'flag', label: 'Flag Check', icon: '🏁' },
    { value: 'scene_visited', label: 'Scene Visited', icon: '👁️' }
  ];

  // Get operator options for condition type
  const getOperatorOptions = (type) => {
    if (type === 'flag' || type === 'scene_visited') {
      return [
        { value: 'eq', label: 'is true', symbol: '=' },
        { value: 'ne', label: 'is false', symbol: '≠' }
      ];
    }
    return [
      { value: 'eq', label: 'equals', symbol: '=' },
      { value: 'ne', label: 'not equal to', symbol: '≠' },
      { value: 'gt', label: 'greater than', symbol: '>' },
      { value: 'gte', label: 'greater than or equal', symbol: '≥' },
      { value: 'lt', label: 'less than', symbol: '<' },
      { value: 'lte', label: 'less than or equal', symbol: '≤' }
    ];
  };

  // Get available keys for condition type
  const getAvailableKeys = (type) => {
    switch (type) {
      case 'stat':
        return adventureStats.map(stat => ({ value: stat.id, label: stat.name }));
      case 'scene_visited':
        return availableScenes.map(scene => ({ value: scene.id, label: scene.title || 'Untitled Scene' }));
      default:
        return [];
    }
  };

  // Format condition for display
  const formatConditionPreview = (condition) => {
    const type = getConditionTypes().find(t => t.value === condition.type);
    const operator = getOperatorOptions(condition.type).find(op => op.value === condition.operator);
    
    if (!condition.key) {
      return `${type?.icon} ${type?.label} - Incomplete`;
    }

    if (condition.type === 'flag') {
      return `${type?.icon} ${condition.key} ${condition.value ? 'is true' : 'is false'}`;
    }
    
    if (condition.type === 'scene_visited') {
      const scene = availableScenes.find(s => s.id === condition.key);
      const sceneName = scene?.title || condition.key;
      return `${type?.icon} Visited "${sceneName}"`;
    }
    
    if (condition.type === 'stat') {
      const stat = adventureStats.find(s => s.id === condition.key);
      const statName = stat?.name || condition.key;
      return `${type?.icon} ${statName} ${operator?.symbol} ${condition.value}`;
    }

    return `${type?.icon} ${type?.label}`;
  };

  // Render condition editor
  const renderConditionEditor = (condition) => {
    const typeOptions = getConditionTypes();
    const operatorOptions = getOperatorOptions(condition.type);
    const availableKeys = getAvailableKeys(condition.type);

    return React.createElement('div', {
      className: 'space-y-4 p-4 bg-gray-50 rounded border'
    }, [
      // Type selection
      React.createElement('div', {
        key: 'type-selection'
      }, [
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-2'
        }, 'Condition Type'),
        React.createElement('div', {
          className: 'grid grid-cols-3 gap-2'
        }, typeOptions.map(type =>
          React.createElement('button', {
            key: type.value,
            onClick: () => updateCondition(condition.id, { 
              type: type.value,
              operator: type.value === 'flag' || type.value === 'scene_visited' ? 'eq' : 'gte',
              key: '',
              value: type.value === 'flag' ? true : type.value === 'scene_visited' ? true : ''
            }),
            className: `p-2 text-sm rounded border transition-colors ${
              condition.type === type.value
                ? 'bg-blue-100 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`
          }, [
            React.createElement('div', { key: 'icon', className: 'text-lg' }, type.icon),
            React.createElement('div', { key: 'label', className: 'text-xs mt-1' }, type.label)
          ])
        ))
      ]),

      // Key selection
      React.createElement('div', {
        key: 'key-selection'
      }, [
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, condition.type === 'stat' ? 'Stat' : condition.type === 'scene_visited' ? 'Scene' : 'Flag Name'),
        
        availableKeys.length > 0 ? React.createElement('select', {
          value: condition.key || '',
          onChange: (e) => updateCondition(condition.id, { key: e.target.value }),
          className: 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
        }, [
          React.createElement('option', { key: 'empty', value: '' }, 
            `Select ${condition.type === 'stat' ? 'stat' : condition.type === 'scene_visited' ? 'scene' : 'flag'}...`),
          ...availableKeys.map(option =>
            React.createElement('option', {
              key: option.value,
              value: option.value
            }, option.label)
          )
        ]) : React.createElement('input', {
          type: 'text',
          value: condition.key || '',
          onChange: (e) => updateCondition(condition.id, { key: e.target.value }),
          placeholder: `Enter ${condition.type === 'stat' ? 'stat name' : 'flag name'}...`,
          className: 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
        })
      ]),

      // Operator selection
      React.createElement('div', {
        key: 'operator-selection'
      }, [
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Comparison'),
        React.createElement('div', {
          className: 'grid grid-cols-2 gap-2'
        }, operatorOptions.map(op =>
          React.createElement('button', {
            key: op.value,
            onClick: () => updateCondition(condition.id, { operator: op.value }),
            className: `p-2 text-sm rounded border transition-colors ${
              condition.operator === op.value
                ? 'bg-blue-100 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`
          }, [
            React.createElement('div', { key: 'symbol', className: 'font-bold text-lg' }, op.symbol),
            React.createElement('div', { key: 'label', className: 'text-xs' }, op.label)
          ])
        ))
      ]),

      // Value input (for stat conditions)
      condition.type === 'stat' && React.createElement('div', {
        key: 'value-input'
      }, [
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Value'),
        React.createElement('input', {
          type: 'number',
          value: condition.value || '',
          onChange: (e) => updateCondition(condition.id, { value: e.target.value }),
          className: 'w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
          placeholder: 'Enter value...'
        })
      ]),

      // Flag value selection
      condition.type === 'flag' && React.createElement('div', {
        key: 'flag-value'
      }, [
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Expected Value'),
        React.createElement('div', {
          className: 'grid grid-cols-2 gap-2'
        }, [
          React.createElement('button', {
            key: 'true-btn',
            onClick: () => updateCondition(condition.id, { value: true, operator: 'eq' }),
            className: `p-2 text-sm rounded border transition-colors ${
              condition.value === true
                ? 'bg-green-100 border-green-500 text-green-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`
          }, '✓ True'),
          React.createElement('button', {
            key: 'false-btn',
            onClick: () => updateCondition(condition.id, { value: false, operator: 'ne' }),
            className: `p-2 text-sm rounded border transition-colors ${
              condition.value === false
                ? 'bg-red-100 border-red-500 text-red-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`
          }, '✗ False')
        ])
      ])
    ]);
  };

  return React.createElement('div', {
    className: `condition-builder ${className}`
  }, [
    // Header
    React.createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between mb-4'
    }, [
      React.createElement('h3', {
        key: 'title',
        className: 'font-medium text-gray-900'
      }, 'Conditions'),
      React.createElement('div', {
        key: 'add-buttons',
        className: 'flex space-x-2'
      }, [
        React.createElement(Button, {
          key: 'add-stat',
          onClick: () => addCondition('stat'),
          variant: 'secondary',
          size: 'xs'
        }, '+ Stat'),
        React.createElement(Button, {
          key: 'add-flag',
          onClick: () => addCondition('flag'),
          variant: 'secondary',
          size: 'xs'
        }, '+ Flag'),
        React.createElement(Button, {
          key: 'add-visited',
          onClick: () => addCondition('scene_visited'),
          variant: 'secondary',
          size: 'xs'
        }, '+ Visited')
      ])
    ]),

    // Conditions list
    React.createElement('div', {
      key: 'conditions-list',
      className: 'space-y-3'
    }, conditions.length > 0 ? conditions.map((condition, index) =>
      React.createElement('div', {
        key: condition.id,
        className: 'border border-gray-200 rounded-lg'
      }, [
        // Condition summary
        React.createElement('div', {
          key: 'condition-summary',
          className: `flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 ${
            expandedCondition === condition.id ? 'border-b border-gray-200' : ''
          }`,
          onClick: () => setExpandedCondition(
            expandedCondition === condition.id ? null : condition.id
          )
        }, [
          React.createElement('div', {
            key: 'condition-preview',
            className: 'flex items-center space-x-2'
          }, [
            React.createElement('span', {
              key: 'condition-number',
              className: 'flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center justify-center font-medium'
            }, index + 1),
            React.createElement('span', {
              key: 'condition-text',
              className: 'text-sm text-gray-700'
            }, formatConditionPreview(condition))
          ]),
          React.createElement('div', {
            key: 'condition-controls',
            className: 'flex items-center space-x-2'
          }, [
            React.createElement('button', {
              key: 'expand-btn',
              className: 'text-gray-400 hover:text-gray-600'
            }, expandedCondition === condition.id ? '▼' : '▶'),
            React.createElement('button', {
              key: 'delete-btn',
              onClick: (e) => {
                e.stopPropagation();
                removeCondition(condition.id);
              },
              className: 'text-red-600 hover:text-red-800 text-sm'
            }, '×')
          ])
        ]),

        // Expanded editor
        expandedCondition === condition.id && renderConditionEditor(condition)
      ])
    ) : React.createElement('div', {
      key: 'no-conditions',
      className: 'text-center text-gray-500 py-8'
    }, [
      React.createElement('div', {
        key: 'no-conditions-icon',
        className: 'text-4xl mb-2'
      }, '⚙️'),
      React.createElement('div', {
        key: 'no-conditions-text',
        className: 'text-sm'
      }, 'No conditions defined'),
      React.createElement('div', {
        key: 'no-conditions-help',
        className: 'text-xs text-gray-400 mt-1'
      }, 'Add conditions to control when this choice appears')
    ])),

    // Logic explanation
    conditions.length > 1 && React.createElement('div', {
      key: 'logic-explanation',
      className: 'mt-4 p-3 bg-blue-50 rounded border border-blue-200'
    }, [
      React.createElement('div', {
        key: 'logic-title',
        className: 'text-sm font-medium text-blue-800'
      }, 'Logic: ALL conditions must be true'),
      React.createElement('div', {
        key: 'logic-description',
        className: 'text-xs text-blue-600 mt-1'
      }, 'This choice will only appear if every condition above is satisfied.')
    ])
  ]);
}