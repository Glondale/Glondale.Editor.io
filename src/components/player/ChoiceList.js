// ChoiceList.js - Enhanced with Phase 3 advanced choice features
import { Button } from '../common/Button.js';

import React, { createElement, useState, useEffect, useRef, useMemo, useCallback, memo } from "https://esm.sh/react@18";

// Enhanced virtual scrolling hook with performance optimizations for 100+ choices
function useVirtualScrolling(items, itemHeight = 80, containerHeight = 400, buffer = 8) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollTime = useRef(0);
  const scrollCache = useRef(new Map());
  
  // Throttled scroll handler for better performance
  const handleScroll = useCallback((event) => {
    const now = performance.now();
    const newScrollTop = event.target.scrollTop;
    
    // Throttle scroll updates to 60fps
    if (now - lastScrollTime.current < 16) return;
    
    lastScrollTime.current = now;
    setScrollTop(newScrollTop);
    
    if (!isScrolling) {
      setIsScrolling(true);
    }
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set scrolling to false after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, [isScrolling]);
  
  // Calculate visible range with enhanced buffer for smoother scrolling
  const visibleRange = useMemo(() => {
    const cacheKey = `${scrollTop}-${itemHeight}-${containerHeight}-${buffer}-${items.length}`;
    
    if (scrollCache.current.has(cacheKey)) {
      return scrollCache.current.get(cacheKey);
    }
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
    );
    
    const range = { startIndex, endIndex };
    
    // Cache the result for performance
    scrollCache.current.set(cacheKey, range);
    
    // Limit cache size
    if (scrollCache.current.size > 50) {
      const firstKey = scrollCache.current.keys().next().value;
      scrollCache.current.delete(firstKey);
    }
    
    return range;
  }, [scrollTop, itemHeight, containerHeight, buffer, items.length]);
  
  // Visible items with optimized slicing
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    const sliceCount = endIndex - startIndex + 1;
    
    if (sliceCount <= 0) return [];
    
    return items.slice(startIndex, endIndex + 1)
      .map((item, index) => ({
        ...item,
        virtualIndex: startIndex + index,
        absoluteIndex: startIndex + index,
        isVisible: true
      }));
  }, [items, visibleRange]);
  
  // Enhanced container props with performance optimizations
  const containerProps = {
    ref: containerRef,
    onScroll: handleScroll,
    style: {
      height: containerHeight,
      overflowY: 'auto',
      overflowX: 'hidden',
      // Use transform3d to enable hardware acceleration
      transform: 'translateZ(0)',
      willChange: isScrolling ? 'scroll-position' : 'auto'
    },
    className: 'virtual-scroll-container'
  };
  
  // Total height calculation with caching
  const totalHeight = useMemo(() => {
    return items.length * itemHeight;
  }, [items.length, itemHeight]);
  
  // Offset for visible items positioning
  const offsetY = useMemo(() => {
    return visibleRange.startIndex * itemHeight;
  }, [visibleRange.startIndex, itemHeight]);
  
  // Performance metrics
  const performanceStats = useMemo(() => {
    return {
      totalItems: items.length,
      visibleItems: visibleItems.length,
      renderRatio: items.length > 0 ? Math.round((visibleItems.length / items.length) * 100) : 0,
      isVirtualized: items.length > 10,
      bufferSize: buffer,
      scrollPosition: scrollTop,
      isScrolling
    };
  }, [items.length, visibleItems.length, buffer, scrollTop, isScrolling]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollCache.current.clear();
    };
  }, []);
  
  return {
    visibleItems,
    containerProps,
    totalHeight,
    offsetY,
    itemHeight,
    visibleRange,
    isScrolling,
    performanceStats
  };
}

