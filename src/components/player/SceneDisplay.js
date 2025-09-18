import React, { createElement, useMemo } from "https://esm.sh/react@18";
import sanitizeHtml from '../../utils/sanitizeHtml.js';

export function SceneDisplay({ scene, className = '' }) {
  const formattedContent = useMemo(() => {
    return scene ? formatSceneContent(scene.content) : '';
  }, [scene?.content]);

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
    createElement('h2', {
      key: 'title',
      className: 'text-2xl font-bold text-gray-900 mb-4'
    }, scene.title),

    createElement('div', {
      key: 'content',
      className: 'prose max-w-none'
    }, createElement('div', {
      className: 'text-gray-700 leading-relaxed',
      dangerouslySetInnerHTML: { __html: formattedContent }
    }))
  ]);
}

export function formatSceneContent(content = '') {
  if (!content) return '';

  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  const processed = hasHtml ? content : convertPlainTextToHtml(content);

  return sanitizeHtml(processed);
}

function convertPlainTextToHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
