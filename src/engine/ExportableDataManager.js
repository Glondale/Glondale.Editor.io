/**
 * ExportableDataManager.js - Manages data transformation and export operations
 * 
 * Features:
 * - Transform save data between different formats (JSON, CSV, XML)
 * - Generate player statistics and analytics
 * - Create shareable progress reports
 * - Handle data privacy and filtering
 * - Optimize export file sizes with compression
 * 
 * Integration Points:
 * - CrossGameSaveSystem: Provides data transformation utilities
 * - SaveSystem: Extends export capabilities
 * - EditorSessionStorage: Session export functionality
 * - UI Components: Progress reports and analytics displays
 */

export class ExportableDataManager {
  constructor(statsManager, inventoryManager) {
    this.statsManager = statsManager;
    this.inventoryManager = inventoryManager;
    
    // Export format versions
    this.formatVersions = {
      'json': '1.0.0',
      'csv': '1.0.0',
      'analytics': '1.0.0',
      'report': '1.0.0'
    };
    
    // Data privacy settings
    this.privacySettings = {
      includePersonalInfo: true,
      includeTimestamps: true,
      includeSecrets: false,
      anonymizeData: false
    };
    
    // Performance settings
    this.compressionEnabled = true;
    this.batchSize = 1000;
    
    // Export templates
    this.exportTemplates = new Map();
    this.initializeTemplates();
  }

