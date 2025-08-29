// ErrorBoundary.js - React Error Boundary with comprehensive error handling
import React, { Component } from "https://esm.sh/react@18";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state to show error UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    this.setState({
      error,
      errorInfo,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Log to centralized error system
    this.logError(error, errorInfo);

    // Report to parent if callback provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  logError = (error, errorInfo) => {
    const errorData = {
      timestamp: new Date().toISOString(),
      errorId: this.state.errorId,
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      props: this.props.logProps ? this.sanitizeProps(this.props) : null,
      retryCount: this.state.retryCount
    };

    // Store in localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingErrors.push(errorData);
      
      // Keep only last 50 errors to prevent storage overflow
      const recentErrors = existingErrors.slice(-50);
      localStorage.setItem('error_logs', JSON.stringify(recentErrors));
    } catch (storageError) {
      console.error('Failed to store error log:', storageError);
    }

    // Console log for development
    console.group(`🔥 React Error Boundary [${this.state.errorId}]`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Full Error Data:', errorData);
    console.groupEnd();
  };

  sanitizeProps = (props) => {
    // Remove sensitive data and functions from props for logging
    const sanitized = {};
    Object.keys(props).forEach(key => {
      const value = props[key];
      if (typeof value === 'function') {
        sanitized[key] = '[Function]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = '[Object]';
      } else if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...[truncated]';
      } else {
        sanitized[key] = value;
      }
    });
    return sanitized;
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));

    // Call retry callback if provided
    if (this.props.onRetry) {
      this.props.onRetry(this.state.retryCount + 1);
    }
  };

  handleReportIssue = () => {
    const errorData = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      retryCount: this.state.retryCount
    };

    // Create a bug report
    const reportText = `Error Report [${this.state.errorId}]
    
Error: ${this.state.error?.message}
Time: ${new Date().toISOString()}
Page: ${window.location.href}
Retry Count: ${this.state.retryCount}
User Agent: ${navigator.userAgent}

Component Stack:
${this.state.errorInfo?.componentStack || 'Not available'}

Error Stack:
${this.state.error?.stack || 'Not available'}
`;

    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(reportText).then(() => {
        alert('Error report copied to clipboard! Please paste it when reporting the issue.');
      }).catch(() => {
        // Fallback for older browsers
        this.fallbackCopyToClipboard(reportText);
      });
    } else {
      this.fallbackCopyToClipboard(reportText);
    }
  };

  fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      alert('Error report copied to clipboard! Please paste it when reporting the issue.');
    } catch (err) {
      console.error('Failed to copy error report:', err);
      // Show error details in a new window as fallback
      const newWindow = window.open('', '_blank');
      newWindow.document.write(`<pre>${text}</pre>`);
    }
    
    document.body.removeChild(textArea);
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI provided by parent
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error, 
          this.state.errorInfo, 
          this.handleRetry,
          this.state.retryCount
        );
      }

      // Default error UI
      return React.createElement('div', {
        className: 'error-boundary min-h-screen bg-red-50 flex items-center justify-center p-4'
      }, React.createElement('div', {
        className: 'bg-white rounded-lg shadow-lg p-6 max-w-md w-full border-l-4 border-red-500'
      }, [
        // Error icon and title
        React.createElement('div', {
          key: 'header',
          className: 'flex items-center mb-4'
        }, [
          React.createElement('div', {
            key: 'icon',
            className: 'flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center'
          }, '⚠️'),
          React.createElement('div', {
            key: 'title',
            className: 'ml-3'
          }, [
            React.createElement('h3', {
              key: 'heading',
              className: 'text-lg font-medium text-red-800'
            }, this.props.title || 'Something went wrong'),
            React.createElement('p', {
              key: 'id',
              className: 'text-sm text-red-600 font-mono'
            }, `Error ID: ${this.state.errorId}`)
          ])
        ]),

        // Error message
        React.createElement('div', {
          key: 'message',
          className: 'mb-4'
        }, React.createElement('p', {
          className: 'text-gray-700'
        }, this.props.message || 'An unexpected error occurred. You can try refreshing the page or retrying the action.')),

        // Error details (in development)
        (typeof window !== 'undefined' && window.location.hostname === 'localhost') && React.createElement('details', {
          key: 'details',
          className: 'mb-4 text-sm'
        }, [
          React.createElement('summary', {
            key: 'summary',
            className: 'cursor-pointer text-red-700 font-medium'
          }, 'Technical Details'),
          React.createElement('div', {
            key: 'content',
            className: 'mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-32'
          }, [
            React.createElement('div', {
              key: 'error-msg',
              className: 'text-red-700 font-bold'
            }, this.state.error?.message),
            React.createElement('div', {
              key: 'stack',
              className: 'mt-2 text-gray-600 whitespace-pre-wrap'
            }, this.state.error?.stack)
          ])
        ]),

        // Action buttons
        React.createElement('div', {
          key: 'actions',
          className: 'flex space-x-3'
        }, [
          React.createElement('button', {
            key: 'retry',
            onClick: this.handleRetry,
            disabled: this.state.retryCount >= (this.props.maxRetries || 3),
            className: `px-4 py-2 text-sm font-medium rounded-md ${
              this.state.retryCount >= (this.props.maxRetries || 3)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`
          }, this.state.retryCount >= (this.props.maxRetries || 3) 
            ? 'Max retries reached' 
            : `Retry${this.state.retryCount > 0 ? ` (${this.state.retryCount})` : ''}`
          ),

          React.createElement('button', {
            key: 'reload',
            onClick: () => window.location.reload(),
            className: 'px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700'
          }, 'Reload Page'),

          React.createElement('button', {
            key: 'report',
            onClick: this.handleReportIssue,
            className: 'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700'
          }, 'Report Issue')
        ])
      ]));
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = (WrappedComponent, errorBoundaryProps = {}) => {
  const WithErrorBoundaryComponent = (props) => {
    return React.createElement(ErrorBoundary, errorBoundaryProps,
      React.createElement(WrappedComponent, props)
    );
  };

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundaryComponent;
};

// Hook for error reporting in functional components
export const useErrorHandler = () => {
  const handleError = React.useCallback((error, errorInfo = {}) => {
    const errorData = {
      timestamp: new Date().toISOString(),
      errorId: `hook_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: error.name,
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...errorInfo
    };

    // Store in localStorage
    try {
      const existingErrors = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingErrors.push(errorData);
      const recentErrors = existingErrors.slice(-50);
      localStorage.setItem('error_logs', JSON.stringify(recentErrors));
    } catch (storageError) {
      console.error('Failed to store error log:', storageError);
    }

    // Console log
    console.error('Handled Error:', errorData);

    // Optionally throw to trigger error boundary
    throw error;
  }, []);

  return { handleError };
};

export default ErrorBoundary;