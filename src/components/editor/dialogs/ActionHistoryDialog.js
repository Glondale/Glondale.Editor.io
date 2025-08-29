// ActionHistoryDialog.js - Command history visualization and navigation
// Handles: history display, command details, jump to history point, statistics

import React, { useState, useEffect, useCallback, useMemo } from "https://esm.sh/react@18";

export default function ActionHistoryDialog({
  isOpen = false,
  commandHistory = null,
  onClose = () => {},
  onJumpToCommand = () => {},
  onClearHistory = () => {}
}) {
  const [historyData, setHistoryData] = useState(null);
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'node', 'choice', 'stat'
  const [searchTerm, setSearchTerm] = useState('');

  // Update history data when dialog opens or command history changes
  useEffect(() => {
    if (isOpen && commandHistory) {
      const history = commandHistory.getHistory();
      setHistoryData(history);
      
      // Set up listener for real-time updates
      const unsubscribe = commandHistory.addListener((event) => {
        const updatedHistory = commandHistory.getHistory();
        setHistoryData(updatedHistory);
      });
      
      return unsubscribe;
    }
  }, [isOpen, commandHistory]);

  // Filter and search commands
  const filteredCommands = useMemo(() => {
    if (!historyData?.commands) return [];
    
    let filtered = historyData.commands;
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(cmd => {
        const type = cmd.metadata?.type || '';
        switch (filterType) {
          case 'node':
            return type.includes('node') || type === 'create_node' || type === 'delete_node';
          case 'choice':
            return type.includes('choice');
          case 'stat':
            return type.includes('stat');
          case 'bulk':
            return cmd.metadata?.isBulk || cmd.metadata?.isComposite;
          default:
            return true;
        }
      });
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(cmd => 
        cmd.description.toLowerCase().includes(term) ||
        (cmd.metadata?.nodeId && cmd.metadata.nodeId.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [historyData?.commands, filterType, searchTerm]);

  const handleJumpToCommand = useCallback((commandIndex) => {
    if (commandHistory && typeof onJumpToCommand === 'function') {
      onJumpToCommand(commandIndex);
    } else if (commandHistory) {
      // Direct jump using command history
      commandHistory.jumpToIndex(commandIndex);
    }
    setSelectedCommand(null);
  }, [commandHistory, onJumpToCommand]);

  const handleClearHistory = useCallback(() => {
    if (confirm('Clear all command history? This cannot be undone.')) {
      if (typeof onClearHistory === 'function') {
        onClearHistory();
      } else if (commandHistory) {
        commandHistory.clear();
      }
      setSelectedCommand(null);
    }
  }, [commandHistory, onClearHistory]);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getCommandIcon = (command) => {
    const type = command.metadata?.type;
    switch (type) {
      case 'create_node':
        return '➕';
      case 'delete_node':
        return '🗑️';
      case 'move_node':
        return '↔️';
      case 'update_node':
        return '✏️';
      case 'create_choice':
        return '🔗';
      case 'delete_choice':
        return '❌';
      case 'update_choice':
        return '📝';
      case 'update_stats':
        return '📊';
      case 'import_adventure':
        return '📁';
      case 'bulk_operation':
        return '📦';
      default:
        return '⚡';
    }
  };

  const getCommandCategory = (command) => {
    return command.metadata?.category || 'other';
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'structure':
        return 'bg-blue-100 text-blue-800';
      case 'content':
        return 'bg-green-100 text-green-800';
      case 'layout':
        return 'bg-purple-100 text-purple-800';
      case 'configuration':
        return 'bg-yellow-100 text-yellow-800';
      case 'data':
        return 'bg-red-100 text-red-800';
      case 'bulk':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (!isOpen) return null;

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  }, [
    React.createElement('div', {
      key: 'dialog',
      className: 'bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-4xl flex flex-col'
    }, [
      // Header
      React.createElement('div', {
        key: 'header',
        className: 'flex items-center justify-between p-6 border-b border-gray-200'
      }, [
        React.createElement('div', {
          key: 'title-section',
          className: 'flex items-center space-x-3'
        }, [
          React.createElement('h2', {
            key: 'title',
            className: 'text-xl font-bold text-gray-900'
          }, '⏱️ Action History'),
          
          historyData && React.createElement('div', {
            key: 'stats-badge',
            className: 'flex items-center space-x-2 text-sm text-gray-600'
          }, [
            React.createElement('span', {
              key: 'total',
              className: 'px-2 py-1 bg-gray-100 rounded'
            }, `${historyData.commands.length} commands`),
            
            React.createElement('span', {
              key: 'position',
              className: 'px-2 py-1 bg-blue-100 rounded'
            }, `Position: ${historyData.currentIndex + 1}`)
          ])
        ]),

        React.createElement('div', {
          key: 'header-controls',
          className: 'flex items-center space-x-2'
        }, [
          React.createElement('button', {
            key: 'stats-btn',
            onClick: () => setShowStats(!showStats),
            className: `px-3 py-1 text-sm border rounded ${
              showStats ? 'bg-blue-100 text-blue-700 border-blue-300' : 'text-gray-600 border-gray-300'
            }`
          }, '📊 Stats'),
          
          React.createElement('button', {
            key: 'clear-btn',
            onClick: handleClearHistory,
            className: 'px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50',
            disabled: !historyData?.commands?.length
          }, 'Clear All'),
          
          React.createElement('button', {
            key: 'close-btn',
            onClick: onClose,
            className: 'text-gray-500 hover:text-gray-700 p-1'
          }, '✕')
        ])
      ]),

      // Controls
      React.createElement('div', {
        key: 'controls',
        className: 'p-4 border-b border-gray-200 bg-gray-50'
      }, [
        React.createElement('div', {
          key: 'control-row',
          className: 'flex items-center justify-between space-x-4'
        }, [
          // Search
          React.createElement('input', {
            key: 'search',
            type: 'text',
            placeholder: 'Search commands...',
            value: searchTerm,
            onChange: (e) => setSearchTerm(e.target.value),
            className: 'flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          }),
          
          // Filter
          React.createElement('select', {
            key: 'filter',
            value: filterType,
            onChange: (e) => setFilterType(e.target.value),
            className: 'px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          }, [
            React.createElement('option', { key: 'all', value: 'all' }, 'All Commands'),
            React.createElement('option', { key: 'node', value: 'node' }, 'Node Operations'),
            React.createElement('option', { key: 'choice', value: 'choice' }, 'Choice Operations'),
            React.createElement('option', { key: 'stat', value: 'stat' }, 'Stat Changes'),
            React.createElement('option', { key: 'bulk', value: 'bulk' }, 'Bulk Operations')
          ])
        ])
      ]),

      // Content
      React.createElement('div', {
        key: 'content',
        className: 'flex-1 flex overflow-hidden'
      }, [
        // Command List
        React.createElement('div', {
          key: 'command-list',
          className: showStats ? 'w-2/3' : 'w-full'
        }, [
          React.createElement('div', {
            key: 'list-container',
            className: 'h-full overflow-y-auto p-4'
          }, filteredCommands.length === 0 ? [
            React.createElement('div', {
              key: 'empty',
              className: 'text-center py-12 text-gray-500'
            }, [
              React.createElement('div', {
                key: 'icon',
                className: 'text-4xl mb-2'
              }, '📝'),
              React.createElement('div', {
                key: 'text'
              }, 'No commands match your filter')
            ])
          ] : filteredCommands.map((command, index) => {
            const isCurrent = command.index === historyData.currentIndex;
            const canExecute = command.canExecute;
            const isSelected = selectedCommand?.id === command.id;
            
            return React.createElement('div', {
              key: command.id,
              className: `group border rounded-lg mb-2 cursor-pointer transition-all ${
                isCurrent ? 'border-blue-500 bg-blue-50' :
                isSelected ? 'border-purple-500 bg-purple-50' :
                canExecute ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'
              } hover:shadow-md`
            }, [
              React.createElement('div', {
                key: 'command-header',
                onClick: () => setSelectedCommand(isSelected ? null : command),
                className: 'p-3'
              }, [
                React.createElement('div', {
                  key: 'command-info',
                  className: 'flex items-center justify-between'
                }, [
                  React.createElement('div', {
                    key: 'left-info',
                    className: 'flex items-center space-x-3'
                  }, [
                    React.createElement('span', {
                      key: 'icon',
                      className: 'text-xl'
                    }, getCommandIcon(command)),
                    
                    React.createElement('div', {
                      key: 'details'
                    }, [
                      React.createElement('div', {
                        key: 'description',
                        className: `font-medium ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`
                      }, command.description),
                      
                      React.createElement('div', {
                        key: 'metadata',
                        className: 'flex items-center space-x-2 text-xs text-gray-500 mt-1'
                      }, [
                        React.createElement('span', {
                          key: 'time'
                        }, formatTimestamp(command.timestamp)),
                        
                        React.createElement('span', {
                          key: 'category',
                          className: `px-2 py-0.5 rounded-full ${getCategoryColor(getCommandCategory(command))}`
                        }, getCommandCategory(command)),
                        
                        command.metadata?.isComposite && React.createElement('span', {
                          key: 'composite',
                          className: 'px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full'
                        }, `${command.metadata.commandCount || 'Multiple'} ops`)
                      ])
                    ])
                  ]),
                  
                  React.createElement('div', {
                    key: 'right-info',
                    className: 'flex items-center space-x-2'
                  }, [
                    isCurrent && React.createElement('span', {
                      key: 'current',
                      className: 'text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full'
                    }, 'Current'),
                    
                    React.createElement('button', {
                      key: 'jump-btn',
                      onClick: (e) => {
                        e.stopPropagation();
                        handleJumpToCommand(command.index);
                      },
                      className: 'px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity',
                      disabled: isCurrent
                    }, 'Jump Here')
                  ])
                ])
              ]),
              
              // Expanded details
              isSelected && React.createElement('div', {
                key: 'expanded-details',
                className: 'border-t border-gray-200 p-3 bg-gray-50'
              }, [
                React.createElement('div', {
                  key: 'details-grid',
                  className: 'grid grid-cols-2 gap-4 text-sm'
                }, [
                  React.createElement('div', {
                    key: 'left-details'
                  }, [
                    React.createElement('h4', {
                      key: 'details-title',
                      className: 'font-semibold mb-2'
                    }, 'Command Details'),
                    
                    React.createElement('div', {
                      key: 'id',
                      className: 'mb-1'
                    }, [
                      React.createElement('span', {
                        key: 'label',
                        className: 'text-gray-600'
                      }, 'ID: '),
                      React.createElement('code', {
                        key: 'value',
                        className: 'text-xs bg-gray-200 px-1 rounded'
                      }, command.id)
                    ]),
                    
                    command.metadata?.nodeId && React.createElement('div', {
                      key: 'node-id',
                      className: 'mb-1'
                    }, [
                      React.createElement('span', {
                        key: 'label',
                        className: 'text-gray-600'
                      }, 'Node: '),
                      React.createElement('code', {
                        key: 'value',
                        className: 'text-xs bg-gray-200 px-1 rounded'
                      }, command.metadata.nodeId)
                    ]),
                    
                    React.createElement('div', {
                      key: 'executed',
                      className: 'mb-1'
                    }, [
                      React.createElement('span', {
                        key: 'label',
                        className: 'text-gray-600'
                      }, 'Status: '),
                      React.createElement('span', {
                        key: 'value',
                        className: command.executed ? 'text-green-600' : 'text-gray-500'
                      }, command.executed ? 'Executed' : 'Pending')
                    ])
                  ]),
                  
                  React.createElement('div', {
                    key: 'right-details'
                  }, [
                    React.createElement('h4', {
                      key: 'metadata-title',
                      className: 'font-semibold mb-2'
                    }, 'Metadata'),
                    
                    React.createElement('pre', {
                      key: 'metadata-json',
                      className: 'text-xs bg-gray-200 p-2 rounded overflow-auto max-h-20'
                    }, JSON.stringify(command.metadata, null, 2))
                  ])
                ])
              ])
            ]);
          }))
        ]),

        // Statistics Panel
        showStats && historyData && React.createElement('div', {
          key: 'stats-panel',
          className: 'w-1/3 border-l border-gray-200 p-4 bg-gray-50'
        }, [
          React.createElement('h3', {
            key: 'stats-title',
            className: 'font-bold mb-4'
          }, 'Statistics'),
          
          React.createElement('div', {
            key: 'stats-grid',
            className: 'space-y-3'
          }, [
            React.createElement('div', {
              key: 'basic-stats',
              className: 'bg-white p-3 rounded border'
            }, [
              React.createElement('h4', {
                key: 'basic-title',
                className: 'font-semibold mb-2 text-sm'
              }, 'Command History'),
              
              React.createElement('div', {
                key: 'basic-items',
                className: 'space-y-1 text-sm'
              }, [
                React.createElement('div', {
                  key: 'total'
                }, `Total Commands: ${historyData.stats.totalCommands}`),
                React.createElement('div', {
                  key: 'undo'
                }, `Undo Operations: ${historyData.stats.undoOperations}`),
                React.createElement('div', {
                  key: 'redo'
                }, `Redo Operations: ${historyData.stats.redoOperations}`),
                React.createElement('div', {
                  key: 'success'
                }, `Success Rate: ${historyData.stats.successRate || 100}%`)
              ])
            ]),
            
            historyData.stats.groupCount > 0 && React.createElement('div', {
              key: 'grouping-stats',
              className: 'bg-white p-3 rounded border'
            }, [
              React.createElement('h4', {
                key: 'grouping-title',
                className: 'font-semibold mb-2 text-sm'
              }, 'Command Grouping'),
              
              React.createElement('div', {
                key: 'grouping-items',
                className: 'space-y-1 text-sm'
              }, [
                React.createElement('div', {
                  key: 'groups'
                }, `Groups: ${historyData.stats.groupCount}`),
                React.createElement('div', {
                  key: 'merged'
                }, `Merged: ${historyData.stats.mergedCommands}`),
                React.createElement('div', {
                  key: 'avg'
                }, `Avg per Group: ${historyData.stats.averageCommandsPerGroup}`)
              ])
            ]),
            
            React.createElement('div', {
              key: 'memory-stats',
              className: 'bg-white p-3 rounded border'
            }, [
              React.createElement('h4', {
                key: 'memory-title',
                className: 'font-semibold mb-2 text-sm'
              }, 'Memory Usage'),
              
              React.createElement('div', {
                key: 'memory-items',
                className: 'space-y-1 text-sm'
              }, [
                React.createElement('div', {
                  key: 'history-size'
                }, `History Size: ${historyData.stats.historySize}`),
                React.createElement('div', {
                  key: 'memory'
                }, `Memory: ${historyData.stats.memoryUsage}KB`),
                React.createElement('div', {
                  key: 'snapshots'
                }, `Snapshots: ${historyData.stats.snapshotSize || 0}`)
              ])
            ])
          ])
        ])
      ])
    ])
  ]);
}