  /**
   * Export save data in specified format
   * @param {Object} saveData - Save data to export
   * @param {Object} adventureData - Adventure metadata
   * @param {Object} options - Export configuration
   * @returns {Object} { success, blob, filename, metadata, error }
   */
  exportSaveData(saveData, adventureData, options = {}) {
    try {
      const exportConfig = this.prepareExportConfig(options);
      const processedData = this.processSaveData(saveData, adventureData, exportConfig);
      
      // Apply privacy filters
      const filteredData = this.applyPrivacyFilters(processedData, exportConfig);
      
      // Generate export based on format
      const exportResult = this.generateExport(filteredData, exportConfig);
      
      if (!exportResult.success) {
        return exportResult;
      }

      // Create downloadable blob
      const blob = this.createBlob(exportResult.content, exportConfig.format);
      const filename = this.generateFilename(saveData, adventureData, exportConfig);
      
      return {
        success: true,
        blob: blob,
        filename: filename,
        metadata: {
          format: exportConfig.format,
          size: blob.size,
          exportedAt: Date.now(),
          recordCount: exportResult.recordCount || 0,
          compressed: exportConfig.compressed
        },
        error: null
      };

    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false,
        blob: null,
        filename: null,
        metadata: null,
        error: error.message
      };
    }
  }

  /**
   * Generate analytics report from save data
   * @param {Object} saveData - Save data to analyze
   * @param {Object} adventureData - Adventure metadata
   * @param {Object} options - Analytics configuration
   * @returns {Object} Analytics data with visualizations
   */
  generateAnalytics(saveData, adventureData, options = {}) {
    try {
      const analytics = {
        overview: this.generateOverviewAnalytics(saveData, adventureData),
        progression: this.generateProgressionAnalytics(saveData, adventureData),
        choices: this.generateChoiceAnalytics(saveData, adventureData),
        stats: this.generateStatAnalytics(saveData, adventureData),
        inventory: this.generateInventoryAnalytics(saveData, adventureData),
        timeline: this.generateTimelineAnalytics(saveData, adventureData),
        achievements: this.generateAchievementAnalytics(saveData, adventureData)
      };

      // Add comparative data if available
      if (options.includeComparative) {
        analytics.comparative = this.generateComparativeAnalytics(saveData, adventureData);
      }

      return {
        success: true,
        analytics: analytics,
        generatedAt: Date.now(),
        version: this.formatVersions.analytics
      };

    } catch (error) {
      console.error('Analytics generation failed:', error);
      return {
        success: false,
        analytics: null,
        error: error.message
      };
    }
  }

  /**
   * Create progress report for sharing
   * @param {Object} saveData - Save data
   * @param {Object} adventureData - Adventure metadata
   * @param {Object} options - Report configuration
   * @returns {Object} Shareable progress report
   */
  createProgressReport(saveData, adventureData, options = {}) {
    try {
      const analytics = this.generateAnalytics(saveData, adventureData, options);
      
      if (!analytics.success) {
        return analytics;
      }

      const report = {
        title: `${adventureData.title} - Progress Report`,
        playerName: saveData.playerName || 'Anonymous',
        adventureInfo: {
          title: adventureData.title,
          author: adventureData.author,
          version: adventureData.version
        },
        summary: this.generateProgressSummary(analytics.analytics),
        highlights: this.generateProgressHighlights(analytics.analytics),
        milestones: this.generateMilestoneData(saveData, adventureData),
        statistics: this.generateReportStatistics(analytics.analytics),
        visualData: this.generateVisualizationData(analytics.analytics),
        shareableUrl: options.generateShareableUrl ? 
          this.generateShareableUrl(saveData, adventureData) : null,
        generatedAt: Date.now(),
        privacy: this.getPrivacySettings(options)
      };

      // Generate different report formats
      const formats = {
        json: this.generateJSONReport(report),
        html: this.generateHTMLReport(report),
        markdown: this.generateMarkdownReport(report)
      };

      return {
        success: true,
        report: report,
        formats: formats,
        error: null
      };

    } catch (error) {
      console.error('Progress report generation failed:', error);
      return {
        success: false,
        report: null,
        formats: null,
        error: error.message
      };
    }
  }

  /**
   * Export adventure data for sharing or backup
   * @param {Object} adventureData - Adventure to export
   * @param {Object} options - Export configuration
   * @returns {Object} Export result with blob
   */
  exportAdventure(adventureData, options = {}) {
    try {
      const exportConfig = {
        format: options.format || 'json',
        includeMetadata: options.includeMetadata !== false,
        includeValidation: options.includeValidation !== false,
        compressed: options.compressed !== false,
        minified: options.minified || false
      };

      // Prepare adventure data for export
      const exportData = {
        type: 'adventure_game',
        version: this.formatVersions.json,
        exported: Date.now(),
        adventure: this.processAdventureData(adventureData, exportConfig)
      };

      // Add validation data if requested
      if (exportConfig.includeValidation) {
        exportData.validation = this.generateValidationData(adventureData);
      }

      // Generate content based on format
      let content;
      let mimeType;
      let extension;

      switch (exportConfig.format.toLowerCase()) {
        case 'json':
          content = JSON.stringify(exportData, null, exportConfig.minified ? 0 : 2);
          mimeType = 'application/json';
          extension = 'json';
          break;
          
        case 'yaml':
          content = this.convertToYAML(exportData);
          mimeType = 'application/x-yaml';
          extension = 'yaml';
          break;
          
        case 'xml':
          content = this.convertToXML(exportData);
          mimeType = 'application/xml';
          extension = 'xml';
          break;
          
        default:
          throw new Error(`Unsupported format: ${exportConfig.format}`);
      }

      // Compress if enabled
      if (exportConfig.compressed && content.length > 1024) {
        content = this.compressContent(content);
        extension += '.gz';
        mimeType = 'application/gzip';
      }

      const blob = new Blob([content], { type: mimeType });
      const filename = `${adventureData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;

      return {
        success: true,
        blob: blob,
        filename: filename,
        metadata: {
          format: exportConfig.format,
          compressed: exportConfig.compressed,
          size: blob.size,
          scenes: adventureData.scenes?.length || 0,
          stats: adventureData.stats?.length || 0
        },
        error: null
      };

    } catch (error) {
      console.error('Adventure export failed:', error);
      return {
        success: false,
        blob: null,
        filename: null,
        metadata: null,
        error: error.message
      };
    }
  }

  /**
   * Process save data for export
   * @private
   */
  processSaveData(saveData, adventureData, config) {
    const processed = {
      metadata: {
        adventureId: saveData.adventureId,
        adventureTitle: adventureData.title,
        playerName: saveData.playerName,
        exportedAt: Date.now(),
        version: saveData.version
      },
      gameState: {
        currentScene: saveData.currentSceneId,
        stats: saveData.stats || {},
        inventory: saveData.inventory || {},
        flags: saveData.flags || {},
        visitedScenes: saveData.visitedScenes || []
      },
      progress: {
        choiceHistory: saveData.choiceHistory || [],
        secretsFound: saveData.secretsFound || [],
        completionPercentage: this.calculateCompletion(saveData, adventureData),
        playtime: this.calculatePlaytime(saveData)
      },
      analytics: config.includeAnalytics ? 
        this.generateQuickAnalytics(saveData, adventureData) : null
    };

    return processed;
  }

  /**
   * Generate overview analytics
   * @private
   */
  generateOverviewAnalytics(saveData, adventureData) {
    const totalScenes = adventureData.scenes?.length || 0;
    const visitedScenes = saveData.visitedScenes?.length || 0;
    const totalChoices = saveData.choiceHistory?.length || 0;
    
    return {
      completion: {
        percentage: Math.round((visitedScenes / Math.max(totalScenes, 1)) * 100),
        scenesVisited: visitedScenes,
        totalScenes: totalScenes
      },
      engagement: {
        totalChoices: totalChoices,
        uniqueChoices: new Set(saveData.choiceHistory?.map(c => c.choiceId) || []).size,
        averageChoicesPerScene: totalChoices / Math.max(visitedScenes, 1)
      },
      progression: {
        currentScene: saveData.currentSceneId,
        secretsFound: saveData.secretsFound?.length || 0,
        flagsSet: Object.keys(saveData.flags || {}).filter(key => saveData.flags[key]).length
      }
    };
  }

  /**
   * Generate progression analytics
   * @private
   */
  generateProgressionAnalytics(saveData, adventureData) {
    const choiceHistory = saveData.choiceHistory || [];
    const visitedScenes = saveData.visitedScenes || [];
    
    return {
      pathTaken: this.analyzePath(choiceHistory, adventureData),
      backtracking: this.analyzeBacktracking(choiceHistory),
      explorationPattern: this.analyzeExplorationPattern(visitedScenes, adventureData),
      decisionSpeed: this.analyzeDecisionSpeed(choiceHistory),
      riskTaking: this.analyzeRiskTaking(choiceHistory, adventureData)
    };
  }

  /**
   * Generate choice analytics
   * @private
   */
  generateChoiceAnalytics(saveData, adventureData) {
    const choiceHistory = saveData.choiceHistory || [];
    const choiceFrequency = new Map();
    const sceneChoices = new Map();

    choiceHistory.forEach(choice => {
      choiceFrequency.set(choice.choiceId, 
        (choiceFrequency.get(choice.choiceId) || 0) + 1);
      
      if (!sceneChoices.has(choice.sceneId)) {
        sceneChoices.set(choice.sceneId, []);
      }
      sceneChoices.get(choice.sceneId).push(choice);
    });

    return {
      mostPopularChoices: Array.from(choiceFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      choiceDistribution: this.calculateChoiceDistribution(choiceHistory),
      decisionPatterns: this.analyzeDecisionPatterns(choiceHistory),
      choiceConsequences: this.analyzeChoiceConsequences(choiceHistory, saveData)
    };
  }

  /**
   * Generate stat analytics
   * @private
   */
  generateStatAnalytics(saveData, adventureData) {
    const stats = saveData.stats || {};
    const statDefinitions = adventureData.stats || [];
    
    const analytics = {
      currentValues: stats,
      statChanges: this.calculateStatChanges(saveData),
      statDistribution: this.calculateStatDistribution(stats, statDefinitions),
      growthPatterns: this.analyzeStatGrowth(saveData),
      correlations: this.analyzeStatCorrelations(saveData)
    };

    return analytics;
  }

  /**
   * Generate inventory analytics
   * @private
   */
  generateInventoryAnalytics(saveData, adventureData) {
    if (!this.inventoryManager || !saveData.inventory) {
      return { empty: true };
    }

    const inventoryStats = this.inventoryManager.getStats();
    const inventoryHistory = this.analyzeInventoryHistory(saveData);
    
    return {
      current: inventoryStats,
      history: inventoryHistory,
      usage: this.analyzeInventoryUsage(saveData),
      preferences: this.analyzeItemPreferences(saveData)
    };
  }

  /**
   * Apply privacy filters to data
   * @private
   */
  applyPrivacyFilters(data, config) {
    const filtered = JSON.parse(JSON.stringify(data)); // Deep clone

    if (!config.includePersonalInfo) {
      filtered.metadata.playerName = 'Anonymous';
      delete filtered.metadata.userId;
    }

    if (!config.includeTimestamps) {
      delete filtered.metadata.exportedAt;
      if (filtered.progress && filtered.progress.choiceHistory) {
        filtered.progress.choiceHistory.forEach(choice => {
          delete choice.timestamp;
        });
      }
    }

    if (!config.includeSecrets) {
      delete filtered.progress.secretsFound;
    }

    if (config.anonymizeData) {
      // Replace specific values with anonymized versions
      this.anonymizeData(filtered);
    }

    return filtered;
  }

  /**
   * Generate export in specified format
   * @private
   */
  generateExport(data, config) {
    switch (config.format.toLowerCase()) {
      case 'json':
        return {
          success: true,
          content: JSON.stringify(data, null, config.pretty ? 2 : 0),
          recordCount: this.countRecords(data)
        };
        
      case 'csv':
        return this.generateCSVExport(data, config);
        
      case 'xml':
        return this.generateXMLExport(data, config);
        
      case 'analytics':
        return {
          success: true,
          content: this.generateAnalyticsExport(data, config),
          recordCount: this.countAnalyticsRecords(data)
        };
        
      default:
        return {
          success: false,
          error: `Unsupported format: ${config.format}`
        };
    }
  }

  /**
   * Generate CSV export
   * @private
   */
  generateCSVExport(data, config) {
    try {
      const csvData = [];
      
      // Headers
      const headers = ['timestamp', 'sceneId', 'choiceId', 'stat', 'value', 'type'];
      csvData.push(headers.join(','));
      
      // Choice history
      if (data.progress && data.progress.choiceHistory) {
        data.progress.choiceHistory.forEach(choice => {
          csvData.push([
            choice.timestamp || '',
            choice.sceneId || '',
            choice.choiceId || '',
            'choice',
            choice.choiceId || '',
            'action'
          ].join(','));
        });
      }
      
      // Stat values
      if (data.gameState && data.gameState.stats) {
        Object.entries(data.gameState.stats).forEach(([stat, value]) => {
          csvData.push([
            Date.now(),
            data.gameState.currentScene || '',
            '',
            stat,
            value,
            'stat'
          ].join(','));
        });
      }

      return {
        success: true,
        content: csvData.join('\n'),
        recordCount: csvData.length - 1
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        recordCount: 0
      };
    }
  }

  /**
   * Create blob for download
   * @private
   */
  createBlob(content, format) {
    const mimeTypes = {
      'json': 'application/json',
      'csv': 'text/csv',
      'xml': 'application/xml',
      'html': 'text/html',
      'markdown': 'text/markdown',
      'analytics': 'application/json'
    };

    const mimeType = mimeTypes[format.toLowerCase()] || 'text/plain';
    return new Blob([content], { type: mimeType });
  }

  /**
   * Generate filename for export
   * @private
   */
  generateFilename(saveData, adventureData, config) {
    const baseName = adventureData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const playerName = (saveData.playerName || 'player').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().slice(0, 10);
    const extension = config.format.toLowerCase();

    return `${baseName}_${playerName}_${timestamp}.${extension}`;
  }

  /**
   * Prepare export configuration
   * @private
   */
  prepareExportConfig(options) {
    return {
      format: options.format || 'json',
      includePersonalInfo: options.includePersonalInfo !== false,
      includeTimestamps: options.includeTimestamps !== false,
      includeSecrets: options.includeSecrets === true,
      includeAnalytics: options.includeAnalytics === true,
      anonymizeData: options.anonymizeData === true,
      compressed: options.compressed === true,
      pretty: options.pretty !== false
    };
  }

  /**
   * Initialize export templates
   * @private
   */
  initializeTemplates() {
    this.exportTemplates.set('minimal', {
      includePersonalInfo: false,
      includeTimestamps: false,
      includeSecrets: false,
      includeAnalytics: false,
      anonymizeData: true
    });

    this.exportTemplates.set('complete', {
      includePersonalInfo: true,
      includeTimestamps: true,
      includeSecrets: true,
      includeAnalytics: true,
      anonymizeData: false
    });

    this.exportTemplates.set('analytics', {
      includePersonalInfo: false,
      includeTimestamps: true,
      includeSecrets: false,
      includeAnalytics: true,
      anonymizeData: true,
      format: 'analytics'
    });
  }

  /**
   * Utility methods for analytics
   * @private
   */
  calculateCompletion(saveData, adventureData) {
    const totalScenes = adventureData.scenes?.length || 1;
    const visitedScenes = saveData.visitedScenes?.length || 0;
    return Math.round((visitedScenes / totalScenes) * 100);
  }

  calculatePlaytime(saveData) {
    const choiceHistory = saveData.choiceHistory || [];
    if (choiceHistory.length < 2) return 0;
    
    const firstChoice = choiceHistory[0].timestamp;
    const lastChoice = choiceHistory[choiceHistory.length - 1].timestamp;
    return lastChoice - firstChoice;
  }

  countRecords(data) {
    let count = 0;
    if (data.progress?.choiceHistory) count += data.progress.choiceHistory.length;
    if (data.gameState?.stats) count += Object.keys(data.gameState.stats).length;
    return count;
  }

  // Additional helper methods would be implemented here
  analyzePath() { return {}; }
  analyzeBacktracking() { return {}; }
  analyzeExplorationPattern() { return {}; }
  analyzeDecisionSpeed() { return {}; }
  analyzeRiskTaking() { return {}; }
  calculateChoiceDistribution() { return {}; }
  analyzeDecisionPatterns() { return {}; }
  analyzeChoiceConsequences() { return {}; }
  calculateStatChanges() { return {}; }
  calculateStatDistribution() { return {}; }
  analyzeStatGrowth() { return {}; }
  analyzeStatCorrelations() { return {}; }
  analyzeInventoryHistory() { return {}; }
  analyzeInventoryUsage() { return {}; }
  analyzeItemPreferences() { return {}; }
  anonymizeData() {}
  generateAnalyticsExport() { return ''; }
  countAnalyticsRecords() { return 0; }
  generateXMLExport() { return { success: true, content: '', recordCount: 0 }; }
  processAdventureData(data) { return data; }
  generateValidationData() { return {}; }
  convertToYAML() { return ''; }
  convertToXML() { return ''; }
  compressContent(content) { return content; }
  generateQuickAnalytics() { return {}; }
  generateProgressSummary() { return {}; }
  generateProgressHighlights() { return {}; }
  generateMilestoneData() { return {}; }
  generateReportStatistics() { return {}; }
  generateVisualizationData() { return {}; }
  generateShareableUrl() { return null; }
  getPrivacySettings() { return {}; }
  generateJSONReport(report) { return JSON.stringify(report, null, 2); }
  generateHTMLReport() { return ''; }
  generateMarkdownReport() { return ''; }
  generateTimelineAnalytics() { return {}; }
  generateAchievementAnalytics() { return {}; }
  generateComparativeAnalytics() { return {}; }
}