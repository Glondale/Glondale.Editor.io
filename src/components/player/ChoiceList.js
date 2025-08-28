// ChoiceList.js - Enhanced with Phase 3 advanced choice features
import { Button } from '../common/Button.js';

const { createElement, useState, useEffect } = React;

export function ChoiceList({ 
  choices, 
  onChoiceSelect, 
  disabled = false, 
  className = '',
  showSecrets = true,
  animateNewSecrets = true
}) {
  const [newlyDiscovered, setNewlyDiscovered] = useState(new Set());
  const [animatingChoices, setAnimatingChoices] = useState(new Set());

  // Handle secret choice discovery animations
  useEffect(() => {
    if (!animateNewSecrets) return;

    const handleSecretDiscovered = (event) => {
      const { choice } = event.detail;
      setNewlyDiscovered(prev => new Set([...prev, choice.id]));
      setAnimatingChoices(prev => new Set([...prev, choice.id]));

      // Remove animation after 3 seconds
      setTimeout(() => {
        setAnimatingChoices(prev => {
          const next = new Set(prev);
          next.delete(choice.id);
          return next;
        });
      }, 3000);

      // Remove from newly discovered after 10 seconds
      setTimeout(() => {
        setNewlyDiscovered(prev => {
          const next = new Set(prev);
          next.delete(choice.id);
          return next;
        });
      }, 10000);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('secretChoiceDiscovered', handleSecretDiscovered);
      return () => window.removeEventListener('secretChoiceDiscovered', handleSecretDiscovered);
    }
  }, [animateNewSecrets]);

  if (choices.length === 0) {
    return createElement('div', {
      className: `p-4 text-center ${className}`
    }, createElement('p', {
      className: 'text-gray-500'
    }, 'No choices available'));
  }

  // Filter choices based on visibility and secret settings
  const visibleChoices = choices.filter(choice => {
    if (!choice.evaluation) return true; // Fallback for choices without evaluation
    
    const state = choice.evaluation.state;
    
    // Always show visible and locked choices
    if (state === 'VISIBLE' || state === 'LOCKED') return true;
    
    // Show secrets only if showSecrets is true and they're discovered
    if (state === 'SECRET' && showSecrets) {
      return choice.evaluation.isNewlyDiscovered;
    }
    
    // Hide hidden choices
    return false;
  });

  // Group choices by priority for better organization
  const sortedChoices = visibleChoices.sort((a, b) => {
    const priorityA = a.priority || 0;
    const priorityB = b.priority || 0;
    return priorityB - priorityA; // Higher priority first
  });

  return createElement('div', {
    className: `space-y-3 ${className}`
  }, [
    createElement('h3', {
      key: 'title',
      className: 'text-lg font-semibold text-gray-800 mb-3 flex items-center justify-between'
    }, [
      createElement('span', { key: 'text' }, 'What do you do?'),
      // Show secret indicator if there are secrets
      visibleChoices.some(c => c.isSecret) && createElement('span', {
        key: 'secret-indicator',
        className: 'text-xs px-2 py-1 bg-purple-600 text-white rounded-full'
      }, '✨ Secrets')
    ]),
    
    createElement('div', {
      key: 'choices',
      className: 'space-y-2'
    }, sortedChoices.map((choice, index) => 
      createElement(ChoiceButton, {
        key: choice.id,
        choice,
        index: index + 1,
        onSelect: () => onChoiceSelect(choice.id),
        disabled: disabled || choice.evaluation?.state === 'LOCKED',
        isAnimating: animatingChoices.has(choice.id),
        isNewlyDiscovered: newlyDiscovered.has(choice.id)
      })
    )),
    
    // Show help text if there are locked or secret choices
    visibleChoices.some(c => c.evaluation?.state === 'LOCKED' || c.isSecret) && createElement('div', {
      key: 'help-text',
      className: 'mt-4 p-3 bg-gray-100 rounded-lg text-sm text-gray-600'
    }, createElement('div', {
      className: 'space-y-1'
    }, [
      visibleChoices.some(c => c.evaluation?.state === 'LOCKED') && createElement('div', {
        key: 'locked-help',
        className: 'flex items-center space-x-2'
      }, [
        createElement('span', { key: 'icon' }, '🔒'),
        createElement('span', { key: 'text' }, 'Locked choices require specific conditions to unlock')
      ]),
      visibleChoices.some(c => c.isSecret) && createElement('div', {
        key: 'secret-help',
        className: 'flex items-center space-x-2'
      }, [
        createElement('span', { key: 'icon' }, '✨'),
        createElement('span', { key: 'text' }, 'Secret choices are discovered through exploration')
      ])
    ]))
  ]);
}

