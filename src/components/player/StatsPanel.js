// StatsPanel.js - Enhanced with Phase 3 advanced features
import { InventoryDisplay } from './InventoryDisplay.js';

const { useState, createElement } = React;

export function StatsPanel({ 
  stats, 
  inventory = [],
  inventoryState = {},
  achievements = [],
  secretsDiscovered = [],
  visitedScenes, 
  totalScenes, 
  progressPercent,
  gameplayMetrics = {},
  className = '',
  showInventory = true,
  showAchievements = true,
  showSecrets = true,
  showAnalytics = false
}) {
  const [activeTab, setActiveTab] = useState('stats');
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  const toggleSection = (section) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Group stats by category
  const statsByCategory = stats.reduce((acc, stat) => {
    const category = stat.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(stat);
    return acc;
  }, {});

  const categories = Object.keys(statsByCategory).sort();

  // Tab configuration
  const tabs = [
    { id: 'stats', label: 'Stats', icon: '📊', count: stats.length },
    showInventory && inventory.length > 0 && { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: '🎒', 
      count: inventory.reduce((sum, item) => sum + item.count, 0) 
    },
    showAchievements && achievements.length > 0 && { 
      id: 'achievements', 
      label: 'Achievements', 
      icon: '🏆', 
      count: achievements.length 
    },
    showSecrets && secretsDiscovered.length > 0 && { 
      id: 'secrets', 
      label: 'Secrets', 
      icon: '✨', 
      count: secretsDiscovered.length 
    },
    showAnalytics && { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: '📈', 
      count: null 
    }
  ].filter(Boolean);

  return createElement('div', {
    className: `bg-gray-50 border rounded-lg overflow-hidden ${className}`
  }, [
    // Tab Header
    tabs.length > 1 && createElement('div', {
      key: 'tab-header',
      className: 'flex border-b bg-white'
    }, tabs.map(tab =>
      createElement('button', {
        key: tab.id,
        className: `flex-1 px-3 py-2 text-sm font-medium transition-colors ${
          activeTab === tab.id
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
        }`,
        onClick: () => setActiveTab(tab.id)
      }, [
        createElement('span', { key: 'icon' }, tab.icon),
        createElement('span', { key: 'label', className: 'ml-1' }, tab.label),
        tab.count !== null && createElement('span', {
          key: 'count',
          className: 'ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full'
        }, tab.count)
      ])
    )),

    // Content Area
    createElement('div', {
      key: 'content',
      className: 'p-4'
    }, [
      // Progress Section (always visible)
      createElement('div', {
        key: 'progress',
        className: 'mb-4 pb-4 border-b'
      }, [
        createElement('div', {
          key: 'progress-header',
          className: 'flex justify-between items-center mb-2'
        }, [
          createElement('h4', {
            key: 'title',
            className: 'text-sm font-medium text-gray-700'
          }, 'Adventure Progress'),
          createElement('span', {
            key: 'percentage',
            className: `text-sm font-medium ${progressPercent === 100 ? 'text-green-600' : 'text-blue-600'}`
          }, `${progressPercent}%`)
        ]),
        createElement('div', {
          key: 'progress-bar',
          className: 'w-full bg-gray-200 rounded-full h-2 mb-1'
        }, createElement('div', {
          className: `h-2 rounded-full transition-all duration-300 ${
            progressPercent === 100 ? 'bg-green-600' : 'bg-blue-600'
          }`,
          style: { width: `${progressPercent}%` }
        })),
        createElement('div', {
          key: 'progress-details',
          className: 'flex justify-between text-xs text-gray-500'
        }, [
          createElement('span', { key: 'scenes' }, `${visitedScenes}/${totalScenes} scenes`),
          progressPercent === 100 && createElement('span', { 
            key: 'complete',
            className: 'text-green-600 font-medium'
          }, '✓ Complete')
        ])
      ]),

      // Tab Content
      activeTab === 'stats' && createElement('div', {
        key: 'stats-content',
        className: 'space-y-4'
      }, [
        categories.length > 0 ? categories.map(category =>
          createElement('div', {
            key: category,
            className: 'space-y-2'
          }, [
            createElement('div', {
              key: 'category-header',
              className: 'flex items-center justify-between cursor-pointer',
              onClick: () => toggleSection(`stats-${category}`)
            }, [
              createElement('h4', {
                key: 'title',
                className: 'text-sm font-medium text-gray-700 capitalize'
              }, category.replace('_', ' ')),
              createElement('button', {
                key: 'toggle',
                className: 'text-gray-400 hover:text-gray-600'
              }, collapsedSections.has(`stats-${category}`) ? '▶' : '▼')
            ]),
            !collapsedSections.has(`stats-${category}`) && createElement('div', {
              key: 'category-stats',
              className: 'space-y-2 ml-2'
            }, statsByCategory[category].map(stat =>
              createElement(StatItem, {
                key: stat.id,
                stat
              })
            ))
          ])
        ) : createElement('p', {
          key: 'no-stats',
          className: 'text-sm text-gray-500 text-center py-4'
        }, 'No stats to display')
      ]),

      activeTab === 'inventory' && createElement(InventoryDisplay, {
        key: 'inventory-content',
        inventory: inventory,
        inventoryState: inventoryState,
        showCategories: true,
        showSearch: true,
        showTooltips: true,
        className: 'bg-transparent border-0 p-0'
      }),

      activeTab === 'achievements' && createElement('div', {
        key: 'achievements-content',
        className: 'space-y-3'
      }, [
        achievements.length > 0 ? achievements.map(achievement =>
          createElement(AchievementItem, {
            key: achievement.id,
            achievement
          })
        ) : createElement('p', {
          key: 'no-achievements',
          className: 'text-sm text-gray-500 text-center py-4'
        }, 'No achievements unlocked yet')
      ]),

      activeTab === 'secrets' && createElement('div', {
        key: 'secrets-content',
        className: 'space-y-3'
      }, [
        secretsDiscovered.length > 0 ? secretsDiscovered.map((secret, index) =>
          createElement(SecretItem, {
            key: `${secret.sceneId}-${secret.choiceId}-${index}`,
            secret,
            index: index + 1
          })
        ) : createElement('p', {
          key: 'no-secrets',
          className: 'text-sm text-gray-500 text-center py-4'
        }, 'No secrets discovered yet')
      ]),

      activeTab === 'analytics' && createElement('div', {
        key: 'analytics-content',
        className: 'space-y-4'
      }, [
        createElement(AnalyticsSection, {
          key: 'analytics',
          metrics: gameplayMetrics,
          achievements: achievements,
          secrets: secretsDiscovered,
          visitedScenes: visitedScenes
        })
      ])
    ])
  ]);
}

