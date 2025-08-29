 /**
 * InventoryEditor.js - Adventure inventory management for editors
 * 
 * Features:
 * - Item definition creation and editing
 * - Category management and organization
 * - Item effects and properties configuration
 * - Bulk import/export functionality
 * - Real-time validation and preview
 * 
 * Integration Points:
 * - InventoryManager: Item definitions and validation
 * - EditorScreen: Adventure inventory configuration
 * - AdvancedChoiceDialog: Item-based actions
 * - ExportableDataManager: Item data export
 */

import React, { useState, useCallback, useMemo, useEffect } from 'https://esm.sh/react@18';

export function InventoryEditor({ 
  items = [], 
  onItemsChange,
  isOpen = false,
  onClose,
  className = ''
}) {
  const [editingItem, setEditingItem] = useState(null);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [validationErrors, setValidationErrors] = useState(new Map());

  // Item categories with metadata
  const itemCategories = useMemo(() => ({
    weapon: { name: 'Weapons', icon: '⚔️', color: 'bg-red-100 text-red-800' },
    armor: { name: 'Armor', icon: '🛡️', color: 'bg-blue-100 text-blue-800' },
    consumable: { name: 'Consumables', icon: '🧪', color: 'bg-green-100 text-green-800' },
    tool: { name: 'Tools', icon: '🔧', color: 'bg-yellow-100 text-yellow-800' },
    key: { name: 'Key Items', icon: '🗝️', color: 'bg-purple-100 text-purple-800' },
    misc: { name: 'Miscellaneous', icon: '📦', color: 'bg-gray-100 text-gray-800' }
  }), []);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        item.id.toLowerCase().includes(searchLower)
      );
    }

    // Sort by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, selectedCategory, searchTerm]);

  // Validate all items
  useEffect(() => {
    const errors = new Map();
    
    items.forEach(item => {
      const itemErrors = validateItem(item, items);
      if (itemErrors.length > 0) {
        errors.set(item.id, itemErrors);
      }
    });

    setValidationErrors(errors);
  }, [items]);

  // Handle item creation
  const handleCreateItem = useCallback(() => {
    const newItem = {
      id: generateItemId(),
      name: 'New Item',
      description: '',
      category: 'misc',
      value: 0,
      maxStack: 1,
      consumable: false,
      equipable: false,
      unique: false,
      hidden: false,
      rarity: 'common',
      icon: '',
      effects: []
    };

    setEditingItem(newItem);
    setShowItemDialog(true);
  }, []);

  // Handle item editing
  const handleEditItem = useCallback((item) => {
    setEditingItem({ ...item });
    setShowItemDialog(true);
  }, []);

  // Handle item save
  const handleSaveItem = useCallback((itemData) => {
    const isNew = !items.find(item => item.id === itemData.id);
    
    if (isNew) {
      onItemsChange([...items, itemData]);
    } else {
      onItemsChange(items.map(item => 
        item.id === itemData.id ? itemData : item
      ));
    }

    setShowItemDialog(false);
    setEditingItem(null);
  }, [items, onItemsChange]);

  // Handle item deletion
  const handleDeleteItem = useCallback((itemId) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      onItemsChange(items.filter(item => item.id !== itemId));
    }
  }, [items, onItemsChange]);

  // Handle duplicate item
  const handleDuplicateItem = useCallback((item) => {
    const duplicatedItem = {
      ...item,
      id: generateItemId(),
      name: `${item.name} Copy`
    };
    
    onItemsChange([...items, duplicatedItem]);
  }, [items, onItemsChange]);

  // Handle bulk import
  const handleBulkImport = useCallback((importedItems) => {
    const validItems = importedItems.filter(item => {
      const errors = validateItem(item, [...items, ...importedItems]);
      return errors.length === 0;
    });

    onItemsChange([...items, ...validItems]);
    setShowBulkImport(false);
  }, [items, onItemsChange]);

  // Get category statistics
  const categoryStats = useMemo(() => {
    const stats = {};
    Object.keys(itemCategories).forEach(category => {
      stats[category] = items.filter(item => item.category === category).length;
    });
    return stats;
  }, [items, itemCategories]);

  if (!isOpen) return null;

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
  },
    React.createElement('div', {
      className: 'bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-screen overflow-hidden'
    },
      // Header
      React.createElement('div', {
        className: 'flex justify-between items-center p-6 border-b'
      },
        React.createElement('div', null,
          React.createElement('h2', {
            className: 'text-xl font-semibold text-gray-900'
          }, 'Inventory Editor'),
          React.createElement('p', {
            className: 'text-sm text-gray-600 mt-1'
          }, `${items.length} items defined`)
        ),
        
        React.createElement('div', {
          className: 'flex items-center gap-3'
        },
          React.createElement('button', {
            onClick: () => setShowBulkImport(true),
            className: 'px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors'
          }, 'Import'),
          
          React.createElement('button', {
            onClick: handleCreateItem,
            className: 'px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
          }, '+ Create Item'),
          
          React.createElement('button', {
            onClick: onClose,
            className: 'text-gray-400 hover:text-gray-600'
          }, '✕')
        )
      ),

      React.createElement('div', {
        className: 'flex flex-1 overflow-hidden'
      },
        // Sidebar with categories
        React.createElement('div', {
          className: 'w-64 border-r bg-gray-50 p-4 overflow-y-auto'
        },
          React.createElement('div', {
            className: 'space-y-2'
          },
            React.createElement('button', {
              onClick: () => setSelectedCategory('all'),
              className: `w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'hover:bg-gray-200'
              }`
            },
              React.createElement('div', {
                className: 'flex justify-between items-center'
              },
                React.createElement('span', null, '📋 All Items'),
                React.createElement('span', {
                  className: 'text-sm text-gray-600'
                }, items.length)
              )
            ),

            React.createElement('div', {
              className: 'border-t pt-2 mt-3'
            }),

            Object.entries(itemCategories).map(([key, category]) =>
              React.createElement('button', {
                key: key,
                onClick: () => setSelectedCategory(key),
                className: `w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === key 
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'hover:bg-gray-200'
                }`
              },
                React.createElement('div', {
                  className: 'flex justify-between items-center'
                },
                  React.createElement('span', null, `${category.icon} ${category.name}`),
                  React.createElement('span', {
                    className: 'text-sm text-gray-600'
                  }, categoryStats[key] || 0)
                )
              )
            )
          )
        ),

        // Main content area
        React.createElement('div', {
          className: 'flex-1 flex flex-col overflow-hidden'
        },
          // Search and filters
          React.createElement('div', {
            className: 'p-4 border-b'
          },
            React.createElement('input', {
              type: 'text',
              placeholder: 'Search items...',
              value: searchTerm,
              onChange: (e) => setSearchTerm(e.target.value),
              className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            })
          ),

          // Items list
          React.createElement('div', {
            className: 'flex-1 overflow-y-auto p-4'
          },
            filteredItems.length === 0 ?
              React.createElement('div', {
                className: 'flex flex-col items-center justify-center h-64 text-gray-500'
              },
                React.createElement('div', {
                  className: 'text-4xl mb-4'
                }, searchTerm ? '🔍' : '📦'),
                React.createElement('p', null, 
                  searchTerm ? `No items match "${searchTerm}"` : 'No items in this category'
                ),
                !searchTerm && selectedCategory === 'all' && React.createElement('button', {
                  onClick: handleCreateItem,
                  className: 'mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                }, 'Create your first item')
              ) :

              React.createElement('div', {
                className: 'grid gap-4'
              },
                filteredItems.map(item =>
                  React.createElement(ItemCard, {
                    key: item.id,
                    item,
                    category: itemCategories[item.category],
                    hasErrors: validationErrors.has(item.id),
                    errors: validationErrors.get(item.id) || [],
                    onEdit: () => handleEditItem(item),
                    onDelete: () => handleDeleteItem(item.id),
                    onDuplicate: () => handleDuplicateItem(item)
                  })
                )
              )
          )
        )
      ),

      // Item dialog
      showItemDialog && React.createElement(ItemDialog, {
        item: editingItem,
        categories: itemCategories,
        existingItems: items,
        onSave: handleSaveItem,
        onCancel: () => {
          setShowItemDialog(false);
          setEditingItem(null);
        }
      }),

      // Bulk import dialog
      showBulkImport && React.createElement(BulkImportDialog, {
        onImport: handleBulkImport,
        onCancel: () => setShowBulkImport(false),
        existingItems: items
      })
    )
  );
}

