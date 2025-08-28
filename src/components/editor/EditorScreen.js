// EditorScreen.js - Main editor component that combines all parts
// Handles: editor layout, component coordination, dialog management, context menu

import EditorToolbar from './core/EditorToolbar.js';
import EditorCanvas from './core/EditorCanvas.js';
import EditorSidebar from './core/EditorSidebar.js';
import ContextMenu from './core/ContextMenu.js';
import SceneEditDialog from './dialogs/SceneEditDialog.js';
import ChoiceEditDialog from './dialogs/ChoiceEditDialog.js';

const { useState, useEffect, useCallback } = React;

export default function EditorScreen({
  onExitEditor = () => {},
  onPlayTest = () => {},
  className = ''
}) {
  // Editor state
  const [adventure, setAdventure] = useState({
    id: 'new_adventure',
    title: 'Untitled Adventure',
    author: '',
    version: '1.0.0',
    description: '',
    startSceneId: null,
    scenes: [],
    stats: []
  });

  const [nodes, setNodes] = useState(new Map());
  const [connections, setConnections] = useState(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);

  // Dialog state
  const [activeDialog, setActiveDialog] = useState(null);
  const [dialogData, setDialogData] = useState(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    nodeId: null,
    nodeData: null
  });

  // Canvas viewport
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Create sample adventure with proper format
  const createSampleAdventure = () => {
    const startNode = {
      id: 'start_scene',
      title: 'The Beginning',
      content: 'You stand at the edge of a dark forest. The path ahead splits into two directions.\n\nTo your left, you see a well-worn trail that looks safe but longer. To your right, there\'s a narrow path that disappears into thick undergrowth.',
      choices: [
        { id: 'choice_left', text: 'Take the left path', targetSceneId: 'forest_left', conditions: [], actions: [] },
        { id: 'choice_right', text: 'Take the right path', targetSceneId: 'forest_right', conditions: [], actions: [] }
      ],
      position: { x: 100, y: 100 },
      onEnter: [],
      onExit: []
    };

    const leftNode = {
      id: 'forest_left',
      title: 'Dark Grove',
      content: 'The left path leads to a dark grove filled with ancient trees. The air is thick and mysterious, and you feel like you\'re being watched.',
      choices: [
        { id: 'choice_return_left', text: 'Return to the beginning', targetSceneId: 'start_scene', conditions: [], actions: [] },
        { id: 'choice_explore_grove', text: 'Explore deeper into the grove', targetSceneId: 'deep_grove', conditions: [], actions: [] }
      ],
      position: { x: 50, y: 300 },
      onEnter: [],
      onExit: []
    };

    const rightNode = {
      id: 'forest_right',
      title: 'Sunny Meadow',
      content: 'The right path opens into a beautiful sunny meadow filled with wildflowers. Birds sing cheerfully overhead.',
      choices: [
        { id: 'choice_return_right', text: 'Return to the beginning', targetSceneId: 'start_scene', conditions: [], actions: [] },
        { id: 'choice_rest_meadow', text: 'Rest in the peaceful meadow', targetSceneId: 'meadow_rest', conditions: [], actions: [] }
      ],
      position: { x: 300, y: 300 },
      onEnter: [],
      onExit: []
    };

    const deepGrove = {
      id: 'deep_grove',
      title: 'Heart of the Grove',
      content: 'Deep in the grove, you discover an ancient stone circle. Mysterious runes glow faintly on the stones.',
      choices: [],
      position: { x: -100, y: 500 },
      onEnter: [],
      onExit: []
    };

    const meadowRest = {
      id: 'meadow_rest',
      title: 'Peaceful Rest',
      content: 'You rest peacefully in the meadow. The warm sun and gentle breeze restore your spirits completely.',
      choices: [
        { id: 'choice_return_refreshed', text: 'Return to the forest entrance', targetSceneId: 'start_scene', conditions: [], actions: [] }
      ],
      position: { x: 500, y: 500 },
      onEnter: [],
      onExit: []
    };

    // Create complete adventure object
    const adventure = {
      id: 'sample_adventure',
      title: 'The Forest Path',
      author: 'Adventure Engine',
      version: '1.0.0',
      description: 'A simple forest adventure to test the engine',
      startSceneId: startNode.id,
      scenes: [startNode, leftNode, rightNode, deepGrove, meadowRest],
      stats: [
        {
          id: 'health',
          name: 'Health',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 100,
          hidden: false,
          category: 'character'
        },
        {
          id: 'courage',
          name: 'Courage',
          type: 'number',
          defaultValue: 50,
          min: 0,
          max: 100,
          hidden: false,
          category: 'character'
        }
      ]
    };

    return {
      nodes: new Map([
        [startNode.id, startNode],
        [leftNode.id, leftNode],
        [rightNode.id, rightNode],
        [deepGrove.id, deepGrove],
        [meadowRest.id, meadowRest]
      ]),
      startSceneId: startNode.id,
      adventure: adventure
    };
  };

  // Initialize with sample adventure
  useEffect(() => {
    const sampleData = createSampleAdventure();
    
    // Set editor state
    setNodes(sampleData.nodes);
    setAdventure(sampleData.adventure);
    
    // Mark start scene in nodes
    const updatedNodes = new Map(sampleData.nodes);
    const startNode = updatedNodes.get(sampleData.startSceneId);
    if (startNode) {
      updatedNodes.set(sampleData.startSceneId, { ...startNode, isStartScene: true });
    }
    setNodes(updatedNodes);
  }, []);

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

  // Set start scene
  const handleSetStartScene = useCallback((nodeId) => {
    setNodes(prev => {
      const newNodes = new Map();
      for (const [id, node] of prev) {
        newNodes.set(id, { ...node, isStartScene: id === nodeId });
      }
      return newNodes;
    });

    setAdventure(prev => ({ ...prev, startSceneId: nodeId }));
    
    console.log('Set start scene:', nodeId);
  }, []);

  // Get context menu items
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
}, [contextMenu.nodeId, nodes, handleSetStartScene]);

  // Node operations
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
      onExit: []
    };
    
    setNodes(prev => new Map(prev.set(nodeId, newNode)));
    setSelectedNodeId(nodeId);
  }, []);

  const handleNodeMove = useCallback((nodeId, newPosition) => {
    setNodes(prev => {
      const newNodes = new Map(prev);
      const node = newNodes.get(nodeId);
      if (node) {
        newNodes.set(nodeId, { ...node, position: newPosition });
      }
      return newNodes;
    });
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
  }, [selectedNodeId, nodes]);

  // Choice operations
  const handleChoiceAdd = useCallback((nodeId) => {
    const choiceId = `choice_${Date.now()}`;
    const newChoice = {
      id: choiceId,
      text: 'New Choice',
      targetSceneId: '',
      conditions: [],
      actions: []
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

  // Dialog operations
  const openSceneDialog = useCallback((nodeId) => {
    const node = nodes.get(nodeId);
    if (node) {
      setDialogData(node);
      setActiveDialog('scene');
    }
  }, [nodes]);

  const openChoiceDialog = useCallback((nodeId, choiceId) => {
    const node = nodes.get(nodeId);
    const choice = node?.choices.find(c => c.id === choiceId);
    if (choice) {
      setDialogData({ choice, nodeId });
      setActiveDialog('choice');
    }
  }, [nodes]);

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

  // Validation
  const validateAdventure = useCallback(() => {
    const errors = [];
    const warnings = [];

    if (!adventure.startSceneId || !nodes.has(adventure.startSceneId)) {
      errors.push('No valid start scene defined');
    }

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
      });
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);
    return { errors, warnings };
  }, [adventure, nodes]);

  // Export adventure
  const handleExport = useCallback(() => {
    const adventureData = {
      ...adventure,
      scenes: Array.from(nodes.values()).map(node => {
        const { isStartScene, ...sceneData } = node;
        return sceneData;
      })
    };

    const dataStr = JSON.stringify(adventureData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${adventure.title.replace(/[^a-z0-9]/gi, '_')}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }, [adventure, nodes]);

  // Import adventure
  const handleImport = useCallback((adventureData) => {
    try {
      setAdventure({
        id: adventureData.id || 'imported_adventure',
        title: adventureData.title || 'Imported Adventure',
        author: adventureData.author || '',
        version: adventureData.version || '1.0.0',
        description: adventureData.description || '',
        startSceneId: adventureData.startSceneId,
        stats: adventureData.stats || []
      });

      const importedNodes = new Map();
      (adventureData.scenes || []).forEach(scene => {
        importedNodes.set(scene.id, {
          ...scene,
          position: scene.position || { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
          isStartScene: scene.id === adventureData.startSceneId
        });
      });
      
      setNodes(importedNodes);
      setSelectedNodeId(null);
    } catch (error) {
      alert('Error importing adventure: ' + error.message);
    }
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
      onNewAdventure: () => {
        if (confirm('Create new adventure? Unsaved changes will be lost.')) {
          setNodes(new Map());
          setAdventure({
            id: 'new_adventure',
            title: 'Untitled Adventure',
            author: '',
            version: '1.0.0',
            description: '',
            startSceneId: null,
            scenes: [],
            stats: []
          });
          setSelectedNodeId(null);
        }
      },
      onImportAdventure: handleImport,
      onExportAdventure: handleExport,
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
          const adventureData = {
            ...adventure,
            scenes: Array.from(nodes.values()).map(node => {
              const { isStartScene, ...sceneData } = node;
              return sceneData;
            })
          };
          onPlayTest(adventureData);
        }
      },
      onValidate: validateAdventure,
      onSaveEditor: () => {
        alert('Editor session save not yet implemented');
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
        onNodeUpdate: handleNodeUpdate,
        onChoiceAdd: handleChoiceAdd,
        onChoiceUpdate: handleChoiceUpdate,
        onChoiceDelete: handleChoiceDelete,
        onStatAdd: () => {
          console.log('Add stat');
        },
        onStatUpdate: (statId, updates) => {
          console.log('Update stat:', statId, updates);
        },
        onStatDelete: (statId) => {
          console.log('Delete stat:', statId);
        },
        onOpenSceneDialog: openSceneDialog,
        onOpenChoiceDialog: openChoiceDialog
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
      onSave: handleSceneSave,
      onCancel: closeDialog,
      onDelete: (sceneId) => {
        if (confirm('Delete this scene?')) {
          handleNodeDelete(sceneId);
          closeDialog();
        }
      }
    }),

    React.createElement(ChoiceEditDialog, {
      key: 'choice-dialog',
      isOpen: activeDialog === 'choice',
      choice: activeDialog === 'choice' ? dialogData?.choice : null,
      availableScenes: Array.from(nodes.values()),
      adventureStats: adventure.stats,
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
    })
  ]);
}