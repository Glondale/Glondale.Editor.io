import React, { useState, useMemo, useCallback, memo } from "https://esm.sh/react@18";

/**
 * InventoryDisplay.js - Player inventory UI component
 * 
 * Features:
 * - Categorized inventory display with filtering
 * - Item usage and interaction
 * - Search and sorting functionality
 * - Responsive grid layout
 * - Item tooltips and descriptions
 * 
 * Integration Points:
 * - InventoryManager: Core inventory operations
 * - StatsPanel: Integration with player stats display
 * - GameScreen: Main game interface component
 * - SaveSystem: Inventory state persistence
 */

export const InventoryDisplay = memo(function InventoryDisplay({ 
  inventoryData = null,
  onItemUse = null,
  onItemSelect = null,
  className = '',
  compact = false,
  showSearch = true,
  showCategories = true,
  maxHeight = '400px'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);

  // Process inventory data
  const processedInventory = useMemo(() => {
    if (!inventoryData || inventoryData.isEmpty) {
      return {
        categories: new Map(),
        totalItems: 0,
        totalValue: 0,
        categoryCount: 0
      };
    }

    return inventoryData;
  }, [inventoryData]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let items = [];

    // Collect items from categories
    processedInventory.categories.forEach((categoryData, categoryName) => {
      if (selectedCategory === 'all' || selectedCategory === categoryName) {
        categoryData.items.forEach(item => {
          items.push({
            ...item,
            category: categoryName,
            categoryDisplayName: categoryData.name
          });
        });
      }
    });

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.item.name.toLowerCase().includes(searchLower) ||
        (item.item.description && item.item.description.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    items.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.item.name.localeCompare(b.item.name);
        case 'quantity':
          return b.quantity - a.quantity;
        case 'value':
          return (b.item.value || 0) - (a.item.value || 0);
        case 'category':
          return a.categoryDisplayName.localeCompare(b.categoryDisplayName);
        case 'recent':
          return b.acquiredAt - a.acquiredAt;
        default:
          return 0;
      }
    });

    return items;
  }, [processedInventory, selectedCategory, searchTerm, sortBy]);

  // Handle item interaction
  const handleItemClick = useCallback((item, event) => {
    event.preventDefault();
    setSelectedItem(selectedItem?.id === item.id ? null : item);
    
    if (onItemSelect) {
      onItemSelect(item);
    }
  }, [selectedItem, onItemSelect]);

  // Handle item usage
  const handleItemUse = useCallback((item) => {
    if (onItemUse && item.item.consumable) {
      onItemUse(item.id, 1);
    }
  }, [onItemUse]);

  // Get category list for filter
  const categoryList = useMemo(() => {
    const categories = [{ value: 'all', label: 'All Items', count: filteredItems.length }];
    
    processedInventory.categories.forEach((categoryData, categoryName) => {
      categories.push({
        value: categoryName,
        label: categoryData.name,
        count: categoryData.items.length
      });
    });

    return categories;
  }, [processedInventory, filteredItems.length]);

  // Empty state
  if (!inventoryData || inventoryData.isEmpty) {
    return React.createElement('div', {
      className: `inventory-display ${className}`,
      style: { maxHeight }
    },
      React.createElement('div', {
        className: 'flex flex-col items-center justify-center p-8 text-gray-500'
      },
        React.createElement('div', {
          className: 'text-4xl mb-4'
        }, '🎒'),
        React.createElement('h3', {
          className: 'text-lg font-medium mb-2'
        }, 'Empty Inventory'),
        React.createElement('p', {
          className: 'text-sm text-center'
        }, 'You haven\'t collected any items yet.')
      )
    );
  }

  return React.createElement('div', {
    className: `inventory-display ${className}`,
    style: { maxHeight }
  },
    // Header with search and filters
    !compact && React.createElement('div', {
      className: 'inventory-header mb-4'
    },
      // Title and summary
      React.createElement('div', {
        className: 'flex justify-between items-center mb-3'
      },
        React.createElement('h3', {
          className: 'text-lg font-medium text-gray-900'
        }, 'Inventory'),
        React.createElement('div', {
          className: 'text-sm text-gray-600'
        },
          `${processedInventory.totalItems} items`,
          processedInventory.totalValue > 0 && ` • ${processedInventory.totalValue} value`
        )
      ),

      // Search and filters
      React.createElement('div', {
        className: 'flex flex-col sm:flex-row gap-3'
      },
        // Search
        showSearch && React.createElement('div', {
          className: 'flex-1'
        },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search items...',
            value: searchTerm,
            onChange: (e) => setSearchTerm(e.target.value),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
          })
        ),

        // Category filter
        showCategories && React.createElement('div', {
          className: 'sm:w-48'
        },
          React.createElement('select', {
            value: selectedCategory,
            onChange: (e) => setSelectedCategory(e.target.value),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
          },
            categoryList.map(category =>
              React.createElement('option', {
                key: category.value,
                value: category.value
              }, `${category.label} (${category.count})`)
            )
          )
        ),

        // Sort
        React.createElement('div', {
          className: 'sm:w-32'
        },
          React.createElement('select', {
            value: sortBy,
            onChange: (e) => setSortBy(e.target.value),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
          },
            React.createElement('option', { value: 'name' }, 'Name'),
            React.createElement('option', { value: 'quantity' }, 'Quantity'),
            React.createElement('option', { value: 'value' }, 'Value'),
            React.createElement('option', { value: 'category' }, 'Category'),
            React.createElement('option', { value: 'recent' }, 'Recent')
          )
        )
      )
    ),

    // Items grid
    React.createElement('div', {
      className: 'inventory-grid overflow-y-auto',
      style: { maxHeight: compact ? maxHeight : 'calc(100% - 120px)' }
    },
      filteredItems.length === 0 ?
        React.createElement('div', {
          className: 'flex flex-col items-center justify-center p-8 text-gray-500'
        },
          React.createElement('div', {
            className: 'text-2xl mb-2'
          }, '🔍'),
          React.createElement('p', null, 
            searchTerm ? `No items match "${searchTerm}"` : 'No items in this category'
          )
        ) :

        React.createElement('div', {
          className: `grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`
        },
          filteredItems.map((item, index) =>
            React.createElement(InventoryItem, {
              key: `${item.id}_${index}`,
              item,
              isSelected: selectedItem?.id === item.id,
              isCompact: compact,
              onClick: handleItemClick,
              onUse: handleItemUse,
              onMouseEnter: () => setShowTooltip(item.id),
              onMouseLeave: () => setShowTooltip(null),
              showTooltip: showTooltip === item.id
            })
          )
        )
    ),

    // Selected item details (if not compact)
    !compact && selectedItem && React.createElement(ItemDetails, {
      item: selectedItem,
      onUse: handleItemUse,
      onClose: () => setSelectedItem(null)
    })
  );
});

