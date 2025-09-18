import React, { createElement, useMemo, useState, useEffect } from "https://esm.sh/react@18";
import { Button } from '../common/Button.js';
import sanitizeHtml from '../../utils/sanitizeHtml.js';

export function ChoiceList({ choices = [], onChoiceSelect, disabled = false }) {
  const preparedChoices = useMemo(() => {
    return Array.isArray(choices) ? choices : [];
  }, [choices]);

  if (preparedChoices.length === 0) {
    return createElement('div', {
      className: 'space-y-3'
    }, createElement('div', {
      className: 'p-4 bg-gray-100 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 text-center'
    }, 'No choices available.'));
  }

  return createElement('div', {
    className: 'space-y-3'
  }, preparedChoices.map((choice, index) => createElement(ChoiceRow, {
    key: choice.id || index,
    choice,
    index: index + 1,
    onChoose: onChoiceSelect,
    disabled
  })));
}

function ChoiceRow({ choice, index, onChoose, disabled }) {
  const evaluation = choice.evaluation || { isSelectable: true, state: 'VISIBLE' };
  const isLocked = evaluation.state === 'LOCKED' || evaluation.isSelectable === false;
  const isSecret = !!choice.isSecret;
  const inputType = evaluation.inputType || choice.inputType || 'static';
  const inputConfig = evaluation.inputConfig || choice.inputConfig || {};
  const hasInput = inputType !== 'static';
  const [inputValue, setInputValue] = useState(() => getDefaultInputValue(inputType, inputConfig));

  const handleChange = (value) => {
    setInputValue(value);
  };

  const handleSelect = () => {
    if (disabled || isLocked) return;
    const submission = hasInput ? { inputValue: normalizeInputValue(inputType, inputValue, inputConfig) } : {};
    if (typeof onChoose === 'function') {
      onChoose(choice.id, submission);
    }
  };

  const textHtml = formatChoiceText(choice.text || '');
  const lockReasons = evaluation.lockReasons || [];

  return createElement('div', {
    className: 'bg-gray-900/80 border border-gray-700 rounded-lg p-4 space-y-3'
  }, [
    hasInput && renderInputControl(inputType, inputConfig, inputValue, handleChange, disabled || isLocked),
    createElement('div', {
      className: 'flex items-start justify-between gap-3'
    }, [
      createElement('div', {
        className: 'flex-1 min-w-0 space-y-2'
      }, [
        createElement('div', {
          className: `text-sm leading-relaxed ${isLocked ? 'text-gray-400' : 'text-white'}`,
          dangerouslySetInnerHTML: { __html: textHtml }
        }),
        isLocked && lockReasons.length > 0 && createElement('div', {
          className: 'text-xs text-yellow-200'
        }, lockReasons.join(', ')),
        choice.consequences && choice.consequences.length > 0 && createElement('div', {
          className: 'text-xs text-gray-400 space-x-2'
        }, choice.consequences.map((consequence, idx) => createElement('span', {
          key: idx,
          className: `inline-block px-2 py-1 rounded-full ${getConsequenceClassName(consequence.severity)}`,
          title: consequence.description
        }, consequence.type.replace('_', ' '))))
      ]),
      createElement(Button, {
        key: 'select-btn',
        variant: isLocked ? 'secondary' : (isSecret ? 'primary' : 'secondary'),
        className: `flex-shrink-0 px-4 py-2 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`,
        disabled: disabled || isLocked,
        onClick: handleSelect
      }, isLocked ? 'Locked' : `Choose ${index}`)
    ])
  ]);
}

function renderInputControl(inputType, inputConfig, value, onChange, disabled) {
  const commonLabel = createElement('label', {
    className: 'block text-xs font-semibold text-gray-300 uppercase tracking-wide'
  }, 'Player Input');

  switch (inputType) {
    case 'input_text':
      return createElement('div', { className: 'space-y-2' }, [
        commonLabel,
        createElement('input', {
          type: 'text',
          value: value ?? '',
          onChange: (event) => onChange(event.target.value),
          placeholder: inputConfig.placeholder || 'Enter text...',
          className: 'w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled
        })
      ]);
    case 'input_number':
      return createElement('div', { className: 'space-y-2' }, [
        commonLabel,
        createElement('input', {
          type: 'number',
          value: value ?? '',
          min: inputConfig.min ?? undefined,
          max: inputConfig.max ?? undefined,
          step: inputConfig.step ?? undefined,
          onChange: (event) => onChange(event.target.value),
          className: 'w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled
        }),
        createElement('p', {
          className: 'text-xs text-gray-400'
        }, buildNumberHint(inputConfig))
      ]);
    case 'input_choice':
      return createElement('div', { className: 'space-y-2' }, [
        commonLabel,
        createElement('select', {
          value: value ?? '',
          onChange: (event) => onChange(event.target.value),
          className: 'w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled
        }, (inputConfig.options || []).map(option => createElement('option', {
          key: option.id || option.value || option.label,
          value: option.value ?? option.label ?? ''
        }, option.label || option.value || option.id || 'Option')))
      ]);
    default:
      return null;
  }
}

function buildNumberHint(config = {}) {
  const parts = [];
  if (config.min != null) parts.push(`min ${config.min}`);
  if (config.max != null) parts.push(`max ${config.max}`);
  if (config.step != null) parts.push(`step ${config.step}`);
  return parts.length > 0 ? parts.join(', ') : 'Enter a number';
}

function formatChoiceText(text) {
  if (!text) return '';
  const hasHtml = /<\/?[a-z][^>]*>/i.test(text);
  const processed = hasHtml ? text : text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');
  return sanitizeHtml(processed);
}

function getDefaultInputValue(type, config = {}) {
  switch (type) {
    case 'input_text':
      return '';
    case 'input_number':
      return config.min != null ? config.min : '';
    case 'input_choice':
      if (Array.isArray(config.options) && config.options.length > 0) {
        return config.options[0].value ?? config.options[0].label ?? '';
      }
      return '';
    default:
      return '';
  }
}

function normalizeInputValue(type, value, config = {}) {
  if (type === 'input_number') {
    let numeric = Number(value);
    if (Number.isNaN(numeric)) {
      numeric = config.min != null ? Number(config.min) : 0;
    }
    if (typeof config.min === 'number') {
      numeric = Math.max(config.min, numeric);
    }
    if (typeof config.max === 'number') {
      numeric = Math.min(config.max, numeric);
    }
    return numeric;
  }

  if (type === 'input_choice') {
    if (!value && Array.isArray(config.options) && config.options.length > 0) {
      return config.options[0].value ?? config.options[0].label ?? '';
    }
    return value;
  }

  return value ?? '';
}

export function getConsequenceClassName(severity) {
  switch (severity) {
    case 'critical':
      return 'bg-red-600 text-red-100';
    case 'major':
      return 'bg-orange-600 text-orange-100';
    case 'moderate':
      return 'bg-yellow-600 text-yellow-100';
    case 'minor':
      return 'bg-green-600 text-green-100';
    default:
      return 'bg-gray-600 text-gray-100';
  }
}

export default ChoiceList;


