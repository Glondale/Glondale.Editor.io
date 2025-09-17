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
import { commandHistory } from '../../services/CommandHistory.js';
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

  // Enhanced dialog state with Phase 3 dialogs
  const [activeDialog, setActiveDialog] = useState(null);
  const [dialogData, setDialogData] = useState(null);
  
  // Inventory editor state
  const [showInventoryEditor, setShowInventoryEditor] = useState(false);
  const [showAchievementsEditor, setShowAchievementsEditor] = useState(false);
  const [showStatsEditor, setShowStatsEditor] = useState(false);
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

    // Enhanced adventure with Phase 3 features
    const adventure = {
      id: 'enhanced_sample_adventure',
      title: 'The Enchanted Forest Quest',
      author: 'Adventure Engine',
      version: '2.0.0',
      description: 'An enhanced forest adventure showcasing Phase 3 features including inventory, secrets, and achievements',
      startSceneId: startNode.id,
      scenes: [startNode, leftNode, rightNode, secretGrove],
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
        [secretGrove.id, secretGrove]
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
  
  const handleAdventureImportCommand = useCallback(async (adventureData) => {
    handleImport(adventureData);
  }, []);
  
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
  const handleExportWithFormat = useCallback((format = 'json') => {
    const adventureData = generateAdventureData();
    
    let content, filename, mimeType;
    
    switch (format.toLowerCase()) {
      case 'yaml':
        // Simple YAML export (would need proper YAML library in real implementation)
        content = JSON.stringify(adventureData, null, 2)
          .replace(/"/g, '')
          .replace(/:/g, ': ')
          .replace(/,/g, '')
          .replace(/\{/g, '')
          .replace(/\}/g, '');
        filename = `${adventure.title.replace(/[^a-z0-9]/gi, '_')}.yaml`;
        mimeType = 'text/yaml';
        break;
      
      case 'xml':
        // Simple XML export
        content = `<?xml version="1.0" encoding="UTF-8"?>\n<adventure>\n${JSON.stringify(adventureData, null, 2)}\n</adventure>`;
        filename = `${adventure.title.replace(/[^a-z0-9]/gi, '_')}.xml`;
        mimeType = 'text/xml';
        break;
      
      default:
        content = JSON.stringify(adventureData, null, 2);
        filename = `${adventure.title.replace(/[^a-z0-9]/gi, '_')}.json`;
        mimeType = 'application/json';
    }
    
    const dataBlob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(url);
  }, [adventure, nodes]);

  // Enhanced import with command system
  const handleImport = useCallback((adventureData) => {
    const command = new ImportAdventureCommand(
      adventureData,
      generateAdventureData(),
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [executeCommand]);
  
  // Internal import handler (called by command)
  const handleImportInternal = useCallback((adventureData) => {
    try {
      setAdventure({
        id: adventureData.id || 'imported_adventure',
        title: adventureData.title || 'Imported Adventure',
        author: adventureData.author || '',
        version: adventureData.version || '1.0.0',
        description: adventureData.description || '',
        startSceneId: adventureData.startSceneId,
        stats: adventureData.stats || [],
        inventory: adventureData.inventory || [],
        achievements: adventureData.achievements || [],
        flags: adventureData.flags || [],
        categories: adventureData.categories || [],
        crossGameCompatibility: adventureData.crossGameCompatibility || {
          version: '2.0',
          exportableStats: [],
          exportableFlags: [],
          exportableItems: []
        },
        metadata: {
          ...adventureData.metadata,
          modified: Date.now()
        } || {
          created: Date.now(),
          modified: Date.now(),
          estimatedPlayTime: 30,
          difficulty: 'medium',
          genre: ['adventure'],
          language: 'en'
        }
      });

      const importedNodes = new Map();
      (adventureData.scenes || []).forEach(scene => {
        importedNodes.set(scene.id, {
          ...scene,
          position: scene.position || { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
          isStartScene: scene.id === adventureData.startSceneId,
          // Ensure Phase 3 properties exist
          tags: scene.tags || [],
          category: scene.category || 'general',
          requiredItems: scene.requiredItems || []
        });
      });
      
      setNodes(importedNodes);
      setSelectedNodeId(null);
    } catch (error) {
      alert('Error importing adventure: ' + error.message);
      throw error;
    }
  }, []);
  
  // Update command callback to use internal handler
  useEffect(() => {
    if (commandCallbacks.current) {
      commandCallbacks.current.onAdventureImport = handleImportInternal;
    }
  }, [handleImportInternal]);
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check if we're in an input field - don't intercept if so
      const isInputField = event.target.tagName === 'INPUT' || 
                          event.target.tagName === 'TEXTAREA' || 
                          event.target.contentEditable === 'true';
                          
      if (isInputField) return;
      
      // Handle Ctrl+Z (Undo)
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          handleUndo();
        }
        return;
      }
      
      // Handle Ctrl+Y or Ctrl+Shift+Z (Redo)
      if ((event.ctrlKey && event.key === 'y') || 
          (event.ctrlKey && event.shiftKey && event.key === 'z')) {
        event.preventDefault();
        if (canRedo) {
          handleRedo();
        }
        return;
      }
      
      // Handle Ctrl+H (Show/Hide Command History)
      if (event.ctrlKey && event.key === 'h' && !event.shiftKey) {
        event.preventDefault();
        setCommandHistoryVisible(prev => !prev);
        return;
      }
      
      // Handle Ctrl+S (Manual Save)
      if (event.ctrlKey && event.key === 's' && !event.shiftKey) {
        event.preventDefault();
        handleManualSave();
        return;
      }
      
      // Handle Ctrl+F (Search Panel)
      if (event.ctrlKey && event.key === 'f' && !event.shiftKey) {
        event.preventDefault();
        setSearchPanelVisible(prev => !prev);
        return;
      }
    };
    
    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [canUndo, canRedo, handleUndo, handleRedo]);
  
  // Manual save handler
  const handleManualSave = useCallback(async () => {
    if (!currentProject) {
      // No current project - create new one
      const projectName = prompt('Save as new project (enter name):', adventure.title);
      if (!projectName) return;
      
      try {
        const adventureData = generateAdventureData();
        const newProject = await editorSession.createNewProject({
          name: projectName,
          data: { adventureData }
        });
        
        setCurrentProject(newProject);
        setLastSaved(newProject.created);
        setHasUnsavedChanges(false);
        alert('Project saved successfully!');
      } catch (error) {
        alert(`Failed to save project: ${error.message}`);
      }
    } else {
      // Save existing project
      try {
        const adventureData = generateAdventureData();
        await editorSession.forceSave(currentProject.id, {
          title: adventure.title,
          data: { adventureData }
        });
        
        setLastSaved(Date.now());
        setHasUnsavedChanges(false);
        
        // Show brief confirmation
        const statusElement = document.querySelector('[data-save-status]');
        if (statusElement) {
          statusElement.textContent = 'Saved!';
          setTimeout(() => {
            statusElement.textContent = '';
          }, 1500);
        }
      } catch (error) {
        alert(`Failed to save project: ${error.message}`);
      }
    }
  }, [currentProject, adventure.title, editorSession, generateAdventureData]);
  
  // Search panel handlers
  const handleSearchNavigate = useCallback((nodeId, matchData) => {
    setSelectedNodeId(nodeId);
    
    // Center on the selected node
    const node = nodes.get(nodeId);
    if (node && node.position) {
      // Focus on the node by updating viewport if needed
      // This would typically require canvas integration
      console.log('Navigating to node:', nodeId, matchData);
    }
  }, [nodes]);
  
  const handleSearchHighlight = useCallback((highlightData) => {
    setSearchHighlights(highlightData);
  }, []);
  
  const handleSearchReplace = useCallback((replacements) => {
    // Apply all replacements using command system
    const commands = [];
    
    replacements.forEach(replacement => {
      const node = nodes.get(replacement.nodeId);
      if (!node) return;
      
      let updatedText = replacement.original.replace(replacement.match, replacement.replacement);
      
      if (replacement.type === 'title') {
        const command = new UpdateNodeCommand(
          replacement.nodeId,
          'title',
          node.title,
          updatedText,
          commandCallbacks.current
        );
        commands.push(command);
      } else if (replacement.type === 'content') {
        const command = new UpdateNodeCommand(
          replacement.nodeId,
          'content',
          node.content,
          updatedText,
          commandCallbacks.current
        );
        commands.push(command);
      } else if (replacement.type === 'choice' && replacement.choiceId) {
        const choice = node.choices?.find(c => c.id === replacement.choiceId);
        if (choice) {
          const command = new UpdateChoiceCommand(
            replacement.nodeId,
            replacement.choiceId,
            'text',
            choice.text,
            updatedText,
            commandCallbacks.current
          );
          commands.push(command);
        }
      }
    });
    
    // Execute all commands as a bulk operation
    if (commands.length > 0) {
      const bulkCommand = new BulkOperationCommand(
        commands,
        `Replace ${commands.length} occurrences`,
        commandCallbacks.current
      );
      executeCommand(bulkCommand);
    }
  }, [nodes, executeCommand]);
  
  // Listen for action history and search panel events
  useEffect(() => {
    const handleShowActionHistory = () => {
      setCommandHistoryVisible(true);
    };
    
    const handleShowSearchPanel = () => {
      setSearchPanelVisible(true);
    };
    
    window.addEventListener('showActionHistory', handleShowActionHistory);
    window.addEventListener('showSearchPanel', handleShowSearchPanel);
    
    return () => {
      window.removeEventListener('showActionHistory', handleShowActionHistory);
      window.removeEventListener('showSearchPanel', handleShowSearchPanel);
    };
  }, []);

  // Enhanced validation with Phase 3 features
  const validateAdventure = useCallback(() => {
    const errors = [];
    const warnings = [];

    if (!adventure.startSceneId || !nodes.has(adventure.startSceneId)) {
      errors.push('No valid start scene defined');
    }

    // Validate inventory items
    adventure.inventory?.forEach((item, index) => {
      if (!item.id || !item.name || !item.category) {
        errors.push(`Inventory item ${index + 1} is missing required fields`);
      }
    });

    // Validate achievements
    adventure.achievements?.forEach((achievement, index) => {
      if (!achievement.id || !achievement.name || !achievement.conditions) {
        errors.push(`Achievement ${index + 1} is missing required fields`);
      }
    });

    for (const [nodeId, node] of nodes) {
      if (!node.title?.trim()) {
        warnings.push(`Scene "${nodeId}" has no title`);
      }
      if (!node.content?.trim()) {
        warnings.push(`Scene "${nodeId}" has no content`);
      }

      node.choices?.forEach((choice, index) => {
        if (!choice.text?.trim()) {
          errors.push(`Scene "${node.title || nodeId}" choice ${index + 1} has no text`);
        }
        if (choice.targetSceneId && !nodes.has(choice.targetSceneId)) {
          errors.push(`Scene "${node.title || nodeId}" choice "${choice.text}" targets non-existent scene`);
        }
        
        // Validate secret choices
        if (choice.isSecret && (!choice.secretConditions || choice.secretConditions.length === 0)) {
          warnings.push(`Secret choice "${choice.text}" in scene "${node.title || nodeId}" has no discovery conditions`);
        }
        
        // Validate locked choices
        if (choice.isLocked && (!choice.requirements || choice.requirements.length === 0)) {
          warnings.push(`Locked choice "${choice.text}" in scene "${node.title || nodeId}" has no requirements`);
        }
      });
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
    return { errors, warnings };
  }, [adventure, nodes]);

  // Subscribe to ValidationService events so the error tracker updates in real time
  useEffect(() => {
    const handleValidationComplete = ({ adventure: adv, result }) => {
      if (!result) return;
      // Map result entries to simple strings for toolbar display (keep full objects internally if needed later)
      const errors = (result.errors || []).map(e => (typeof e === 'string' ? e : e.message || JSON.stringify(e)));
      const warnings = (result.warnings || []).map(w => (typeof w === 'string' ? w : w.message || JSON.stringify(w)));

      setValidationErrors(errors);
      setValidationWarnings(warnings);
    };

    const handleValidationError = ({ error }) => {
      setValidationErrors([`Validation system error: ${error?.message || String(error)}`]);
      setValidationWarnings([]);
    };

    validationService.on('validation-complete', handleValidationComplete);
    validationService.on('validation-cached', handleValidationComplete);
    validationService.on('validation-error', handleValidationError);

    return () => {
      validationService.off('validation-complete', handleValidationComplete);
      validationService.off('validation-cached', handleValidationComplete);
      validationService.off('validation-error', handleValidationError);
    };
  }, []);

  // Auto-validate (debounced) when nodes or adventure change so toolbar updates live
  useEffect(() => {
    if (validationDebounceRef.current) {
      clearTimeout(validationDebounceRef.current);
    }

    validationDebounceRef.current = setTimeout(() => {
      try {
        const adv = generateAdventureData();
        // Fire-and-forget; ValidationService will emit events we subscribed to above
        validationService.validate(adv, { realTimeMode: true, includeContext: false }).catch(() => {});
      } catch (e) {
        // ignore
      }
    }, 400);

    return () => {
      if (validationDebounceRef.current) clearTimeout(validationDebounceRef.current);
    };
  }, [nodes, adventure]);

  // Context menu operations
  const handleNodeContextMenu = useCallback((nodeId, position, nodeData) => {
    setContextMenu({
      isOpen: true,
      position: position,
      nodeId: nodeId,
      nodeData: nodeData
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      nodeId: null,
      nodeData: null
    });
  }, []);

  // ...generateConnections is declared earlier to avoid TDZ

  // Memoized connection data for rendering performance
  const connectionArray = useMemo(() => {
    return Array.from(connections.values());
  }, [connections]);

  // Intelligently handle connection generation based on changes
  useEffect(() => {
    if (nodes.size > 0) {
      // Check if this is initial load or a structural change
      const hasConnectionsForAllNodes = Array.from(nodes.keys()).every(nodeId =>
  connectionCacheEarly.current.has(`${nodeId}_version`)
      );

      if (!hasConnectionsForAllNodes) {
        // Full regeneration needed for initial load or major changes
        generateConnections();
      }
    } else {
      // Clear connections when no nodes
      setConnections(new Map());
  connectionCacheEarly.current.clear();
    }
  }, [nodes.size, generateConnections]);

  // Enhanced choice operations with command system
  const handleChoiceAdd = useCallback((nodeId) => {
    const choiceId = `choice_${Date.now()}`;
    const newChoice = {
      id: choiceId,
      text: 'New Choice',
      targetSceneId: '',
      conditions: [],
      actions: [],
      isHidden: false,
      isSecret: false,
      isLocked: false,
      requirements: [],
      consequences: [],
      priority: 0,
        oneTime: false,
        maxUses: 0,
        cooldown: 0
    };

    const command = new CreateChoiceCommand(
      nodeId,
      newChoice,
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [executeCommand]);

  const handleChoiceUpdate = useCallback((nodeId, choiceId, updates) => {
    const node = nodes.get(nodeId);
    if (!node) return;

    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice) return;

    // Create commands for each property update
    const commands = [];

    for (const [property, newValue] of Object.entries(updates)) {
      const oldValue = choice[property];
      if (oldValue !== newValue) {
        commands.push(new UpdateChoiceCommand(
          nodeId,
          choiceId,
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
      // Execute multiple choice updates as a batch
      executeCommand(commands[0]); // For now, execute individually
      for (let i = 1; i < commands.length; i++) {
        setTimeout(() => executeCommand(commands[i]), i * 10);
      }
    }
  }, [nodes, executeCommand]);

  const handleChoiceDelete = useCallback((nodeId, choiceId) => {
    const command = new DeleteChoiceCommand(
      nodeId,
      choiceId,
      { nodes, connections },
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [nodes, connections, executeCommand]);

  // Dialog operations
  const closeDialog = useCallback(() => {
    setActiveDialog(null);
    setDialogData(null);
  }, []);

  const handleSceneSave = useCallback((updatedScene) => {
    handleNodeUpdate(updatedScene.id, updatedScene);
    closeDialog();
  }, [handleNodeUpdate, closeDialog]);

  const handleChoiceSave = useCallback((updatedChoice) => {
    if (dialogData?.nodeId) {
      handleChoiceUpdate(dialogData.nodeId, updatedChoice.id, updatedChoice);
    }
    closeDialog();
  }, [dialogData, handleChoiceUpdate, closeDialog]);

  // Inventory management
  const handleInventoryUpdate = useCallback((newInventory) => {
    setAdventure(prev => ({
      ...prev,
      inventory: newInventory,
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Stats management with command system
  const handleStatAdd = useCallback(() => {
    const statId = `stat_${Date.now()}`;
    const newStat = {
      id: statId,
      name: 'New Stat',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
      hidden: false,
      category: 'general',
      description: '',
      noExport: false
    };

    const command = new UpdateStatsCommand(
      'add',
      newStat,
      adventure.stats,
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [adventure.stats, executeCommand]);

  const handleStatUpdate = useCallback((statId, updates) => {
    const oldStat = adventure.stats.find(s => s.id === statId);
    if (!oldStat) return;
    
    const updatedStat = { ...oldStat, ...updates };
    const command = new UpdateStatsCommand(
      'update',
      updatedStat,
      adventure.stats,
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [adventure.stats, executeCommand]);

  const handleStatDelete = useCallback((statId) => {
    const statToDelete = adventure.stats.find(s => s.id === statId);
    if (!statToDelete) return;
    
    const command = new UpdateStatsCommand(
      'delete',
      statToDelete,
      adventure.stats,
      commandCallbacks.current
    );
    
    executeCommand(command);
  }, [adventure.stats, executeCommand]);

  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null;

  return React.createElement('div', {
    className: `editor-screen h-screen flex flex-col bg-gray-100 ${className}`
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
      exportFormats: ['json', 'yaml', 'xml'],
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
      onExportAdventure: () => handleExportWithFormat('json'),
      onExportFormat: handleExportWithFormat,
      onAddScene: () => handleNodeCreate({ x: 200, y: 200 }),
      onDeleteSelected: () => {
        if (selectedNodeId && confirm('Delete selected scene?')) {
          handleNodeDelete(selectedNodeId);
        }
      },
      onPlayTest: () => {
        const { errors } = validateAdventure();
        if (errors.length > 0) {
          alert('Fix validation errors before play testing');
        } else {
          const adventureData = generateAdventureData();
          onPlayTest(adventureData);
        }
      },
      onValidate: validateAdventure,
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
      commandHistory: commandHistory
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
        onOpenFlagsEditor: () => { setShowFlagEditor(true); setEditingFlag(null); }
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