// Individual item card component
function ItemCard({ item, category, hasErrors, errors, onEdit, onDelete, onDuplicate }) {
  const [showErrors, setShowErrors] = useState(false);

  return React.createElement('div', {
    className: `border rounded-lg p-4 bg-white hover:shadow-md transition-shadow ${
      hasErrors ? 'border-red-300' : 'border-gray-300'
    }`
  },
    React.createElement('div', {
      className: 'flex items-start gap-4'
    },
      // Item icon
      React.createElement('div', {
        className: 'w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-xl flex-shrink-0'
      }, item.icon || category?.icon || '📦'),

      // Item details
      React.createElement('div', {
        className: 'flex-1 min-w-0'
      },
        React.createElement('div', {
          className: 'flex items-start justify-between'
        },
          React.createElement('div', null,
            React.createElement('h4', {
              className: 'font-medium text-gray-900 truncate'
            }, item.name),
            React.createElement('p', {
              className: 'text-sm text-gray-600'
            }, `ID: ${item.id}`)
          ),

          React.createElement('span', {
            className: `px-2 py-1 text-xs rounded-full ${category?.color || 'bg-gray-100 text-gray-800'}`
          }, category?.name || item.category)
        ),

        item.description && React.createElement('p', {
          className: 'text-sm text-gray-700 mt-2 line-clamp-2'
        }, item.description),

        // Item properties
        React.createElement('div', {
          className: 'flex flex-wrap gap-2 mt-3'
        },
          item.value > 0 && React.createElement('span', {
            className: 'px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded'
          }, `${item.value} value`),

          item.maxStack > 1 && React.createElement('span', {
            className: 'px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded'
          }, `Stack ${item.maxStack}`),

          item.consumable && React.createElement('span', {
            className: 'px-2 py-1 text-xs bg-green-100 text-green-800 rounded'
          }, 'Consumable'),

          item.equipable && React.createElement('span', {
            className: 'px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded'
          }, 'Equipable'),

          item.unique && React.createElement('span', {
            className: 'px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded'
          }, 'Unique'),

          item.hidden && React.createElement('span', {
            className: 'px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded'
          }, 'Hidden')
        ),

        // Effects summary
        item.effects && item.effects.length > 0 && React.createElement('div', {
          className: 'mt-2 text-sm text-gray-600'
        }, `${item.effects.length} effect${item.effects.length > 1 ? 's' : ''}`)
      ),

      // Actions menu
      React.createElement('div', {
        className: 'flex flex-col gap-1'
      },
        React.createElement('button', {
          onClick: onEdit,
          className: 'p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors'
        }, '✏️'),
        
        React.createElement('button', {
          onClick: onDuplicate,
          className: 'p-2 text-green-600 hover:bg-green-50 rounded transition-colors'
        }, '📋'),
        
        React.createElement('button', {
          onClick: onDelete,
          className: 'p-2 text-red-600 hover:bg-red-50 rounded transition-colors'
        }, '🗑️')
      )
    ),

    // Error indicators
    hasErrors && React.createElement('div', {
      className: 'mt-3 border-t pt-3'
    },
      React.createElement('div', {
        className: 'flex items-center justify-between'
      },
        React.createElement('span', {
          className: 'text-sm text-red-600 font-medium'
        }, `${errors.length} validation error${errors.length > 1 ? 's' : ''}`),
        
        React.createElement('button', {
          onClick: () => setShowErrors(!showErrors),
          className: 'text-sm text-red-600 underline'
        }, showErrors ? 'Hide' : 'Show')
      ),

      showErrors && React.createElement('ul', {
        className: 'mt-2 text-sm text-red-600 space-y-1'
      },
        errors.map((error, index) =>
          React.createElement('li', {
            key: index,
            className: 'flex items-start'
          },
            React.createElement('span', {
              className: 'mr-2'
            }, '•'),
            error
          )
        )
      )
    )
  );
}

