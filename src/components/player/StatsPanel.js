 
const { useState, createElement } = React;

export function StatsPanel({ 
  stats, 
  visitedScenes, 
  totalScenes, 
  progressPercent,
  className = '' 
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return createElement('div', {
    className: `bg-gray-50 border rounded-lg ${className}`
  }, [
    // Header
    createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100',
      onClick: () => setIsCollapsed(!isCollapsed)
    }, [
      createElement('h3', {
        key: 'title',
        className: 'font-semibold text-gray-800'
      }, 'Character Stats'),
      createElement('button', {
        key: 'toggle',
        className: 'text-gray-500 hover:text-gray-700'
      }, isCollapsed ? '▼' : '▲')
    ]),

    // Content
    !isCollapsed && createElement('div', {
      key: 'content',
      className: 'px-4 pb-4 space-y-4'
    }, [
      // Progress
      createElement('div', {
        key: 'progress'
      }, [
        createElement('div', {
          key: 'progress-header',
          className: 'flex justify-between text-sm text-gray-600 mb-1'
        }, [
          createElement('span', { key: 'label' }, 'Progress'),
          createElement('span', { key: 'count' }, `${visitedScenes}/${totalScenes} scenes`)
        ]),
        createElement('div', {
          key: 'progress-bar',
          className: 'w-full bg-gray-200 rounded-full h-2'
        }, createElement('div', {
          className: 'bg-blue-600 h-2 rounded-full transition-all duration-300',
          style: { width: `${progressPercent}%` }
        })),
        createElement('div', {
          key: 'progress-text',
          className: 'text-xs text-gray-500 mt-1'
        }, `${progressPercent}% complete`)
      ]),

      // Stats
      stats.length > 0 && createElement('div', {
        key: 'stats',
        className: 'space-y-2'
      }, [
        createElement('h4', {
          key: 'stats-title',
          className: 'text-sm font-medium text-gray-700 border-b pb-1'
        }, 'Stats'),
        ...stats.map(stat => 
          createElement(StatItem, {
            key: stat.id,
            stat
          })
        )
      ]),

      stats.length === 0 && createElement('p', {
        key: 'no-stats',
        className: 'text-sm text-gray-500 text-center py-2'
      }, 'No stats to display')
    ])
  ]);
}

function StatItem({ stat }) {
  const renderStatValue = () => {
    switch (stat.type) {
      case 'number':
        return createElement('div', {
          className: 'flex items-center space-x-2'
        }, [
          createElement('span', {
            key: 'value',
            className: 'font-mono'
          }, stat.value),
          typeof stat.value === 'number' && stat.value > 0 && createElement('div', {
            key: 'bar',
            className: 'flex-1 bg-gray-200 rounded-full h-1 max-w-[60px]'
          }, createElement('div', {
            className: 'bg-green-500 h-1 rounded-full',
            style: { width: `${Math.min((stat.value / 100) * 100, 100)}%` }
          }))
        ]);
      case 'boolean':
        return createElement('span', {
          className: `px-2 py-1 rounded text-xs font-medium ${
            stat.value 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`
        }, stat.value ? 'Yes' : 'No');
      default:
        return createElement('span', {
          className: 'font-mono'
        }, String(stat.value));
    }
  };

  return createElement('div', {
    className: 'flex items-center justify-between text-sm'
  }, [
    createElement('span', {
      key: 'name',
      className: 'text-gray-700'
    }, stat.name),
    createElement('div', {
      key: 'value'
    }, renderStatValue())
  ]);
}