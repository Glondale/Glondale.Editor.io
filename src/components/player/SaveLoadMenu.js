 
import { Button } from '../common/Button.js';

const { useState, createElement } = React;

export function SaveLoadMenu({
  saves,
  onSave,
  onLoad,
  onDelete,
  onQuickSave,
  canSave,
  canLoad,
  isLoading,
  onClose
}) {
  const [mode, setMode] = useState('save');
  const [saveName, setSaveName] = useState('');
  const [selectedSave, setSelectedSave] = useState('');

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

  return createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  }, createElement('div', {
    className: 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden'
  }, [
    // Header
    createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between p-4 border-b'
    }, [
      createElement('h2', {
        key: 'title',
        className: 'text-xl font-semibold'
      }, 'Save & Load'),
      createElement('button', {
        key: 'close',
        onClick: onClose,
        className: 'text-gray-500 hover:text-gray-700 text-xl'
      }, '×')
    ]),

    // Mode Tabs
    createElement('div', {
      key: 'tabs',
      className: 'flex border-b'
    }, [
      createElement('button', {
        key: 'save-tab',
        onClick: () => setMode('save'),
        className: `flex-1 py-3 px-4 text-center font-medium ${
          mode === 'save'
            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-600 hover:bg-gray-50'
        }`
      }, 'Save Game'),
      createElement('button', {
        key: 'load-tab',
        onClick: () => setMode('load'),
        className: `flex-1 py-3 px-4 text-center font-medium ${
          mode === 'load'
            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-600 hover:bg-gray-50'
        }`
      }, 'Load Game')
    ]),

    // Content
    createElement('div', {
      key: 'content',
      className: 'p-4 overflow-y-auto max-h-96'
    }, mode === 'save' ? [
      // Quick Save
      createElement(Button, {
        key: 'quick-save',
        onClick: handleQuickSave,
        disabled: !canSave || isLoading,
        className: 'w-full mb-4'
      }, 'Quick Save'),

      // Custom Save
      createElement('div', {
        key: 'custom-save'
      }, [
        createElement('label', {
          key: 'label',
          className: 'block text-sm font-medium text-gray-700 mb-2'
        }, 'Save Name'),
        createElement('input', {
          key: 'input',
          type: 'text',
          value: saveName,
          onChange: (e) => setSaveName(e.target.value),
          placeholder: 'Enter save name...',
          className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4',
          disabled: isLoading
        }),
        createElement(Button, {
          key: 'save-button',
          onClick: handleSave,
          disabled: !canSave || !saveName.trim() || isLoading,
          className: 'w-full'
        }, 'Save Game')
      ])
    ] : [
      saves.length === 0 ? createElement('p', {
        key: 'no-saves',
        className: 'text-gray-500 text-center py-4'
      }, 'No saved games found') : [
        ...saves.map(save =>
          createElement(SaveItem, {
            key: save.id,
            save,
            isSelected: selectedSave === save.id,
            onSelect: () => setSelectedSave(save.id),
            onDelete: () => handleDelete(save.id)
          })
        ),
        selectedSave && createElement(Button, {
          key: 'load-button',
          onClick: handleLoad,
          disabled: !canLoad || isLoading,
          className: 'w-full mt-4'
        }, 'Load Selected Save')
      ]
    ])
  ]));
}

function SaveItem({ save, isSelected, onSelect, onDelete }) {
  return createElement('div', {
    className: `p-3 border rounded cursor-pointer transition-colors mb-2 ${
      isSelected
        ? 'bg-blue-50 border-blue-300'
        : 'hover:bg-gray-50 border-gray-200'
    }`,
    onClick: onSelect
  }, createElement('div', {
    className: 'flex items-center justify-between'
  }, [
    createElement('div', {
      key: 'info',
      className: 'flex-1'
    }, [
      createElement('h4', {
        key: 'name',
        className: 'font-medium text-gray-900'
      }, save.name),
      createElement('p', {
        key: 'scene',
        className: 'text-sm text-gray-600'
      }, save.currentSceneTitle),
      createElement('p', {
        key: 'time',
        className: 'text-xs text-gray-500'
      }, `${new Date(save.timestamp).toLocaleDateString()} ${new Date(save.timestamp).toLocaleTimeString()}`)
    ]),
    createElement('button', {
      key: 'delete',
      onClick: (e) => {
        e.stopPropagation();
        onDelete();
      },
      className: 'text-red-500 hover:text-red-700 p-1'
    }, '🗑')
  ]));
}