// EditorScreen.js - Enhanced with Phase 3 advanced features
import EditorToolbar from './core/EditorToolbar.js';
import EditorCanvas from './core/EditorCanvas.js';
import EditorSidebar from './core/EditorSidebar.js';
import ContextMenu from './core/ContextMenu.js';
import SceneEditDialog from './dialogs/SceneEditDialog.js';
import ChoiceEditDialog from './dialogs/ChoiceEditDialog.js';
import InventoryEditor from './InventoryEditor.js';
import AchievementsEditor from './AchievementsEditor.js';
import StatsEditor from './StatsEditor.js';
import EditorSessionStorage from '../../engine/EditorSessionStorage.js';
import AdvancedChoiceDialog from './AdvancedChoiceDialog.js';
import ActionHistoryDialog from './dialogs/ActionHistoryDialog.js';
import SearchPanel from './panels/SearchPanel.js';
import FlagEditor from './dialogs/FlagEditor.js';
import { commandHistory, CompositeCommand } from '../../services/CommandHistory.js';
import {
  CreateNodeCommand,
  DeleteNodeCommand,
  MoveNodeCommand,
  UpdateNodeCommand,
  CreateChoiceCommand,
  DeleteChoiceCommand,
  UpdateChoiceCommand,
  UpdateStatsCommand,
  CreateConnectionCommand,
  BulkOperationCommand,
  ImportAdventureCommand
} from '../../commands/EditorCommands.js';

import React, { useState, useEffect, useCallback, useRef, useMemo } from "https://esm.sh/react@18";
import { validationService } from '../../services/ValidationService.js';
import { exportAdventureToChoiceScript } from '../../editor/exporters/ChoiceScriptExporter.js';