// Individual inventory item component
const InventoryItem = memo(function InventoryItem({ 
  item, 
  isSelected, 
  isCompact, 
  onClick, 
  onUse, 
  onMouseEnter, 
  onMouseLeave,
  showTooltip 
}) {
  const handleClick = useCallback((e) => {
    onClick(item, e);
  }, [item, onClick]);

  const handleUse = useCallback((e) => {
    e.stopPropagation();
    onUse(item);
  }, [item, onUse]);

  return React.createElement('div', {
    className: `inventory-item relative cursor-pointer border rounded-lg p-3 transition-all duration-200 ${
      isSelected 
        ? 'border-blue-500 bg-blue-50 shadow-md' 
        : 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm'
    }`,
    onClick: handleClick,
    onMouseEnter: onMouseEnter,
    onMouseLeave: onMouseLeave
  },
    React.createElement('div', {
      className: 'flex items-start gap-3'
    },
      // Item icon/image
      React.createElement('div', {
        className: `flex-shrink-0 w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-lg ${
          getRarityColor(item.item.rarity)
        }`
      },
        item.item.icon || getItemIcon(item.item.category)
      ),

      // Item details
      React.createElement('div', {
        className: 'flex-1 min-w-0'
      },
        React.createElement('div', {
          className: 'flex justify-between items-start'
        },
          React.createElement('h4', {
            className: 'font-medium text-gray-900 truncate'
          }, item.item.name),
          
          item.quantity > 1 && React.createElement('span', {
            className: 'text-sm font-medium text-gray-600 ml-2'
          }, `×${item.quantity}`)
        ),

        !isCompact && React.createElement('div', {
          className: 'mt-1'
        },
          item.item.description && React.createElement('p', {
            className: 'text-sm text-gray-600 line-clamp-2'
          }, item.item.description),

          React.createElement('div', {
            className: 'flex items-center justify-between mt-2'
          },
            React.createElement('span', {
              className: 'text-xs text-gray-500'
            }, item.categoryDisplayName),

            item.item.value > 0 && React.createElement('span', {
              className: 'text-xs text-gray-500'
            }, `${item.item.value} value`)
          )
        ),

        // Action buttons
        React.createElement('div', {
          className: 'flex gap-2 mt-2'
        },
          item.item.consumable && React.createElement('button', {
            onClick: handleUse,
            className: 'px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors'
          }, 'Use'),

          item.item.equipable && React.createElement('button', {
            onClick: (e) => { e.stopPropagation(); /* handle equip */ },
            className: 'px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
          }, 'Equip')
        )
      )
    ),

    // Tooltip
    showTooltip && React.createElement(ItemTooltip, {
      item: item.item,
      quantity: item.quantity
    })
  );
});

