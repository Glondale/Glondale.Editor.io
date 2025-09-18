// EditorToolbar.js - Enhanced with Phase 3 advanced features
import { Button } from '../../common/Button.js';
import EditorSessionStorage from '../../../engine/EditorSessionStorage.js';

import React, { useState, useEffect, useRef } from "https://esm.sh/react@18";

export default function EditorToolbar({
  adventureTitle = 'Untitled Adventure',
  hasNodes = false,
  validationErrors = [],
  validationWarnings = [],
  canExport = false,
  onNewAdventure = () => {},
  onImportAdventure = () => {},
  onExportAdventure = () => {},
  onAddScene = () => {},
  onDeleteSelected = () => {},
  onPlayTest = () => {},
  onValidate = () => {},
  onSaveEditor = () => {},
  onLoadEditor = () => {},
  onAutoSaveToggle = () => {},
  onExportFormat = () => {},
  selectedNodeId = null,
  // Phase 3 additions
  currentProject = null,
  projectList = [],
  autoSaveEnabled = true,
  lastSaved = null,
  hasUnsavedChanges = false,
  exportFormats = ['json', 'yaml', 'xml'],
  sessionStorage = null,
  onProjectListRefresh = () => {},
  // Undo/Redo functionality
  canUndo = false,
  canRedo = false,
  undoDescription = null,
  redoDescription = null,
  onUndo = () => {},
  onRedo = () => {},
  commandHistory = null
}) {
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const fileInputRef = useRef(null);
  const templateInputRef = useRef(null);

  // Initialize session storage if not provided
  const editorSession = sessionStorage || new EditorSessionStorage();

  // Update save status based on props
  useEffect(() => {
    if (hasUnsavedChanges) {
      setSaveStatus('modified');
    } else if (lastSaved) {
      setSaveStatus('saved');
    }
  }, [hasUnsavedChanges, lastSaved]);

  const hasErrors = validationErrors.length > 0;
  const hasWarnings = validationWarnings.length > 0;
  const hasIssues = hasErrors || hasWarnings;

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const adventureData = JSON.parse(event.target.result);
          onImportAdventure(adventureData);
        } catch (error) {
          alert('Invalid adventure file format');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleTemplateImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const templateData = JSON.parse(event.target.result);
          editorSession.importTemplate(templateData);
          onImportAdventure(templateData);
        } catch (error) {
          alert('Invalid template file format');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleNewProject = async () => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Continue anyway?')) {
      return;
    }

    const projectName = prompt('Enter project name:');
    if (projectName) {
      // Ask parent to create the project so it can include current adventure data
      if (onNewAdventure && typeof onNewAdventure === 'function') {
        await onNewAdventure(projectName);
      } else {
        await editorSession.createNewProject({ name: projectName, title: projectName });
      }
    }
    setShowProjectMenu(false);
  };

  const handleLoadProject = async (projectId) => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Continue anyway?')) {
      return;
    }
    
    try {
      const projectData = await editorSession.loadProject(projectId);
      onLoadEditor(projectData);
    } catch (error) {
      alert(`Failed to load project: ${error.message}`);
    }
    setShowProjectMenu(false);
  };

  const handleSaveProject = async () => {
    try {
      // Allow Save As: ask user for a new name. If provided, pass it to parent handler
      const saveAsName = prompt('Save as new project (enter name) — leave blank to overwrite current:');

      if (onSaveEditor && typeof onSaveEditor === 'function') {
        // Parent can handle save or save-as when given a name
        await onSaveEditor(saveAsName && saveAsName.trim() ? saveAsName.trim() : null);
      } else {
        // Fallback: try to perform save or save-as using session storage
        if (saveAsName && saveAsName.trim()) {
          // Duplicate current project data into a new project
          const name = saveAsName.trim();
          const data = currentProject ? (currentProject.data || {}) : { adventureData: null };
          await editorSession.createNewProject({ name, data });
        } else {
          if (currentProject) {
            await editorSession.saveProject(currentProject.id, { title: adventureTitle });
          } else {
            const projectName = prompt('Enter project name:', adventureTitle);
            if (projectName) {
              await editorSession.createProject({ name: projectName, title: adventureTitle });
            }
          }
        }
      }

      setSaveStatus('saved');

      // Refresh project list UI after save
      if (onProjectListRefresh && typeof onProjectListRefresh === 'function') {
        await onProjectListRefresh();
      }
    } catch (error) {
      alert(`Failed to save project: ${error.message}`);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await editorSession.deleteProject(projectId);
        if (currentProject && currentProject.id === projectId) {
          onNewAdventure();
        }
        // Refresh the project list after deletion
        if (onProjectListRefresh) {
          await onProjectListRefresh();
        }
      } catch (error) {
        alert(`Failed to delete project: ${error.message}`);
      }
    }
    setShowProjectMenu(false);
  };

  const handleExportFormat = (format) => {
    onExportFormat(format);
    setShowExportMenu(false);
  };

  const handleSaveTemplate = async () => {
    const templateName = prompt('Enter template name:');
    if (templateName) {
      try {
        await editorSession.saveAsTemplate(templateName, {
          title: adventureTitle,
          // Template data would be passed from parent
        });
        alert('Template saved successfully!');
      } catch (error) {
        alert(`Failed to save template: ${error.message}`);
      }
    }
  };

  const handleLoadTemplate = async (templateId) => {
    try {
      const templateData = await editorSession.loadTemplate(templateId);
      onImportAdventure(templateData);
    } catch (error) {
      alert(`Failed to load template: ${error.message}`);
    }
    setShowTemplateMenu(false);
  };

  // Enhanced autosave feedback system
  const [saveState, setSaveState] = useState({
    status: 'idle', // 'idle', 'saving', 'saved', 'error', 'offline', 'conflict'
    progress: 0,
    isOnline: true,
    lastSaved: null,
    retryCount: 0,
    queueSize: 0,
    conflictData: null
  });

  // Subscribe to save status changes
  useEffect(() => {
    if (!sessionStorage) return;
    
    const unsubscribe = editorSession.onSaveStatusChange((status) => {
      setSaveState(status);
    });
    
    return unsubscribe;
  }, [editorSession, sessionStorage]);

  const getSaveStatusDisplay = () => {
    switch (saveState.status) {
      case 'saving':
        return { 
          text: `Saving... ${Math.round(saveState.progress)}%`, 
          className: 'text-blue-600',
          showSpinner: true,
          progress: saveState.progress
        };
      case 'saved':
        return { 
          text: saveState.lastSaved ? `Saved ${new Date(saveState.lastSaved).toLocaleTimeString()}` : 'Saved', 
          className: 'text-green-600',
          showCheckmark: true
        };
      case 'error':
        return { 
          text: saveState.retryCount > 0 ? `Save failed (retry ${saveState.retryCount})` : 'Save failed', 
          className: 'text-red-600',
          showError: true,
          showRetry: true
        };
      case 'offline':
        return { 
          text: 'Offline - changes saved locally', 
          className: 'text-orange-600',
          showOffline: true
        };
      case 'conflict':
        return { 
          text: 'Save conflict detected', 
          className: 'text-yellow-600',
          showConflict: true
        };
      case 'idle':
      default:
        if (hasUnsavedChanges) {
          return { text: 'Unsaved changes', className: 'text-orange-600' };
        }
        return { text: '', className: 'text-gray-600' };
    }
  };

  const saveStatusDisplay = getSaveStatusDisplay();

  return React.createElement('div', {
    className: 'flex items-center justify-between p-3 bg-white border-b border-gray-200 shadow-sm'
  }, [
    // Left section - Project management and title
    React.createElement('div', {
      key: 'left-section',
      className: 'flex items-center space-x-4'
    }, [
      // Project dropdown
      React.createElement('div', {
        key: 'project-menu',
        className: 'relative'
      }, [
        React.createElement('button', {
          key: 'project-btn',
          onClick: () => setShowProjectMenu(!showProjectMenu),
          className: 'flex items-center space-x-1 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border'
        }, [
          React.createElement('span', { key: 'icon' }, '📁'),
          React.createElement('span', { key: 'text' }, currentProject?.name || 'No Project'),
          React.createElement('span', { key: 'arrow' }, '▼')
        ]),

        showProjectMenu && React.createElement('div', {
          key: 'project-dropdown',
          className: 'absolute left-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-20'
        }, [
          React.createElement('div', {
            key: 'project-actions',
            className: 'p-2 border-b border-gray-200'
          }, [
            React.createElement(Button, {
              key: 'new-project',
              onClick: handleNewProject,
              variant: 'secondary',
              size: 'sm',
              className: 'w-full mb-2'
            }, '+ New Project'),
            React.createElement(Button, {
              key: 'save-project',
              onClick: handleSaveProject,
              variant: 'primary',
              size: 'sm',
              className: 'w-full'
            }, currentProject ? 'Save Project' : 'Save As New')
          ]),
          
          projectList.length > 0 && React.createElement('div', {
            key: 'project-list',
            className: 'max-h-40 overflow-y-auto'
          }, projectList.map(project =>
            React.createElement('div', {
              key: project.id,
              className: 'flex items-center justify-between p-2 hover:bg-gray-50'
            }, [
              React.createElement('button', {
                key: 'load-btn',
                onClick: () => handleLoadProject(project.id),
                className: 'flex-1 text-left text-sm text-gray-700 hover:text-gray-900'
              }, [
                React.createElement('div', { key: 'name' }, project.name),
                React.createElement('div', {
                  key: 'date',
                  className: 'text-xs text-gray-500'
                }, new Date(project.modified).toLocaleDateString())
              ]),
              React.createElement('button', {
                key: 'delete-btn',
                onClick: () => handleDeleteProject(project.id),
                className: 'text-red-500 hover:text-red-700 p-1'
              }, '🗑')
            ])
          ))
        ])
      ]),

      React.createElement('h1', {
        key: 'title',
        className: 'text-lg font-semibold text-gray-800 flex items-center space-x-2'
      }, [
        React.createElement('span', { key: 'text' }, adventureTitle),
        hasUnsavedChanges && React.createElement('span', {
          key: 'unsaved',
          className: 'text-orange-500 text-sm'
        }, '●')
      ]),

      // Enhanced Save status with visual indicators
      React.createElement('div', {
        key: 'save-status',
        className: 'flex items-center space-x-2'
      }, [
        // Progress bar for saving
        saveStatusDisplay.showSpinner && React.createElement('div', {
          key: 'progress-container',
          className: 'flex items-center space-x-1'
        }, [
          React.createElement('div', {
            key: 'spinner',
            className: 'animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full'
          }),
          React.createElement('div', {
            key: 'progress-bar',
            className: 'w-12 h-1 bg-gray-200 rounded-full overflow-hidden'
          }, React.createElement('div', {
            className: 'h-full bg-blue-600 transition-all duration-300',
            style: { width: `${saveStatusDisplay.progress || 0}%` }
          }))
        ]),

        // Status icons
        saveStatusDisplay.showCheckmark && React.createElement('span', {
          key: 'checkmark',
          className: 'text-green-600 text-sm'
        }, '✓'),

        saveStatusDisplay.showError && React.createElement('span', {
          key: 'error-icon',
          className: 'text-red-600 text-sm'
        }, '⚠️'),

        saveStatusDisplay.showOffline && React.createElement('span', {
          key: 'offline-icon',
          className: 'text-orange-600 text-sm'
        }, '📴'),

        saveStatusDisplay.showConflict && React.createElement('span', {
          key: 'conflict-icon',
          className: 'text-yellow-600 text-sm'
        }, '⚡'),

        // Save queue indicator
        saveState.queueSize > 0 && React.createElement('span', {
          key: 'queue-indicator',
          className: 'text-xs text-gray-500 bg-gray-100 px-1 rounded',
          title: `${saveState.queueSize} saves queued`
        }, saveState.queueSize),

        // Status text
        React.createElement('div', {
          key: 'save-text',
          className: `text-xs ${saveStatusDisplay.className}`,
          'data-save-status': true
        }, saveStatusDisplay.text),

        // Retry button for failed saves
        saveStatusDisplay.showRetry && React.createElement('button', {
          key: 'retry-btn',
          onClick: () => {
            if (currentProject && editorSession) {
              editorSession.forceSave(currentProject.id, { 
                title: adventureTitle,
                // Add current editor data here
              });
            }
          },
          className: 'text-xs text-red-600 hover:text-red-800 underline',
          title: 'Retry save'
        }, 'Retry'),

        // Conflict resolution button
        saveStatusDisplay.showConflict && React.createElement('button', {
          key: 'resolve-btn',
          onClick: () => {
            // Show conflict resolution dialog
            alert('Conflict resolution dialog would appear here');
          },
          className: 'text-xs text-yellow-600 hover:text-yellow-800 underline',
          title: 'Resolve conflict'
        }, 'Resolve')
      ])
    ]),

    // Center section - Scene tools and templates
    React.createElement('div', {
      key: 'center-section',
      className: 'flex items-center space-x-3'
    }, [
      React.createElement(Button, {
        key: 'add-scene-btn',
        onClick: onAddScene,
        variant: 'primary',
        size: 'sm'
      }, '+ Scene'),

      React.createElement(Button, {
        key: 'delete-btn',
        onClick: onDeleteSelected,
        variant: 'danger',
        size: 'sm',
        disabled: !selectedNodeId
      }, 'Delete'),

      // Undo/Redo buttons
      React.createElement('div', {
        key: 'undo-redo-group',
        className: 'flex items-center space-x-1 border-l border-gray-300 pl-3 ml-3'
      }, [
        React.createElement(Button, {
          key: 'undo-btn',
          onClick: onUndo,
          variant: 'secondary',
          size: 'sm',
          disabled: !canUndo,
          title: undoDescription ? `Undo: ${undoDescription}` : 'Undo (Ctrl+Z)'
        }, [
          React.createElement('span', { key: 'undo-icon', className: 'mr-1' }, '↶'),
          React.createElement('span', { key: 'undo-text' }, 'Undo')
        ]),
        
        React.createElement(Button, {
          key: 'redo-btn',
          onClick: onRedo,
          variant: 'secondary',
          size: 'sm',
          disabled: !canRedo,
          title: redoDescription ? `Redo: ${redoDescription}` : 'Redo (Ctrl+Y)'
        }, [
          React.createElement('span', { key: 'redo-icon', className: 'mr-1' }, '↷'),
          React.createElement('span', { key: 'redo-text' }, 'Redo')
        ]),
        
        React.createElement(Button, {
          key: 'history-btn',
          onClick: () => window.dispatchEvent(new CustomEvent('showActionHistory')),
          variant: 'secondary',
          size: 'sm',
          title: 'Show Action History (Ctrl+H)'
        }, [
          React.createElement('span', { key: 'history-icon', className: 'mr-1' }, '⏱️'),
          React.createElement('span', { key: 'history-text' }, 'History')
        ]),
        
        React.createElement(Button, {
          key: 'search-btn',
          onClick: () => window.dispatchEvent(new CustomEvent('showSearchPanel')),
          variant: 'secondary',
          size: 'sm',
          title: 'Search & Filter (Ctrl+F)'
        }, [
          React.createElement('span', { key: 'search-icon', className: 'mr-1' }, '🔍'),
          React.createElement('span', { key: 'search-text' }, 'Search')
        ])
      ]),

      // Template menu
      React.createElement('div', {
        key: 'template-menu',
        className: 'relative'
      }, [
        React.createElement('button', {
          key: 'template-btn',
          onClick: () => setShowTemplateMenu(!showTemplateMenu),
          className: 'px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded'
        }, '📄 Templates'),

        showTemplateMenu && React.createElement('div', {
          key: 'template-dropdown',
          className: 'absolute left-0 top-full mt-1 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-20'
        }, [
          React.createElement('div', {
            key: 'template-actions',
            className: 'p-2'
          }, [
            React.createElement(Button, {
              key: 'save-template',
              onClick: handleSaveTemplate,
              variant: 'secondary',
              size: 'sm',
              className: 'w-full mb-2'
            }, 'Save as Template'),
            React.createElement('label', {
              key: 'import-template',
              className: 'block'
            }, [
              React.createElement(Button, {
                key: 'import-btn',
                variant: 'secondary',
                size: 'sm',
                className: 'w-full',
                as: 'span'
              }, 'Import Template'),
              React.createElement('input', {
                key: 'import-input',
                type: 'file',
                accept: '.json',
                onChange: handleTemplateImport,
                ref: templateInputRef,
                className: 'hidden'
              })
            ])
          ])
        ])
      ]),

      React.createElement('div', {
        key: 'divider',
        className: 'h-6 w-px bg-gray-300'
      })
    ]),

    // Right section - Settings, validation, export, and play test
    React.createElement('div', {
      key: 'right-section',
      className: 'flex items-center space-x-3'
    }, [
      // Auto-save toggle
      React.createElement('div', {
        key: 'auto-save',
        className: 'flex items-center space-x-1'
      }, [
        React.createElement('input', {
          key: 'auto-save-checkbox',
          type: 'checkbox',
          checked: autoSaveEnabled,
          onChange: (e) => onAutoSaveToggle(e.target.checked),
          className: 'w-4 h-4 text-blue-600 rounded'
        }),
        React.createElement('span', {
          key: 'auto-save-label',
          className: 'text-xs text-gray-600'
        }, 'Auto-save')
      ]),

      // Session menu
      React.createElement('div', {
        key: 'session-menu',
        className: 'relative'
      }, [
        React.createElement('button', {
          key: 'session-btn',
          onClick: () => setShowSessionMenu(!showSessionMenu),
          className: 'p-1 text-gray-600 hover:bg-gray-100 rounded',
          title: 'Session Options'
        }, '⚙️'),

        showSessionMenu && React.createElement('div', {
          key: 'session-dropdown',
          className: 'absolute right-0 top-full mt-1 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-20'
        }, React.createElement('div', {
          className: 'p-2 space-y-1'
        }, [
          React.createElement('button', {
            key: 'clear-session',
            onClick: () => {
              if (confirm('Clear all session data?')) {
                editorSession.clearSession();
              }
              setShowSessionMenu(false);
            },
            className: 'w-full text-left px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded'
          }, 'Clear Session'),
          React.createElement('button', {
            key: 'backup-session',
            onClick: () => {
              editorSession.createBackup();
              setShowSessionMenu(false);
            },
            className: 'w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded'
          }, 'Create Backup')
        ]))
      ]),

      // Validation status
      React.createElement('div', {
        key: 'validation',
        className: 'relative'
      }, [
        React.createElement('button', {
          key: 'validation-btn',
          onClick: () => {
            onValidate();
            setShowValidationDetails(!showValidationDetails);
          },
          className: `flex items-center space-x-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
            hasErrors ? 'bg-red-100 text-red-700 hover:bg-red-200' :
            hasWarnings ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
            'bg-green-100 text-green-700 hover:bg-green-200'
          }`
        }, [
          React.createElement('span', {
            key: 'validation-icon',
            className: 'text-xs'
          }, hasErrors ? '❌' : hasWarnings ? '⚠️' : '✅'),
          
          React.createElement('span', {
            key: 'validation-text'
          }, hasErrors ? `${validationErrors.length} Error${validationErrors.length !== 1 ? 's' : ''}` :
              hasWarnings ? `${validationWarnings.length} Warning${validationWarnings.length !== 1 ? 's' : ''}` :
              'Valid')
        ]),

        showValidationDetails && hasIssues && React.createElement('div', {
          key: 'validation-dropdown',
          className: 'absolute right-0 top-full mt-1 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto'
        }, [
          validationErrors.length > 0 && React.createElement('div', {
            key: 'errors-section',
            className: 'p-3 border-b border-gray-200'
          }, [
            React.createElement('h4', {
              key: 'errors-title',
              className: 'font-medium text-red-700 mb-2'
            }, 'Errors'),
            ...validationErrors.map((error, index) => 
              React.createElement('div', {
                key: `error-${index}`,
                className: 'text-sm text-red-600 mb-1'
              }, `• ${error}`)
            )
          ]),

          validationWarnings.length > 0 && React.createElement('div', {
            key: 'warnings-section',
            className: 'p-3'
          }, [
            React.createElement('h4', {
              key: 'warnings-title',
              className: 'font-medium text-yellow-700 mb-2'
            }, 'Warnings'),
            ...validationWarnings.map((warning, index) =>
              React.createElement('div', {
                key: `warning-${index}`,
                className: 'text-sm text-yellow-600 mb-1'
              }, `• ${warning}`)
            )
          ])
        ])
      ]),

      // Export menu
      React.createElement('div', {
        key: 'export-menu',
        className: 'relative'
      }, [
        React.createElement('button', {
          key: 'export-btn',
          onClick: () => setShowExportMenu(!showExportMenu),
          disabled: !canExport || hasErrors,
          className: `flex items-center space-x-1 px-3 py-1 text-sm font-medium rounded transition-colors ${
            !canExport || hasErrors 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`
        }, [
          React.createElement('span', { key: 'text' }, 'Export'),
          React.createElement('span', { key: 'arrow' }, '▼')
        ]),

        showExportMenu && canExport && !hasErrors && React.createElement('div', {
          key: 'export-dropdown',
          className: 'absolute right-0 top-full mt-1 w-32 bg-white border border-gray-300 rounded-lg shadow-lg z-20'
        }, React.createElement('div', {
          className: 'p-1'
        }, exportFormats.map(format =>
          React.createElement('button', {
            key: format,
            onClick: () => handleExportFormat(format),
            className: 'w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded capitalize'
          }, format.toUpperCase())
        )))
      ]),

      React.createElement(Button, {
        key: 'playtest-btn',
        onClick: onPlayTest,
        variant: 'primary',
        size: 'sm',
        disabled: !hasNodes || hasErrors
      }, 'Play Test')
    ])
  ]);
}


