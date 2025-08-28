// EditorToolbar.js - Tool selection and actions
// Handles: add scene, delete, export, import, validation status, play test

import { Button } from '../../common/Button.js';

const { useState } = React;

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
  selectedNodeId = null
}) {
  const [showValidationDetails, setShowValidationDetails] = useState(false);

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
    e.target.value = ''; // Reset input
  };

  return React.createElement('div', {
    className: 'flex items-center justify-between p-3 bg-white border-b border-gray-200 shadow-sm'
  }, [
    // Left section - Adventure title and basic actions
    React.createElement('div', {
      key: 'left-section',
      className: 'flex items-center space-x-4'
    }, [
      React.createElement('h1', {
        key: 'title',
        className: 'text-lg font-semibold text-gray-800'
      }, adventureTitle),

      React.createElement('div', {
        key: 'file-actions',
        className: 'flex items-center space-x-2'
      }, [
        React.createElement(Button, {
          key: 'new-btn',
          onClick: onNewAdventure,
          variant: 'secondary',
          size: 'sm'
        }, 'New'),

        React.createElement('label', {
          key: 'import-label',
          className: 'cursor-pointer'
        }, [
          React.createElement(Button, {
            key: 'import-btn',
            variant: 'secondary',
            size: 'sm',
            as: 'span'
          }, 'Import'),
          React.createElement('input', {
            key: 'import-input',
            type: 'file',
            accept: '.json',
            onChange: handleFileImport,
            className: 'hidden'
          })
        ]),

        React.createElement(Button, {
          key: 'save-btn',
          onClick: onSaveEditor,
          variant: 'secondary',
          size: 'sm'
        }, 'Save Draft')
      ])
    ]),

    // Center section - Scene tools
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

      React.createElement('div', {
        key: 'divider',
        className: 'h-6 w-px bg-gray-300'
      })
    ]),

    // Right section - Validation, export, and play test
    React.createElement('div', {
      key: 'right-section',
      className: 'flex items-center space-x-3'
    }, [
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
          className: `flex items-center space-x-1 px-2 py-1 rounded text-sm font-medium ${
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

        // Validation details dropdown
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

      React.createElement(Button, {
        key: 'export-btn',
        onClick: onExportAdventure,
        variant: 'secondary',
        size: 'sm',
        disabled: !canExport || hasErrors
      }, 'Export'),

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