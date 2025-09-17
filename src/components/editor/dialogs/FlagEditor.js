import React, { useState, useEffect } from "https://esm.sh/react@18";

export default function FlagEditor({
  isOpen = false,
  flags = [],
  editingFlag = null,
  onSave = () => {},
  onCancel = () => {},
  onDelete = () => {}
}) {
  const [form, setForm] = useState({ id: '', name: '', description: '', defaultValue: false, exportable: true, category: '' });
  const isEditingExisting = flags?.some(f => f.id === form.id);

  useEffect(() => {
    if (!isOpen) return;
    if (editingFlag) {
      setForm({ ...editingFlag });
    } else {
      setForm({ id: `flag_${Date.now()}`, name: '', description: '', defaultValue: false, exportable: true, category: '' });
    }
  }, [isOpen, editingFlag]);

  if (!isOpen) return null;

  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50',
    onClick: (e) => { if (e.target === e.currentTarget) onCancel(); }
  }, React.createElement('div', {
    className: 'bg-white rounded-lg p-4 w-96 shadow-lg'
  }, [
    React.createElement('h3', { key: 'title', className: 'font-semibold mb-2' }, editingFlag ? 'Edit Flag' : 'New Flag'),

    // Existing flags list
    React.createElement('div', { key: 'list', className: 'mb-3' }, [
      React.createElement('div', { key: 'list-header', className: 'flex items-center justify-between text-xs text-gray-600 mb-1' }, [
        React.createElement('span', { key: 'lbl' }, `Existing Flags (${flags?.length || 0})`),
        React.createElement('button', {
          key: 'new-btn',
          className: 'px-2 py-1 border rounded text-gray-700 hover:bg-gray-50',
          onClick: () => setForm({ id: `flag_${Date.now()}`, name: '', description: '', defaultValue: false, exportable: true, category: '' })
        }, 'New')
      ]),
      React.createElement('div', { key: 'list-body', className: 'max-h-32 overflow-auto space-y-1' },
        (flags || []).length === 0
          ? React.createElement('div', { className: 'text-xs text-gray-400 italic' }, 'No flags yet')
          : (flags || []).map(f => React.createElement('div', { key: f.id, className: 'flex items-center justify-between text-xs bg-gray-50 border rounded px-2 py-1' }, [
              React.createElement('div', { key: 'meta', className: 'truncate' }, [
                React.createElement('span', { key: 'name', className: 'font-medium text-gray-800 truncate' }, f.name || f.id),
                React.createElement('span', { key: 'sep', className: 'mx-1 text-gray-400' }, '·'),
                React.createElement('span', { key: 'id', className: 'text-gray-500' }, f.id)
              ]),
              React.createElement('div', { key: 'actions', className: 'flex items-center gap-1' }, [
                React.createElement('button', {
                  key: 'edit',
                  className: 'px-2 py-0.5 border rounded hover:bg-blue-50 text-blue-700',
                  onClick: () => setForm({ ...f })
                }, 'Edit'),
                React.createElement('button', {
                  key: 'del',
                  className: 'px-2 py-0.5 border rounded hover:bg-red-50 text-red-600',
                  onClick: () => {
                    if (confirm(`Delete flag '${f.name || f.id}'?`)) onDelete(f.id);
                  }
                }, 'Delete')
              ])
            ]))
      )
    ]),

    React.createElement('div', { key: 'fields', className: 'space-y-2' }, [
      React.createElement('div', { key: 'id-field' }, [
        React.createElement('label', { className: 'text-xs text-gray-600' }, 'ID'),
        React.createElement('input', {
          className: 'w-full px-2 py-1 border rounded',
          value: form.id,
          onChange: (e) => setForm(f => ({ ...f, id: e.target.value }))
        })
      ]),

      React.createElement('div', { key: 'name-field' }, [
        React.createElement('label', { className: 'text-xs text-gray-600' }, 'Name'),
        React.createElement('input', {
          className: 'w-full px-2 py-1 border rounded',
          value: form.name,
          onChange: (e) => setForm(f => ({ ...f, name: e.target.value }))
        })
      ]),

      React.createElement('div', { key: 'desc-field' }, [
        React.createElement('label', { className: 'text-xs text-gray-600' }, 'Description'),
        React.createElement('textarea', {
          className: 'w-full px-2 py-1 border rounded',
          rows: 3,
          value: form.description,
          onChange: (e) => setForm(f => ({ ...f, description: e.target.value }))
        })
      ]),

      React.createElement('label', { key: 'default-label', className: 'flex items-center space-x-2' }, [
        React.createElement('input', {
          type: 'checkbox',
          checked: !!form.defaultValue,
          onChange: (e) => setForm(f => ({ ...f, defaultValue: e.target.checked }))
        }),
        React.createElement('span', null, 'Default true')
      ]),

      React.createElement('label', { key: 'exportable-label', className: 'flex items-center space-x-2' }, [
        React.createElement('input', {
          type: 'checkbox',
          checked: !!form.exportable,
          onChange: (e) => setForm(f => ({ ...f, exportable: e.target.checked }))
        }),
        React.createElement('span', null, 'Exportable')
      ]),

      React.createElement('div', { key: 'category-field' }, [
        React.createElement('label', { className: 'text-xs text-gray-600' }, 'Category'),
        React.createElement('input', {
          className: 'w-full px-2 py-1 border rounded',
          value: form.category,
          onChange: (e) => setForm(f => ({ ...f, category: e.target.value }))
        })
      ])
    ]),

    React.createElement('div', { key: 'actions', className: 'mt-3 flex justify-end gap-2' }, [
      isEditingExisting && React.createElement('button', {
        key: 'delete',
        className: 'px-3 py-1 text-sm text-red-600',
        onClick: () => {
          if (confirm(`Delete flag '${form.name || form.id}'?`)) onDelete(form.id);
        }
      }, 'Delete'),

      React.createElement('button', {
        key: 'cancel',
        className: 'px-3 py-1 text-sm',
        onClick: onCancel
      }, 'Cancel'),

      React.createElement('button', {
        key: 'save',
        className: 'px-3 py-1 bg-blue-600 text-white rounded text-sm',
        onClick: () => onSave({ ...form })
      }, 'Save')
    ])
  ]));
}
