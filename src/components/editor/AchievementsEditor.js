// AchievementsEditor.js - Manage adventure achievements with conditions
import React, { useMemo, useState, useCallback, useEffect } from "https://esm.sh/react@18";
import ConditionBuilder from '../common/ConditionBuilder.js';

export default function AchievementsEditor({
  achievements = [],
  isOpen = false,
  onClose = () => {},
  onAchievementsChange = () => {},
  availableStats = [],
  availableFlags = [],
  availableItems = [],
  availableScenes = [],
  onInlineAddFlag = null,
  className = ''
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState([]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return achievements;
    return achievements.filter(a =>
      (a.name || '').toLowerCase().includes(s) ||
      (a.id || '').toLowerCase().includes(s) ||
      (a.description || '').toLowerCase().includes(s)
    );
  }, [achievements, search]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedId) {
      const ach = achievements.find(a => a.id === selectedId);
      if (ach) {
        // If this id exists in the list, sync the editor from source of truth
        setEditing(prev => {
          // Preserve fields that may exist in prev but ensure props are authoritative
          return { ...ach };
        });
      } else {
        // Selected id does not exist yet (new/unsaved). Keep current editing if it matches.
        setEditing(prev => (prev && prev.id === selectedId) ? prev : prev);
      }
    } else if (achievements.length > 0) {
      setSelectedId(achievements[0].id);
    }
  }, [isOpen, achievements, selectedId]);

  const handleCreate = useCallback(() => {
    const newAch = {
      id: `ach_${Date.now()}`,
      name: 'New Achievement',
      description: '',
      category: 'general',
      points: 0,
      rarity: 'common',
      conditions: []
    };
    setEditing(newAch);
    setSelectedId(newAch.id);
  }, []);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    const ach = achievements.find(a => a.id === id);
    setEditing(ach ? { ...ach } : null);
    setErrors([]);
  }, [achievements]);

  const validate = useCallback((ach, others) => {
    const errs = [];
    if (!ach.id || !ach.id.trim()) errs.push('ID is required.');
    if (!ach.name || !ach.name.trim()) errs.push('Name is required.');
    if (others.some(o => o.id === ach.id)) errs.push('ID must be unique.');
    return errs;
  }, []);

  const handleSave = useCallback(() => {
    if (!editing) return;
    const others = achievements.filter(a => a.id !== editing.id);
    const v = validate(editing, others);
    setErrors(v);
    if (v.length > 0) return;

    const exists = achievements.some(a => a.id === editing.id);
    const next = exists
      ? achievements.map(a => a.id === editing.id ? editing : a)
      : [...achievements, editing];
    onAchievementsChange(next);
  }, [editing, achievements, onAchievementsChange, validate]);

  const handleDelete = useCallback((id) => {
    if (!id) return;
    if (!confirm('Delete this achievement?')) return;
    const next = achievements.filter(a => a.id !== id);
    onAchievementsChange(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id || null);
      setEditing(next[0] ? { ...next[0] } : null);
    }
  }, [achievements, onAchievementsChange, selectedId]);

  if (!isOpen) return null;

  return React.createElement('div', {
    className: `fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 ${className}`,
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
  },
    React.createElement('div', {
      className: 'bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col'
    },
      // Header
      React.createElement('div', { className: 'flex items-center justify-between p-4 border-b' }, [
        React.createElement('div', { key: 'title' }, [
          React.createElement('h2', { className: 'text-xl font-semibold text-gray-900' }, 'Achievements'),
          React.createElement('p', { className: 'text-sm text-gray-600' }, `${achievements.length} defined`)
        ]),
        React.createElement('div', { key: 'actions', className: 'flex items-center gap-2' }, [
          React.createElement('input', {
            key: 'search',
            type: 'text',
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: 'Search achievements...',
            className: 'px-3 py-2 border rounded-md text-sm'
          }),
          React.createElement('button', {
            key: 'create',
            onClick: handleCreate,
            className: 'px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700'
          }, '+ Create'),
          React.createElement('button', {
            key: 'close',
            onClick: onClose,
            className: 'px-3 py-2 text-gray-600 hover:text-gray-800'
          }, '✕')
        ])
      ]),

      // Body
      React.createElement('div', { className: 'flex-1 flex overflow-hidden' }, [
        // List
        React.createElement('div', { key: 'list', className: 'w-72 border-r overflow-y-auto p-3 bg-gray-50' }, [
          filtered.length === 0 ?
            React.createElement('div', { className: 'text-sm text-gray-500 p-3 italic' }, 'No achievements found') :
            filtered.map(ach => React.createElement('div', {
              key: ach.id,
              className: `p-2 rounded cursor-pointer text-sm ${selectedId === ach.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`,
              onClick: () => handleSelect(ach.id)
            }, [
              React.createElement('div', { key: 'name', className: 'font-medium truncate' }, ach.name || ach.id),
              React.createElement('div', { key: 'meta', className: 'text-xs text-gray-600 truncate' }, ach.id)
            ]))
        ]),

        // Editor
        React.createElement('div', { key: 'editor', className: 'flex-1 overflow-y-auto p-4' }, [
          !editing ? React.createElement('div', { className: 'h-full flex items-center justify-center text-gray-500' }, 'Select or create an achievement') :
          React.createElement('div', { className: 'space-y-4' }, [
            // Basic fields
            React.createElement('div', { key: 'basic', className: 'grid grid-cols-2 gap-4' }, [
              React.createElement(Field, {
                key: 'name', label: 'Name *', value: editing.name,
                onChange: (v) => setEditing(prev => ({ ...prev, name: v }))
              }),
              React.createElement(Field, {
                key: 'id', label: 'ID *', value: editing.id,
                onChange: (v) => setEditing(prev => ({ ...prev, id: v }))
              })
            ]),

            React.createElement(TextArea, {
              key: 'desc', label: 'Description', value: editing.description || '', rows: 3,
              onChange: (v) => setEditing(prev => ({ ...prev, description: v }))
            }),

            React.createElement('div', { key: 'row2', className: 'grid grid-cols-3 gap-4' }, [
              React.createElement(Select, {
                key: 'category', label: 'Category', value: editing.category || 'general',
                onChange: (v) => setEditing(prev => ({ ...prev, category: v })),
                options: [
                  { value: 'general', label: 'General' },
                  { value: 'exploration', label: 'Exploration' },
                  { value: 'progression', label: 'Progression' },
                  { value: 'combat', label: 'Combat' }
                ]
              }),
              React.createElement(NumberField, {
                key: 'points', label: 'Points', value: editing.points ?? 0, min: 0,
                onChange: (v) => setEditing(prev => ({ ...prev, points: v }))
              }),
              React.createElement(Select, {
                key: 'rarity', label: 'Rarity', value: editing.rarity || 'common',
                onChange: (v) => setEditing(prev => ({ ...prev, rarity: v })),
                options: [
                  { value: 'common', label: 'Common' },
                  { value: 'uncommon', label: 'Uncommon' },
                  { value: 'rare', label: 'Rare' },
                  { value: 'epic', label: 'Epic' },
                  { value: 'legendary', label: 'Legendary' }
                ]
              })
            ]),

            // Conditions
            React.createElement('div', { key: 'conditions' }, [
              React.createElement('h3', { className: 'text-sm font-medium text-gray-900 mb-2' }, 'Unlock Conditions'),
              React.createElement(ConditionBuilder, {
                conditions: editing.conditions || [],
                onConditionsChange: (conds) => setEditing(prev => ({ ...prev, conditions: conds })),
                availableStats,
                availableFlags,
                availableItems,
                availableScenes,
                onInlineAddFlag
              })
            ]),

            errors.length > 0 && React.createElement('div', { key: 'errors', className: 'bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700' },
              errors.map((e, i) => React.createElement('div', { key: i }, `• ${e}`))
            ),

            // Footer buttons
            React.createElement('div', { key: 'footer', className: 'flex items-center justify-between pt-2' }, [
              React.createElement('button', {
                key: 'delete',
                onClick: () => handleDelete(editing.id),
                className: 'px-3 py-2 text-red-600 hover:text-red-800'
              }, 'Delete'),
              React.createElement('div', { key: 'cta', className: 'flex gap-2' }, [
                React.createElement('button', { onClick: onClose, className: 'px-4 py-2 border rounded-md' }, 'Cancel'),
                React.createElement('button', { onClick: handleSave, className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700' }, 'Save')
              ])
            ])
          ])
        ])
      ])
    )
  );
}

function Field({ label, value, onChange }) {
  return React.createElement('div', null,
    React.createElement('label', { className: 'block text-sm text-gray-700 mb-1' }, label),
    React.createElement('input', {
      className: 'w-full px-3 py-2 border rounded-md',
      type: 'text',
      value: value || '',
      onChange: (e) => onChange(e.target.value)
    })
  );
}

function NumberField({ label, value, onChange, min = 0 }) {
  return React.createElement('div', null,
    React.createElement('label', { className: 'block text-sm text-gray-700 mb-1' }, label),
    React.createElement('input', {
      className: 'w-full px-3 py-2 border rounded-md',
      type: 'number',
      min,
      value: value ?? 0,
      onChange: (e) => onChange(Number(e.target.value))
    })
  );
}

function TextArea({ label, value, onChange, rows = 3 }) {
  return React.createElement('div', null,
    React.createElement('label', { className: 'block text-sm text-gray-700 mb-1' }, label),
    React.createElement('textarea', {
      className: 'w-full px-3 py-2 border rounded-md',
      rows,
      value: value || '',
      onChange: (e) => onChange(e.target.value)
    })
  );
}

function Select({ label, value, onChange, options = [] }) {
  return React.createElement('div', null,
    React.createElement('label', { className: 'block text-sm text-gray-700 mb-1' }, label),
    React.createElement('select', {
      className: 'w-full px-3 py-2 border rounded-md',
      value: value || '',
      onChange: (e) => onChange(e.target.value)
    },
      options.map(opt => React.createElement('option', { key: opt.value, value: opt.value }, opt.label))
    )
  );
}
