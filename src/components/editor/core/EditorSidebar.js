// EditorSidebar.js - Properties panel for selected nodes
// Handles: scene editing, choice management, stats definition, adventure settings

import { Button } from '../../common/Button.js';

const { useState } = React;

export default function EditorSidebar({
  selectedNode = null,
  adventureStats = [],
  onNodeUpdate = () => {},
  onChoiceAdd = () => {},
  onChoiceUpdate = () => {},
  onChoiceDelete = () => {},
  onStatAdd = () => {},
  onStatUpdate = () => {},
  onStatDelete = () => {},
  onOpenSceneDialog = () => {},
  onOpenChoiceDialog = () => {},
  className = ''
}) {
  const [activeTab, setActiveTab] = useState('scene'); // 'scene' or 'stats'
  const [expandedSections, setExpandedSections] = useState({
    choices: true,
    actions: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderSceneProperties = () => {
    if (!selectedNode) {
      return React.createElement('div', {
        className: 'p-4 text-center text-gray-500'
      }, [
        React.createElement('div', {
          key: 'no-selection-icon',
          className: 'text-4xl mb-2'
        }, '📝'),
        React.createElement('div', {
          key: 'no-selection-text',
          className: 'text-sm'
        }, 'Select a scene to edit its properties')
      ]);
    }

    return React.createElement('div', {
      className: 'p-4 space-y-4'
    }, [
      // Scene basic info
      React.createElement('div', {
        key: 'scene-info',
        className: 'space-y-3'
      }, [
        React.createElement('div', {
          key: 'scene-title'
        }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Scene Title'),
          React.createElement('input', {
            type: 'text',
            value: selectedNode.title || '',
            onChange: (e) => onNodeUpdate(selectedNode.id, { title: e.target.value }),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            placeholder: 'Enter scene title...'
          })
        ]),

        React.createElement('div', {
          key: 'scene-content'
        }, [
          React.createElement('div', {
            className: 'flex items-center justify-between mb-1'
          }, [
            React.createElement('label', {
              key: 'content-label',
              className: 'text-sm font-medium text-gray-700'
            }, 'Content'),
            React.createElement(Button, {
              key: 'edit-content-btn',
              onClick: () => onOpenSceneDialog(selectedNode.id),
              variant: 'secondary',
              size: 'xs'
            }, 'Edit Full')
          ]),
          React.createElement('textarea', {
            value: selectedNode.content || '',
            onChange: (e) => onNodeUpdate(selectedNode.id, { content: e.target.value }),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm',
            rows: 4,
            placeholder: 'Enter scene content...'
          })
        ])
      ]),

      // Choices section
      React.createElement('div', {
        key: 'choices-section',
        className: 'border-t border-gray-200 pt-4'
      }, [
        React.createElement('button', {
          key: 'choices-header',
          onClick: () => toggleSection('choices'),
          className: 'flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900'
        }, [
          React.createElement('span', {
            key: 'choices-title'
          }, `Choices (${(selectedNode.choices || []).length})`),
          React.createElement('span', {
            key: 'choices-icon',
            className: 'text-xs'
          }, expandedSections.choices ? '▼' : '▶')
        ]),

        expandedSections.choices && React.createElement('div', {
          key: 'choices-content',
          className: 'mt-3 space-y-2'
        }, [
          ...(selectedNode.choices || []).map((choice, index) =>
            React.createElement('div', {
              key: choice.id || index,
              className: 'p-2 bg-gray-50 rounded border border-gray-200'
            }, [
              React.createElement('div', {
                key: 'choice-header',
                className: 'flex items-center justify-between mb-1'
              }, [
                React.createElement('span', {
                  key: 'choice-text',
                  className: 'text-sm font-medium text-gray-800 truncate flex-1'
                }, choice.text || 'Untitled Choice'),
                React.createElement('button', {
                  key: 'edit-choice-btn',
                  onClick: () => onOpenChoiceDialog(selectedNode.id, choice.id),
                  className: 'text-xs text-blue-600 hover:text-blue-800'
                }, 'Edit')
              ]),
              React.createElement('div', {
                key: 'choice-details',
                className: 'text-xs text-gray-600'
              }, [
                choice.targetSceneId && React.createElement('div', {
                  key: 'target'
                }, `→ ${choice.targetSceneId}`),
                choice.conditions && choice.conditions.length > 0 && React.createElement('div', {
                  key: 'conditions',
                  className: 'text-yellow-600'
                }, `${choice.conditions.length} condition(s)`)
              ])
            ])
          ),

          React.createElement(Button, {
            key: 'add-choice-btn',
            onClick: () => onChoiceAdd(selectedNode.id),
            variant: 'secondary',
            size: 'sm',
            className: 'w-full'
          }, '+ Add Choice')
        ])
      ]),

      // Actions section
      React.createElement('div', {
        key: 'actions-section',
        className: 'border-t border-gray-200 pt-4'
      }, [
        React.createElement('button', {
          key: 'actions-header',
          onClick: () => toggleSection('actions'),
          className: 'flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900'
        }, [
          React.createElement('span', {
            key: 'actions-title'
          }, 'Scene Actions'),
          React.createElement('span', {
            key: 'actions-icon',
            className: 'text-xs'
          }, expandedSections.actions ? '▼' : '▶')
        ]),

        expandedSections.actions && React.createElement('div', {
          key: 'actions-content',
          className: 'mt-3 space-y-2 text-sm text-gray-600'
        }, [
          React.createElement('div', {
            key: 'on-enter'
          }, [
            React.createElement('span', { className: 'font-medium' }, 'On Enter: '),
            (selectedNode.onEnter || []).length > 0 ? 
              `${selectedNode.onEnter.length} action(s)` : 'None'
          ]),
          React.createElement('div', {
            key: 'on-exit'
          }, [
            React.createElement('span', { className: 'font-medium' }, 'On Exit: '),
            (selectedNode.onExit || []).length > 0 ? 
              `${selectedNode.onExit.length} action(s)` : 'None'
          ]),
          React.createElement('div', {
            key: 'actions-note',
            className: 'text-xs text-gray-500 italic'
          }, 'Use full editor for action management')
        ])
      ])
    ]);
  };

  const renderStatsManager = () => {
    return React.createElement('div', {
      className: 'p-4 space-y-4'
    }, [
      React.createElement('div', {
        key: 'stats-header',
        className: 'flex items-center justify-between'
      }, [
        React.createElement('h3', {
          key: 'stats-title',
          className: 'font-medium text-gray-900'
        }, 'Adventure Stats'),
        React.createElement(Button, {
          key: 'add-stat-btn',
          onClick: onStatAdd,
          variant: 'primary',
          size: 'xs'
        }, '+ Add')
      ]),

      React.createElement('div', {
        key: 'stats-list',
        className: 'space-y-2'
      }, adventureStats.map((stat, index) =>
        React.createElement('div', {
          key: stat.id || index,
          className: 'p-3 bg-gray-50 rounded border border-gray-200'
        }, [
          React.createElement('div', {
            key: 'stat-header',
            className: 'flex items-center justify-between mb-2'
          }, [
            React.createElement('span', {
              key: 'stat-name',
              className: 'font-medium text-sm text-gray-800'
            }, stat.name || 'Unnamed Stat'),
            React.createElement('button', {
              key: 'delete-stat-btn',
              onClick: () => onStatDelete(stat.id),
              className: 'text-xs text-red-600 hover:text-red-800'
            }, '×')
          ]),
          React.createElement('div', {
            key: 'stat-details',
            className: 'text-xs text-gray-600 space-y-1'
          }, [
            React.createElement('div', {
              key: 'stat-type'
            }, `Type: ${stat.type || 'number'}`),
            React.createElement('div', {
              key: 'stat-default'
            }, `Default: ${stat.defaultValue ?? 0}`),
            stat.min !== undefined && React.createElement('div', {
              key: 'stat-min'
            }, `Min: ${stat.min}`),
            stat.max !== undefined && React.createElement('div', {
              key: 'stat-max'
            }, `Max: ${stat.max}`)
          ])
        ])
      )),

      adventureStats.length === 0 && React.createElement('div', {
        key: 'no-stats',
        className: 'text-center text-gray-500 text-sm py-8'
      }, [
        React.createElement('div', {
          key: 'no-stats-icon',
          className: 'text-2xl mb-2'
        }, '📊'),
        React.createElement('div', {
          key: 'no-stats-text'
        }, 'No stats defined yet')
      ])
    ]);
  };

  return React.createElement('div', {
    className: `w-80 bg-white border-l border-gray-200 flex flex-col ${className}`
  }, [
    // Tab navigation
    React.createElement('div', {
      key: 'tab-nav',
      className: 'flex border-b border-gray-200'
    }, [
      React.createElement('button', {
        key: 'scene-tab',
        onClick: () => setActiveTab('scene'),
        className: `flex-1 px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'scene' 
            ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`
      }, 'Scene'),
      React.createElement('button', {
        key: 'stats-tab',
        onClick: () => setActiveTab('stats'),
        className: `flex-1 px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'stats' 
            ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`
      }, 'Stats')
    ]),

    // Tab content
    React.createElement('div', {
      key: 'tab-content',
      className: 'flex-1 overflow-y-auto'
    }, activeTab === 'scene' ? renderSceneProperties() : renderStatsManager())
  ]);
}