function StatItem({ stat }) {
  const renderStatValue = () => {
    // Use displayValue if available (from custom stat types)
    const displayValue = stat.displayValue || stat.value;
    
    switch (stat.type) {
      case 'number':
        return createElement('div', {
          className: 'flex items-center space-x-2'
        }, [
          createElement('span', {
            key: 'value',
            className: 'font-mono text-sm'
          }, displayValue),
          // Show progress bar for stats with min/max
          stat.max !== undefined && createElement('div', {
            key: 'bar',
            className: 'flex-1 bg-gray-200 rounded-full h-1.5 max-w-[60px]',
            title: `${stat.value}/${stat.max}`
          }, createElement('div', {
            className: `h-1.5 rounded-full transition-all duration-300 ${
              stat.value === stat.max ? 'bg-green-500' : 
              stat.value > (stat.max * 0.7) ? 'bg-blue-500' :
              stat.value > (stat.max * 0.3) ? 'bg-yellow-500' : 'bg-red-500'
            }`,
            style: { width: `${Math.min((stat.value / stat.max) * 100, 100)}%` }
          }))
        ]);
      
      case 'boolean':
        return createElement('span', {
          className: `px-2 py-0.5 rounded-full text-xs font-medium ${
            stat.value 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`
        }, stat.value ? '✓ Yes' : '✗ No');
      
      case 'percentage':
        return createElement('div', {
          className: 'flex items-center space-x-2'
        }, [
          createElement('span', {
            key: 'value',
            className: 'font-mono text-sm'
          }, displayValue),
          createElement('div', {
            key: 'bar',
            className: 'flex-1 bg-gray-200 rounded-full h-1.5 max-w-[60px]'
          }, createElement('div', {
            className: 'bg-blue-500 h-1.5 rounded-full transition-all duration-300',
            style: { width: `${Math.min(stat.value, 100)}%` }
          }))
        ]);
      
      case 'currency':
      case 'time':
        return createElement('span', {
          className: 'font-mono text-sm'
        }, displayValue);
      
      default:
        return createElement('span', {
          className: 'text-sm'
        }, String(displayValue));
    }
  };

  return createElement('div', {
    className: 'flex items-center justify-between text-sm py-1',
    title: stat.description
  }, [
    createElement('span', {
      key: 'name',
      className: 'text-gray-700 flex items-center space-x-1'
    }, [
      createElement('span', { key: 'text' }, stat.name),
      stat.description && createElement('span', {
        key: 'info',
        className: 'text-gray-400 text-xs',
        title: stat.description
      }, 'ⓘ')
    ]),
    createElement('div', {
      key: 'value',
      className: 'flex items-center'
    }, renderStatValue())
  ]);
}

