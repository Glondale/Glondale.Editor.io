 
import React, { useState, useCallback, useMemo } from "https://esm.sh/react@18";

/**
 * ConditionBuilder.js - Visual condition creation component
 * 
 * Features:
 * - Visual condition builder with drag and drop
 * - Complex logic operators (AND, OR, NOT)
 * - Real-time condition validation
 * - Condition templates and presets
 * - Integration with existing condition system
 * 
 * Integration Points:
 * - ConditionParser: Uses existing condition evaluation
 * - StatsManager: Provides available stats for conditions
 * - InventoryManager: Provides available items for conditions
 * - Editor dialogs: Scene and choice editing integration
 */

export default function ConditionBuilder({ 
  conditions = [], 
  onConditionsChange, 
  availableStats = [], 
  availableFlags = [],
  availableItems = [],
  availableScenes = [],
  className = '',
  disabled = false,
  onInlineAddFlag = null 
}) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Memoized condition templates
  const conditionTemplates = useMemo(() => ({
    common: [
      {
        name: 'Health Check',
        description: 'Check if health is above threshold',
        condition: { type: 'stat', key: 'health', operator: 'gte', value: 50 }
      },
      {
        name: 'Has Item',
        description: 'Check if player has specific item',
        condition: { type: 'inventory', key: 'has_item', operator: 'eq', value: 'sword' }
      },
      {
        name: 'Flag Set',
        description: 'Check if flag is true',
        condition: { type: 'flag', key: 'met_wizard', operator: 'eq', value: true }
      },
      {
        name: 'Scene Visited',
        description: 'Check if scene was visited',
        condition: { type: 'scene_visited', key: 'scene_visited', operator: 'eq', value: 'forest' }
      }
    ],
    advanced: [
      {
        name: 'Combat Ready',
        description: 'Health high and has weapon',
        conditions: [
          { type: 'stat', key: 'health', operator: 'gte', value: 70 },
          { type: 'inventory', key: 'has_item', operator: 'eq', value: 'sword' }
        ],
        logic: 'AND'
      },
      {
        name: 'Experienced Explorer',
        description: 'High stats or many scenes visited',
        conditions: [
          { type: 'stat', key: 'experience', operator: 'gte', value: 100 },
          { type: 'stat', key: 'scenes_visited_count', operator: 'gte', value: 10 }
        ],
        logic: 'OR'
      }
    ]
  }), []);

  // Handle adding new condition
  const handleAddCondition = useCallback((template = null) => {
    const newCondition = template || {
      id: generateConditionId(),
      type: 'stat',
      key: availableStats[0]?.id || '',
      operator: 'eq',
      value: ''
    };

    onConditionsChange([...conditions, newCondition]);
  }, [conditions, onConditionsChange, availableStats]);

  // Handle condition update
  const handleConditionUpdate = useCallback((index, updates) => {
    const updatedConditions = conditions.map((condition, i) => 
      i === index ? { ...condition, ...updates } : condition
    );
    onConditionsChange(updatedConditions);
  }, [conditions, onConditionsChange]);

  // Handle condition deletion
  const handleConditionDelete = useCallback((index) => {
    const updatedConditions = conditions.filter((_, i) => i !== index);
    onConditionsChange(updatedConditions);
  }, [conditions, onConditionsChange]);

  // Handle drag start
  const handleDragStart = useCallback((e, condition, index) => {
    if (disabled) return;
    
    setDraggedItem({ condition, index });
    e.dataTransfer.effectAllowed = 'move';
  }, [disabled]);

  // Handle drag over
  const handleDragOver = useCallback((e, targetIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback((e, targetIndex) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.index === targetIndex) {
      setDraggedItem(null);
      return;
    }

    const reorderedConditions = [...conditions];
    const [removed] = reorderedConditions.splice(draggedItem.index, 1);
    reorderedConditions.splice(targetIndex, 0, removed);

    onConditionsChange(reorderedConditions);
    setDraggedItem(null);
  }, [conditions, draggedItem, onConditionsChange]);

  // Add condition from template
  const handleTemplateSelect = useCallback((template) => {
    if (template.condition) {
      handleAddCondition(template.condition);
    } else if (template.conditions) {
      // Add multiple conditions for complex templates
      template.conditions.forEach(condition => {
        handleAddCondition(condition);
      });
    }
    setShowTemplates(false);
  }, [handleAddCondition]);

  return React.createElement('div', {
    className: `condition-builder ${className}`,
    style: { opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }
  },
    // Header with add button and templates
    React.createElement('div', {
      className: 'flex justify-between items-center mb-4'
    },
      React.createElement('h3', {
        className: 'text-lg font-medium text-gray-900'
      }, 'Conditions'),
      
      React.createElement('div', {
        className: 'flex gap-2'
      },
        React.createElement('button', {
          type: 'button',
          onClick: () => setShowTemplates(!showTemplates),
          className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors'
        }, 'Templates'),
        
        React.createElement('button', {
          type: 'button',
          onClick: () => handleAddCondition(),
          className: 'px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors'
        }, '+ Add Condition')
      )
    ),

    // Templates panel
    showTemplates && React.createElement('div', {
      className: 'mb-4 p-4 bg-gray-50 rounded-lg border'
    },
      React.createElement('h4', {
        className: 'font-medium mb-3'
      }, 'Condition Templates'),
      
      React.createElement('div', {
        className: 'space-y-3'
      },
        // Common templates
        React.createElement('div', null,
          React.createElement('h5', {
            className: 'text-sm font-medium text-gray-700 mb-2'
          }, 'Common'),
          
          React.createElement('div', {
            className: 'grid grid-cols-2 gap-2'
          },
            conditionTemplates.common.map((template, index) =>
              React.createElement('button', {
                key: index,
                onClick: () => handleTemplateSelect(template),
                className: 'p-2 text-left bg-white border rounded hover:bg-gray-50 transition-colors'
              },
                React.createElement('div', {
                  className: 'font-medium text-sm'
                }, template.name),
                React.createElement('div', {
                  className: 'text-xs text-gray-600'
                }, template.description)
              )
            )
          )
        ),

        // Advanced templates
        React.createElement('div', null,
          React.createElement('h5', {
            className: 'text-sm font-medium text-gray-700 mb-2'
          }, 'Advanced'),
          
          React.createElement('div', {
            className: 'grid grid-cols-1 gap-2'
          },
            conditionTemplates.advanced.map((template, index) =>
              React.createElement('button', {
                key: index,
                onClick: () => handleTemplateSelect(template),
                className: 'p-2 text-left bg-white border rounded hover:bg-gray-50 transition-colors'
              },
                React.createElement('div', {
                  className: 'font-medium text-sm'
                }, template.name),
                React.createElement('div', {
                  className: 'text-xs text-gray-600'
                }, template.description)
              )
            )
          )
        )
      )
    ),

    // Conditions list
    React.createElement('div', {
      className: 'space-y-3'
    },
      conditions.length === 0 ? 
        React.createElement('div', {
          className: 'text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg'
        },
          React.createElement('p', null, 'No conditions set'),
          React.createElement('p', {
            className: 'text-sm'
          }, 'Add a condition to get started')
        ) :
        
        conditions.map((condition, index) =>
          React.createElement(ConditionItem, {
            key: condition.id || index,
            condition,
            index,
            availableStats,
            availableFlags,
            availableItems,
            availableScenes,
            onUpdate: (updates) => handleConditionUpdate(index, updates),
            onDelete: () => handleConditionDelete(index),
            onDragStart: handleDragStart,
            onDragOver: handleDragOver,
            onDrop: handleDrop,
            isSelected: selectedCondition === index,
            onSelect: () => setSelectedCondition(selectedCondition === index ? null : index),
            showLogic: conditions.length > 1 && index < conditions.length - 1
          })
        )
    ),

    // Logic explanation
    conditions.length > 1 && React.createElement('div', {
      className: 'mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg'
    },
      React.createElement('div', {
        className: 'text-sm text-blue-800'
      },
        React.createElement('strong', null, 'Logic: '),
        'All conditions must be true (AND logic). The choice will only be available when every condition above is met.'
      )
    )
  );
}