export function ChoiceList({ 
  choices, 
  onChoiceSelect, 
  disabled = false, 
  className = '',
  showSecrets = true,
  animateNewSecrets = true,
  virtualScrollThreshold = 20 // Enable virtual scrolling when choices exceed this number
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
  const sortedChoices = useMemo(() => {
    return visibleChoices.sort((a, b) => {
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;
      return priorityB - priorityA; // Higher priority first
    });
  }, [visibleChoices]);

  // Enhanced virtual scrolling with adaptive settings
  const useVirtual = sortedChoices.length > virtualScrollThreshold;
  const dynamicItemHeight = useMemo(() => {
    // Adapt item height based on content
    const hasComplexChoices = sortedChoices.some(c => 
      (c.consequences && c.consequences.length > 0) || 
      (c.evaluation?.lockReasons && c.evaluation.lockReasons.length > 0)
    );
    return hasComplexChoices ? 100 : 80;
  }, [sortedChoices]);
  
  const adaptiveContainerHeight = useMemo(() => {
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxHeight = Math.min(500, screenHeight * 0.7); // Max 500px or 70% of screen
    const minHeight = 200; // Minimum height
    
    if (sortedChoices.length < 3) {
      return Math.max(minHeight, sortedChoices.length * dynamicItemHeight + 40);
    }
    
    return maxHeight;
  }, [sortedChoices.length, dynamicItemHeight]);
  
  const virtualScroll = useVirtualScrolling(
    sortedChoices,
    dynamicItemHeight,
    adaptiveContainerHeight,
    Math.max(5, Math.ceil(sortedChoices.length * 0.1)) // Adaptive buffer: 10% of items or min 5
  );

  // Render choice items (either all or just visible ones for virtual scrolling)
  const renderChoiceItems = useCallback((choicesToRender, startIndex = 0) => {
    return choicesToRender.map((choice, index) => {
      const actualIndex = startIndex + index;
      return createElement(ChoiceButton, {
        key: choice.id,
        choice,
        index: actualIndex + 1,
        onSelect: () => onChoiceSelect(choice.id),
        disabled: disabled || choice.evaluation?.state === 'LOCKED',
        isAnimating: animatingChoices.has(choice.id),
        isNewlyDiscovered: newlyDiscovered.has(choice.id),
        // Enhanced virtual styling with performance optimizations
        style: useVirtual ? {
          position: 'absolute',
          top: (choice.virtualIndex || actualIndex) * virtualScroll.itemHeight,
          width: '100%',
          minHeight: virtualScroll.itemHeight,
          maxHeight: virtualScroll.itemHeight * 1.5, // Allow slight overflow for complex content
          boxSizing: 'border-box',
          // Performance optimizations
          transform: 'translateZ(0)', // Enable hardware acceleration
          willChange: virtualScroll.isScrolling ? 'transform' : 'auto',
          contain: 'layout style paint' // CSS containment for better performance
        } : undefined
      });
    });
  }, [onChoiceSelect, disabled, animatingChoices, newlyDiscovered, useVirtual, virtualScroll.itemHeight]);

  return createElement('div', {
    className: `space-y-3 ${className}`
  }, [
    createElement('h3', {
      key: 'title',
      className: 'text-lg font-semibold text-gray-800 mb-3 flex items-center justify-between'
    }, [
      createElement('span', { key: 'text' }, 'What do you do?'),
      // Show choice count and secret indicator
      createElement('div', { 
        key: 'indicators',
        className: 'flex items-center space-x-2'
      }, [
        // Choice count
        sortedChoices.length > 5 && createElement('span', {
          key: 'count',
          className: 'text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full'
        }, `${sortedChoices.length} choices`),
        
        // Secret indicator
        visibleChoices.some(c => c.isSecret) && createElement('span', {
          key: 'secret-indicator',
          className: 'text-xs px-2 py-1 bg-purple-600 text-white rounded-full'
        }, '✨ Secrets'),
        
        // Enhanced virtual scrolling indicator with performance stats
        useVirtual && createElement('div', {
          key: 'virtual-indicators',
          className: 'flex space-x-1'
        }, [
          createElement('span', {
            key: 'virtual-indicator',
            className: 'text-xs px-2 py-1 bg-blue-600 text-white rounded-full',
            title: `Showing ${virtualScroll.visibleItems.length} of ${sortedChoices.length} choices`
          }, `📜 ${virtualScroll.performanceStats.renderRatio}%`),
          
          // Performance indicator for development
          (typeof window !== 'undefined' && window.location.hostname === 'localhost') &&
          virtualScroll.isScrolling && createElement('span', {
            key: 'scroll-indicator',
            className: 'text-xs px-2 py-1 bg-green-600 text-white rounded-full animate-pulse'
          }, '⚡')
        ])
      ])
    ]),
    
    // Enhanced choice container with performance optimizations
    createElement('div', {
      key: 'choices',
      className: useVirtual ? 'virtual-scroll-wrapper' : 'space-y-2',
      ...(useVirtual ? virtualScroll.containerProps : {}),
      'data-choices-count': sortedChoices.length,
      'data-virtual': useVirtual
    }, useVirtual ? [
      // Virtual scrolling: optimized container with total height and positioning
      createElement('div', {
        key: 'virtual-container',
        className: 'relative',
        style: {
          height: virtualScroll.totalHeight,
          contain: 'layout style paint', // CSS containment
          // Use transform instead of paddingTop for better performance
          transform: `translateY(${virtualScroll.offsetY}px)`,
          willChange: virtualScroll.isScrolling ? 'transform' : 'auto'
        }
      }, renderChoiceItems(virtualScroll.visibleItems, virtualScroll.visibleRange.startIndex)),
      
      // Performance debug info (development only)
      (typeof window !== 'undefined' && window.location.hostname === 'localhost') &&
      createElement('div', {
        key: 'debug-info',
        className: 'absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs p-1 rounded font-mono',
        style: { fontSize: '10px', zIndex: 10 }
      }, `V:${virtualScroll.visibleItems.length}/${sortedChoices.length} S:${Math.round(virtualScroll.performanceStats.scrollPosition)}`)
    ] : [
      // Regular scrolling: render all choices with optimized spacing
      createElement('div', {
        key: 'choice-list',
        className: 'space-y-2'
      }, renderChoiceItems(sortedChoices))
    ]),
    
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

const ChoiceButton = memo(function ChoiceButton({ choice, index, onSelect, disabled, isAnimating, isNewlyDiscovered, style }) {
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
    className: 'w-full relative',
    style: style // Apply virtual scrolling styles
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
});

// Helper function for consequence styling
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