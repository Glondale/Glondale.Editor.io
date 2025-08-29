// EditorScreen.js - Enhanced with Phase 3 advanced features
import EditorToolbar from './core/EditorToolbar.js';
import EditorCanvas from './core/EditorCanvas.js';
import EditorSidebar from './core/EditorSidebar.js';
import ContextMenu from './core/ContextMenu.js';
import SceneEditDialog from './dialogs/SceneEditDialog.js';
import ChoiceEditDialog from './dialogs/ChoiceEditDialog.js';
import InventoryEditor from './InventoryEditor.js';
import EditorSessionStorage from '../../../engine/EditorSessionStorage.js';
import AdvancedChoiceDialog from './dialogs/AdvancedChoiceDialog.js';

const { useState, useEffect, useCallback, useRef } = React;

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

  // Enhanced dialog state with Phase 3 dialogs
  const [activeDialog, setActiveDialog] = useState(null);
  const [dialogData, setDialogData] = useState(null);
  
  // Inventory editor state
  const [showInventoryEditor, setShowInventoryEditor] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    nodeId: null,
    nodeData: null
  });

  // Canvas viewport
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Load project list on mount
  useEffect(() => {
    loadProjectList();
    
    // Try to restore last session
    const lastSession = editorSession.getLastSession();
    if (lastSession) {
      setCurrentProject(lastSession.project);
      if (lastSession.adventureData) {
        handleImport(lastSession.adventureData);
      }
    } else {
      // Initialize with sample adventure if no session
      initializeSampleAdventure();
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

  const generateAdventureData = () => {
    return {
      ...adventure,
      scenes: Array.from(nodes.values()).map(node => {
        const { isStartScene, ...sceneData } = node;
        return sceneData;
      })
    };
  };

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
    
    setNodes(prev => new Map(prev.set(nodeId, newNode)));
    setSelectedNodeId(nodeId);
  }, []);

  const handleNodeUpdate = useCallback((nodeId, updates) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        newNodes.set(nodeId, { ...node, ...updates });
      }
      return newNodes;
    });
    
    if (updates.choices) {
      generateConnections();
    }
    setHasUnsavedChanges(true);
  }, []);

  const handleNodeDelete = useCallback((nodeId) => {
    const node = nodes.get(nodeId);
    if (node?.isStartScene) {
      alert('Cannot delete the start scene. Set another scene as start first.');
      return;
    }

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
    setHasUnsavedChanges(true);
  }, [selectedNodeId, nodes]);

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
      const project = await editorSession.createProject(projectName, {
        title: projectName,
        adventureData: generateAdventureData()
      });
      setCurrentProject(project);
      initializeSampleAdventure();
      await loadProjectList();
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

  const handleSaveProject = async () => {
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
      await loadProjectList();
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

  // Enhanced import with validation
  const handleImport = useCallback((adventureData) => {
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
      setHasUnsavedChanges(true);
    } catch (error) {
      alert('Error importing adventure: ' + error.message);
    }
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

  // Generate connections from node choices
  const generateConnections = useCallback(() => {
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
    });
    
    setConnections(newConnections);
  }, [nodes]);

  useEffect(() => {
    generateConnections();
  }, [generateConnections]);

  // Enhanced choice operations with Phase 3 features
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
      oneTime: false
    };

    handleNodeUpdate(nodeId, {
      choices: [...(nodes.get(nodeId)?.choices || []), newChoice]
    });
  }, [nodes, handleNodeUpdate]);

  const handleChoiceUpdate = useCallback((nodeId, choiceId, updates) => {
    const node = nodes.get(nodeId);
    if (node) {
      const updatedChoices = node.choices.map(choice =>
        choice.id === choiceId ? { ...choice, ...updates } : choice
      );
      handleNodeUpdate(nodeId, { choices: updatedChoices });
    }
  }, [nodes, handleNodeUpdate]);

  const handleChoiceDelete = useCallback((nodeId, choiceId) => {
    const node = nodes.get(nodeId);
    if (node) {
      const filteredChoices = node.choices.filter(choice => choice.id !== choiceId);
      handleNodeUpdate(nodeId, { choices: filteredChoices });
    }
  }, [nodes, handleNodeUpdate]);

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

  // Stats management with Phase 3 features
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

    setAdventure(prev => ({
      ...prev,
      stats: [...prev.stats, newStat],
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleStatUpdate = useCallback((statId, updates) => {
    setAdventure(prev => ({
      ...prev,
      stats: prev.stats.map(stat => 
        stat.id === statId ? { ...stat, ...updates } : stat
      ),
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleStatDelete = useCallback((statId) => {
    setAdventure(prev => ({
      ...prev,
      stats: prev.stats.filter(stat => stat.id !== statId),
      metadata: { ...prev.metadata, modified: Date.now() }
    }));
    setHasUnsavedChanges(true);
  }, []);

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
      onNewAdventure: () => {
        if (!hasUnsavedChanges || confirm('Create new adventure? Unsaved changes will be lost.')) {
          initializeSampleAdventure();
          setCurrentProject(null);
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
      }
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
        onNodeUpdate: handleNodeUpdate,
        onChoiceAdd: handleChoiceAdd,
        onChoiceUpdate: handleChoiceUpdate,
        onChoiceDelete: handleChoiceDelete,
        onStatAdd: handleStatAdd,
        onStatUpdate: handleStatUpdate,
        onStatDelete: handleStatDelete,
        onOpenSceneDialog: openSceneDialog,
        onOpenChoiceDialog: (nodeId, choiceId) => openAdvancedChoiceDialog(nodeId, choiceId),
        onOpenInventoryEditor: () => setShowInventoryEditor(true)
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
      adventureStats: adventure.stats,
      adventureInventory: adventure.inventory,
      adventureFlags: adventure.flags,
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

    React.createElement(InventoryEditor, {
      key: 'inventory-editor',
      isOpen: showInventoryEditor,
      inventory: adventure.inventory,
      categories: adventure.categories,
      onSave: (newInventory) => {
        handleInventoryUpdate(newInventory);
        setShowInventoryEditor(false);
      },
      onCancel: () => setShowInventoryEditor(false)
    })
  ]);
}