// Item editing dialog
function ItemDialog({ item, categories, existingItems, onSave, onCancel }) {
  const [formData, setFormData] = useState(item);
  const [activeTab, setActiveTab] = useState('basic');

  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleEffectChange = useCallback((index, field, value) => {
    setFormData(prev => ({
      ...prev,
      effects: prev.effects.map((effect, i) => 
        i === index ? { ...effect, [field]: value } : effect
      )
    }));
  }, []);

  const handleAddEffect = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      effects: [...prev.effects, { type: 'stat_add', target: '', value: 0 }]
    }));
  }, []);

  const handleRemoveEffect = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      effects: prev.effects.filter((_, i) => i !== index)
    }));
  }, []);

  const validation = useMemo(() => {
    const errors = validateItem(formData, existingItems.filter(i => i.id !== item.id));
    return {
      errors,
      isValid: errors.length === 0
    };
  }, [formData, existingItems, item.id]);

  const handleSave = useCallback(() => {
    if (validation.isValid) {
      onSave(formData);
    }
  }, [formData, validation.isValid, onSave]);

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60'
  },
    React.createElement('div', {
      className: 'bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-hidden'
    },
      // Header
      React.createElement('div', {
        className: 'flex justify-between items-center p-6 border-b'
      },
        React.createElement('h3', {
          className: 'text-lg font-semibold'
        }, item.name === 'New Item' ? 'Create Item' : 'Edit Item'),
        React.createElement('button', {
          onClick: onCancel,
          className: 'text-gray-400 hover:text-gray-600'
        }, '✕')
      ),

      // Tabs
      React.createElement('div', {
        className: 'flex border-b'
      },
        ['basic', 'properties', 'effects'].map(tab =>
          React.createElement('button', {
            key: tab,
            onClick: () => setActiveTab(tab),
            className: `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`
          }, tab.charAt(0).toUpperCase() + tab.slice(1))
        )
      ),

      // Content
      React.createElement('div', {
        className: 'p-6 max-h-96 overflow-y-auto'
      },
        activeTab === 'basic' && React.createElement(BasicItemForm, {
          formData,
          categories,
          onFieldChange: handleFieldChange
        }),

        activeTab === 'properties' && React.createElement(ItemPropertiesForm, {
          formData,
          onFieldChange: handleFieldChange
        }),

        activeTab === 'effects' && React.createElement(ItemEffectsForm, {
          effects: formData.effects || [],
          onEffectChange: handleEffectChange,
          onAddEffect: handleAddEffect,
          onRemoveEffect: handleRemoveEffect
        })
      ),

      // Footer
      React.createElement('div', {
        className: 'flex justify-between items-center p-6 border-t bg-gray-50'
      },
        React.createElement('div', null,
          validation.errors.length > 0 && React.createElement('span', {
            className: 'text-sm text-red-600'
          }, `${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''} found`)
        ),

        React.createElement('div', {
          className: 'flex gap-3'
        },
          React.createElement('button', {
            onClick: onCancel,
            className: 'px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50'
          }, 'Cancel'),
          React.createElement('button', {
            onClick: handleSave,
            disabled: !validation.isValid,
            className: `px-4 py-2 bg-blue-600 text-white rounded-md transition-colors ${
              validation.isValid ? 'hover:bg-blue-700' : 'opacity-50 cursor-not-allowed'
            }`
          }, 'Save Item')
        )
      )
    )
  );
}