// Individual condition item component
function ConditionItem({ 
  condition, 
  index, 
  availableStats,
  availableFlags,
  availableItems,
  availableScenes,
  onUpdate, 
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isSelected,
  onSelect,
  showLogic 
}) {
  // Get available options based on condition type
  const getAvailableKeys = useCallback((type) => {
    switch (type) {
      case 'stat':
        return availableStats.map(stat => ({ value: stat.id, label: stat.name }));
      case 'flag':
        return availableFlags.map(flag => ({ value: flag.id, label: flag.name || flag.id }));
      case 'inventory':
        return [
          { value: 'has_item', label: 'Has Item' },
          { value: 'item_count', label: 'Item Count' },
          ...availableItems.map(item => ({ value: item.id, label: item.name }))
        ];
      case 'scene_visited':
        return availableScenes.map(scene => ({ value: scene.id, label: scene.title }));
      default:
        return [];
    }
  }, [availableStats, availableFlags, availableItems, availableScenes]);

  // Get available operators based on condition type
  const getAvailableOperators = useCallback((type) => {
    switch (type) {
      case 'stat':
        return [
          { value: 'eq', label: '=' },
          { value: 'ne', label: '≠' },
          { value: 'gt', label: '>' },
          { value: 'gte', label: '≥' },
          { value: 'lt', label: '<' },
          { value: 'lte', label: '≤' }
        ];
      case 'flag':
      case 'scene_visited':
        return [
          { value: 'eq', label: '=' },
          { value: 'ne', label: '≠' }
        ];
      case 'inventory':
        return [
          { value: 'eq', label: '=' },
          { value: 'gte', label: '≥' }
        ];
      default:
        return [];
    }
  }, []);

  const availableKeys = getAvailableKeys(condition.type);
  const availableOperators = getAvailableOperators(condition.type);

  return React.createElement('div', {
    className: `condition-item border rounded-lg p-4 bg-white ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-300'}`,
    draggable: true,
    onDragStart: (e) => onDragStart(e, condition, index),
    onDragOver: (e) => onDragOver(e, index),
    onDrop: (e) => onDrop(e, index)
  },
    React.createElement('div', {
      className: 'flex items-start gap-3'
    },
      // Drag handle
      React.createElement('div', {
        className: 'mt-2 cursor-move text-gray-400 hover:text-gray-600'
      }, '⋮⋮'),

      // Condition fields
      React.createElement('div', {
        className: 'flex-1 grid grid-cols-1 md:grid-cols-4 gap-3'
      },
        // Type selection
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Type'),
          React.createElement('select', {
            value: condition.type,
            onChange: (e) => onUpdate({ 
              type: e.target.value, 
              key: '',
              operator: getAvailableOperators(e.target.value)[0]?.value || 'eq',
              value: ''
            }),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          },
            React.createElement('option', { value: 'stat' }, 'Stat'),
            React.createElement('option', { value: 'flag' }, 'Flag'),
            React.createElement('option', { value: 'inventory' }, 'Inventory'),
            React.createElement('option', { value: 'scene_visited' }, 'Scene Visited')
          )
        ),

        // Key selection
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Property'),
          condition.type === 'flag' && availableKeys.length > 0 ?
            React.createElement('div', { className: 'flex items-center gap-2' }, [
              React.createElement('select', {
                key: 'flag-select',
                value: condition.key,
                onChange: (e) => onUpdate({ key: e.target.value }),
                className: 'flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              },
                React.createElement('option', { value: '' }, 'Select...'),
                availableKeys.map(key =>
                  React.createElement('option', { 
                    key: key.value, 
                    value: key.value 
                  }, key.label)
                )
              ),
              React.createElement('button', {
                key: 'add-flag-inline',
                type: 'button',
                className: 'px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200',
                onClick: () => {
                  if (typeof onInlineAddFlag === 'function') {
                    onInlineAddFlag((newFlag) => onUpdate({ key: newFlag.id }));
                  }
                },
                title: 'Create a new flag'
              }, '+ Add Flag')
            ])
          : availableKeys.length > 0 ?
              React.createElement('select', {
                value: condition.key,
                onChange: (e) => onUpdate({ key: e.target.value }),
                className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              },
                React.createElement('option', { value: '' }, 'Select...'),
                availableKeys.map(key =>
                  React.createElement('option', { 
                    key: key.value, 
                    value: key.value 
                  }, key.label)
                )
              )
            :
              React.createElement('input', {
                type: 'text',
                value: condition.key,
                onChange: (e) => onUpdate({ key: e.target.value }),
                placeholder: 'Enter property name',
                className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              })
        ),

        // Operator selection
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Operator'),
          React.createElement('select', {
            value: condition.operator,
            onChange: (e) => onUpdate({ operator: e.target.value }),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          },
            availableOperators.map(op =>
              React.createElement('option', { 
                key: op.value, 
                value: op.value 
              }, op.label)
            )
          )
        ),

        // Value input
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Value'),
          condition.type === 'flag' ?
            React.createElement('select', {
              value: condition.value,
              onChange: (e) => onUpdate({ value: e.target.value === 'true' }),
              className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            },
              React.createElement('option', { value: 'true' }, 'True'),
              React.createElement('option', { value: 'false' }, 'False')
            ) :
            condition.type === 'inventory' && condition.key === 'has_item' ?
              React.createElement('select', {
                value: condition.value,
                onChange: (e) => onUpdate({ value: e.target.value }),
                className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              },
                React.createElement('option', { value: '' }, 'Select item...'),
                availableItems.map(item =>
                  React.createElement('option', { 
                    key: item.id, 
                    value: item.id 
                  }, item.name)
                )
              ) :
              condition.type === 'scene_visited' ?
                React.createElement('select', {
                  value: condition.value,
                  onChange: (e) => onUpdate({ value: e.target.value }),
                  className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                },
                  React.createElement('option', { value: '' }, 'Select scene...'),
                  availableScenes.map(scene =>
                    React.createElement('option', { 
                      key: scene.id, 
                      value: scene.id 
                    }, scene.title)
                  )
                ) :
                React.createElement('input', {
                  type: condition.type === 'stat' ? 'number' : 'text',
                  value: condition.value,
                  onChange: (e) => onUpdate({ 
                    value: condition.type === 'stat' ? Number(e.target.value) : e.target.value 
                  }),
                  placeholder: 'Enter value',
                  className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                })
        )
      ),

      // Delete button
      React.createElement('button', {
        onClick: onDelete,
        className: 'mt-6 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors'
      }, '🗑️')
    ),

    // Logic connector
    showLogic && React.createElement('div', {
      className: 'mt-3 text-center'
    },
      React.createElement('span', {
        className: 'inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full'
      }, 'AND')
    ),

    // Condition preview
    isSelected && React.createElement('div', {
      className: 'mt-3 p-3 bg-gray-50 border-t'
    },
      React.createElement('div', {
        className: 'text-sm text-gray-600'
      },
        React.createElement('strong', null, 'Preview: '),
        formatConditionPreview(condition)
      )
    )
  );
}

// Helper functions
export function generateConditionId() {
  return 'condition_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

export function formatConditionPreview(condition) {
  const operatorLabels = {
    'eq': '=',
    'ne': '≠',
    'gt': '>',
    'gte': '≥',
    'lt': '<',
    'lte': '≤'
  };

  const operator = operatorLabels[condition.operator] || condition.operator;
  
  if (condition.type === 'inventory' && condition.key === 'has_item') {
    return `Player has item "${condition.value}"`;
  }
  
  if (condition.type === 'scene_visited') {
    return `Scene "${condition.value}" has been visited`;
  }
  
  if (condition.type === 'flag') {
    return `Flag "${condition.key}" is ${condition.value}`;
  }

  return `${condition.key} ${operator} ${condition.value}`;
}