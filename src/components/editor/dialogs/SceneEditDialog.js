// SceneEditDialog.js - Modal for editing scene content and properties
// Handles: scene title, content, onEnter/onExit actions, tags

import { Button } from '../../common/Button.js';

const { useState, useEffect, useRef } = React;

export default function SceneEditDialog({
  isOpen = false,
  scene = null,
  adventureStats = [],
  onSave = () => {},
  onCancel = () => {},
  onDelete = () => {}
}) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: [],
    onEnter: [],
    onExit: []
  });
  const [activeTab, setActiveTab] = useState('content');
  const [newTag, setNewTag] = useState('');
  const dialogRef = useRef(null);
  const titleInputRef = useRef(null);

  // Initialize form data when scene changes
  useEffect(() => {
    if (scene) {
      setFormData({
        title: scene.title || '',
        content: scene.content || '',
        tags: [...(scene.tags || [])],
        onEnter: [...(scene.onEnter || [])],
        onExit: [...(scene.onExit || [])]
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

  // Handle action operations
  const addAction = (actionType) => {
    const newAction = {
      id: `action_${Date.now()}`,
      type: 'set_stat',
      key: '',
      value: ''
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
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  const renderActionEditor = (actionType, actions) => {
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
        className: 'space-y-2'
      }, actions.map((action, index) =>
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
              onChange: (e) => updateAction(actionType, action.id, { type: e.target.value }),
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
              onChange: (e) => updateAction(actionType, action.id, { key: e.target.value }),
              placeholder: 'Stat/Flag name',
              className: 'col-span-4 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
            }),

            React.createElement('input', {
              key: 'action-value',
              type: action.type === 'set_flag' ? 'checkbox' : 'text',
              value: action.type === 'set_flag' ? undefined : (action.value || ''),
              checked: action.type === 'set_flag' ? action.value : undefined,
              onChange: (e) => updateAction(actionType, action.id, { 
                value: action.type === 'set_flag' ? e.target.checked : e.target.value 
              }),
              placeholder: 'Value',
              className: `${action.type === 'set_flag' ? 'col-span-2' : 'col-span-4'} px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500`
            }),

            React.createElement('button', {
              key: 'remove-action',
              onClick: () => removeAction(actionType, action.id),
              className: 'col-span-1 text-red-600 hover:text-red-800 text-sm'
            }, '×')
          ])
        ])
      )),

      actions.length === 0 && React.createElement('div', {
        key: 'no-actions',
        className: 'text-center text-gray-500 text-sm py-4'
      }, `No ${actionType === 'onEnter' ? 'enter' : 'exit'} actions defined`)
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
      React.createElement('button', {
        key: 'content-tab',
        onClick: () => setActiveTab('content'),
        className: `pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === 'content' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`
      }, 'Content'),
      React.createElement('button', {
        key: 'actions-tab',
        onClick: () => setActiveTab('actions'),
        className: `pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === 'actions' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`
      }, 'Actions'),
      React.createElement('button', {
        key: 'meta-tab',
        onClick: () => setActiveTab('meta'),
        className: `pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === 'meta' 
            ? 'border-blue-500 text-blue-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`
      }, 'Metadata')
    ])),

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
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            placeholder: 'Enter scene title...'
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
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            rows: 12,
            placeholder: 'Write your scene content here...'
          })
        ])
      ]),

      // Actions tab
      activeTab === 'actions' && React.createElement('div', {
        key: 'actions-form',
        className: 'space-y-6'
      }, [
        renderActionEditor('onEnter', formData.onEnter),
        renderActionEditor('onExit', formData.onExit)
      ]),

      // Metadata tab
      activeTab === 'meta' && React.createElement('div', {
        key: 'meta-form',
        className: 'space-y-4'
      }, [
        React.createElement('div', {
          key: 'tags-field'
        }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-1'
          }, 'Tags'),
          React.createElement('div', {
            className: 'flex space-x-2 mb-2'
          }, [
            React.createElement('input', {
              key: 'tag-input',
              type: 'text',
              value: newTag,
              onChange: (e) => setNewTag(e.target.value),
              onKeyPress: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              },
              className: 'flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              placeholder: 'Add tag...'
            }),
            React.createElement(Button, {
              key: 'add-tag-btn',
              onClick: addTag,
              variant: 'secondary',
              size: 'sm'
            }, 'Add')
          ]),
          React.createElement('div', {
            className: 'flex flex-wrap gap-2'
          }, formData.tags.map(tag =>
            React.createElement('span', {
              key: tag,
              className: 'inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full'
            }, [
              React.createElement('span', { key: 'tag-text' }, tag),
              React.createElement('button', {
                key: 'remove-tag',
                onClick: () => removeTag(tag),
                className: 'ml-1 text-blue-600 hover:text-blue-800'
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
        key: 'footer-left'
      }, scene && React.createElement(Button, {
        onClick: () => onDelete(scene.id),
        variant: 'danger',
        size: 'sm'
      }, 'Delete Scene')),

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
        }, 'Save Scene')
      ])
    ])
  ]));
}