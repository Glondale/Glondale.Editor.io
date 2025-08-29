// errorLogger.js - Centralized error logging and handling system

export class ErrorLogger {
  static instance = null;
  
  constructor() {
    if (ErrorLogger.instance) {
      return ErrorLogger.instance;
    }
    
    this.logs = [];
    this.maxLogs = 100;
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.errorListeners = [];
    
    // Load existing logs from storage
    this.loadLogsFromStorage();
    
    // Set up global error handlers
    this.setupGlobalHandlers();
    
    ErrorLogger.instance = this;
  }

  static getInstance() {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  setupGlobalHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason,
        stack: event.reason?.stack
      });
    });
  }

  logError(errorData, context = {}) {
    const timestamp = new Date().toISOString();
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const logEntry = {
      id: errorId,
      timestamp,
      sessionId: this.sessionId,
      type: errorData.type || 'generic_error',
      message: errorData.message,
      stack: errorData.stack,
      filename: errorData.filename,
      lineno: errorData.lineno,
      colno: errorData.colno,
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: this.sanitizeContext(context),
      severity: this.determineSeverity(errorData),
      category: this.categorizeError(errorData)
    };

    // Add to memory
    this.logs.unshift(logEntry);
    
    // Limit memory usage
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Persist to storage
    this.saveLogsToStorage();

    // Console logging based on severity
    this.consoleLog(logEntry);

    // Notify listeners
    this.notifyListeners(logEntry);

    return errorId;
  }

  logWarning(message, context = {}) {
    return this.logError({
      type: 'warning',
      message,
      severity: 'warning'
    }, context);
  }

  logInfo(message, context = {}) {
    return this.logError({
      type: 'info',
      message,
      severity: 'info'
    }, context);
  }

  determineSeverity(errorData) {
    if (errorData.severity) return errorData.severity;
    
    const message = errorData.message?.toLowerCase() || '';
    const type = errorData.type?.toLowerCase() || '';
    
    if (type.includes('critical') || message.includes('critical')) return 'critical';
    if (type.includes('error') || message.includes('error')) return 'error';
    if (type.includes('warning') || message.includes('warning')) return 'warning';
    if (type.includes('info') || message.includes('info')) return 'info';
    
    // Default severity based on type
    if (type === 'javascript_error' || type === 'unhandled_promise_rejection') return 'error';
    if (type === 'save_corruption' || type === 'data_loss') return 'critical';
    if (type === 'export_failure' || type === 'import_failure') return 'error';
    if (type === 'validation_error') return 'warning';
    
    return 'error';
  }

  categorizeError(errorData) {
    const message = errorData.message?.toLowerCase() || '';
    const type = errorData.type?.toLowerCase() || '';
    const stack = errorData.stack?.toLowerCase() || '';
    
    if (type.includes('save') || message.includes('save') || stack.includes('savesystem')) {
      return 'save_system';
    }
    if (type.includes('export') || message.includes('export') || stack.includes('export')) {
      return 'export_system';
    }
    if (type.includes('validation') || message.includes('validation')) {
      return 'validation';
    }
    if (type.includes('network') || message.includes('fetch') || message.includes('network')) {
      return 'network';
    }
    if (stack.includes('react') || message.includes('react')) {
      return 'react';
    }
    if (type.includes('storage') || message.includes('localstorage') || message.includes('storage')) {
      return 'storage';
    }
    
    return 'general';
  }

  sanitizeContext(context) {
    const sanitized = {};
    
    Object.keys(context).forEach(key => {
      const value = context[key];
      
      if (typeof value === 'function') {
        sanitized[key] = '[Function]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize objects but limit depth
        sanitized[key] = this.sanitizeObject(value, 0, 3);
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...[truncated]';
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  sanitizeObject(obj, currentDepth, maxDepth) {
    if (currentDepth >= maxDepth) return '[Object - max depth reached]';
    
    const sanitized = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      if (typeof value === 'function') {
        sanitized[key] = '[Function]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, currentDepth + 1, maxDepth);
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...[truncated]';
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  consoleLog(logEntry) {
    const style = this.getConsoleStyle(logEntry.severity);
    const groupLabel = `${logEntry.severity.toUpperCase()} [${logEntry.category}] - ${logEntry.id}`;
    
    console.group(`%c${groupLabel}`, style);
    console.log('Message:', logEntry.message);
    console.log('Timestamp:', logEntry.timestamp);
    console.log('Type:', logEntry.type);
    if (logEntry.stack) console.log('Stack:', logEntry.stack);
    if (Object.keys(logEntry.context).length > 0) console.log('Context:', logEntry.context);
    console.groupEnd();
  }

  getConsoleStyle(severity) {
    switch (severity) {
      case 'critical':
        return 'color: white; background-color: #dc2626; font-weight: bold; padding: 2px 6px; border-radius: 3px;';
      case 'error':
        return 'color: white; background-color: #ef4444; font-weight: bold; padding: 2px 6px; border-radius: 3px;';
      case 'warning':
        return 'color: black; background-color: #f59e0b; font-weight: bold; padding: 2px 6px; border-radius: 3px;';
      case 'info':
        return 'color: white; background-color: #3b82f6; font-weight: bold; padding: 2px 6px; border-radius: 3px;';
      default:
        return 'color: white; background-color: #6b7280; font-weight: bold; padding: 2px 6px; border-radius: 3px;';
    }
  }

  loadLogsFromStorage() {
    try {
      const stored = localStorage.getItem('error_logs');
      if (stored) {
        const parsedLogs = JSON.parse(stored);
        // Only load logs from the last 24 hours to prevent bloat
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        this.logs = parsedLogs.filter(log => 
          new Date(log.timestamp).getTime() > oneDayAgo
        ).slice(0, this.maxLogs);
      }
    } catch (error) {
      console.warn('Failed to load error logs from storage:', error);
      this.logs = [];
    }
  }

  saveLogsToStorage() {
    try {
      // Only save recent logs to prevent storage bloat
      const recentLogs = this.logs.slice(0, 50);
      localStorage.setItem('error_logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.warn('Failed to save error logs to storage:', error);
      // If storage is full, try clearing old logs and retry
      try {
        localStorage.removeItem('error_logs');
        const essentialLogs = this.logs.slice(0, 10);
        localStorage.setItem('error_logs', JSON.stringify(essentialLogs));
      } catch (retryError) {
        console.error('Failed to save even essential error logs:', retryError);
      }
    }
  }

  addErrorListener(callback) {
    this.errorListeners.push(callback);
  }

  removeErrorListener(callback) {
    const index = this.errorListeners.indexOf(callback);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  notifyListeners(logEntry) {
    this.errorListeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch (error) {
        console.error('Error in error listener:', error);
      }
    });
  }

  // Get logs by category
  getLogsByCategory(category) {
    return this.logs.filter(log => log.category === category);
  }

  // Get logs by severity
  getLogsBySeverity(severity) {
    return this.logs.filter(log => log.severity === severity);
  }

  // Get recent logs (last N entries)
  getRecentLogs(count = 10) {
    return this.logs.slice(0, count);
  }

  // Get logs for current session
  getSessionLogs() {
    return this.logs.filter(log => log.sessionId === this.sessionId);
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem('error_logs');
    } catch (error) {
      console.warn('Failed to clear error logs from storage:', error);
    }
  }

  // Generate error report
  generateErrorReport(includeContext = false) {
    const stats = this.getErrorStats();
    const recentCritical = this.getLogsBySeverity('critical').slice(0, 5);
    const recentErrors = this.getLogsBySeverity('error').slice(0, 10);
    
    return {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      stats,
      recentCritical: includeContext ? recentCritical : recentCritical.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        message: log.message,
        type: log.type,
        category: log.category
      })),
      recentErrors: includeContext ? recentErrors : recentErrors.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        message: log.message,
        type: log.type,
        category: log.category
      }))
    };
  }

  getErrorStats() {
    const stats = {
      total: this.logs.length,
      bySeverity: {},
      byCategory: {},
      sessionErrors: this.getSessionLogs().length
    };

    this.logs.forEach(log => {
      // Count by severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      
      // Count by category
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
    });

    return stats;
  }
}

// Convenience functions for global usage
const logger = ErrorLogger.getInstance();

export const logError = (errorData, context) => logger.logError(errorData, context);
export const logWarning = (message, context) => logger.logWarning(message, context);
export const logInfo = (message, context) => logger.logInfo(message, context);

export default ErrorLogger;