export default function EditorScreen({
  onExitEditor = () => {},
  onPlayTest = () => {},
  className = ''
}) {
  // Session storage integration
  const [editorSession] = useState(() => new EditorSessionStorage());
  const [currentProject, setCurrentProject] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveIntervalRef = useRef(null);
  
  // Command system state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoDescription, setUndoDescription] = useState(null);
  const [redoDescription, setRedoDescription] = useState(null);
  const [commandHistoryVisible, setCommandHistoryVisible] = useState(false);
  const commandCallbacks = useRef(null);
  
  // Search panel state
  const [searchPanelVisible, setSearchPanelVisible] = useState(false);
  const [searchHighlights, setSearchHighlights] = useState([]);

  // Enhanced adventure state with Phase 3 features
  const [adventure, setAdventure] = useState({
    id: 'new_adventure',
    title: 'Untitled Adventure',
    author: '',
    version: '1.0.0',
    description: '',
    startSceneId: null,
    scenes: [],
    stats: [],
    inventory: [], // Phase 3: Inventory system
    achievements: [], // Phase 3: Achievement system
    flags: [], // Phase 3: Flag definitions
    categories: [], // Phase 3: Organization categories
    crossGameCompatibility: {
      version: '2.0',
      exportableStats: [],
      exportableFlags: [],
      exportableItems: []
    },
    metadata: {
      created: Date.now(),
      modified: Date.now(),
      estimatedPlayTime: 30,
      difficulty: 'medium',
      genre: ['adventure'],
      language: 'en'
    }
  });

  const [nodes, setNodes] = useState(new Map());
  const [connections, setConnections] = useState(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);

  // Debounce ref for auto validation
  const validationDebounceRef = useRef(null);

  const formatValidationEntry = useCallback((entry) => {
    if (!entry) return 'Unknown validation issue';
    if (typeof entry === 'string') return entry;
    if (entry.message) return entry.message;
    if (entry.detail) return entry.detail;
    try {
      return JSON.stringify(entry);
    } catch (error) {
      return String(entry);
    }
  }, []);

  const deepEqual = useCallback((a, b) => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (error) {
      return false;
    }
  }, []);

  const replaceSegment = useCallback((source = '', replacement = '', index = 0, match = '') => {
    if (typeof source !== 'string' || typeof replacement !== 'string') {
      return source;
    }
    if (typeof index !== 'number' || index < 0 || index >= source.length) {
      return source.replace(match, replacement);
    }
    const matchLength = typeof match === 'string' && match.length > 0 ? match.length : 0;
    const endIndex = matchLength > 0 ? index + matchLength : index + replacement.length;
    return `${source.slice(0, index)}${replacement}${source.slice(endIndex)}`;
  }, []);

  // Enhanced dialog state with Phase 3 dialogs
  const [activeDialog, setActiveDialog] = useState(null);
  const [dialogData, setDialogData] = useState(null);
  
  // Inventory editor state
  const [showInventoryEditor, setShowInventoryEditor] = useState(false);
  const [showAchievementsEditor, setShowAchievementsEditor] = useState(false);
  const [showStatsEditor, setShowStatsEditor] = useState(false);
  const [choiceScriptMode, setChoiceScriptMode] = useState(false);
  // Flags editor state
  const [showFlagEditor, setShowFlagEditor] = useState(false);
  const [editingFlag, setEditingFlag] = useState(null);
  // Inline flag creation callback (used by dropdowns with "+ Add Flag")
  const [pendingFlagSelectionCallback, setPendingFlagSelectionCallback] = useState(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    nodeId: null,
    nodeData: null
  });

  // Canvas viewport
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const exportFormatOptions = useMemo(() => (
    choiceScriptMode
      ? ['choicescript', 'json', 'yaml', 'xml']
      : ['json', 'yaml', 'xml', 'choicescript']
  ), [choiceScriptMode]);

  const highlightedNodeIds = useMemo(() => {
    const set = new Set();
    searchHighlights.forEach(highlight => {
      if (highlight?.nodeId) {
        set.add(highlight.nodeId);
      }
    });
    return set;
  }, [searchHighlights]);

  // Initialize command system
  useEffect(() => {
    // Set up command callbacks
    commandCallbacks.current = {
      onNodeCreate: handleNodeCreateCommand,
      onNodeDelete: handleNodeDeleteCommand,
      onNodeMove: handleNodeMoveCommand,
      onNodeUpdate: handleNodeUpdateCommand,
      onChoiceAdd: handleChoiceAddCommand,
      onChoiceDelete: handleChoiceDeleteCommand,
      onChoiceUpdate: handleChoiceUpdateCommand,
      onStatAdd: handleStatAddCommand,
      onStatUpdate: handleStatUpdateCommand,
      onStatDelete: handleStatDeleteCommand,
      onConnectionCreate: handleConnectionCreateCommand,
      onConnectionDelete: handleConnectionDeleteCommand,
      onAdventureImport: handleAdventureImportCommand,
      onAdventureClear: handleAdventureClearCommand
    };
    
    // Listen to command history changes
    const unsubscribe = commandHistory.addListener(handleCommandHistoryChange);
    
    // Update initial state
    updateCommandState();
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Load project list on mount
  useEffect(() => {
    loadProjectList();
    
    // Try to restore last session
    const lastSession = editorSession.getLastSession();
    if (lastSession) {
      setCurrentProject(lastSession.project);
      if (lastSession.adventureData) {
        executeCommand(new ImportAdventureCommand(
          lastSession.adventureData, 
          generateAdventureData(),
          commandCallbacks.current
        ));
      }
    } else {
  // Start blank by default (no sample adventure)
  // initializeSampleAdventure();
    }
  }, []);

  // Toolbar-driven panels (search/history) and auto-save effect
  useEffect(() => {
    const handleShowSearch = () => setSearchPanelVisible(true);
    const handleShowHistory = () => setCommandHistoryVisible(true);
    const handleHotkeys = (event) => {
      if (event.defaultPrevented) return;
      const targetTag = event.target?.tagName;
      if (targetTag && ['INPUT', 'TEXTAREA'].includes(targetTag)) return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === 'f') {
          event.preventDefault();
          handleShowSearch();
        } else if (key === 'h') {
          event.preventDefault();
          handleShowHistory();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('showSearchPanel', handleShowSearch);
      window.addEventListener('showActionHistory', handleShowHistory);
      window.addEventListener('keydown', handleHotkeys);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('showSearchPanel', handleShowSearch);
        window.removeEventListener('showActionHistory', handleShowHistory);
        window.removeEventListener('keydown', handleHotkeys);
      }
    };
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (autoSaveEnabled && hasUnsavedChanges && currentProject) {
      if (autoSaveIntervalRef.current) {
        clearTimeout(autoSaveIntervalRef.current);
      }
      
      autoSaveIntervalRef.current = setTimeout(() => {
        handleAutoSave();
      }, 30000); // Auto-save every 30 seconds
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearTimeout(autoSaveIntervalRef.current);
      }
    };
  }, [autoSaveEnabled, hasUnsavedChanges, currentProject, adventure, nodes]);

  // Mark unsaved changes when adventure or nodes change
  useEffect(() => {
    setHasUnsavedChanges(true);
    setAdventure(prev => ({ ...prev, metadata: { ...prev.metadata, modified: Date.now() } }));
  }, [adventure.title, adventure.description, nodes.size]);

  const loadProjectList = async () => {
    try {
      const projects = await editorSession.listProjects();
      setProjectList(projects);
      
      // Also check if there's a current project and load it
      const currentProj = await editorSession.getCurrentProject();
      if (currentProj && !currentProject) {
        setCurrentProject(currentProj);
      }
    } catch (error) {
      console.error('Failed to load project list:', error);
    }
  };

  const handleAutoSave = async () => {
    if (!currentProject) return;
    
    try {
      const adventureData = generateAdventureData();
      await editorSession.saveProject(currentProject.id, {
        ...currentProject,
        adventureData: adventureData,
        modified: Date.now()
      });
      
      setLastSaved(Date.now());
      setHasUnsavedChanges(false);
      console.log('Auto-saved project:', currentProject.name);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const generateAdventureData = useCallback(() => {
    return {
      ...adventure,
      startSceneId: Array.from(nodes.values()).find(n => n.isStartScene)?.id || Array.from(nodes.keys())[0] || null,
      scenes: Array.from(nodes.values()).map(node => {
        const { isStartScene, ...sceneData } = node;
        return sceneData;
      })
    };
  }, [adventure, nodes]);

  // Enhanced sample adventure with Phase 3 features
  const createEnhancedSampleAdventure = () => {
    const startNode = {
      id: 'start_scene',
      title: 'The Enchanted Forest',
      content: 'You stand at the edge of an enchanted forest. Ancient magic thrums through the air, and mystical creatures can be glimpsed through the trees.\n\nTo your left, you see a well-worn path marked with protective runes. To your right, a narrow trail leads deeper into the unknown.',
      choices: [
        { 
          id: 'choice_left', 
          text: 'Take the protected path', 
          targetSceneId: 'forest_left',
          conditions: [],
          actions: [{ type: 'set_flag', key: 'chose_safe_path', value: true }],
          consequences: [{ type: 'stat_change', description: 'Gain safety but lose mystery', severity: 'minor' }]
        },
        { 
          id: 'choice_right', 
          text: 'Brave the mysterious trail', 
          targetSceneId: 'forest_right',
          conditions: [],
          actions: [{ type: 'add_stat', key: 'courage', value: 10 }],
          consequences: [{ type: 'stat_change', description: 'Gain courage but risk danger', severity: 'moderate' }]
        },
        {
          id: 'secret_choice_1',
          text: 'Search for hidden paths',
          targetSceneId: 'secret_grove',
          isSecret: true,
          secretConditions: [{ type: 'stat', key: 'perception', operator: 'gte', value: 15 }],
          conditions: [{ type: 'stat', key: 'perception', operator: 'gte', value: 15 }],
          actions: [{ type: 'add_inventory', key: 'magic_compass', value: 1 }],
          consequences: [{ type: 'item_gain', description: 'Discover a magical compass', severity: 'major' }]
        }
      ],
      position: { x: 200, y: 100 },
      onEnter: [{ type: 'set_stat', key: 'perception', value: 10 }],
      onExit: []
    };

    const leftNode = {
      id: 'forest_left',
      title: 'Protected Grove',
      content: 'The protected path leads to a serene grove. Ancient guardian stones pulse with gentle light, keeping malevolent spirits at bay.',
      choices: [
        { 
          id: 'choice_return_left', 
          text: 'Return to the forest entrance', 
          targetSceneId: 'start_scene',
          conditions: [],
          actions: []
        },
        { 
          id: 'choice_rest_grove', 
          text: 'Rest by the guardian stones', 
          targetSceneId: 'grove_rest',
          conditions: [],
          actions: [{ type: 'add_stat', key: 'health', value: 25 }],
          requirements: [{ type: 'stat', key: 'health', operator: 'lt', value: 75 }]
        }
      ],
      position: { x: 50, y: 300 },
      onEnter: [{ type: 'set_flag', key: 'visited_protected_grove', value: true }],
      onExit: []
    };

    const rightNode = {
      id: 'forest_right',
      title: 'Mysterious Depths',
      content: 'The mysterious trail plunges into the heart of the forest. Strange whispers echo from the shadows, and magical energy crackles in the air.',
      choices: [
        { 
          id: 'choice_return_right', 
          text: 'Return to the forest entrance', 
          targetSceneId: 'start_scene',
          conditions: [],
          actions: []
        },
        { 
          id: 'choice_investigate', 
          text: 'Investigate the whispers', 
          targetSceneId: 'whisper_source',
          conditions: [{ type: 'stat', key: 'courage', operator: 'gte', value: 50 }],
          actions: [{ type: 'add_stat', key: 'magic_knowledge', value: 15 }],
          isLocked: true,
          lockReasons: ['Requires at least 50 courage']
        }
      ],
      position: { x: 350, y: 300 },
      onEnter: [{ type: 'add_stat', key: 'magic_exposure', value: 5 }],
      onExit: []
    };

    const groveRest = {
      id: 'grove_rest',
      title: 'Guardian Stones',
      content: 'You rest beside the guardian stones as their energy restores your strength.',
      choices: [
        {
          id: 'choice_return_from_rest',
          text: 'Return to the Protected Grove',
          targetSceneId: 'forest_left',
          actions: [{ type: 'set_stat', key: 'health', value: 100 }]
        }
      ],
      position: { x: -100, y: 460 },
      onEnter: [{ type: 'set_stat', key: 'health', value: 100 }],
      onExit: []
    };

    const whisperSource = {
      id: 'whisper_source',
      title: 'Echoing Clearing',
      content: 'The whispers converge here, revealing an ancient spirit eager to share forgotten lore.',
      choices: [
        {
          id: 'choice_listen_spirit',
          text: 'Listen to the spirit',
          targetSceneId: 'forest_right',
          actions: [{ type: 'add_stat', key: 'magic_knowledge', value: 10 }]
        }
      ],
      position: { x: 500, y: 460 },
      onEnter: [{ type: 'add_stat', key: 'magic_knowledge', value: 5 }],
      onExit: []
    };

    const secretGrove = {
      id: 'secret_grove',
      title: 'Hidden Sanctuary',
      content: 'Your keen perception has revealed a hidden sanctuary. Ancient trees form a perfect circle, and in the center grows a tree with silver leaves that shimmer with inner light.',
      choices: [
        {
          id: 'choice_touch_tree',
          text: 'Touch the silver tree',
          targetSceneId: 'tree_blessing',
          actions: [{ type: 'unlock_achievement', key: 'tree_touched', value: true }]
        }
      ],
      position: { x: 200, y: 500 },
      onEnter: [{ type: 'set_flag', key: 'found_secret_grove', value: true }],
      onExit: []
    };

    const treeBlessing = {
      id: 'tree_blessing',
      title: 'Silver Tree Blessing',
      content: 'The silver leaves glow brightly, filling you with renewed purpose.',
      choices: [
        {
          id: 'choice_return_from_blessing',
          text: 'Return to the sanctuary',
          targetSceneId: 'secret_grove',
          actions: [{ type: 'add_stat', key: 'courage', value: 5 }]
        }
      ],
      position: { x: 200, y: 660 },
      onEnter: [{ type: 'add_stat', key: 'courage', value: 5 }],
      onExit: []
    };

    // Enhanced adventure with Phase 3 features
    const adventure = {
      id: 'enhanced_sample_adventure',
      title: 'The Enchanted Forest Quest',
      author: 'Adventure Engine',
      version: '2.0.0',
      description: 'An enhanced forest adventure showcasing Phase 3 features including inventory, secrets, and achievements',
      startSceneId: startNode.id,
      scenes: [startNode, leftNode, rightNode, groveRest, whisperSource, secretGrove, treeBlessing],
      stats: [
        {
          id: 'health',
          name: 'Health',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          hidden: false,
          category: 'vital',
          description: 'Your physical well-being'
        },
        {
          id: 'courage',
          name: 'Courage',
          type: 'number',
          defaultValue: 50,
          min: 0,
          max: 100,
          hidden: false,
          category: 'attributes',
          description: 'Your bravery in the face of danger'
        },
        {
          id: 'perception',
          name: 'Perception',
          type: 'number',
          defaultValue: 10,
          min: 0,
          max: 100,
          hidden: false,
          category: 'attributes',
          description: 'Your ability to notice hidden details'
        },
        {
          id: 'magic_knowledge',
          name: 'Magical Knowledge',
          type: 'number',
          defaultValue: 0,
          min: 0,
          max: 100,
          hidden: false,
          category: 'skills',
          description: 'Your understanding of magical phenomena'
        }
      ],
      inventory: [
        {
          id: 'magic_compass',
          name: 'Enchanted Compass',
          description: 'A mystical compass that points toward hidden secrets',
          category: 'tools',
          stackable: false,
          weight: 0.5,
          value: 100,
          rarity: 'rare',
          effects: [{ type: 'stat_modifier', target: 'perception', value: 5 }],
          exportable: true
        },
        {
          id: 'healing_herbs',
          name: 'Forest Herbs',
          description: 'Medicinal herbs that restore health',
          category: 'consumables',
          stackable: true,
          maxStack: 10,
          weight: 0.1,
          value: 15,
          rarity: 'common',
          effects: [{ type: 'stat_modifier', target: 'health', value: 20 }],
          exportable: true
        }
      ],
      achievements: [
        {
          id: 'first_steps',
          name: 'First Steps',
          description: 'Begin your forest adventure',
          category: 'progression',
          conditions: [{ type: 'scene_visited', key: 'start_scene', operator: 'eq', value: true }],
          points: 10
        },
        {
          id: 'secret_finder',
          name: 'Secret Finder',
          description: 'Discover a hidden location',
          category: 'exploration',
          conditions: [{ type: 'scene_visited', key: 'secret_grove', operator: 'eq', value: true }],
          points: 25,
          rarity: 'rare'
        }
      ],
      flags: [
        {
          id: 'chose_safe_path',
          name: 'Chose Safe Path',
          description: 'Player chose the protected route',
          category: 'choices',
          defaultValue: false,
          exportable: true
        },
        {
          id: 'found_secret_grove',
          name: 'Found Secret Grove',
          description: 'Player discovered the hidden sanctuary',
          category: 'secrets',
          defaultValue: false,
          exportable: true
        }
      ],
      categories: [
        { id: 'vital', name: 'Vital Stats', color: '#ef4444', order: 1 },
        { id: 'attributes', name: 'Attributes', color: '#3b82f6', order: 2 },
        { id: 'skills', name: 'Skills', color: '#10b981', order: 3 }
      ],
      crossGameCompatibility: {
        version: '2.0',
        exportableStats: ['courage', 'perception', 'magic_knowledge'],
        exportableFlags: ['chose_safe_path', 'found_secret_grove'],
        exportableItems: ['magic_compass', 'healing_herbs']
      },
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        estimatedPlayTime: 45,
        difficulty: 'medium',
        genre: ['fantasy', 'adventure', 'exploration'],
        language: 'en',
        contentRating: 'G',
        keywords: ['magic', 'forest', 'secrets', 'exploration']
      }
    };

    return {
      nodes: new Map([
        [startNode.id, startNode],
        [leftNode.id, leftNode],
        [rightNode.id, rightNode],
        [groveRest.id, groveRest],
        [whisperSource.id, whisperSource],
        [secretGrove.id, secretGrove],
        [treeBlessing.id, treeBlessing]
      ]),
      startSceneId: startNode.id,
      adventure: adventure
    };
  };

  const initializeSampleAdventure = () => {
    const sampleData = createEnhancedSampleAdventure();
    
    setNodes(sampleData.nodes);
    setAdventure(sampleData.adventure);
    
    const updatedNodes = new Map(sampleData.nodes);
    const startNode = updatedNodes.get(sampleData.startSceneId);
    if (startNode) {
      updatedNodes.set(sampleData.startSceneId, { ...startNode, isStartScene: true });
    }
    setNodes(updatedNodes);
    setHasUnsavedChanges(false);
  };

  // Enhanced context menu with Phase 3 features
  const getContextMenuItems = useCallback((nodeData) => {
    const isStartScene = nodeData?.isStartScene || false;

    return [
      {
        key: 'edit',
        label: 'Edit Scene',
        icon: '✏️',
        onClick: () => openSceneDialog(contextMenu.nodeId)
      },
      {
        key: 'edit-advanced',
        label: 'Advanced Edit',
        icon: '⚙️',
        onClick: () => openAdvancedSceneDialog(contextMenu.nodeId)
      },
      {
        key: 'duplicate',
        label: 'Duplicate Scene',
        icon: '📋',
        onClick: () => {
          const node = nodes.get(contextMenu.nodeId);
          if (node) {
            const newNodeId = `scene_${Date.now()}`;
            const duplicatedNode = {
              ...node,
              id: newNodeId,
              title: `${node.title} (Copy)`,
              position: {
                x: node.position.x + 50,
                y: node.position.y + 50
              },
              isStartScene: false
            };
            setNodes(prev => new Map(prev.set(newNodeId, duplicatedNode)));
            setSelectedNodeId(newNodeId);
          }
        }
      },
      { separator: true },
      {
        key: 'add-secret',
        label: 'Add Secret Choice',
        icon: '✨',
        onClick: () => {
          const choiceId = `secret_choice_${Date.now()}`;
          const newChoice = {
            id: choiceId,
            text: 'New Secret Choice',
            targetSceneId: '',
            isSecret: true,
            secretConditions: [],
            conditions: [],
            actions: []
          };
          const node = nodes.get(contextMenu.nodeId);
          if (node) {
            handleNodeUpdate(contextMenu.nodeId, {
              choices: [...(node.choices || []), newChoice]
            });
          }
        }
      },
      {
        key: 'start',
        label: 'Set as Start Scene',
        icon: '🏠',
        onClick: () => handleSetStartScene(contextMenu.nodeId),
        disabled: isStartScene
      },
      { separator: true },
      {
        key: 'delete',
        label: 'Delete Scene',
        icon: '🗑️',
        onClick: () => {
          if (confirm('Delete this scene?')) {
            handleNodeDelete(contextMenu.nodeId);
          }
        },
        disabled: isStartScene
      }
    ];
  }, [contextMenu.nodeId, nodes]);

  // Enhanced node operations
  // Command system integration
  const executeCommand = useCallback(async (command) => {
    try {
      await commandHistory.executeCommand(command);
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Command execution failed:', error);
      alert(`Operation failed: ${error.message}`);
    }
  }, []);
  
  const handleUndo = useCallback(async () => {
    try {
      await commandHistory.undo();
    } catch (error) {
      console.error('Undo failed:', error);
      alert(`Undo failed: ${error.message}`);
    }
  }, []);
  
  const handleRedo = useCallback(async () => {
    try {
      await commandHistory.redo();
    } catch (error) {
      console.error('Redo failed:', error);
      alert(`Redo failed: ${error.message}`);
    }
  }, []);
  
  const handleCommandHistoryChange = useCallback((event) => {
    updateCommandState();
    
    // Handle different command events
    switch (event.type) {
      case 'execute':
      case 'undo':
      case 'redo':
        // Force re-render of components that depend on state
        break;
      case 'clear':
        // Handle history clear
        break;
    }
  }, []);
  
  const updateCommandState = useCallback(() => {
    setCanUndo(commandHistory.canUndo());
    setCanRedo(commandHistory.canRedo());
    setUndoDescription(commandHistory.getUndoDescription());
    setRedoDescription(commandHistory.getRedoDescription());
  }, []);

  // Advanced connection system refs and node versioning (move earlier to avoid TDZ)
  const connectionCacheEarly = useRef(new Map());
  const nodeVersionsEarly = useRef(new Map());
  const lastNodeChangeTimestampEarly = useRef(new Map());

  const updateNodeVersion = useCallback((nodeId) => {
    const currentVersion = nodeVersionsEarly.current.get(nodeId) || 0;
    nodeVersionsEarly.current.set(nodeId, currentVersion + 1);
    lastNodeChangeTimestampEarly.current.set(nodeId, Date.now());
  }, []);
  
  // Advanced connection system with caching and selective updates
  const updateConnectionsSelectively = useCallback((changedNodeIds = null) => {
    if (!changedNodeIds) {
      // Full update - clear cache
      connectionCacheEarly.current.clear();
    }

    const newConnections = new Map(connections);
    const nodesToUpdate = changedNodeIds || Array.from(nodes.keys());
    let hasChanges = false;

    // Performance optimization: batch process changes
    const changesBatch = {
      toRemove: new Set(),
      toAdd: new Map(),
      toUpdate: new Map()
    };

    nodesToUpdate.forEach(nodeId => {
      const node = nodes.get(nodeId);
      const nodeVersion = nodeVersionsEarly.current.get(nodeId) || 0;
      const cachedVersion = connectionCacheEarly.current.get(`${nodeId}_version`);

      // Skip if node hasn't changed and we have cached connections
      if (cachedVersion === nodeVersion && node && connectionCacheEarly.current.has(`${nodeId}_connections`)) {
        return;
      }

      if (!node) {
        // Handle node deletion
        const connectionsToRemove = Array.from(newConnections.keys())
          .filter(connId => {
            const conn = newConnections.get(connId);
            return conn?.fromNodeId === nodeId || conn?.toNodeId === nodeId;
          });

        connectionsToRemove.forEach(connId => changesBatch.toRemove.add(connId));
        connectionCacheEarly.current.delete(`${nodeId}_version`);
        connectionCacheEarly.current.delete(`${nodeId}_connections`);
        hasChanges = true;
        return;
      }
      
      // Remove existing connections from this node
      const existingConnections = Array.from(newConnections.keys())
        .filter(connId => connId.startsWith(`${nodeId}_`));
      
      existingConnections.forEach(connId => changesBatch.toRemove.add(connId));
      
      // Generate new connections for this node
      const nodeConnections = new Map();
      if (node.choices) {
        node.choices.forEach((choice) => {
          if (choice.targetSceneId && nodes.has(choice.targetSceneId)) {
            const connectionId = `${nodeId}_${choice.id}_${choice.targetSceneId}`;
            const newConnection = {
              id: connectionId,
              fromNodeId: nodeId,
              toNodeId: choice.targetSceneId,
              choiceId: choice.id,
              choice: choice
            };
            
            nodeConnections.set(connectionId, newConnection);
            changesBatch.toAdd.set(connectionId, newConnection);
          }
        });
      }
      
      // Cache the connections for this node
      connectionCacheEarly.current.set(`${nodeId}_version`, nodeVersion);
      connectionCacheEarly.current.set(`${nodeId}_connections`, nodeConnections);
      hasChanges = true;
    });
    
    // Apply batched changes
    if (hasChanges) {
      // Remove connections
      changesBatch.toRemove.forEach(connId => newConnections.delete(connId));
      
      // Add new connections
      changesBatch.toAdd.forEach((connection, connId) => {
        newConnections.set(connId, connection);
      });
      
      setConnections(newConnections);
    }
  }, [nodes, connections]);

  // Full connection regeneration with optional nodeId parameter for selective updates
  const generateConnections = useCallback((nodeId = null) => {
    if (nodeId) {
      // Selective update for single node
      updateConnectionsSelectively([nodeId]);
      return;
    }
    
    // Full regeneration - clear all caches
    connectionCacheEarly.current.clear();
    nodeVersionsEarly.current.clear();
    lastNodeChangeTimestampEarly.current.clear();
    
    const newConnections = new Map();
    
    nodes.forEach((node) => {
      if (node.choices) {
        node.choices.forEach((choice) => {
          if (choice.targetSceneId && nodes.has(choice.targetSceneId)) {
            const connectionId = `${node.id}_${choice.id}_${choice.targetSceneId}`;
            newConnections.set(connectionId, {
              id: connectionId,
              fromNodeId: node.id,
              toNodeId: choice.targetSceneId,
              choiceId: choice.id,
              choice: choice
            });
          }
        });
      }
      
      // Initialize version tracking
      updateNodeVersion(node.id);
    });
    
    setConnections(newConnections);
  }, [nodes, updateConnectionsSelectively]);
  
  // Command callback implementations
  const handleNodeCreateCommand = useCallback(async (nodeId, nodeData) => {
    setNodes(prev => new Map(prev.set(nodeId, nodeData)));
    setSelectedNodeId(nodeId);
  }, []);
  
  const handleNodeDeleteCommand = useCallback(async (nodeId) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      newNodes.delete(nodeId);
      return newNodes;
    });
    
    setConnections(prev => {
      const newConnections = new Map();
      for (const [id, conn] of prev) {
        if (conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId) {
          newConnections.set(id, conn);
        }
      }
      return newConnections;
    });

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);
  
  const handleNodeMoveCommand = useCallback(async (nodeId, position) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        newNodes.set(nodeId, { ...node, position });
      }
      return newNodes;
    });
    
    updateNodeVersion(nodeId);
    generateConnections(nodeId);
  }, [updateNodeVersion, generateConnections]);
  
  const handleNodeUpdateCommand = useCallback(async (nodeId, updates) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        newNodes.set(nodeId, { ...node, ...updates });
      }
      return newNodes;
    });
    
    updateNodeVersion(nodeId);
    if (updates.choices) {
      generateConnections(nodeId);
    }
  }, [updateNodeVersion, generateConnections]);
  
  const handleChoiceAddCommand = useCallback(async (nodeId, choiceData) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        const updatedChoices = [...(node.choices || []), choiceData];
        newNodes.set(nodeId, { ...node, choices: updatedChoices });
      }
      return newNodes;
    });
    
    updateNodeVersion(nodeId);
    generateConnections(nodeId);
  }, [updateNodeVersion, generateConnections]);
  
  const handleChoiceDeleteCommand = useCallback(async (nodeId, choiceId) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        const updatedChoices = node.choices.filter(c => c.id !== choiceId);
        newNodes.set(nodeId, { ...node, choices: updatedChoices });
      }
      return newNodes;
    });
    
    updateNodeVersion(nodeId);
    generateConnections(nodeId);
  }, [updateNodeVersion, generateConnections]);
  
  const handleChoiceUpdateCommand = useCallback(async (nodeId, choiceId, updates) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        const updatedChoices = node.choices.map(choice => 
          choice.id === choiceId ? { ...choice, ...updates } : choice
        );
        newNodes.set(nodeId, { ...node, choices: updatedChoices });
      }
      return newNodes;
    });
    
    updateNodeVersion(nodeId);
    if (updates.targetSceneId !== undefined) {
      generateConnections(nodeId);
    }
  }, [updateNodeVersion, generateConnections]);
  
  const handleStatAddCommand = useCallback(async (statData) => {
    setAdventure(prev => ({
      ...prev,
      stats: [...prev.stats, statData],
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
  }, []);
  
  const handleStatUpdateCommand = useCallback(async (statId, updates) => {
    setAdventure(prev => ({
      ...prev,
      stats: prev.stats.map(stat => 
        stat.id === statId ? { ...stat, ...updates } : stat
      ),
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
  }, []);
  
  const handleStatDeleteCommand = useCallback(async (statId) => {
    setAdventure(prev => ({
      ...prev,
      stats: prev.stats.filter(stat => stat.id !== statId),
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
  }, []);

  // Flag management handlers
  const handleFlagAdd = useCallback((flagData) => {
    setAdventure(prev => ({
      ...prev,
      flags: [...(prev.flags || []), flagData],
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleFlagUpdate = useCallback((flagData) => {
    setAdventure(prev => ({
      ...prev,
      flags: (prev.flags || []).map(f => f.id === flagData.id ? flagData : f),
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleFlagDelete = useCallback((flagId) => {
    setAdventure(prev => ({
      ...prev,
      flags: (prev.flags || []).filter(f => f.id !== flagId),
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
    setShowFlagEditor(false);
    setEditingFlag(null);
  }, []);
  
  // Allow child components to open the Flag Editor inline and receive the created flag
  const handleInlineAddFlag = useCallback((onCreated) => {
    if (typeof onCreated === 'function') {
      setPendingFlagSelectionCallback(() => onCreated);
    } else {
      setPendingFlagSelectionCallback(null);
    }
    setEditingFlag(null);
    setShowFlagEditor(true);
  }, []);

  const handleChoiceScriptModeToggle = useCallback((enabled) => {
    setChoiceScriptMode(Boolean(enabled));
  }, []);

  const handleNodeContextMenu = useCallback((nodeId, position, nodeData) => {
    const resolvedNode = nodeData || nodes.get(nodeId) || null;
    setSelectedNodeId(nodeId);
    setContextMenu({
      isOpen: true,
      position,
      nodeId,
      nodeData: resolvedNode
    });
  }, [nodes]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleChoiceAdd = useCallback((nodeId) => {
    if (!nodeId || !commandCallbacks.current) return;
    const node = nodes.get(nodeId);
    if (!node) return;

    const newChoice = {
      id: `choice_${Date.now()}`,
      text: 'New Choice',
      targetSceneId: '',
      conditions: [],
      secretConditions: [],
      actions: [],
      requirements: [],
      consequences: [],
      selectableIf: [],
      isSecret: false,
      isHidden: false,
      isLocked: false,
      isFake: false,
      lockReasons: [],
      inputType: 'static',
      inputConfig: {},
      notes: [],
      priority: 0,
      category: 'normal'
    };

    const command = new CreateChoiceCommand(nodeId, newChoice, commandCallbacks.current);
    executeCommand(command);
  }, [nodes, executeCommand]);

  const handleChoiceDelete = useCallback((nodeId, choiceId) => {
    if (!nodeId || !choiceId || !commandCallbacks.current) return;
    const command = new DeleteChoiceCommand(nodeId, choiceId, { nodes, connections }, commandCallbacks.current);
    executeCommand(command);
  }, [connections, executeCommand, nodes]);

  const handleChoiceUpdate = useCallback((nodeId, choiceId, updates = {}) => {
    if (!nodeId || !choiceId || !commandCallbacks.current) return;
    const node = nodes.get(nodeId);
    if (!node) return;
    const choice = (node.choices || []).find(c => c.id === choiceId);
    if (!choice) return;

    const commands = [];
    for (const [property, newValue] of Object.entries(updates)) {
      const oldValue = choice[property];
      if (deepEqual(oldValue, newValue)) continue;
      commands.push(new UpdateChoiceCommand(nodeId, choiceId, property, oldValue, newValue, commandCallbacks.current));
    }

    if (commands.length === 0) return;

    if (commands.length === 1) {
      executeCommand(commands[0]);
      return;
    }

    const composite = new CompositeCommand(`Update choice: ${choice.text || choiceId}`, commands, {
      type: 'update_choice_bulk',
      nodeId,
      choiceId
    });
    executeCommand(composite);
  }, [commandCallbacks, deepEqual, executeCommand, nodes]);

  const handleChoiceSave = useCallback((updatedChoice) => {
    if (!dialogData?.nodeId || !updatedChoice?.id) {
      setActiveDialog(null);
      setDialogData(null);
      return;
    }

    handleChoiceUpdate(dialogData.nodeId, updatedChoice.id, updatedChoice);
    setActiveDialog(null);
    setDialogData(null);
  }, [dialogData, handleChoiceUpdate]);

  const handleSceneSave = useCallback((updatedScene) => {
    if (!updatedScene?.id) {
      setActiveDialog(null);
      setDialogData(null);
      return;
    }

    const nodeId = updatedScene.id;
    const currentNode = nodes.get(nodeId);
    if (!currentNode || !commandCallbacks.current) {
      setActiveDialog(null);
      setDialogData(null);
      return;
    }

    const updates = {};
    Object.entries(updatedScene).forEach(([key, value]) => {
      if (key === 'id') return;
      if (!deepEqual(currentNode[key], value)) {
        updates[key] = value;
      }
    });

    if (Object.keys(updates).length > 0) {
      const bulk = new BulkOperationCommand('update_nodes', [
        {
          nodeId,
          updates,
          oldValues: currentNode
        }
      ], commandCallbacks.current, { editorState: { nodes, connections } });
      executeCommand(bulk);
      setAdventure(prev => ({
        ...prev,
        scenes: Array.isArray(prev.scenes)
          ? prev.scenes.map(scene => scene.id === nodeId ? { ...scene, ...updatedScene } : scene)
          : prev.scenes,
        metadata: { ...prev.metadata, modified: Date.now() }
      }));
      generateConnections(nodeId);
    } else {
      // ensure connections refresh even when only metadata changed
      generateConnections(nodeId);
    }

    setActiveDialog(null);
    setDialogData(null);
  }, [connections, deepEqual, executeCommand, nodes, setAdventure, generateConnections]);

  const handleInventoryUpdate = useCallback((newInventory = []) => {
    setAdventure(prev => ({
      ...prev,
      inventory: Array.isArray(newInventory) ? newInventory : [],
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSearchHighlight = useCallback((highlights = []) => {
    setSearchHighlights(Array.isArray(highlights) ? highlights : []);
  }, []);

  useEffect(() => {
    if (!searchPanelVisible) {
      setSearchHighlights([]);
    }
  }, [searchPanelVisible]);

  const handleSearchNavigate = useCallback((nodeId, match) => {
    if (nodeId) {
      setSelectedNodeId(nodeId);
    }
    if (match?.type === 'choice' && match.choiceId) {
      // Future enhancement: focus specific choice
    }
  }, []);

  const handleSearchReplace = useCallback((replacements = []) => {
    if (!Array.isArray(replacements) || replacements.length === 0) return;

    const mutatedNodes = new Map(nodes);
    const affectedNodes = new Set();

    replacements.forEach(({ nodeId, type, replacement, match, index, choiceId }) => {
      const node = mutatedNodes.get(nodeId);
      if (!node || typeof replacement !== 'string') return;

      if (type === 'title' && typeof node.title === 'string') {
        const updatedTitle = replaceSegment(node.title, replacement, index, match);
        if (node.title !== updatedTitle) {
          mutatedNodes.set(nodeId, { ...node, title: updatedTitle });
          affectedNodes.add(nodeId);
        }
      } else if (type === 'content' && typeof node.content === 'string') {
        const updatedContent = replaceSegment(node.content, replacement, index, match);
        if (node.content !== updatedContent) {
          mutatedNodes.set(nodeId, { ...node, content: updatedContent });
          affectedNodes.add(nodeId);
        }
      } else if (type === 'choice' && choiceId) {
        const choices = node.choices || [];
        const updatedChoices = choices.map(choice => {
          if (choice.id !== choiceId || typeof choice.text !== 'string') {
            return choice;
          }
          const updatedText = replaceSegment(choice.text, replacement, index, match);
          if (choice.text === updatedText) {
            return choice;
          }
          affectedNodes.add(nodeId);
          return { ...choice, text: updatedText };
        });
        if (affectedNodes.has(nodeId)) {
          mutatedNodes.set(nodeId, { ...node, choices: updatedChoices });
        }
      }
    });

    if (affectedNodes.size === 0) return;

    setNodes(mutatedNodes);
    affectedNodes.forEach(nodeId => {
      updateNodeVersion(nodeId);
    });
    generateConnections(Array.from(affectedNodes));
    setAdventure(prev => ({
      ...prev,
      scenes: Array.isArray(prev.scenes)
        ? prev.scenes.map(scene => {
            if (!affectedNodes.has(scene.id)) return scene;
            const updatedNode = mutatedNodes.get(scene.id);
            return updatedNode ? { ...scene, ...updatedNode } : scene;
          })
        : prev.scenes,
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, [generateConnections, nodes, replaceSegment, setAdventure, updateNodeVersion]);

  const handleStatUpdate = useCallback((statId, updates = {}) => {
    const existing = adventure.stats.find(stat => stat.id === statId);
    if (!existing) return;
    const updatedStat = { ...existing, ...updates };
    const command = new UpdateStatsCommand('update', updatedStat, adventure.stats, commandCallbacks.current);
    executeCommand(command);
  }, [adventure.stats, commandCallbacks, executeCommand]);

  const handleStatDelete = useCallback((statId) => {
    const existing = adventure.stats.find(stat => stat.id === statId);
    if (!existing) return;
    const command = new UpdateStatsCommand('delete', existing, adventure.stats, commandCallbacks.current);
    executeCommand(command);
  }, [adventure.stats, commandCallbacks, executeCommand]);
  
  const handleConnectionCreateCommand = useCallback(async (connectionData) => {
    setConnections(prev => new Map(prev.set(connectionData.id, connectionData)));
  }, []);
  
  const handleConnectionDeleteCommand = useCallback(async (connectionId) => {
    setConnections(prev => {
      const newConnections = new Map(prev);
      newConnections.delete(connectionId);
      return newConnections;
    });
  }, []);
  
  const handleImport = useCallback((incomingData) => {
    try {
      const data = incomingData?.adventureData ? incomingData.adventureData : incomingData;
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid adventure data payload');
      }

      const rawScenes = Array.isArray(data.scenes) ? data.scenes : [];
      const sceneIdMap = new Map();
      const usedSceneIds = new Set();

      rawScenes.forEach((scene, index) => {
        const originalId = typeof scene?.id === 'string' && scene.id.trim() ? scene.id.trim() : null;
        const fallbackId = `scene_${index + 1}`;
        let candidateId = originalId || fallbackId;
        let counter = 2;
        while (!candidateId || usedSceneIds.has(candidateId)) {
          candidateId = `${originalId || fallbackId}_${counter}`;
          counter += 1;
        }
        usedSceneIds.add(candidateId);
        if (originalId) {
          sceneIdMap.set(originalId, candidateId);
        }
        sceneIdMap.set(`__index_${index}`, candidateId);
      });

      const nodesFromImport = new Map();
      const connectionsFromImport = new Map();

      rawScenes.forEach((scene, index) => {
        const fallbackId = `scene_${index + 1}`;
        const originalId = typeof scene?.id === 'string' && scene.id.trim() ? scene.id.trim() : null;
        const nodeId = sceneIdMap.get(originalId || `__index_${index}`) || fallbackId;

        const normalizedChoices = Array.isArray(scene?.choices)
          ? scene.choices.map((choice, choiceIndex) => {
              const choiceId = typeof choice?.id === 'string' && choice.id.trim()
                ? choice.id.trim()
                : `choice_${nodeId}_${choiceIndex + 1}`;
              const targetOriginal = typeof choice?.targetSceneId === 'string' && choice.targetSceneId.trim()
                ? choice.targetSceneId.trim()
                : '';
              const targetSceneId = targetOriginal
                ? sceneIdMap.get(targetOriginal) || targetOriginal
                : '';
              return {
                ...choice,
                id: choiceId,
                text: choice?.text || `Option ${choiceIndex + 1}`,
                targetSceneId
              };
            })
          : [];

        const nodePosition = (scene?.position && typeof scene.position.x === 'number' && typeof scene.position.y === 'number')
          ? scene.position
          : { x: 200 + (index % 5) * 220, y: 120 + Math.floor(index / 5) * 180 };

        nodesFromImport.set(nodeId, {
          ...scene,
          id: nodeId,
          title: scene?.title || `Scene ${index + 1}`,
          content: scene?.content || '',
          choices: normalizedChoices,
          position: nodePosition,
          onEnter: Array.isArray(scene?.onEnter) ? scene.onEnter : [],
          onExit: Array.isArray(scene?.onExit) ? scene.onExit : [],
          isStartScene: false
        });
      });

      let resolvedStartSceneId = null;
      if (data.startSceneId) {
        resolvedStartSceneId = sceneIdMap.get(data.startSceneId) || (nodesFromImport.has(data.startSceneId) ? data.startSceneId : null);
      }
      if (!resolvedStartSceneId && nodesFromImport.size > 0) {
        resolvedStartSceneId = nodesFromImport.keys().next().value;
      }

      nodesFromImport.forEach((node, nodeId) => {
        const isStartScene = nodeId === resolvedStartSceneId;
        if (node.isStartScene !== isStartScene) {
          nodesFromImport.set(nodeId, { ...node, isStartScene });
        }

        node.choices?.forEach(choice => {
          if (choice.targetSceneId && nodesFromImport.has(choice.targetSceneId)) {
            const connectionId = `${nodeId}_${choice.id}_${choice.targetSceneId}`;
            connectionsFromImport.set(connectionId, {
              id: connectionId,
              fromNodeId: nodeId,
              toNodeId: choice.targetSceneId,
              choiceId: choice.id,
              choice
            });
          }
        });
      });

      const sanitizedScenes = Array.from(nodesFromImport.values()).map(({ isStartScene, ...sceneData }) => sceneData);

      const mergedAdventure = {
        ...adventure,
        ...data,
        startSceneId: resolvedStartSceneId || null,
        scenes: sanitizedScenes,
        stats: Array.isArray(data.stats) ? data.stats : [],
        inventory: Array.isArray(data.inventory) ? data.inventory : [],
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        flags: Array.isArray(data.flags) ? data.flags : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        crossGameCompatibility: {
          ...adventure.crossGameCompatibility,
          ...(data.crossGameCompatibility || {})
        },
        metadata: {
          ...adventure.metadata,
          ...(data.metadata || {}),
          modified: Date.now()
        }
      };

      commandHistory.clear();
      updateCommandState();
      connectionCacheEarly.current.clear();
      nodeVersionsEarly.current.clear();
      lastNodeChangeTimestampEarly.current.clear();

      setAdventure(mergedAdventure);
      setNodes(nodesFromImport);
      setConnections(connectionsFromImport);
      setSelectedNodeId(resolvedStartSceneId || null);
      setContextMenu(prev => ({ ...prev, isOpen: false }));
      setActiveDialog(null);
      setDialogData(null);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to import adventure:', error);
      alert(`Failed to import adventure: ${error.message}`);
    }
  }, [adventure, updateCommandState]);

  const handleAdventureImportCommand = useCallback(async (adventureData) => {
    handleImport(adventureData);
  }, [handleImport]);

  const validateAdventure = useCallback(async (options = {}) => {
    const adventureData = generateAdventureData();
    if (validationDebounceRef.current) {
      clearTimeout(validationDebounceRef.current);
      validationDebounceRef.current = null;
    }

    try {
      const result = await validationService.validate(adventureData, {
        scope: 'editor',
        enableFixes: false,
        includeContext: false,
        skipCache: false,
        ...options
      });

      setValidationErrors((result.errors || []).map(formatValidationEntry));
      setValidationWarnings((result.warnings || []).map(formatValidationEntry));
      return result;
    } catch (error) {
      console.error('EditorScreen: Adventure validation failed', error);
      const fallback = {
        errors: [{ message: `Validation failed: ${error.message}` }],
        warnings: []
      };
      setValidationErrors([`Validation failed: ${error.message}`]);
      setValidationWarnings([]);
      return fallback;
    }
  }, [generateAdventureData, formatValidationEntry]);
  
  const handleAdventureClearCommand = useCallback(async () => {
    setNodes(new Map());
    setConnections(new Map());
    setSelectedNodeId(null);
    initializeSampleAdventure();
  }, []);

  const handleNodeCreate = useCallback((position) => {
    const nodeId = `scene_${Date.now()}`;
    const newNode = {
      id: nodeId,
      title: 'New Scene',
      content: '',
      choices: [],
      position: position,
      isStartScene: false,
      onEnter: [],
      onExit: [],
      tags: [],
      category: 'general',
      requiredItems: []
    };
    
    const command = new CreateNodeCommand(
      newNode, 
      position, 
      { nodes, connections },
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [nodes, connections, executeCommand]);

  const handleNodeUpdate = useCallback((nodeId, updates) => {
    const node = nodes.get(nodeId);
    if (!node) return;
    
    // Create commands for each property update
    const commands = [];
    
    for (const [property, newValue] of Object.entries(updates)) {
      const oldValue = node[property];
      if (oldValue !== newValue) {
        commands.push(new UpdateNodeCommand(
          nodeId, 
          property, 
          oldValue, 
          newValue, 
          commandCallbacks.current
        ));
      }
    }
    
    if (commands.length === 1) {
      executeCommand(commands[0]);
    } else if (commands.length > 1) {
      const bulkCommand = new BulkOperationCommand(
        'update_nodes',
        [{ nodeId, updates, oldValues: node }],
        commandCallbacks.current,
        { editorState: { nodes, connections } }
      );
      executeCommand(bulkCommand);
    }
  }, [nodes, connections, executeCommand]);

  const handleNodeMove = useCallback((nodeId, position) => {
    const node = nodes.get(nodeId);
    if (!node) return;
    
    const command = new MoveNodeCommand(
      nodeId,
      node.position,
      position,
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [nodes, executeCommand]);

  // Live drag handler - updates node position immediately without creating history entries
  const handleNodeDrag = useCallback((nodeId, position) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        newNodes.set(nodeId, { ...node, position });
      }
      return newNodes;
    });
  }, []);

  const handleNodeDelete = useCallback((nodeId) => {
    const node = nodes.get(nodeId);
    if (!node) return;
    
    if (node.isStartScene) {
      alert('Cannot delete the start scene. Set another scene as start first.');
      return;
    }

    const command = new DeleteNodeCommand(
      nodeId,
      { nodes, connections },
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [nodes, connections, executeCommand]);

  const handleSetStartScene = useCallback((nodeId) => {
    setNodes(prev => {
      const newNodes = new Map();
      for (const [id, node] of prev) {
        newNodes.set(id, { ...node, isStartScene: id === nodeId });
      }
      return newNodes;
    });

    setAdventure(prev => ({ ...prev, startSceneId: nodeId }));
    setHasUnsavedChanges(true);
  }, []);

  // Enhanced dialog operations
  const openSceneDialog = useCallback((nodeId) => {
    const node = nodes.get(nodeId);
    if (node) {
      setDialogData(node);
      setActiveDialog('scene');
    }
  }, [nodes]);

  const openAdvancedSceneDialog = useCallback((nodeId) => {
    const node = nodes.get(nodeId);
    if (node) {
      setDialogData(node);
      setActiveDialog('advanced-scene');
    }
  }, [nodes]);

  const openAdvancedChoiceDialog = useCallback((nodeId, choiceId) => {
    const node = nodes.get(nodeId);
    const choice = node?.choices.find(c => c.id === choiceId);
    if (choice) {
      setDialogData({ choice, nodeId, availableScenes: Array.from(nodes.values()) });
      setActiveDialog('advanced-choice');
    }
  }, [nodes]);

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
    setDialogData(null);
  }, []);

  // Enhanced project operations
  const handleNewProject = async (projectName) => {
    try {
      const projectData = {
        name: projectName,
        data: {
          title: projectName,
          adventureData: generateAdventureData()
        }
      };
      
      const project = await editorSession.createNewProject(projectData);
      setCurrentProject(project);
      
      // Reload project list and get current project
      await loadProjectList();
      const currentProj = await editorSession.getCurrentProject();
      if (currentProj) {
        setCurrentProject(currentProj);
      }
      
      initializeSampleAdventure();
      setHasUnsavedChanges(false);
    } catch (error) {
      alert(`Failed to create project: ${error.message}`);
    }
  };

  const handleLoadProject = async (projectData) => {
    setCurrentProject(projectData.project);
    if (projectData.adventureData) {
      handleImport(projectData.adventureData);
    }
    setHasUnsavedChanges(false);
    setLastSaved(projectData.project.modified);
  };

  const handleSaveProject = async (saveAsName = null) => {
    try {
      const adventureData = generateAdventureData();

      if (saveAsName && typeof saveAsName === 'string' && saveAsName.trim()) {
        // Save as new project (duplicate current content under a new name)
        const projectRecord = await editorSession.createNewProject({
          name: saveAsName.trim(),
          data: { adventureData }
        });

        // Set newly created project as current
        setCurrentProject(projectRecord);
        setLastSaved(projectRecord.modified || Date.now());
        setHasUnsavedChanges(false);

      } else {
        // Regular save (if no current project, create one)
        if (!currentProject) {
          const projectName = prompt('Enter project name:');
          if (!projectName) return;
          const created = await editorSession.createNewProject({
            name: projectName,
            data: { adventureData }
          });
          setCurrentProject(created);
          setLastSaved(created.modified || Date.now());
          setHasUnsavedChanges(false);
        } else {
          const updated = await editorSession.saveProject(currentProject.id, {
            ...currentProject,
            adventureData: adventureData,
            modified: Date.now()
          });

          setLastSaved(updated.modified || Date.now());
          setHasUnsavedChanges(false);
        }
      }

      // Refresh project list and set current project from storage
      await loadProjectList();
      const refreshed = await editorSession.getCurrentProject();
      if (refreshed) setCurrentProject(refreshed);

    } catch (error) {
      alert(`Failed to save project: ${error.message}`);
    }
  };

      // Enhanced export with multiple formats
  const handleExportWithFormat = useCallback(async (format = "json") => {
    const adventureData = generateAdventureData();
    const sanitizedTitle = (adventure.title || "adventure").replace(/[^a-z0-9]/gi, "_").toLowerCase();

    let content;
    let filename;
    let mimeType;

    switch (format.toLowerCase()) {
      case "choicescript": {
        const result = await exportAdventureToChoiceScript(adventureData);
        content = result.data;
        mimeType = "application/zip";
        filename = `${sanitizedTitle}_choicescript.zip`;
        if (result.warnings && result.warnings.length > 0) {
          console.warn("ChoiceScript export warnings:", result.warnings);
        }
        break;
      }
      case "yaml":
        content = JSON.stringify(adventureData, null, 2)
          .replace(/"/g, "")
          .replace(/:/g, ": ")
          .replace(/,/g, "")
          .replace(/\{/g, "")
          .replace(/\}/g, "");
        filename = `${sanitizedTitle}.yaml`;
        mimeType = "text/yaml";
        break;
      case "xml":
        content = `<?xml version="1.0" encoding="UTF-8"?>\n<adventure>\n${JSON.stringify(adventureData, null, 2)}\n</adventure>`;
        filename = `${sanitizedTitle}.xml`;
        mimeType = "text/xml";
        break;
      default:
        content = JSON.stringify(adventureData, null, 2);
        filename = `${sanitizedTitle}.json`;
        mimeType = "application/json";
        break;
    }

    const dataBlob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [generateAdventureData, adventure.title]);
  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null;

  return React.createElement('div', {
    className: `editor-screen h-screen flex flex-col bg-gray-100 text-gray-900 ${className}`
  }, [
    React.createElement(EditorToolbar, {
      key: 'toolbar',
      adventureTitle: adventure.title,
      hasNodes: nodes.size > 0,
      validationErrors: validationErrors,
      validationWarnings: validationWarnings,
      canExport: nodes.size > 0,
      selectedNodeId: selectedNodeId,
      currentProject: currentProject,
      projectList: projectList,
      autoSaveEnabled: autoSaveEnabled,
      lastSaved: lastSaved,
      hasUnsavedChanges: hasUnsavedChanges,
      exportFormats: exportFormatOptions,
      sessionStorage: editorSession,
      onProjectListRefresh: loadProjectList,
      onNewAdventure: async (projectName) => {
        if (!hasUnsavedChanges || confirm('Create new adventure? Unsaved changes will be lost.')) {
          if (projectName) {
            await handleNewProject(projectName);
          } else {
            initializeSampleAdventure();
            setCurrentProject(null);
          }
        }
      },
      onImportAdventure: handleImport,
      onExportAdventure: () => handleExportWithFormat(choiceScriptMode ? 'choicescript' : 'json'),
      onExportFormat: handleExportWithFormat,
      onAddScene: () => handleNodeCreate({ x: 200, y: 200 }),
      onDeleteSelected: () => {
        if (selectedNodeId && confirm('Delete selected scene?')) {
          handleNodeDelete(selectedNodeId);
        }
      },
      onPlayTest: async () => {
        const result = await validateAdventure({ skipCache: true, scope: 'runtime' });
        const errors = Array.isArray(result?.errors) ? result.errors : [];
        if (errors.length > 0) {
          alert('Fix validation errors before play testing');
        } else {
          const adventureData = generateAdventureData();
          onPlayTest(adventureData);
        }
      },
      onValidate: () => {
        validateAdventure({ skipCache: false });
      },
      onSaveEditor: handleSaveProject,
      onLoadEditor: handleLoadProject,
      onAutoSaveToggle: (enabled) => {
        setAutoSaveEnabled(enabled);
        if (enabled && hasUnsavedChanges) {
          handleAutoSave();
        }
      },
      // Command system props
      canUndo: canUndo,
      canRedo: canRedo,
      undoDescription: undoDescription,
      redoDescription: redoDescription,
      onUndo: handleUndo,
      onRedo: handleRedo,
      commandHistory: commandHistory,
      isChoiceScriptMode: choiceScriptMode,
      onChoiceScriptModeToggle: handleChoiceScriptModeToggle
    }),

    React.createElement('div', {
      key: 'main-content',
      className: 'flex-1 flex overflow-hidden'
    }, [
      React.createElement(EditorCanvas, {
        key: 'canvas',
        className: 'flex-1',
        nodes: nodes,
        connections: connections,
        selectedNodeId: selectedNodeId,
        highlightedNodeIds: highlightedNodeIds,
        onNodeSelect: setSelectedNodeId,
  onNodeMove: handleNodeMove,
  onNodeDrag: handleNodeDrag,
        onNodeCreate: handleNodeCreate,
        onNodeContextMenu: handleNodeContextMenu,
        onConnectionCreate: (fromId, toId) => {
          console.log('Create connection:', fromId, '->', toId);
        }
      }),

      React.createElement(EditorSidebar, {
        key: 'sidebar',
        selectedNode: selectedNode,
        adventureStats: adventure.stats,
        adventureInventory: adventure.inventory,
      choiceScriptMode: choiceScriptMode,
        adventureAchievements: adventure.achievements,
        adventureFlags: adventure.flags,
    availableScenes: Array.from(nodes.values()),
        onNodeUpdate: handleNodeUpdate,
        onChoiceAdd: handleChoiceAdd,
        onChoiceUpdate: handleChoiceUpdate,
        onChoiceDelete: handleChoiceDelete,
        onStatAdd: () => setShowStatsEditor(true),
        onStatUpdate: handleStatUpdate,
        onStatDelete: handleStatDelete,
        onOpenSceneDialog: openSceneDialog,
        onOpenChoiceDialog: (nodeId, choiceId) => openAdvancedChoiceDialog(nodeId, choiceId),
        onOpenInventoryEditor: () => setShowInventoryEditor(true),
        onOpenAchievementsEditor: () => setShowAchievementsEditor(true),
        onOpenFlagsEditor: () => { setShowFlagEditor(true); setEditingFlag(null); },
        isChoiceScriptMode: choiceScriptMode
      })
    ]),

    React.createElement(ContextMenu, {
      key: 'context-menu',
      isOpen: contextMenu.isOpen,
      position: contextMenu.position,
      items: contextMenu.isOpen ? getContextMenuItems(contextMenu.nodeData) : [],
      onClose: handleCloseContextMenu
    }),

    React.createElement(SceneEditDialog, {
      key: 'scene-dialog',
      isOpen: activeDialog === 'scene',
      scene: activeDialog === 'scene' ? dialogData : null,
      adventureStats: adventure.stats,
      adventureInventory: adventure.inventory,
      choiceScriptMode: choiceScriptMode,
      adventureFlags: adventure.flags,
      onInlineAddFlag: handleInlineAddFlag,
      onSave: handleSceneSave,
      onCancel: closeDialog,
      onDelete: (sceneId) => {
        if (confirm('Delete this scene?')) {
          handleNodeDelete(sceneId);
          closeDialog();
        }
      }
    }),

    React.createElement(AdvancedChoiceDialog, {
      key: 'advanced-choice-dialog',
      isOpen: activeDialog === 'advanced-choice',
      choice: activeDialog === 'advanced-choice' ? dialogData?.choice : null,
      availableScenes: activeDialog === 'advanced-choice' ? dialogData?.availableScenes || [] : [],
      isChoiceScriptMode: choiceScriptMode,
      availableStats: adventure.stats || [],
      availableFlags: adventure.flags || [],
      availableItems: adventure.inventory || [],
  availableAchievements: adventure.achievements || [],
      onInlineAddFlag: handleInlineAddFlag,
      existingChoices: selectedNode?.choices || [],
      onSave: handleChoiceSave,
      onCancel: closeDialog,
      onDelete: (choiceId) => {
        if (confirm('Delete this choice?')) {
          if (dialogData?.nodeId) {
            handleChoiceDelete(dialogData.nodeId, choiceId);
          }
          closeDialog();
        }
      }
    }),

    React.createElement(FlagEditor, {
      key: 'flag-editor',
      isOpen: showFlagEditor,
      flags: adventure.flags || [],
      editingFlag: editingFlag,
      onSave: (flag) => {
        const exists = (adventure.flags || []).some(f => f.id === flag.id);
        if (exists) handleFlagUpdate(flag); else handleFlagAdd(flag);
        setShowFlagEditor(false);
        setEditingFlag(null);
        // If invoked from an inline selection, notify the requester with the created/updated flag
        if (pendingFlagSelectionCallback) {
          try {
            pendingFlagSelectionCallback(flag);
          } finally {
            setPendingFlagSelectionCallback(null);
          }
        }
      },
      onCancel: () => { setShowFlagEditor(false); setEditingFlag(null); },
      onDelete: (flagId) => handleFlagDelete(flagId)
    }),

    React.createElement(InventoryEditor, {
      key: 'inventory-editor',
      isOpen: showInventoryEditor,
      items: adventure.inventory,
      onItemsChange: (newInventory) => {
        handleInventoryUpdate(newInventory);
      },
      onClose: () => setShowInventoryEditor(false)
    }),

    React.createElement(AchievementsEditor, {
      key: 'achievements-editor',
      isOpen: showAchievementsEditor,
      achievements: adventure.achievements || [],
      onClose: () => setShowAchievementsEditor(false),
      onAchievementsChange: (next) => setAdventure(prev => ({ ...prev, achievements: next, metadata: { ...prev.metadata, modified: Date.now() } })),
      availableStats: adventure.stats || [],
      availableFlags: adventure.flags || [],
      availableItems: adventure.inventory || [],
      availableScenes: Array.from(nodes.values()),
      onInlineAddFlag: handleInlineAddFlag
    }),

    React.createElement(StatsEditor, {
      key: 'stats-editor',
      isOpen: showStatsEditor,
      stats: adventure.stats || [],
      onClose: () => setShowStatsEditor(false),
      onStatsChange: (next) => setAdventure(prev => ({ ...prev, stats: next, metadata: { ...prev.metadata, modified: Date.now() } }))
    }),

    React.createElement(ActionHistoryDialog, {
      key: 'action-history-dialog',
      isOpen: commandHistoryVisible,
      commandHistory: commandHistory,
      isChoiceScriptMode: choiceScriptMode,
      onChoiceScriptModeToggle: handleChoiceScriptModeToggle,
      onClose: () => setCommandHistoryVisible(false),
      onJumpToCommand: async (commandIndex) => {
        try {
          await commandHistory.jumpToIndex(commandIndex);
        } catch (error) {
          console.error('Failed to jump to command:', error);
          alert(`Failed to jump to command: ${error.message}`);
        }
      },
      onClearHistory: () => {
        commandHistory.clear();
        setCommandHistoryVisible(false);
      }
    }),

    React.createElement(SearchPanel, {
      key: 'search-panel',
      isOpen: searchPanelVisible,
      nodes: nodes,
      adventure: adventure,
      onClose: () => setSearchPanelVisible(false),
      onNavigateToNode: handleSearchNavigate,
      onHighlightMatches: handleSearchHighlight,
      onReplaceAll: handleSearchReplace
    })
  ]);
}