// Item details panel
const ItemDetails = memo(function ItemDetails({ item, onUse, onClose}) {
  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
  },
    React.createElement('div', {
      className: 'bg-white rounded-lg p-6 max-w-md w-full max-h-screen overflow-y-auto'
    },
      // Header
      React.createElement('div', {
        className: 'flex justify-between items-start mb-4'
      },
        React.createElement('h3', {
          className: 'text-lg font-medium text-gray-900'
        }, item.item.name),
        React.createElement('button', {
          onClick: onClose,
          className: 'text-gray-400 hover:text-gray-600'
        }, '✕')
      ),

      // Item info
      React.createElement('div', {
        className: 'space-y-4'
      },
        React.createElement('div', {
          className: 'flex items-center gap-4'
        },
          React.createElement('div', {
            className: `w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-2xl ${
              getRarityColor(item.item.rarity)
            }`
          }, item.item.icon || getItemIcon(item.item.category)),

          React.createElement('div', null,
            React.createElement('div', {
              className: 'font-medium'
            }, `Quantity: ${item.quantity}`),
            item.item.value > 0 && React.createElement('div', {
              className: 'text-sm text-gray-600'
            }, `Value: ${item.item.value} each`),
            React.createElement('div', {
              className: 'text-sm text-gray-600'
            }, `Category: ${item.categoryDisplayName}`)
          )
        ),

        item.item.description && React.createElement('div', null,
          React.createElement('h4', {
            className: 'font-medium mb-2'
          }, 'Description'),
          React.createElement('p', {
            className: 'text-sm text-gray-700'
          }, item.item.description)
        ),

        item.item.effects && React.createElement('div', null,
          React.createElement('h4', {
            className: 'font-medium mb-2'
          }, 'Effects'),
          React.createElement('ul', {
            className: 'text-sm text-gray-700 space-y-1'
          },
            item.item.effects.map((effect, index) =>
              React.createElement('li', {
                key: index,
                className: 'flex justify-between'
              },
                React.createElement('span', null, effect.target),
                React.createElement('span', null, `${effect.value > 0 ? '+' : ''}${effect.value}`)
              )
            )
          )
        )
      ),

      // Actions
      React.createElement('div', {
        className: 'flex gap-2 mt-6'
      },
        item.item.consumable && React.createElement('button', {
          onClick: () => onUse(item),
          className: 'flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
        }, 'Use Item'),

        item.item.equipable && React.createElement('button', {
          onClick: () => { /* handle equip */ },
          className: 'flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
        }, 'Equip')
      )
    )
  );
});

// Item tooltip component
const ItemTooltip = memo(function ItemTooltip({ item, quantity }) {
  return React.createElement('div', {
    className: 'absolute z-10 bg-gray-900 text-white text-sm rounded-lg p-3 shadow-lg pointer-events-none',
    style: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px',
      minWidth: '200px'
    }
  },
    React.createElement('div', {
      className: 'font-medium mb-1'
    }, item.name),
    
    quantity > 1 && React.createElement('div', {
      className: 'text-gray-300 text-xs mb-2'
    }, `Quantity: ${quantity}`),

    item.description && React.createElement('div', {
      className: 'text-gray-300 text-xs mb-2'
    }, item.description),

    React.createElement('div', {
      className: 'flex justify-between text-xs'
    },
      React.createElement('span', null, item.category || 'misc'),
      item.value > 0 && React.createElement('span', null, `${item.value} value`)
    ),

    // Tooltip arrow
    React.createElement('div', {
      className: 'absolute top-full left-1/2 transform -translate-x-1/2',
      style: {
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #1f2937'
      }
    })
  );
});

// Helper functions
export function getItemIcon(category) {
  const icons = {
    weapon: '⚔️',
    armor: '🛡️',
    consumable: '🧪',
    tool: '🔧',
    key: '🗝️',
    misc: '📦'
  };
  
  return icons[category] || icons.misc;
}

export function getRarityColor(rarity) {
  switch (rarity) {
    case 'common':
      return 'bg-gray-200';
    case 'uncommon':
      return 'bg-green-200';
    case 'rare':
      return 'bg-blue-200';
    case 'epic':
      return 'bg-purple-200';
    case 'legendary':
      return 'bg-yellow-200';
    default:
      return 'bg-gray-200';
  }
}