// Basic item form
function BasicItemForm({ formData, categories, onFieldChange }) {
  return React.createElement('div', {
    className: 'space-y-4'
  },
    React.createElement('div', {
      className: 'grid grid-cols-2 gap-4'
    },
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Item Name *'),
        React.createElement('input', {
          type: 'text',
          value: formData.name,
          onChange: (e) => onFieldChange('name', e.target.value),
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        })
      ),

      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Item ID *'),
        React.createElement('input', {
          type: 'text',
          value: formData.id,
          onChange: (e) => onFieldChange('id', e.target.value),
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        })
      )
    ),

    React.createElement('div', null,
      React.createElement('label', {
        className: 'block text-sm font-medium text-gray-700 mb-1'
      }, 'Description'),
      React.createElement('textarea', {
        value: formData.description,
        onChange: (e) => onFieldChange('description', e.target.value),
        rows: 3,
        className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical'
      })
    ),

    React.createElement('div', {
      className: 'grid grid-cols-2 gap-4'
    },
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Category'),
        React.createElement('select', {
          value: formData.category,
          onChange: (e) => onFieldChange('category', e.target.value),
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        },
          Object.entries(categories).map(([key, category]) =>
            React.createElement('option', {
              key: key,
              value: key
            }, `${category.icon} ${category.name}`)
          )
        )
      ),

      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Icon'),
        React.createElement('input', {
          type: 'text',
          value: formData.icon,
          onChange: (e) => onFieldChange('icon', e.target.value),
          placeholder: 'Emoji or text',
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        })
      )
    )
  );
}

