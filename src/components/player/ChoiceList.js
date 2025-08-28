 
import { Button } from '../common/Button.js';

const { createElement } = React;

export function ChoiceList({ 
  choices, 
  onChoiceSelect, 
  disabled = false, 
  className = '' 
}) {
  if (choices.length === 0) {
    return createElement('div', {
      className: `p-4 text-center ${className}`
    }, createElement('p', {
      className: 'text-gray-500'
    }, 'No choices available'));
  }

  return createElement('div', {
    className: `space-y-3 ${className}`
  }, [
    createElement('h3', {
      key: 'title',
      className: 'text-lg font-semibold text-gray-800 mb-3'
    }, 'What do you do?'),
    
    createElement('div', {
      key: 'choices',
      className: 'space-y-2'
    }, choices.map((choice, index) => 
      createElement(ChoiceButton, {
        key: choice.id,
        choice,
        index: index + 1,
        onSelect: () => onChoiceSelect(choice.id),
        disabled
      })
    ))
  ]);
}

function ChoiceButton({ choice, index, onSelect, disabled }) {
  return createElement('div', {
    className: 'w-full'
  }, createElement(Button, {
    onClick: onSelect,
    disabled,
    variant: 'secondary',
    className: 'w-full text-left justify-start p-4 h-auto min-h-[3rem] hover:bg-gray-700'
  }, createElement('div', {
    className: 'flex items-start space-x-3'
  }, [
    // Choice number
    createElement('span', {
      key: 'number',
      className: 'flex-shrink-0 w-6 h-6 bg-gray-500 text-white text-sm font-bold rounded-full flex items-center justify-center'
    }, index),
    
    // Choice text
    createElement('span', {
      key: 'text',
      className: 'flex-1 text-white leading-relaxed'
    }, choice.text)
  ])));
}