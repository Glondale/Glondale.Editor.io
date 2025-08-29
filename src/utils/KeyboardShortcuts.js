// KeyboardShortcuts.js - Comprehensive keyboard shortcuts system
import { logInfo, logWarning, logError } from './errorLogger.js';

/**
 * Keyboard Shortcuts Manager
 * 
 * Features:
 * - Global and context-specific shortcuts
 * - Chord combinations (Ctrl+K, Ctrl+S)
 * - Keyboard shortcuts help overlay
 * - Platform-specific key mappings
 * - Configurable shortcuts
 * - Conflict detection and resolution
 * - Mode-aware shortcuts (editor vs player)
 */

export class KeyboardShortcutsManager {
  constructor(options = {}) {
    this.shortcuts = new Map();
    this.contexts = new Set(['global']);
    this.currentContext = 'global';
    this.isEnabled = options.enabled !== false;
    this.enableChords = options.enableChords !== false;
    this.chordTimeout = options.chordTimeout || 1000;
    
    // Platform detection
    this.isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.ctrlKey = this.isMac ? 'cmd' : 'ctrl';
    
    // State management
    this.activeChord = null;
    this.chordTimer = null;
    this.listeners = new Set();
    this.helpVisible = false;
    
    // Key press tracking
    this.pressedKeys = new Set();
    this.keySequence = [];
    
    // Initialize
    this.initializeEventListeners();
    this.registerDefaultShortcuts();
    
    logInfo('Keyboard shortcuts manager initialized', {
      platform: this.isMac ? 'mac' : 'windows',
      ctrlKey: this.ctrlKey,
      enableChords: this.enableChords
    });
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut, handler, options = {}) {
    const {
      context = 'global',
      description = '',
      group = 'Other',
      allowInInputs = false,
      preventDefault = true,
      priority = 0
    } = options;

    // Normalize shortcut string
    const normalizedShortcut = this.normalizeShortcut(shortcut);
    const key = `${context}:${normalizedShortcut}`;
    
    // Check for conflicts
    if (this.shortcuts.has(key)) {
      logWarning('Keyboard shortcut conflict detected', { 
        shortcut: normalizedShortcut, 
        context 
      });
    }

    const shortcutData = {
      keys: normalizedShortcut,
      handler,
      context,
      description,
      group,
      allowInInputs,
      preventDefault,
      priority,
      registeredAt: Date.now()
    };

    this.shortcuts.set(key, shortcutData);
    this.contexts.add(context);
    
    logInfo('Keyboard shortcut registered', { 
      shortcut: normalizedShortcut, 
      context, 
      description 
    });
    
    return () => this.unregister(shortcut, context);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(shortcut, context = 'global') {
    const normalizedShortcut = this.normalizeShortcut(shortcut);
    const key = `${context}:${normalizedShortcut}`;
    
    const removed = this.shortcuts.delete(key);
    if (removed) {
      logInfo('Keyboard shortcut unregistered', { 
        shortcut: normalizedShortcut, 
        context 
      });
    }
    
    return removed;
  }

  /**
   * Set the current context
   */
  setContext(context) {
    if (this.currentContext !== context) {
      logInfo('Keyboard shortcuts context changed', { 
        from: this.currentContext, 
        to: context 
      });
      this.currentContext = context;
      this.clearChord();
    }
  }

  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearChord();
    }
    logInfo('Keyboard shortcuts enabled state changed', { enabled });
  }

  /**
   * Get all shortcuts for a context
   */
  getShortcuts(context = null) {
    const contextFilter = context || this.currentContext;
    const shortcuts = [];
    
    for (const [key, shortcut] of this.shortcuts) {
      if (shortcut.context === contextFilter || shortcut.context === 'global') {
        shortcuts.push({
          ...shortcut,
          displayKeys: this.formatKeysForDisplay(shortcut.keys)
        });
      }
    }
    
    return shortcuts.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get shortcuts grouped by category
   */
  getGroupedShortcuts(context = null) {
    const shortcuts = this.getShortcuts(context);
    const grouped = {};
    
    for (const shortcut of shortcuts) {
      const group = shortcut.group || 'Other';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(shortcut);
    }
    
    return grouped;
  }

  /**
   * Show/hide help overlay
   */
  toggleHelp() {
    this.helpVisible = !this.helpVisible;
    this.notifyListeners('helpToggled', { visible: this.helpVisible });
    return this.helpVisible;
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Private methods

  initializeEventListeners() {
    if (typeof document === 'undefined') return;

    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    document.addEventListener('blur', this.handleWindowBlur.bind(this));
  }

  handleKeyDown(event) {
    if (!this.isEnabled) return;

    // Track pressed keys
    this.pressedKeys.add(event.code);
    
    // Check if we should ignore this event
    if (this.shouldIgnoreEvent(event)) return;

    // Build current key combination
    const keyCombo = this.buildKeyCombo(event);
    
    // Handle chord sequences
    if (this.activeChord) {
      const chordCombo = `${this.activeChord}+${keyCombo}`;
      const handled = this.executeShortcut(chordCombo, event);
      this.clearChord();
      if (handled) return;
    }
    
    // Try to execute as regular shortcut
    const handled = this.executeShortcut(keyCombo, event);
    
    // Check if this could be the start of a chord
    if (!handled && this.enableChords && this.couldBeChordStart(keyCombo)) {
      this.startChord(keyCombo);
      if (event.preventDefault) event.preventDefault();
    }
  }

  handleKeyUp(event) {
    this.pressedKeys.delete(event.code);
    
    // Clear key sequence on modifier release
    if (this.isModifier(event.code)) {
      this.keySequence = [];
    }
  }

  handleWindowBlur() {
    this.pressedKeys.clear();
    this.keySequence = [];
    this.clearChord();
  }

  shouldIgnoreEvent(event) {
    // Don't handle shortcuts in input elements (unless explicitly allowed)
    const target = event.target;
    const isInput = target.tagName === 'INPUT' || 
                   target.tagName === 'TEXTAREA' || 
                   target.contentEditable === 'true';
    
    if (isInput) {
      // Check if any shortcut allows execution in inputs
      const keyCombo = this.buildKeyCombo(event);
      const shortcuts = this.findShortcuts(keyCombo);
      return !shortcuts.some(s => s.allowInInputs);
    }
    
    return false;
  }

  buildKeyCombo(event) {
    const parts = [];
    
    // Add modifiers in consistent order
    if (event.ctrlKey || event.metaKey) parts.push(this.ctrlKey);
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    
    // Add the main key
    const key = this.normalizeKey(event.code, event.key);
    if (key && !this.isModifier(event.code)) {
      parts.push(key);
    }
    
    return parts.join('+');
  }

  normalizeKey(code, key) {
    // Convert from KeyboardEvent.code to readable format
    const keyMap = {
      'Space': 'space',
      'Enter': 'enter',
      'Escape': 'escape',
      'Tab': 'tab',
      'Backspace': 'backspace',
      'Delete': 'delete',
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Home': 'home',
      'End': 'end',
      'PageUp': 'pageup',
      'PageDown': 'pagedown'
    };

    if (keyMap[code]) return keyMap[code];
    
    // Function keys
    if (code.startsWith('F') && /^F\d+$/.test(code)) {
      return code.toLowerCase();
    }
    
    // Regular keys
    if (/^Key[A-Z]$/.test(code)) {
      return code.replace('Key', '').toLowerCase();
    }
    
    // Numbers
    if (/^Digit\d$/.test(code)) {
      return code.replace('Digit', '');
    }
    
    // Use the key value for other keys
    return key.toLowerCase();
  }

  normalizeShortcut(shortcut) {
    return shortcut.toLowerCase()
      .replace(/command|cmd/g, this.ctrlKey)
      .replace(/\s+/g, '');
  }

  isModifier(code) {
    return ['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 
            'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(code);
  }

  findShortcuts(keyCombo) {
    const shortcuts = [];
    
    // Check current context first, then global
    const contexts = [this.currentContext, 'global'];
    
    for (const context of contexts) {
      const key = `${context}:${keyCombo}`;
      const shortcut = this.shortcuts.get(key);
      if (shortcut) {
        shortcuts.push(shortcut);
      }
    }
    
    return shortcuts.sort((a, b) => b.priority - a.priority);
  }

  executeShortcut(keyCombo, event) {
    const shortcuts = this.findShortcuts(keyCombo);
    
    if (shortcuts.length === 0) return false;
    
    const shortcut = shortcuts[0]; // Use highest priority shortcut
    
    try {
      if (shortcut.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      const result = shortcut.handler(event, { shortcut, keyCombo });
      
      this.notifyListeners('shortcutExecuted', {
        shortcut: shortcut.keys,
        context: shortcut.context,
        description: shortcut.description
      });
      
      logInfo('Keyboard shortcut executed', {
        keys: shortcut.keys,
        context: shortcut.context,
        description: shortcut.description
      });
      
      return result !== false;
    } catch (error) {
      logError('Keyboard shortcut execution failed', {
        keys: shortcut.keys,
        error: error.message
      });
      return false;
    }
  }

  couldBeChordStart(keyCombo) {
    // Check if any shortcuts start with this combination
    for (const [key] of this.shortcuts) {
      if (key.includes('+') && key.startsWith(`${this.currentContext}:${keyCombo}+`)) {
        return true;
      }
    }
    return false;
  }

  startChord(keyCombo) {
    this.activeChord = keyCombo;
    this.chordTimer = setTimeout(() => {
      this.clearChord();
    }, this.chordTimeout);
    
    this.notifyListeners('chordStarted', { chord: keyCombo });
  }

  clearChord() {
    if (this.chordTimer) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
    
    if (this.activeChord) {
      this.notifyListeners('chordCleared', { chord: this.activeChord });
      this.activeChord = null;
    }
  }

  formatKeysForDisplay(keys) {
    return keys
      .split('+')
      .map(key => {
        const displayMap = {
          'ctrl': this.isMac ? '⌘' : 'Ctrl',
          'cmd': '⌘',
          'alt': this.isMac ? '⌥' : 'Alt',
          'shift': this.isMac ? '⇧' : 'Shift',
          'space': 'Space',
          'enter': 'Enter',
          'escape': 'Esc',
          'backspace': this.isMac ? '⌫' : 'Backspace',
          'delete': this.isMac ? '⌦' : 'Delete',
          'up': '↑',
          'down': '↓',
          'left': '←',
          'right': '→'
        };
        
        return displayMap[key] || key.toUpperCase();
      })
      .join(this.isMac ? '' : '+');
  }

  notifyListeners(type, data) {
    for (const listener of this.listeners) {
      try {
        listener({ type, ...data });
      } catch (error) {
        logWarning('Keyboard shortcuts listener error', { error: error.message });
      }
    }
  }

  registerDefaultShortcuts() {
    // Global shortcuts
    this.register('ctrl+z', () => false, {
      description: 'Undo',
      group: 'Edit',
      context: 'global'
    });

    this.register('ctrl+y', () => false, {
      description: 'Redo',
      group: 'Edit',
      context: 'global'
    });

    this.register('ctrl+shift+z', () => false, {
      description: 'Redo (alternative)',
      group: 'Edit',
      context: 'global'
    });

    this.register('ctrl+s', () => false, {
      description: 'Save',
      group: 'File',
      context: 'global'
    });

    this.register('ctrl+shift+s', () => false, {
      description: 'Save As',
      group: 'File',
      context: 'global'
    });

    this.register('ctrl+o', () => false, {
      description: 'Open',
      group: 'File',
      context: 'global'
    });

    this.register('ctrl+n', () => false, {
      description: 'New',
      group: 'File',
      context: 'global'
    });

    this.register('f1', (event) => {
      this.toggleHelp();
      return true;
    }, {
      description: 'Show keyboard shortcuts help',
      group: 'Help',
      context: 'global',
      allowInInputs: true
    });

    // Editor-specific shortcuts
    this.register('ctrl+shift+n', () => false, {
      description: 'Add new scene',
      group: 'Editor',
      context: 'editor'
    });

    this.register('delete', () => false, {
      description: 'Delete selected node',
      group: 'Editor',
      context: 'editor'
    });

    this.register('ctrl+d', () => false, {
      description: 'Duplicate selected node',
      group: 'Editor',
      context: 'editor'
    });

    this.register('ctrl+g', () => false, {
      description: 'Group selection',
      group: 'Editor',
      context: 'editor'
    });

    this.register('ctrl+shift+g', () => false, {
      description: 'Ungroup selection',
      group: 'Editor',
      context: 'editor'
    });

    this.register('ctrl+a', () => false, {
      description: 'Select all',
      group: 'Editor',
      context: 'editor'
    });

    this.register('escape', () => false, {
      description: 'Clear selection',
      group: 'Editor',
      context: 'editor'
    });

    this.register('f5', () => false, {
      description: 'Play test adventure',
      group: 'Editor',
      context: 'editor'
    });

    this.register('ctrl+shift+v', () => false, {
      description: 'Validate adventure',
      group: 'Editor',
      context: 'editor'
    });

    // Navigation shortcuts
    this.register('ctrl+k', () => {
      // Start command chord
      return true;
    }, {
      description: 'Command palette',
      group: 'Navigation',
      context: 'global'
    });

    this.register('ctrl+k+ctrl+s', () => false, {
      description: 'Open settings',
      group: 'Navigation',
      context: 'global'
    });

    this.register('ctrl+k+ctrl+h', () => {
      this.toggleHelp();
      return true;
    }, {
      description: 'Toggle help',
      group: 'Navigation',
      context: 'global'
    });
  }
}

// Singleton instance
export const keyboardShortcuts = new KeyboardShortcutsManager({
  enabled: true,
  enableChords: true,
  chordTimeout: 1000
});

// React hook for using keyboard shortcuts
export function useKeyboardShortcuts(shortcuts = [], context = 'global', deps = []) {
  const [React] = [typeof React !== 'undefined' ? React : null];
  const { useEffect, useCallback, useMemo } = React || {};
  
  if (!React) {
    console.warn('React not available - useKeyboardShortcuts hook will not work');
    return { registerShortcut: () => {}, unregisterAll: () => {} };
  }

  // Store cleanup functions
  const cleanupFunctions = useMemo(() => [], []);

  const registerShortcut = useCallback((shortcut, handler, options = {}) => {
    const cleanup = keyboardShortcuts.register(shortcut, handler, {
      context,
      ...options
    });
    
    cleanupFunctions.push(cleanup);
    return cleanup;
  }, [context, ...deps]);

  const unregisterAll = useCallback(() => {
    cleanupFunctions.forEach(cleanup => cleanup());
    cleanupFunctions.length = 0;
  }, []);

  useEffect(() => {
    // Set context when component mounts
    keyboardShortcuts.setContext(context);
    
    // Register shortcuts
    shortcuts.forEach(({ keys, handler, options = {} }) => {
      registerShortcut(keys, handler, options);
    });

    // Cleanup on unmount
    return () => {
      unregisterAll();
    };
  }, [context, ...deps]);

  return {
    registerShortcut,
    unregisterAll,
    setContext: keyboardShortcuts.setContext.bind(keyboardShortcuts),
    getShortcuts: keyboardShortcuts.getShortcuts.bind(keyboardShortcuts),
    toggleHelp: keyboardShortcuts.toggleHelp.bind(keyboardShortcuts)
  };
}

export default KeyboardShortcutsManager;