// Item properties form
function ItemPropertiesForm({ formData, onFieldChange }) {
  return React.createElement('div', {
    className: 'space-y-4'
  },
    React.createElement('div', {
      className: 'grid grid-cols-3 gap-4'
    },
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Value'),
        React.createElement('input', {
          type: 'number',
          value: formData.value,
          onChange: (e) => onFieldChange('value', Number(e.target.value)),
          min: 0,
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        })
      ),

      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Max Stack'),
        React.createElement('input', {
          type: 'number',
          value: formData.maxStack,
          onChange: (e) => onFieldChange('maxStack', Number(e.target.value)),
          min: 1,
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        })
      ),

      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 mb-1'
        }, 'Rarity'),
        React.createElement('select', {
          value: formData.rarity,
          onChange: (e) => onFieldChange('rarity', e.target.value),
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        },
          React.createElement('option', { value: 'common' }, 'Common'),
          React.createElement('option', { value: 'uncommon' }, 'Uncommon'),
          React.createElement('option', { value: 'rare' }, 'Rare'),
          React.createElement('option', { value: 'epic' }, 'Epic'),
          React.createElement('option', { value: 'legendary' }, 'Legendary')
        )
      )
    ),

    React.createElement('div', {
      className: 'grid grid-cols-2 gap-4'
    },
      ['consumable', 'equipable', 'unique', 'hidden'].map(prop =>
        React.createElement('label', {
          key: prop,
          className: 'flex items-center'
        },
          React.createElement('input', {
            type: 'checkbox',
            checked: formData[prop],
            onChange: (e) => onFieldChange(prop, e.target.checked),
            className: 'mr-2'
          }),
          React.createElement('span', {
            className: 'text-sm font-medium text-gray-700'
          }, prop.charAt(0).toUpperCase() + prop.slice(1))
        )
      )
    )
  );
}

