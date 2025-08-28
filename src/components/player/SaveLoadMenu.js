// SaveLoadMenu.js - Enhanced with Phase 3 advanced features
import { Button } from '../common/Button.js';

const { useState, createElement, useRef } = React;

export function SaveLoadMenu({
  saves,
  onSave,
  onLoad,
  onDelete,
  onQuickSave,
  onExportCrossGame,
  onImportCrossGame,
  onGetSaveAnalytics,
  canSave,
  canLoad,
  isLoading,
  onClose
}) {
  const [mode, setMode] = useState('save');
  const [saveName, setSaveName] = useState('');
  const [selectedSave, setSelectedSave] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(null);
  const [importData, setImportData] = useState(null);
  const fileInputRef = useRef(null);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    await onSave(saveName.trim());
    setSaveName('');
    onClose();
  };

  const handleLoad = async () => {
    if (!selectedSave) return;
    await onLoad(selectedSave);
    onClose();
  };

  const handleDelete = async (saveId) => {
    if (window.confirm('Are you sure you want to delete this save?')) {
      await onDelete(saveId);
      if (selectedSave === saveId) {
        setSelectedSave('');
      }
    }
  };

  const handleQuickSave = async () => {
    await onQuickSave();
    onClose();
  };

  const handleExportCrossGame = async (saveId, format = 'json') => {
    try {
      const result = await onExportCrossGame(saveId, format);
      if (result) {
        // Create download link
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    }
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setImportData(data);
      } catch (error) {
        alert('Invalid save file format');
      }
    };
    reader.readAsText(file);
  };

  const handleImportCrossGame = async () => {
    if (!importData) return;
    
    try {
      const result = await onImportCrossGame(importData);
      if (result.success) {
        alert('Cross-game save imported successfully!');
        setImportData(null);
        onClose();
      } else {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  };

  const handleShowAnalytics = async (saveId) => {
    if (onGetSaveAnalytics) {
      try {
        const analytics = await onGetSaveAnalytics(saveId);
        setShowAnalytics(analytics);
      } catch (error) {
        alert(`Failed to load analytics: ${error.message}`);
      }
    }
  };

  const modes = [
    { id: 'save', label: 'Save Game', icon: '💾' },
    { id: 'load', label: 'Load Game', icon: '📂' },
    { id: 'crossgame', label: 'Cross-Game', icon: '🔄' },
    saves.length > 0 && { id: 'analytics', label: 'Analytics', icon: '📊' }
  ].filter(Boolean);

  return createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  }, createElement('div', {
    className: 'bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden'
  }, [
    // Header
    createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between p-4 border-b bg-gray-50'
    }, [
      createElement('h2', {
        key: 'title',
        className: 'text-xl font-semibold text-gray-800'
      }, 'Save & Load Manager'),
      createElement('button', {
        key: 'close',
        onClick: onClose,
        className: 'text-gray-500 hover:text-gray-700 text-xl p-1 hover:bg-gray-200 rounded'
      }, '×')
    ]),

    // Mode Tabs
    createElement('div', {
      key: 'tabs',
      className: 'flex border-b bg-white'
    }, modes.map(mode_item =>
      createElement('button', {
        key: mode_item.id,
        onClick: () => {
          setMode(mode_item.id);
          setShowAnalytics(null);
          setImportData(null);
        },
        className: `flex-1 py-3 px-4 text-center font-medium transition-colors ${
          mode === mode_item.id
            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-600 hover:bg-gray-50'
        }`
      }, [
        createElement('span', { key: 'icon', className: 'mr-1' }, mode_item.icon),
        createElement('span', { key: 'label' }, mode_item.label)
      ])
    )),

    // Content
    createElement('div', {
      key: 'content',
      className: 'p-4 overflow-y-auto',
      style: { maxHeight: '60vh' }
    }, [
      // Save Mode
      mode === 'save' && createElement('div', {
        key: 'save-mode',
        className: 'space-y-4'
      }, [
        // Quick Save
        createElement('div', {
          key: 'quick-save-section',
          className: 'p-3 bg-blue-50 rounded-lg border border-blue-200'
        }, [
          createElement('h3', {
            key: 'title',
            className: 'text-sm font-medium text-blue-800 mb-2'
          }, 'Quick Save'),
          createElement('p', {
            key: 'desc',
            className: 'text-xs text-blue-600 mb-3'
          }, 'Save your progress instantly'),
          createElement(Button, {
            key: 'button',
            onClick: handleQuickSave,
            disabled: !canSave || isLoading,
            className: 'w-full'
          }, isLoading ? 'Saving...' : 'Quick Save')
        ]),

        // Custom Save
        createElement('div', {
          key: 'custom-save-section',
          className: 'p-3 bg-gray-50 rounded-lg border border-gray-200'
        }, [
          createElement('h3', {
            key: 'title',
            className: 'text-sm font-medium text-gray-800 mb-2'
          }, 'Named Save'),
          createElement('label', {
            key: 'label',
            className: 'block text-xs text-gray-600 mb-2'
          }, 'Save Name'),
          createElement('input', {
            key: 'input',
            type: 'text',
            value: saveName,
            onChange: (e) => setSaveName(e.target.value),
            placeholder: 'Enter save name...',
            className: 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3',
            disabled: isLoading,
            onKeyPress: (e) => e.key === 'Enter' && handleSave()
          }),
          createElement(Button, {
            key: 'button',
            onClick: handleSave,
            disabled: !canSave || !saveName.trim() || isLoading,
            variant: 'primary',
            className: 'w-full'
          }, isLoading ? 'Saving...' : 'Save Game')
        ])
      ]),

      // Load Mode
      mode === 'load' && createElement('div', {
        key: 'load-mode'
      }, [
        saves.length === 0 ? createElement('div', {
          key: 'no-saves',
          className: 'text-center py-8'
        }, [
          createElement('p', {
            key: 'text',
            className: 'text-gray-500 mb-2'
          }, 'No saved games found'),
          createElement('p', {
            key: 'hint',
            className: 'text-xs text-gray-400'
          }, 'Create a save to get started')
        ]) : createElement('div', {
          key: 'saves-list',
          className: 'space-y-2'
        }, [
          ...saves.map(save =>
            createElement(SaveItem, {
              key: save.id,
              save,
              isSelected: selectedSave === save.id,
              onSelect: () => setSelectedSave(save.id),
              onDelete: () => handleDelete(save.id),
              onExportCrossGame: () => handleExportCrossGame(save.id),
              onShowAnalytics: () => handleShowAnalytics(save.id),
              hasExportData: save.hasExportData,
              canExportCrossGame: save.canExportCrossGame
            })
          ),
          selectedSave && createElement(Button, {
            key: 'load-button',
            onClick: handleLoad,
            disabled: !canLoad || isLoading,
            variant: 'primary',
            className: 'w-full mt-4'
          }, isLoading ? 'Loading...' : 'Load Selected Save')
        ])
      ]),

      // Cross-Game Mode
      mode === 'crossgame' && createElement('div', {
        key: 'crossgame-mode',
        className: 'space-y-4'
      }, [
        // Export Section
        createElement('div', {
          key: 'export-section',
          className: 'p-3 bg-green-50 rounded-lg border border-green-200'
        }, [
          createElement('h3', {
            key: 'title',
            className: 'text-sm font-medium text-green-800 mb-2'
          }, 'Export Cross-Game Save'),
          createElement('p', {
            key: 'desc',
            className: 'text-xs text-green-600 mb-3'
          }, 'Export your progress to use in other adventures'),
          saves.length > 0 ? createElement('div', {
            key: 'saves',
            className: 'space-y-2'
          }, saves.filter(save => save.canExportCrossGame).map(save =>
            createElement('div', {
              key: save.id,
              className: 'flex items-center justify-between p-2 bg-white rounded border'
            }, [
              createElement('div', {
                key: 'info',
                className: 'flex-1'
              }, [
                createElement('span', {
                  key: 'name',
                  className: 'text-sm font-medium'
                }, save.name),
                createElement('span', {
                  key: 'progress',
                  className: 'ml-2 text-xs text-gray-500'
                }, `${save.completionPercentage}% complete`)
              ]),
              createElement(Button, {
                key: 'export',
                onClick: () => handleExportCrossGame(save.id),
                size: 'sm',
                variant: 'secondary'
              }, '📤 Export')
            ])
          )) : createElement('p', {
            key: 'no-saves',
            className: 'text-xs text-green-600'
          }, 'No exportable saves available')
        ]),

        // Import Section
        createElement('div', {
          key: 'import-section',
          className: 'p-3 bg-purple-50 rounded-lg border border-purple-200'
        }, [
          createElement('h3', {
            key: 'title',
            className: 'text-sm font-medium text-purple-800 mb-2'
          }, 'Import Cross-Game Save'),
          createElement('p', {
            key: 'desc',
            className: 'text-xs text-purple-600 mb-3'
          }, 'Import progress from another adventure'),
          
          // File input
          createElement('input', {
            key: 'file-input',
            type: 'file',
            accept: '.json',
            onChange: handleImportFileSelect,
            ref: fileInputRef,
            className: 'hidden'
          }),
          createElement(Button, {
            key: 'select-file',
            onClick: () => fileInputRef.current?.click(),
            variant: 'secondary',
            className: 'w-full mb-3'
          }, '📁 Select Cross-Game Save File'),
          
          // Import data preview
          importData && createElement('div', {
            key: 'import-preview',
            className: 'p-2 bg-white rounded border mb-3'
          }, [
            createElement('h4', {
              key: 'title',
              className: 'text-xs font-medium text-gray-700 mb-1'
            }, 'Import Preview'),
            createElement('p', {
              key: 'source',
              className: 'text-xs text-gray-600'
            }, `From: ${importData.sourceAdventure?.title || 'Unknown Adventure'}`),
            createElement('p', {
              key: 'stats',
              className: 'text-xs text-gray-600'
            }, `Stats: ${Object.keys(importData.transferableData?.stats || {}).length}`),
            createElement('p', {
              key: 'items',
              className: 'text-xs text-gray-600'
            }, `Items: ${(importData.transferableData?.inventory || []).length}`)
          ]),
          
          createElement(Button, {
            key: 'import-button',
            onClick: handleImportCrossGame,
            disabled: !importData,
            variant: 'primary',
            className: 'w-full'
          }, '📥 Import Save Data')
        ])
      ]),

      // Analytics Mode
      mode === 'analytics' && createElement('div', {
        key: 'analytics-mode',
        className: 'space-y-4'
      }, [
        createElement('h3', {
          key: 'title',
          className: 'text-lg font-medium text-gray-800 mb-3'
        }, 'Save Analytics'),
        
        saves.length > 0 ? saves.map(save =>
          createElement('div', {
            key: save.id,
            className: 'p-3 border rounded-lg hover:bg-gray-50 cursor-pointer',
            onClick: () => handleShowAnalytics(save.id)
          }, [
            createElement('div', {
              key: 'header',
              className: 'flex items-center justify-between mb-2'
            }, [
              createElement('span', {
                key: 'name',
                className: 'font-medium'
              }, save.name),
              createElement('span', {
                key: 'icon',
                className: 'text-blue-600'
              }, '📊')
            ]),
            createElement('div', {
              key: 'stats',
              className: 'grid grid-cols-3 gap-2 text-xs text-gray-600'
            }, [
              createElement('div', { key: 'progress' }, `${save.completionPercentage}% complete`),
              createElement('div', { key: 'secrets' }, `${save.secretsFound} secrets`),
              createElement('div', { key: 'choices' }, `${save.choicesMade} choices`)
            ])
          ])
        ) : createElement('p', {
          key: 'no-saves',
          className: 'text-gray-500 text-center py-4'
        }, 'No saves available for analytics')
      ]),

      // Analytics Detail Modal
      showAnalytics && createElement(AnalyticsModal, {
        key: 'analytics-modal',
        analytics: showAnalytics,
        onClose: () => setShowAnalytics(null)
      })
    ])
  ]));
}

