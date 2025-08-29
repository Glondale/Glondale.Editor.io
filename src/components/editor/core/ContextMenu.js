// ContextMenu.js - Efficient context menu component
// Handles: Position-aware rendering, click-outside-to-close, keyboard navigation

import React, { useEffect, useRef } from "https://esm.sh/react@18";

export default function ContextMenu({
  isOpen = false,
  position = { x: 0, y: 0 },
  items = [],
  onClose = () => {}
}) {
  const menuRef = useRef(null);

  // Handle click outside and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add listeners with slight delay to prevent immediate closure
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Calculate position to keep menu on screen
  const getMenuPosition = () => {
    if (!menuRef.current) return position;

    const menu = menuRef.current;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let { x, y } = position;

    // Adjust X position if menu would go off right edge
    if (x + menu.offsetWidth > viewport.width) {
      x = viewport.width - menu.offsetWidth - 10;
    }

    // Adjust Y position if menu would go off bottom edge  
    if (y + menu.offsetHeight > viewport.height) {
      y = viewport.height - menu.offsetHeight - 10;
    }

    // Ensure minimum margins
    x = Math.max(10, x);
    y = Math.max(10, y);

    return { x, y };
  };

  if (!isOpen || items.length === 0) return null;

  const menuPosition = getMenuPosition();

  return React.createElement('div', {
    ref: menuRef,
    className: 'fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-48 z-50',
    style: {
      left: `${menuPosition.x}px`,
      top: `${menuPosition.y}px`
    }
  }, items.map((item, index) => {
    // Render separator
    if (item.separator) {
      return React.createElement('div', {
        key: `separator-${index}`,
        className: 'border-t border-gray-200 my-1'
      });
    }

    // Render menu item
    return React.createElement('button', {
      key: item.key || `item-${index}`,
      className: `w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
        item.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'
      }`,
      disabled: item.disabled,
      onClick: (e) => {
        e.stopPropagation();
        if (!item.disabled && item.onClick) {
          item.onClick();
          onClose();
        }
      }
    }, [
      // Icon (if provided)
      item.icon && React.createElement('span', {
        key: 'icon',
        className: 'text-gray-500'
      }, item.icon),

      // Label
      React.createElement('span', {
        key: 'label'
      }, item.label)
    ]);
  }));
}