// Item effects form
function ItemEffectsForm({ effects, onEffectChange, onAddEffect, onRemoveEffect }) {
  return React.createElement('div', {
    className: 'space-y-4'
  },
    React.createElement('div', {
      className: 'flex justify-between items-center'
    },
      React.createElement('h4', {
        className: 'font-medium'
      }, 'Item Effects'),
      React.createElement('button', {
        onClick: onAddEffect,
        className: 'px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700'
      }, '+ Add Effect')
    ),

    effects.length === 0 ?
      React.createElement('div', {
        className: 'text-center py-4 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg'
      }, 'No effects configured') :

      effects.map((effect, index) =>
        React.createElement('div', {
          key: index,
          className: 'border rounded-lg p-3 bg-white'
        },
          React.createElement('div', {
            className: 'flex items-center gap-3'
          },
            React.createElement('select', {
              value: effect.type,
              onChange: (e) => onEffectChange(index, 'type', e.target.value),
              className: 'px-2 py-1 border rounded text-sm'
            },
              React.createElement('option', { value: 'stat_add' }, 'Add to Stat'),
              React.createElement('option', { value: 'stat_set' }, 'Set Stat'),
              React.createElement('option', { value: 'flag_set' }, 'Set Flag')
            ),

            React.createElement('input', {
              type: 'text',
              value: effect.target,
              onChange: (e) => onEffectChange(index, 'target', e.target.value),
              placeholder: 'Target stat/flag',
              className: 'flex-1 px-2 py-1 border rounded text-sm'
            }),

            effect.type !== 'flag_set' ?
              React.createElement('input', {
                type: 'number',
                value: effect.value,
                onChange: (e) => onEffectChange(index, 'value', Number(e.target.value)),
                className: 'w-20 px-2 py-1 border rounded text-sm'
              }) :
              React.createElement('select', {
                value: effect.value,
                onChange: (e) => onEffectChange(index, 'value', e.target.value === 'true'),
                className: 'w-20 px-2 py-1 border rounded text-sm'
              },
                React.createElement('option', { value: 'true' }, 'True'),
                React.createElement('option', { value: 'false' }, 'False')
              ),

            React.createElement('button', {
              onClick: () => onRemoveEffect(index),
              className: 'p-1 text-red-600 hover:text-red-800'
            }, '🗑️')
          )
        )
      )
  );
}

