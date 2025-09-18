// EditorSidebar.js - Properties panel for selected nodes
// Handles: scene editing, choice management, stats definition, adventure settings

import { Button } from '../../common/Button.js';

import React, { useState } from "https://esm.sh/react@18";

export default function EditorSidebar({
  selectedNode = null,
  adventureStats = [],
  adventureInventory = [],
  adventureAchievements = [],
  adventureFlags = [],
  availableScenes = [],
  onNodeUpdate = () => {},
  onChoiceAdd = () => {},
  onChoiceUpdate = () => {},
  onChoiceDelete = () => {},
  onStatAdd = () => {},
  onStatUpdate = () => {},
  onStatDelete = () => {},
  onOpenSceneDialog = () => {},
  onOpenChoiceDialog = () => {},
  onOpenInventoryEditor = () => {},
  onOpenAchievementsEditor = () => {},
  onOpenFlagsEditor = () => {},
  className = '',
  choiceScriptMode = false
}) {
  const [activeTab, setActiveTab] = useState('scene'); // 'scene' or 'data'
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
                }, `→ ${availableScenes.find(s => s.id === choice.targetSceneId)?.title || choice.targetSceneId}`),
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

  const renderDataManager = () => {
    // Vertical stack of data managers similar to other tool entry points
    return React.createElement('div', { className: 'p-4 space-y-3' }, [
      React.createElement('h3', { key: 'data-title', className: 'font-medium text-gray-900' }, 'Data'),
      React.createElement('div', { key: 'tools', className: 'flex flex-col gap-2' }, [
        React.createElement(Button, { key: 'flags-btn', onClick: onOpenFlagsEditor, variant: 'secondary', size: 'sm', className: 'w-full justify-start' }, '🏁 Flags'),
        React.createElement(Button, { key: 'inventory-btn', onClick: onOpenInventoryEditor, variant: 'secondary', size: 'sm', className: 'w-full justify-start' }, '📦 Inventory'),
        React.createElement(Button, { key: 'achievements-btn', onClick: onOpenAchievementsEditor, variant: 'secondary', size: 'sm', className: 'w-full justify-start' }, '🏆 Achievements'),
  React.createElement(Button, { key: 'stats-btn', onClick: onStatAdd, variant: 'primary', size: 'sm', className: 'w-full justify-start' }, '📊 Stats')
      ]),
      React.createElement('div', { key: 'hint', className: 'text-xs text-gray-500' }, 'Tip: Use these to manage data in dedicated editors.')
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
        key: 'data-tab',
        onClick: () => setActiveTab('data'),
        className: `flex-1 px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'data' 
            ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`
      }, 'Data')
    ]),

    // Tab content
    React.createElement('div', {
      key: 'tab-content',
      className: 'flex-1 overflow-y-auto'
    }, activeTab === 'scene' ? renderSceneProperties() : renderDataManager())
  ]);
}


