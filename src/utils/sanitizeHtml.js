// Simple client-side HTML sanitizer to strip scripts and unsafe attributes.
// NOTE: Replace with DOMPurify or a more robust library if available.

const UNSAFE_ATTR_PATTERN = /on\w+/i;
const UNSAFE_PROTO_PATTERN = /javascript:/i;

export function sanitizeHtml(html = '') {
  if (typeof window === 'undefined') {
    // Server-side rendering: return raw string for now.
    return html;
  }

  const template = window.document.createElement('template');
  template.innerHTML = html;

  const walk = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      // Remove script/style tags entirely
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
        node.remove();
        return;
      }

      // Strip unsafe attributes
      [...node.attributes].forEach(attr => {
        if (UNSAFE_ATTR_PATTERN.test(attr.name) || UNSAFE_PROTO_PATTERN.test(attr.value)) {
          node.removeAttribute(attr.name);
        }
      });
    }

    [...node.childNodes].forEach(child => walk(child));
  };

  walk(template.content || template);
  return template.innerHTML;
}

export default sanitizeHtml;
