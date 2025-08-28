 
const { createElement } = React;

export function SceneDisplay({ scene, className = '' }) {
  if (!scene) {
    return createElement('div', {
      className: `p-6 bg-gray-100 rounded-lg ${className}`
    }, createElement('p', {
      className: 'text-gray-500 text-center'
    }, 'No scene loaded'));
  }

  return createElement('div', {
    className: `p-6 bg-white rounded-lg shadow-sm border ${className}`
  }, [
    // Scene Title
    createElement('h2', {
      key: 'title',
      className: 'text-2xl font-bold text-gray-900 mb-4'
    }, scene.title),

    // Scene Content
    createElement('div', {
      key: 'content',
      className: 'prose max-w-none'
    }, createElement('div', {
      className: 'text-gray-700 leading-relaxed whitespace-pre-wrap',
      dangerouslySetInnerHTML: { 
        __html: formatSceneContent(scene.content) 
      }
    }))
  ]);
}

// Helper function to format scene content
function formatSceneContent(content) {
  // Basic formatting - convert line breaks to HTML
  return content
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Bold text **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic text *text*
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}