function SaveItem({ 
  save, 
  isSelected, 
  onSelect, 
  onDelete, 
  onExportCrossGame,
  onShowAnalytics,
  hasExportData,
  canExportCrossGame 
}) {
  return createElement('div', {
    className: `p-3 border rounded-lg cursor-pointer transition-all ${
      isSelected
        ? 'bg-blue-50 border-blue-300 shadow-sm'
        : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300'
    }`,
    onClick: onSelect
  }, [
    createElement('div', {
      key: 'main',
      className: 'flex items-center justify-between'
    }, [
      createElement('div', {
        key: 'info',
        className: 'flex-1 min-w-0'
      }, [
        createElement('div', {
          key: 'header',
          className: 'flex items-center space-x-2 mb-1'
        }, [
          createElement('h4', {
            key: 'name',
            className: 'font-medium text-gray-900 truncate'
          }, save.name),
          save.version && createElement('span', {
            key: 'version',
            className: 'text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded'
          }, `v${save.version}`)
        ]),
        createElement('p', {
          key: 'scene',
          className: 'text-sm text-gray-600 truncate'
        }, save.currentSceneTitle),
        createElement('div', {
          key: 'metadata',
          className: 'flex items-center space-x-3 mt-2 text-xs text-gray-500'
        }, [
          createElement('span', {
            key: 'time'
          }, new Date(save.timestamp).toLocaleString()),
          save.completionPercentage !== undefined && createElement('span', {
            key: 'progress',
            className: `px-1.5 py-0.5 rounded ${
              save.completionPercentage === 100 
                ? 'bg-green-100 text-green-700' 
                : 'bg-blue-100 text-blue-700'
            }`
          }, `${save.completionPercentage}% complete`),
          save.secretsFound > 0 && createElement('span', {
            key: 'secrets',
            className: 'px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded'
          }, `${save.secretsFound} secrets`)
        ])
      ]),
      
      createElement('div', {
        key: 'actions',
        className: 'flex items-center space-x-1 ml-2'
      }, [
        onShowAnalytics && createElement('button', {
          key: 'analytics',
          onClick: (e) => {
            e.stopPropagation();
            onShowAnalytics();
          },
          className: 'text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded',
          title: 'View Analytics'
        }, '📊'),
        canExportCrossGame && createElement('button', {
          key: 'export',
          onClick: (e) => {
            e.stopPropagation();
            onExportCrossGame();
          },
          className: 'text-green-500 hover:text-green-700 p-1 hover:bg-green-50 rounded',
          title: 'Export for Cross-Game Use'
        }, '📤'),
        createElement('button', {
          key: 'delete',
          onClick: (e) => {
            e.stopPropagation();
            onDelete();
          },
          className: 'text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded',
          title: 'Delete Save'
        }, '🗑')
      ])
    ])
  ]);
}

