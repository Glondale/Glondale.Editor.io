// SearchPanel.js - Comprehensive search and filter functionality
import React, { useState, useEffect, useCallback, useRef, useMemo } from "https://esm.sh/react@18";

export default function SearchPanel({
  isOpen = false,
  nodes = new Map(),
  adventure = {},
  onClose = () => {},
  onNavigateToNode = () => {},
  onHighlightMatches = () => {},
  onReplaceAll = () => {}
}) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWordsOnly, setIsWholeWordsOnly] = useState(false);
  
  // Filter state
  const [activeFilters, setActiveFilters] = useState({
    searchIn: {
      titles: true,
      content: true,
      choices: true,
      conditions: false,
      stats: false
    },
    nodeTypes: {
      allNodes: true,
      startNodes: false,
      endNodes: false,
      branchNodes: false
    },
    connections: {
      hasConnections: false,
      noConnections: false,
      specificConnections: ''
    }
  });
  
  // Replace functionality
  const [showReplace, setShowReplace] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [replaceHistory, setReplaceHistory] = useState([]);
  
  // Results state
  const [searchResults, setSearchResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState({
    totalMatches: 0,
    nodesWithMatches: 0,
    searchTime: 0
  });
  
  // References
  const searchInputRef = useRef(null);
  const resultsContainerRef = useRef(null);
  const searchDebounceRef = useRef(null);
  
  // Focus search input when panel opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isOpen]);
  
  // Load search history from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('editor_search_history');
      const savedReplaceHistory = localStorage.getItem('editor_replace_history');
      
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory).slice(0, 20)); // Keep last 20 searches
      }
      if (savedReplaceHistory) {
        setReplaceHistory(JSON.parse(savedReplaceHistory).slice(0, 20));
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, []);
  
  // Advanced search engine
  const performSearch = useCallback(async (query, filters, options = {}) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchStats({ totalMatches: 0, nodesWithMatches: 0, searchTime: 0 });
      onHighlightMatches([]);
      return;
    }
    
    setIsSearching(true);
    const startTime = performance.now();
    
    try {
      const results = [];
      let totalMatches = 0;
      
      // Compile search regex if needed
      let searchRegex;
      try {
        const flags = `g${!isCaseSensitive ? 'i' : ''}`;
        if (isRegexMode) {
          searchRegex = new RegExp(query, flags);
        } else {
          // Escape special regex characters for literal search
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = isWholeWordsOnly ? `\\b${escapedQuery}\\b` : escapedQuery;
          searchRegex = new RegExp(pattern, flags);
        }
      } catch (error) {
        // Invalid regex - fall back to literal search
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchRegex = new RegExp(escapedQuery, `g${!isCaseSensitive ? 'i' : ''}`);
      }
      
      // Search through all nodes
      for (const [nodeId, node] of nodes) {
        const nodeResults = [];
        
        // Search in title
        if (filters.searchIn.titles && node.title) {
          const matches = [...node.title.matchAll(searchRegex)];
          matches.forEach(match => {
            nodeResults.push({
              type: 'title',
              text: node.title,
              match: match[0],
              index: match.index,
              context: getContext(node.title, match.index, match[0].length)
            });
          });
          totalMatches += matches.length;
        }
        
        // Search in content
        if (filters.searchIn.content && node.content) {
          const matches = [...node.content.matchAll(searchRegex)];
          matches.forEach(match => {
            nodeResults.push({
              type: 'content',
              text: node.content,
              match: match[0],
              index: match.index,
              context: getContext(node.content, match.index, match[0].length)
            });
          });
          totalMatches += matches.length;
        }
        
        // Search in choices
        if (filters.searchIn.choices && node.choices) {
          node.choices.forEach((choice, choiceIndex) => {
            if (choice.text) {
              const matches = [...choice.text.matchAll(searchRegex)];
              matches.forEach(match => {
                nodeResults.push({
                  type: 'choice',
                  text: choice.text,
                  match: match[0],
                  index: match.index,
                  choiceIndex: choiceIndex,
                  choiceId: choice.id,
                  context: getContext(choice.text, match.index, match[0].length)
                });
              });
              totalMatches += matches.length;
            }
          });
        }
        
        // Search in conditions (advanced)
        if (filters.searchIn.conditions && node.choices) {
          node.choices.forEach((choice, choiceIndex) => {
            if (choice.conditions) {
              choice.conditions.forEach((condition, condIndex) => {
                const conditionText = JSON.stringify(condition);
                const matches = [...conditionText.matchAll(searchRegex)];
                matches.forEach(match => {
                  nodeResults.push({
                    type: 'condition',
                    text: conditionText,
                    match: match[0],
                    index: match.index,
                    choiceIndex: choiceIndex,
                    conditionIndex: condIndex,
                    context: getContext(conditionText, match.index, match[0].length)
                  });
                });
                totalMatches += matches.length;
              });
            }
          });
        }
        
        // Search in stats usage
        if (filters.searchIn.stats) {
          const statsText = JSON.stringify({
            stats: node.stats || [],
            statModifications: node.statModifications || []
          });
          const matches = [...statsText.matchAll(searchRegex)];
          matches.forEach(match => {
            nodeResults.push({
              type: 'stats',
              text: statsText,
              match: match[0],
              index: match.index,
              context: getContext(statsText, match.index, match[0].length)
            });
          });
          totalMatches += matches.length;
        }
        
        // Apply node type filters
        if (nodeResults.length > 0 && passesNodeTypeFilter(node, filters.nodeTypes)) {
          // Apply connection filters
          if (passesConnectionFilter(node, nodeId, filters.connections)) {
            results.push({
              nodeId,
              node,
              matches: nodeResults,
              matchCount: nodeResults.length
            });
          }
        }
      }
      
      // Sort results by relevance
      results.sort((a, b) => {
        // Prioritize title matches
        const aTitleMatches = a.matches.filter(m => m.type === 'title').length;
        const bTitleMatches = b.matches.filter(m => m.type === 'title').length;
        if (aTitleMatches !== bTitleMatches) return bTitleMatches - aTitleMatches;
        
        // Then by total match count
        return b.matchCount - a.matchCount;
      });
      
      const searchTime = performance.now() - startTime;
      
      setSearchResults(results);
      setSearchStats({
        totalMatches,
        nodesWithMatches: results.length,
        searchTime: Math.round(searchTime * 100) / 100
      });
      
      // Update highlights
      const highlightData = results.map(result => ({
        nodeId: result.nodeId,
        matches: result.matches
      }));
      onHighlightMatches(highlightData);
      
      // Reset result navigation
      setCurrentResultIndex(0);
      
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [nodes, isRegexMode, isCaseSensitive, isWholeWordsOnly, onHighlightMatches]);
  
  // Helper function to get context around matches
  const getContext = useCallback((text, index, matchLength, contextLength = 50) => {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + matchLength + contextLength);
    
    const before = text.slice(start, index);
    const match = text.slice(index, index + matchLength);
    const after = text.slice(index + matchLength, end);
    
    return {
      before: start > 0 ? '...' + before : before,
      match,
      after: end < text.length ? after + '...' : after,
      fullMatch: text.slice(start, end)
    };
  }, []);
  
  // Helper function for node type filtering
  const passesNodeTypeFilter = useCallback((node, nodeTypeFilters) => {
    if (nodeTypeFilters.allNodes) return true;
    
    let passes = false;
    if (nodeTypeFilters.startNodes && node.isStartScene) passes = true;
    if (nodeTypeFilters.endNodes && (!node.choices || node.choices.length === 0)) passes = true;
    if (nodeTypeFilters.branchNodes && node.choices && node.choices.length > 1) passes = true;
    
    return passes;
  }, []);
  
  // Helper function for connection filtering
  const passesConnectionFilter = useCallback((node, nodeId, connectionFilters) => {
    const hasOutgoingConnections = node.choices && node.choices.some(c => c.targetSceneId);
    
    if (connectionFilters.hasConnections && !hasOutgoingConnections) return false;
    if (connectionFilters.noConnections && hasOutgoingConnections) return false;
    
    if (connectionFilters.specificConnections) {
      const targetIds = node.choices ? node.choices.map(c => c.targetSceneId).filter(Boolean) : [];
      if (!targetIds.some(id => id.includes(connectionFilters.specificConnections))) return false;
    }
    
    return true;
  }, []);
  
  // Debounced search
  const debouncedSearch = useCallback((query, filters) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      performSearch(query, filters);
    }, 300); // 300ms debounce
  }, [performSearch]);
  
  // Handle search input change
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    debouncedSearch(value, activeFilters);
  }, [activeFilters, debouncedSearch]);
  
  // Handle filter changes
  const handleFilterChange = useCallback((category, key, value) => {
    const newFilters = {
      ...activeFilters,
      [category]: {
        ...activeFilters[category],
        [key]: value
      }
    };
    
    setActiveFilters(newFilters);
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery, newFilters);
    }
  }, [activeFilters, searchQuery, debouncedSearch]);
  
  // Navigation functions
  const navigateToResult = useCallback((index) => {
    const result = searchResults[index];
    if (result) {
      setCurrentResultIndex(index);
      onNavigateToNode(result.nodeId, result.matches[0]);
      
      // Scroll to result in list
      if (resultsContainerRef.current) {
        const resultElements = resultsContainerRef.current.querySelectorAll('.search-result-item');
        if (resultElements[index]) {
          resultElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [searchResults, onNavigateToNode]);
  
  const navigateNext = useCallback(() => {
    if (searchResults.length > 0) {
      const nextIndex = (currentResultIndex + 1) % searchResults.length;
      navigateToResult(nextIndex);
    }
  }, [searchResults.length, currentResultIndex, navigateToResult]);
  
  const navigatePrevious = useCallback(() => {
    if (searchResults.length > 0) {
      const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
      navigateToResult(prevIndex);
    }
  }, [searchResults.length, currentResultIndex, navigateToResult]);
  
  // Save search to history
  const saveToHistory = useCallback((query, isReplace = false) => {
    if (!query.trim()) return;
    
    const historyKey = isReplace ? 'editor_replace_history' : 'editor_search_history';
    const setHistory = isReplace ? setReplaceHistory : setSearchHistory;
    const maxHistory = 20;
    
    try {
      const currentHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      const newHistory = [query, ...currentHistory.filter(h => h !== query)].slice(0, maxHistory);
      
      localStorage.setItem(historyKey, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, []);
  
  // Handle Enter key for search
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        navigatePrevious();
      } else {
        navigateNext();
      }
      saveToHistory(searchQuery);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [searchQuery, navigateNext, navigatePrevious, onClose, saveToHistory]);
  
  // Bulk replace functionality
  const handleReplaceAll = useCallback(() => {
    if (!searchQuery.trim() || !replaceQuery) return;
    
    const replacements = [];
    
    searchResults.forEach(result => {
      result.matches.forEach(match => {
        if (match.type === 'title' || match.type === 'content' || match.type === 'choice') {
          replacements.push({
            nodeId: result.nodeId,
            type: match.type,
            original: match.text,
            match: match.match,
            index: match.index,
            replacement: replaceQuery,
            choiceId: match.choiceId
          });
        }
      });
    });
    
    if (replacements.length > 0 && confirm(`Replace ${replacements.length} occurrences?`)) {
      onReplaceAll(replacements);
      saveToHistory(searchQuery);
      saveToHistory(replaceQuery, true);
      
      // Re-run search after replacement
      setTimeout(() => {
        performSearch(searchQuery, activeFilters);
      }, 100);
    }
  }, [searchQuery, replaceQuery, searchResults, onReplaceAll, saveToHistory, performSearch, activeFilters]);
  
  // Memoized results for performance
  const memoizedResults = useMemo(() => {
    return searchResults.map((result, index) => ({
      ...result,
      isActive: index === currentResultIndex
    }));
  }, [searchResults, currentResultIndex]);
  
  if (!isOpen) return null;
  
  return React.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20',
    onClick: (e) => e.target === e.currentTarget && onClose()
  }, React.createElement('div', {
    className: 'bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col',
    onClick: (e) => e.stopPropagation()
  }, [
    // Header
    React.createElement('div', {
      key: 'header',
      className: 'flex items-center justify-between p-4 border-b border-gray-200'
    }, [
      React.createElement('div', {
        key: 'title-section',
        className: 'flex items-center space-x-3'
      }, [
        React.createElement('h2', {
          key: 'title',
          className: 'text-lg font-semibold text-gray-800'
        }, 'Search & Filter'),
        
        searchStats.totalMatches > 0 && React.createElement('div', {
          key: 'stats',
          className: 'text-sm text-gray-500'
        }, `${searchStats.totalMatches} matches in ${searchStats.nodesWithMatches} scenes (${searchStats.searchTime}ms)`)
      ]),
      
      React.createElement('button', {
        key: 'close-btn',
        onClick: onClose,
        className: 'text-gray-500 hover:text-gray-700 text-xl font-bold'
      }, '×')
    ]),
    
    // Search controls
    React.createElement('div', {
      key: 'search-controls',
      className: 'p-4 border-b border-gray-200'
    }, [
      // Main search input
      React.createElement('div', {
        key: 'main-search',
        className: 'flex items-center space-x-2 mb-3'
      }, [
        React.createElement('div', {
          key: 'search-input-container',
          className: 'flex-1 relative'
        }, [
          React.createElement('input', {
            key: 'search-input',
            ref: searchInputRef,
            type: 'text',
            placeholder: 'Search scenes, content, choices...',
            value: searchQuery,
            onChange: (e) => handleSearchChange(e.target.value),
            onKeyDown: handleSearchKeyDown,
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          }),
          
          isSearching && React.createElement('div', {
            key: 'loading',
            className: 'absolute right-3 top-1/2 transform -translate-y-1/2'
          }, React.createElement('div', {
            className: 'animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full'
          }))
        ]),
        
        React.createElement('div', {
          key: 'navigation-buttons',
          className: 'flex items-center space-x-1'
        }, [
          React.createElement('button', {
            key: 'prev-btn',
            onClick: navigatePrevious,
            disabled: searchResults.length === 0,
            className: 'px-2 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300',
            title: 'Previous match (Shift+Enter)'
          }, '↑'),
          
          React.createElement('button', {
            key: 'next-btn', 
            onClick: navigateNext,
            disabled: searchResults.length === 0,
            className: 'px-2 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300',
            title: 'Next match (Enter)'
          }, '↓'),
          
          searchResults.length > 0 && React.createElement('span', {
            key: 'position',
            className: 'text-sm text-gray-500 px-2'
          }, `${currentResultIndex + 1}/${searchResults.length}`)
        ])
      ]),
      
      // Replace controls
      showReplace && React.createElement('div', {
        key: 'replace-controls',
        className: 'flex items-center space-x-2 mb-3'
      }, [
        React.createElement('input', {
          key: 'replace-input',
          type: 'text',
          placeholder: 'Replace with...',
          value: replaceQuery,
          onChange: (e) => setReplaceQuery(e.target.value),
          className: 'flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        }),
        
        React.createElement('button', {
          key: 'replace-all-btn',
          onClick: handleReplaceAll,
          disabled: !searchQuery.trim() || !replaceQuery || searchResults.length === 0,
          className: 'px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-300'
        }, `Replace All (${searchStats.totalMatches})`)
      ]),
      
      // Search options
      React.createElement('div', {
        key: 'search-options',
        className: 'flex items-center space-x-4'
      }, [
        React.createElement('label', {
          key: 'regex-option',
          className: 'flex items-center space-x-1 text-sm'
        }, [
          React.createElement('input', {
            type: 'checkbox',
            checked: isRegexMode,
            onChange: (e) => setIsRegexMode(e.target.checked),
            className: 'w-4 h-4'
          }),
          React.createElement('span', { className: 'text-gray-700' }, 'Regex')
        ]),
        
        React.createElement('label', {
          key: 'case-option',
          className: 'flex items-center space-x-1 text-sm'
        }, [
          React.createElement('input', {
            type: 'checkbox',
            checked: isCaseSensitive,
            onChange: (e) => setIsCaseSensitive(e.target.checked),
            className: 'w-4 h-4'
          }),
          React.createElement('span', { className: 'text-gray-700' }, 'Case sensitive')
        ]),
        
        React.createElement('label', {
          key: 'whole-words-option',
          className: 'flex items-center space-x-1 text-sm'
        }, [
          React.createElement('input', {
            type: 'checkbox',
            checked: isWholeWordsOnly,
            onChange: (e) => setIsWholeWordsOnly(e.target.checked),
            className: 'w-4 h-4'
          }),
          React.createElement('span', { className: 'text-gray-700' }, 'Whole words')
        ]),
        
        React.createElement('button', {
          key: 'toggle-replace',
          onClick: () => setShowReplace(!showReplace),
          className: `text-sm px-2 py-1 rounded ${showReplace ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:text-gray-800'}`
        }, 'Replace')
      ])
    ]),
    
    // Main content area with results and filters
    React.createElement('div', {
      key: 'main-content',
      className: 'flex flex-1 min-h-0'
    }, [
      // Results list
      React.createElement('div', {
        key: 'results-section',
        className: 'flex-1 flex flex-col min-h-0'
      }, [
        React.createElement('div', {
          key: 'results-header',
          className: 'px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700'
        }, 'Search Results'),
        
        React.createElement('div', {
          key: 'results-list',
          ref: resultsContainerRef,
          className: 'flex-1 overflow-y-auto'
        }, searchResults.length === 0 ? (
          React.createElement('div', {
            className: 'p-8 text-center text-gray-500'
          }, searchQuery ? (isSearching ? 'Searching...' : 'No results found') : 'Enter search terms to find scenes')
        ) : (
          memoizedResults.map((result, index) => 
            React.createElement('div', {
              key: result.nodeId,
              className: `search-result-item p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${result.isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`,
              onClick: () => navigateToResult(index)
            }, [
              React.createElement('div', {
                key: 'result-header',
                className: 'flex items-center justify-between mb-2'
              }, [
                React.createElement('h4', {
                  key: 'scene-title',
                  className: 'font-medium text-gray-800 truncate'
                }, result.node.title || 'Untitled Scene'),
                
                React.createElement('span', {
                  key: 'match-count',
                  className: 'text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full'
                }, `${result.matchCount} match${result.matchCount !== 1 ? 'es' : ''}`)
              ]),
              
              React.createElement('div', {
                key: 'matches',
                className: 'space-y-1'
              }, result.matches.slice(0, 3).map((match, matchIndex) =>
                React.createElement('div', {
                  key: `${match.type}-${matchIndex}`,
                  className: 'text-sm'
                }, [
                  React.createElement('span', {
                    key: 'match-type',
                    className: `inline-block px-2 py-1 text-xs rounded mr-2 ${
                      match.type === 'title' ? 'bg-blue-100 text-blue-700' :
                      match.type === 'content' ? 'bg-green-100 text-green-700' :
                      match.type === 'choice' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`
                  }, match.type),
                  
                  React.createElement('span', {
                    key: 'context',
                    className: 'text-gray-600'
                  }, [
                    match.context.before,
                    React.createElement('mark', {
                      key: 'highlight',
                      className: 'bg-yellow-200 px-1'
                    }, match.context.match),
                    match.context.after
                  ])
                ])
              ))
            ])
          )
        ))
      ]),
      
      // Filters sidebar
      React.createElement('div', {
        key: 'filters-section',
        className: 'w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto'
      }, [
        React.createElement('div', {
          key: 'filters-header',
          className: 'px-4 py-3 bg-gray-100 border-b border-gray-200'
        }, React.createElement('h3', {
          className: 'font-medium text-gray-800'
        }, 'Filters')),
        
        React.createElement('div', {
          key: 'filters-content',
          className: 'p-4 space-y-6'
        }, [
          // Search in filters
          React.createElement('div', {
            key: 'search-in-group'
          }, [
            React.createElement('h4', {
              key: 'search-in-title',
              className: 'font-medium text-gray-700 mb-3'
            }, 'Search In'),
            
            React.createElement('div', {
              key: 'search-in-options',
              className: 'space-y-2'
            }, [
              ['titles', 'Scene Titles'],
              ['content', 'Scene Content'], 
              ['choices', 'Choice Text'],
              ['conditions', 'Conditions'],
              ['stats', 'Stats Usage']
            ].map(([key, label]) =>
              React.createElement('label', {
                key,
                className: 'flex items-center space-x-2 text-sm'
              }, [
                React.createElement('input', {
                  type: 'checkbox',
                  checked: activeFilters.searchIn[key],
                  onChange: (e) => handleFilterChange('searchIn', key, e.target.checked),
                  className: 'w-4 h-4'
                }),
                React.createElement('span', { className: 'text-gray-700' }, label)
              ])
            ))
          ]),
          
          // Node type filters
          React.createElement('div', {
            key: 'node-type-group'
          }, [
            React.createElement('h4', {
              key: 'node-type-title',
              className: 'font-medium text-gray-700 mb-3'
            }, 'Node Types'),
            
            React.createElement('div', {
              key: 'node-type-options',
              className: 'space-y-2'
            }, [
              ['allNodes', 'All Nodes'],
              ['startNodes', 'Start Scenes'],
              ['endNodes', 'End Scenes'],
              ['branchNodes', 'Branch Scenes']
            ].map(([key, label]) =>
              React.createElement('label', {
                key,
                className: 'flex items-center space-x-2 text-sm'
              }, [
                React.createElement('input', {
                  type: 'radio',
                  name: 'nodeType',
                  checked: activeFilters.nodeTypes[key],
                  onChange: (e) => {
                    if (e.target.checked) {
                      const newNodeTypes = Object.keys(activeFilters.nodeTypes).reduce((acc, k) => {
                        acc[k] = k === key;
                        return acc;
                      }, {});
                      setActiveFilters(prev => ({ ...prev, nodeTypes: newNodeTypes }));
                      if (searchQuery.trim()) {
                        debouncedSearch(searchQuery, { ...activeFilters, nodeTypes: newNodeTypes });
                      }
                    }
                  },
                  className: 'w-4 h-4'
                }),
                React.createElement('span', { className: 'text-gray-700' }, label)
              ])
            ))
          ]),
          
          // Connection filters
          React.createElement('div', {
            key: 'connection-group'
          }, [
            React.createElement('h4', {
              key: 'connection-title',
              className: 'font-medium text-gray-700 mb-3'
            }, 'Connections'),
            
            React.createElement('div', {
              key: 'connection-options',
              className: 'space-y-2'
            }, [
              React.createElement('label', {
                key: 'has-connections',
                className: 'flex items-center space-x-2 text-sm'
              }, [
                React.createElement('input', {
                  type: 'checkbox',
                  checked: activeFilters.connections.hasConnections,
                  onChange: (e) => handleFilterChange('connections', 'hasConnections', e.target.checked),
                  className: 'w-4 h-4'
                }),
                React.createElement('span', { className: 'text-gray-700' }, 'Has Outgoing Connections')
              ]),
              
              React.createElement('label', {
                key: 'no-connections',
                className: 'flex items-center space-x-2 text-sm'
              }, [
                React.createElement('input', {
                  type: 'checkbox',
                  checked: activeFilters.connections.noConnections,
                  onChange: (e) => handleFilterChange('connections', 'noConnections', e.target.checked),
                  className: 'w-4 h-4'
                }),
                React.createElement('span', { className: 'text-gray-700' }, 'No Outgoing Connections')
              ]),
              
              React.createElement('div', {
                key: 'specific-connections',
                className: 'pt-2'
              }, [
                React.createElement('label', {
                  className: 'block text-sm text-gray-700 mb-1'
                }, 'Connected to Scene ID:'),
                React.createElement('input', {
                  type: 'text',
                  placeholder: 'Enter scene ID...',
                  value: activeFilters.connections.specificConnections,
                  onChange: (e) => handleFilterChange('connections', 'specificConnections', e.target.value),
                  className: 'w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                })
              ])
            ])
          ])
        ])
      ])
    ])
  ]));
}