function AchievementItem({ achievement }) {
  const isComplete = achievement.progress >= 1.0;
  
  return createElement('div', {
    className: `p-3 rounded-lg border ${
      isComplete ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
    }`
  }, [
    createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between mb-1'
    }, [
      createElement('span', {
        key: 'name',
        className: `font-medium text-sm ${
          isComplete ? 'text-yellow-800' : 'text-gray-800'
        }`
      }, achievement.name || achievement.id),
      createElement('span', {
        key: 'icon',
        className: 'text-lg'
      }, isComplete ? '🏆' : '🔓')
    ]),
    achievement.description && createElement('p', {
      key: 'description',
      className: 'text-xs text-gray-600 mb-2'
    }, achievement.description),
    achievement.progress < 1.0 && createElement('div', {
      key: 'progress',
      className: 'w-full bg-gray-200 rounded-full h-1'
    }, createElement('div', {
      className: 'bg-yellow-500 h-1 rounded-full transition-all duration-300',
      style: { width: `${(achievement.progress * 100)}%` }
    }))
  ]);
}

function SecretItem({ secret, index }) {
  const timeAgo = new Date(secret.timestamp).toLocaleString();
  
  return createElement('div', {
    className: 'p-3 rounded-lg bg-purple-50 border border-purple-200'
  }, [
    createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between mb-1'
    }, [
      createElement('span', {
        key: 'number',
        className: 'text-sm font-medium text-purple-800'
      }, `Secret #${index}`),
      createElement('span', {
        key: 'icon',
        className: 'text-purple-600'
      }, '✨')
    ]),
    createElement('p', {
      key: 'text',
      className: 'text-sm text-purple-700 mb-1 italic'
    }, `"${secret.choiceText}"`),
    createElement('p', {
      key: 'details',
      className: 'text-xs text-purple-600'
    }, `Discovered ${timeAgo}`)
  ]);
}

function AnalyticsSection({ metrics, achievements, secrets, visitedScenes }) {
  const analyticsData = [
    { label: 'Choices Made', value: metrics.totalChoicesMade || 0, icon: '🎯' },
    { label: 'Scenes Visited', value: visitedScenes || 0, icon: '🗺️' },
    { label: 'Secrets Found', value: secrets.length || 0, icon: '✨' },
    { label: 'Achievements', value: achievements.length || 0, icon: '🏆' },
    { label: 'Completion', value: `${metrics.completionPercentage || 0}%`, icon: '📊' },
    { label: 'Avg Choices/Scene', value: (metrics.averageChoicesPerScene || 0).toFixed(1), icon: '⚖️' }
  ];

  return createElement('div', {
    className: 'space-y-3'
  }, [
    createElement('h4', {
      key: 'title',
      className: 'text-sm font-medium text-gray-700 mb-3'
    }, 'Gameplay Analytics'),
    createElement('div', {
      key: 'grid',
      className: 'grid grid-cols-2 gap-3'
    }, analyticsData.map((item, index) =>
      createElement('div', {
        key: index,
        className: 'p-2 bg-white border rounded-lg'
      }, [
        createElement('div', {
          key: 'icon',
          className: 'text-center text-lg mb-1'
        }, item.icon),
        createElement('div', {
          key: 'value',
          className: 'text-center text-sm font-medium text-gray-800'
        }, item.value),
        createElement('div', {
          key: 'label',
          className: 'text-center text-xs text-gray-600'
        }, item.label)
      ])
    ))
  ]);
}