// Bulk import dialog
function BulkImportDialog({ onImport, onCancel, existingItems }) {
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState('json');
  const [previewItems, setPreviewItems] = useState([]);
  const [errors, setErrors] = useState([]);

  const handleParseImport = useCallback(() => {
    try {
      let parsed;
      
      if (importFormat === 'json') {
        parsed = JSON.parse(importText);
      } else if (importFormat === 'csv') {
        // Simple CSV parsing
        const lines = importText.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        parsed = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const item = {};
          headers.forEach((header, index) => {
            item[header] = values[index] || '';
          });
          return item;
        });
      }

      const items = Array.isArray(parsed) ? parsed : [parsed];
      const validationErrors = [];

      items.forEach((item, index) => {
        const itemErrors = validateItem(item, [...existingItems, ...items]);
        if (itemErrors.length > 0) {
          validationErrors.push(`Item ${index + 1}: ${itemErrors.join(', ')}`);
        }
      });

      setPreviewItems(items);
      setErrors(validationErrors);

    } catch (error) {
      setErrors([`Parse error: ${error.message}`]);
      setPreviewItems([]);
    }
  }, [importText, importFormat, existingItems]);

  const handleImport = useCallback(() => {
    if (previewItems.length > 0 && errors.length === 0) {
      onImport(previewItems);
    }
  }, [previewItems, errors, onImport]);

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60'
  },
    React.createElement('div', {
      className: 'bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden'
    },
      // Header
      React.createElement('div', {
        className: 'flex justify-between items-center p-6 border-b'
      },
        React.createElement('h3', {
          className: 'text-lg font-semibold'
        }, 'Bulk Import Items'),
        React.createElement('button', {
          onClick: onCancel,
          className: 'text-gray-400 hover:text-gray-600'
        }, '✕')
      ),

      // Content
      React.createElement('div', {
        className: 'p-6 space-y-4 max-h-96 overflow-y-auto'
      },
        // Format selection
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-2'
          }, 'Import Format'),
          React.createElement('select', {
            value: importFormat,
            onChange: (e) => setImportFormat(e.target.value),
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md'
          },
            React.createElement('option', { value: 'json' }, 'JSON'),
            React.createElement('option', { value: 'csv' }, 'CSV')
          )
        ),

        // Import text
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-2'
          }, 'Import Data'),
          React.createElement('textarea', {
            value: importText,
            onChange: (e) => setImportText(e.target.value),
            rows: 10,
            placeholder: importFormat === 'json' 
              ? 'Paste JSON array of items...'
              : 'Paste CSV data with headers...',
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm'
          })
        ),

        // Parse button
        React.createElement('button', {
          onClick: handleParseImport,
          disabled: !importText.trim(),
          className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
        }, 'Parse and Preview'),

        // Errors
        errors.length > 0 && React.createElement('div', {
          className: 'bg-red-50 border border-red-200 rounded-lg p-4'
        },
          React.createElement('h4', {
            className: 'font-medium text-red-900 mb-2'
          }, 'Import Errors'),
          React.createElement('ul', {
            className: 'text-sm text-red-700 space-y-1'
          },
            errors.map((error, index) =>
              React.createElement('li', { key: index }, `• ${error}`)
            )
          )
        ),

        // Preview
        previewItems.length > 0 && React.createElement('div', {
          className: 'bg-green-50 border border-green-200 rounded-lg p-4'
        },
          React.createElement('h4', {
            className: 'font-medium text-green-900 mb-2'
          }, `Preview: ${previewItems.length} items ready to import`),
          React.createElement('div', {
            className: 'text-sm text-green-700'
          },
            previewItems.slice(0, 3).map((item, index) =>
              React.createElement('div', { key: index }, `• ${item.name || 'Unnamed Item'}`)
            ),
            previewItems.length > 3 && React.createElement('div', null, `... and ${previewItems.length - 3} more`)
          )
        )
      ),

      // Footer
      React.createElement('div', {
        className: 'flex justify-between items-center p-6 border-t bg-gray-50'
      },
        React.createElement('div', null,
          previewItems.length > 0 && React.createElement('span', {
            className: 'text-sm text-gray-600'
          }, `${previewItems.length} items parsed`)
        ),

        React.createElement('div', {
          className: 'flex gap-3'
        },
          React.createElement('button', {
            onClick: onCancel,
            className: 'px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50'
          }, 'Cancel'),
          React.createElement('button', {
            onClick: handleImport,
            disabled: previewItems.length === 0 || errors.length > 0,
            className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          }, `Import ${previewItems.length} Items`)
        )
      )
    )
  );
}

// Helper functions
function generateItemId() {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

function validateItem(item, existingItems = []) {
  const errors = [];

  if (!item.id || !item.id.trim()) {
    errors.push('Item ID is required');
  } else if (existingItems.some(existing => existing.id === item.id)) {
    errors.push('Item ID must be unique');
  }

  if (!item.name || !item.name.trim()) {
    errors.push('Item name is required');
  }

  if (item.maxStack && (item.maxStack < 1 || !Number.isInteger(item.maxStack))) {
    errors.push('Max stack must be a positive integer');
  }

  if (item.value && item.value < 0) {
    errors.push('Item value cannot be negative');
  }

  if (item.effects && Array.isArray(item.effects)) {
    item.effects.forEach((effect, index) => {
      if (!effect.target || !effect.target.trim()) {
        errors.push(`Effect ${index + 1}: target is required`);
      }
      if (effect.type !== 'flag_set' && (typeof effect.value !== 'number')) {
        errors.push(`Effect ${index + 1}: value must be a number`);
      }
    });
  }

  return errors;
}