// StatsEditor.js - Manage adventure stats in a dedicated modal
import React, { useState, useMemo, useCallback } from "https://esm.sh/react@18";

export default function StatsEditor({
  isOpen = false,
  stats = [],
  onClose = () => {},
  onStatsChange = () => {},
  className = ''
}) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return stats;
    return stats.filter(st => (st.name || '').toLowerCase().includes(s) || (st.id || '').toLowerCase().includes(s));
  }, [stats, search]);

  const createNew = useCallback(() => {
    setEditing({
      id: `stat_${Date.now()}`,
      name: 'New Stat',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
      hidden: false,
      category: 'general',
      description: ''
    });
  }, []);

  const save = useCallback(() => {
    if (!editing) return;
    const exists = stats.some(s => s.id === editing.id);
    const next = exists ? stats.map(s => s.id === editing.id ? editing : s) : [...stats, editing];
    onStatsChange(next);
    setEditing(null);
  }, [editing, stats, onStatsChange]);

  const del = useCallback((id) => {
    if (!confirm('Delete this stat?')) return;
    onStatsChange(stats.filter(s => s.id !== id));
    setEditing(null);
  }, [stats, onStatsChange]);

  if (!isOpen) return null;

  return React.createElement('div', {
    className: `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 ${className}`,
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
  },
    React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col' }, [
      // Header
      React.createElement('div', { key: 'hdr', className: 'flex items-center justify-between p-4 border-b' }, [
        React.createElement('div', { key: 't' }, [
          React.createElement('h2', { className: 'text-xl font-semibold' }, 'Stats'),
          React.createElement('p', { className: 'text-sm text-gray-600' }, `${stats.length} defined`)
        ]),
        React.createElement('div', { key: 'actions', className: 'flex items-center gap-2' }, [
          React.createElement('input', { type: 'text', value: search, onChange: (e) => setSearch(e.target.value), placeholder: 'Search stats...', className: 'px-3 py-2 border rounded-md text-sm' }),
          React.createElement('button', { onClick: createNew, className: 'px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700' }, '+ Create'),
          React.createElement('button', { onClick: onClose, className: 'px-3 py-2 text-gray-600 hover:text-gray-800' }, '✕')
        ])
      ]),

      // Body
      React.createElement('div', { key: 'body', className: 'flex-1 flex overflow-hidden' }, [
        React.createElement('div', { key: 'list', className: 'w-72 border-r p-3 bg-gray-50 overflow-y-auto' },
          filtered.length === 0
            ? React.createElement('div', { className: 'text-sm text-gray-500 italic p-2' }, 'No stats found')
            : filtered.map(s => React.createElement('div', {
                key: s.id,
                className: 'p-2 rounded hover:bg-gray-100 cursor-pointer',
                onClick: () => setEditing({ ...s })
              }, [
                React.createElement('div', { key: 'n', className: 'font-medium text-sm truncate' }, s.name || s.id),
                React.createElement('div', { key: 'i', className: 'text-xs text-gray-600 truncate' }, s.id)
              ])
            )
        ),

        React.createElement('div', { key: 'edit', className: 'flex-1 p-4 overflow-y-auto' }, [
          !editing ? React.createElement('div', { className: 'h-full flex items-center justify-center text-gray-500' }, 'Select or create a stat') :
          React.createElement(StatForm, { stat: editing, onChange: setEditing, onDelete: () => del(editing.id), onSave: save })
        ])
      ])
    ])
  );
}

function StatForm({ stat, onChange, onDelete, onSave }) {
  const update = (field, value) => onChange(prev => ({ ...prev, [field]: value }));
  return React.createElement('div', { className: 'space-y-4' }, [
    gridRow('Name *', React.createElement('input', { className: 'w-full px-3 py-2 border rounded-md', value: stat.name || '', onChange: (e) => update('name', e.target.value) })),
    gridRow('ID *', React.createElement('input', { className: 'w-full px-3 py-2 border rounded-md', value: stat.id || '', onChange: (e) => update('id', e.target.value) })),
    gridRow('Type', React.createElement('select', { className: 'w-full px-3 py-2 border rounded-md', value: stat.type || 'number', onChange: (e) => update('type', e.target.value) }, [
      React.createElement('option', { key: 'number', value: 'number' }, 'Number'),
      React.createElement('option', { key: 'boolean', value: 'boolean' }, 'Boolean')
    ])),
    gridRow('Default', React.createElement('input', { type: 'number', className: 'w-full px-3 py-2 border rounded-md', value: stat.defaultValue ?? 0, onChange: (e) => update('defaultValue', Number(e.target.value)) })),
    React.createElement('div', { className: 'grid grid-cols-2 gap-4' }, [
      gridRow('Min', React.createElement('input', { type: 'number', className: 'w-full px-3 py-2 border rounded-md', value: stat.min ?? 0, onChange: (e) => update('min', Number(e.target.value)) })),
      gridRow('Max', React.createElement('input', { type: 'number', className: 'w-full px-3 py-2 border rounded-md', value: stat.max ?? 100, onChange: (e) => update('max', Number(e.target.value)) }))
    ]),
    React.createElement('label', { className: 'flex items-center gap-2' }, [
      React.createElement('input', { type: 'checkbox', checked: !!stat.hidden, onChange: (e) => update('hidden', e.target.checked) }),
      React.createElement('span', null, 'Hidden')
    ]),
    gridRow('Category', React.createElement('input', { className: 'w-full px-3 py-2 border rounded-md', value: stat.category || 'general', onChange: (e) => update('category', e.target.value) })),
    gridRow('Description', React.createElement('textarea', { className: 'w-full px-3 py-2 border rounded-md', rows: 3, value: stat.description || '', onChange: (e) => update('description', e.target.value) })),
    React.createElement('div', { className: 'flex items-center justify-between pt-2' }, [
      React.createElement('button', { onClick: onDelete, className: 'px-3 py-2 text-red-600 hover:text-red-800' }, 'Delete'),
      React.createElement('div', { className: 'flex gap-2' }, [
        React.createElement('button', { onClick: () => onChange(null), className: 'px-4 py-2 border rounded-md' }, 'Cancel'),
        React.createElement('button', { onClick: onSave, className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700' }, 'Save')
      ])
    ])
  ]);
}

function gridRow(label, inputEl) {
  return React.createElement('div', { className: 'space-y-1' }, [
    React.createElement('div', { className: 'text-sm text-gray-700' }, label),
    inputEl
  ]);
}