function AnalyticsModal({ analytics, onClose }) {
  return createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    onClick: onClose
  }, createElement('div', {
    className: 'bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden',
    onClick: (e) => e.stopPropagation()
  }, [
    createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between p-4 border-b bg-gray-50'
    }, [
      createElement('h3', {
        key: 'title',
        className: 'text-lg font-semibold text-gray-800'
      }, 'Save Analytics'),
      createElement('button', {
        key: 'close',
        onClick: onClose,
        className: 'text-gray-500 hover:text-gray-700 text-xl'
      }, '×')
    ]),
    
    createElement('div', {
      key: 'content',
      className: 'p-4 overflow-y-auto'
    }, [
      createElement('div', {
        key: 'save-info',
        className: 'mb-4 p-3 bg-gray-50 rounded-lg'
      }, [
        createElement('h4', {
          key: 'title',
          className: 'font-medium text-gray-800 mb-2'
        }, analytics.saveInfo.name),
        createElement('div', {
          key: 'details',
          className: 'text-sm text-gray-600 space-y-1'
        }, [
          createElement('p', { key: 'created' }, `Created: ${new Date(analytics.saveInfo.created).toLocaleString()}`),
          createElement('p', { key: 'modified' }, `Modified: ${new Date(analytics.saveInfo.modified).toLocaleString()}`),
          createElement('p', { key: 'version' }, `Version: ${analytics.saveInfo.version}`)
        ])
      ]),
      
      analytics.gameplayMetrics && createElement('div', {
        key: 'metrics',
        className: 'grid grid-cols-2 gap-3'
      }, Object.entries(analytics.gameplayMetrics).map(([key, value]) =>
        createElement('div', {
          key,
          className: 'p-2 bg-blue-50 rounded-lg text-center'
        }, [
          createElement('div', {
            key: 'value',
            className: 'text-lg font-semibold text-blue-800'
          }, typeof value === 'number' ? value.toLocaleString() : String(value)),
          createElement('div', {
            key: 'label',
            className: 'text-xs text-blue-600 capitalize'
          }, key.replace(/([A-Z])/g, ' $1').trim())
        ])
      ))
    ])
  ]));
}