function ChoiceButton({ choice, index, onSelect, disabled, isAnimating, isNewlyDiscovered }) {
  const evaluation = choice.evaluation || { state: 'VISIBLE' };
  const isLocked = evaluation.state === 'LOCKED';
  const isSecret = choice.isSecret;
  
  // Determine button styling based on choice state
  const getButtonVariant = () => {
    if (isSecret) return 'secret';
    if (isLocked) return 'locked';
    return 'secondary';
  };

  const getButtonClassName = () => {
    let baseClasses = 'w-full text-left justify-start p-4 h-auto min-h-[3rem] transition-all duration-300';
    
    if (isSecret) {
      baseClasses += ' bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500';
      baseClasses += ' border-2 border-purple-400 shadow-purple-300/50 shadow-lg';
    } else if (isLocked) {
      baseClasses += ' bg-gray-600 hover:bg-gray-600 opacity-60 cursor-not-allowed';
      baseClasses += ' border-2 border-gray-500';
    } else {
      baseClasses += ' hover:bg-gray-700';
    }
    
    // Add animation classes
    if (isAnimating) {
      baseClasses += ' animate-pulse shadow-lg shadow-purple-300/70 scale-[1.02]';
    }
    
    if (isNewlyDiscovered) {
      baseClasses += ' ring-2 ring-purple-400 ring-offset-2';
    }
    
    return baseClasses;
  };

  const getNumberBadgeClassName = () => {
    let baseClasses = 'flex-shrink-0 w-6 h-6 text-sm font-bold rounded-full flex items-center justify-center';
    
    if (isSecret) {
      baseClasses += ' bg-purple-400 text-purple-900';
    } else if (isLocked) {
      baseClasses += ' bg-gray-500 text-gray-300';
    } else {
      baseClasses += ' bg-gray-500 text-white';
    }
    
    return baseClasses;
  };

  const getTextClassName = () => {
    let baseClasses = 'flex-1 leading-relaxed';
    
    if (isSecret) {
      baseClasses += ' text-purple-100 font-medium';
    } else if (isLocked) {
      baseClasses += ' text-gray-300';
    } else {
      baseClasses += ' text-white';
    }
    
    return baseClasses;
  };

  return createElement('div', {
    className: 'w-full relative'
  }, [
    // Main choice button
    createElement(Button, {
      key: 'button',
      onClick: disabled ? undefined : onSelect,
      disabled: disabled,
      variant: getButtonVariant(),
      className: getButtonClassName(),
      title: isLocked ? evaluation.lockReasons?.join(', ') : choice.description
    }, createElement('div', {
      className: 'flex items-start space-x-3 w-full'
    }, [
      // Choice number with special styling
      createElement('div', {
        key: 'number-container',
        className: 'relative'
      }, [
        createElement('span', {
          key: 'number',
          className: getNumberBadgeClassName()
        }, isSecret ? '✨' : isLocked ? '🔒' : index),
        
        // Secret discovery animation
        isAnimating && createElement('div', {
          key: 'animation',
          className: 'absolute inset-0 bg-purple-400 rounded-full animate-ping'
        })
      ]),
      
      // Choice text and metadata
      createElement('div', {
        key: 'content',
        className: 'flex-1 min-w-0'
      }, [
        createElement('div', {
          key: 'text',
          className: getTextClassName()
        }, choice.text),
        
        // Show requirements if locked
        isLocked && evaluation.lockReasons && createElement('div', {
          key: 'requirements',
          className: 'mt-1 text-xs text-gray-400'
        }, evaluation.lockReasons.join(', ')),
        
        // Show consequences if available
        choice.consequences && choice.consequences.length > 0 && createElement('div', {
          key: 'consequences',
          className: 'mt-1 text-xs opacity-75'
        }, createElement('div', {
          className: 'flex flex-wrap gap-2'
        }, choice.consequences.map((consequence, idx) =>
          createElement('span', {
            key: idx,
            className: `px-2 py-1 rounded-full ${getConsequenceClassName(consequence.severity)}`,
            title: consequence.description
          }, consequence.type.replace('_', ' '))
        ))),
        
        // Secret discovery indicator
        isNewlyDiscovered && createElement('div', {
          key: 'new-indicator',
          className: 'mt-1 text-xs text-purple-300 animate-pulse'
        }, '✨ Newly discovered!')
      ]),
      
      // Priority indicator for high-priority choices
      choice.priority && choice.priority > 0 && createElement('div', {
        key: 'priority',
        className: 'flex-shrink-0 w-2 h-2 bg-yellow-400 rounded-full'
      }),
      
      // One-time choice indicator
      choice.oneTime && createElement('div', {
        key: 'one-time',
        className: 'flex-shrink-0 text-xs text-yellow-400',
        title: 'This choice can only be selected once'
      }, '⚡')
    ])),
    
    // Cooldown indicator
    choice.cooldown && createElement('div', {
      key: 'cooldown',
      className: 'absolute top-0 right-0 -mt-1 -mr-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center',
      title: `Cooldown: ${choice.cooldown}ms`
    }, '⏱')
  ]);
}

// Helper function for consequence styling
function getConsequenceClassName(severity) {
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