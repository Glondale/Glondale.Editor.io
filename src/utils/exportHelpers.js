/**
 * exportHelpers.js - Data transformation and export utility functions
 * 
 * Features:
 * - Format conversion utilities (JSON, CSV, XML, YAML)
 * - Data compression and optimization
 * - Schema transformation and mapping
 * - Batch processing for large datasets
 * - Memory-efficient streaming operations
 * 
 * Integration Points:
 * - ExportableDataManager: Core transformation utilities
 * - CrossGameSaveSystem: Data format conversion
 * - EditorSessionStorage: Session export utilities
 * - CompatibilityChecker: Data validation helpers
 */

/**
 * Convert object to CSV format
 * @param {Array|Object} data - Data to convert
 * @param {Object} options - Conversion options
 * @returns {string} CSV formatted string
 */
export function convertToCSV(data, options = {}) {
  const {
    headers = null,
    delimiter = ',',
    escape = '"',
    includeHeaders = true,
    flattenObjects = true,
    maxDepth = 3
  } = options;

  try {
    // Normalize data to array of objects
    const records = Array.isArray(data) ? data : [data];
    
    if (records.length === 0) {
      return '';
    }

    // Flatten nested objects if requested
    const flatRecords = flattenObjects ? 
      records.map(record => flattenObject(record, maxDepth)) : 
      records;

    // Extract headers
    const allHeaders = headers || extractHeaders(flatRecords);
    
    const csvLines = [];

    // Add headers
    if (includeHeaders && allHeaders.length > 0) {
      csvLines.push(allHeaders.map(h => escapeCSVValue(h, delimiter, escape)).join(delimiter));
    }

    // Add data rows
    flatRecords.forEach(record => {
      const row = allHeaders.map(header => {
        const value = record[header];
        return escapeCSVValue(value, delimiter, escape);
      });
      csvLines.push(row.join(delimiter));
    });

    return csvLines.join('\n');

  } catch (error) {
    throw new Error(`CSV conversion failed: ${error.message}`);
  }
}

/**
 * Convert object to XML format
 * @param {Object} data - Data to convert
 * @param {Object} options - Conversion options
 * @returns {string} XML formatted string
 */
export function convertToXML(data, options = {}) {
  const {
    rootElement = 'data',
    indent = '  ',
    includeDeclaration = true,
    attributePrefix = '@',
    textProperty = '#text',
    cdataElements = [],
    preserveOrder = false
  } = options;

  try {
    let xml = '';

    if (includeDeclaration) {
      xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
    }

    xml += objectToXML(data, rootElement, 0, {
      indent,
      attributePrefix,
      textProperty,
      cdataElements: new Set(cdataElements),
      preserveOrder
    });

    return xml;

  } catch (error) {
    throw new Error(`XML conversion failed: ${error.message}`);
  }
}

/**
 * Convert object to YAML format
 * @param {Object} data - Data to convert
 * @param {Object} options - Conversion options
 * @returns {string} YAML formatted string
 */
export function convertToYAML(data, options = {}) {
  const {
    indent = 2,
    flowLevel = -1,
    includeDocumentMarkers = true,
    sortKeys = false,
    quotingType = '"',
    forceQuotes = false
  } = options;

  try {
    let yaml = '';

    if (includeDocumentMarkers) {
      yaml += '---\n';
    }

    yaml += objectToYAML(data, 0, {
      indent,
      flowLevel,
      sortKeys,
      quotingType,
      forceQuotes,
      currentLevel: 0
    });

    if (includeDocumentMarkers) {
      yaml += '\n...';
    }

    return yaml;

  } catch (error) {
    throw new Error(`YAML conversion failed: ${error.message}`);
  }
}

/**
 * Compress string data
 * @param {string} data - Data to compress
 * @param {Object} options - Compression options
 * @returns {string} Compressed data (base64 encoded)
 */
export function compressData(data, options = {}) {
  const {
    algorithm = 'simple',
    level = 6,
    dictionary = null
  } = options;

  try {
    // Simple compression algorithm (placeholder for real compression)
    if (algorithm === 'simple') {
      return btoa(data); // Base64 encoding as simple "compression"
    }

    // In a real implementation, you might use:
    // - pako for gzip compression
    // - fflate for deflate compression
    // - lz-string for string compression

    throw new Error(`Unsupported compression algorithm: ${algorithm}`);

  } catch (error) {
    throw new Error(`Compression failed: ${error.message}`);
  }
}

/**
 * Decompress string data
 * @param {string} compressedData - Compressed data to decompress
 * @param {Object} options - Decompression options
 * @returns {string} Decompressed data
 */
export function decompressData(compressedData, options = {}) {
  const { algorithm = 'simple' } = options;

  try {
    if (algorithm === 'simple') {
      return atob(compressedData); // Base64 decoding
    }

    throw new Error(`Unsupported decompression algorithm: ${algorithm}`);

  } catch (error) {
    throw new Error(`Decompression failed: ${error.message}`);
  }
}

/**
 * Transform data schema from source to target format
 * @param {Object} data - Data to transform
 * @param {Object} mapping - Schema mapping configuration
 * @param {Object} options - Transformation options
 * @returns {Object} Transformed data
 */
export function transformSchema(data, mapping, options = {}) {
  const {
    strict = false,
    preserveUnmapped = true,
    applyDefaults = true,
    validateTypes = true
  } = options;

  try {
    const transformed = {};
    const processed = new Set();

    // Apply mapped transformations
    Object.entries(mapping).forEach(([targetKey, sourceConfig]) => {
      let value;

      if (typeof sourceConfig === 'string') {
        // Simple key mapping
        value = getNestedValue(data, sourceConfig);
        processed.add(sourceConfig);
      } else if (typeof sourceConfig === 'object') {
        // Complex transformation
        value = applyTransformation(data, sourceConfig, options);
        if (sourceConfig.source) {
          processed.add(sourceConfig.source);
        }
      }

      if (value !== undefined) {
        setNestedValue(transformed, targetKey, value);
      } else if (applyDefaults && sourceConfig.default !== undefined) {
        setNestedValue(transformed, targetKey, sourceConfig.default);
      }
    });

    // Preserve unmapped properties if requested
    if (preserveUnmapped && !strict) {
      preserveUnmappedProperties(data, transformed, processed, '');
    }

    return transformed;

  } catch (error) {
    throw new Error(`Schema transformation failed: ${error.message}`);
  }
}

/**
 * Batch process large datasets
 * @param {Array} data - Data array to process
 * @param {Function} processor - Processing function
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Processed results
 */
export async function batchProcess(data, processor, options = {}) {
  const {
    batchSize = 1000,
    concurrent = false,
    concurrency = 3,
    onProgress = null,
    onError = 'continue' // 'continue', 'stop', 'collect'
  } = options;

  try {
    const results = [];
    const errors = [];
    let processed = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      if (concurrent) {
        // Process batches concurrently
        const batchPromises = [];
        
        for (let j = 0; j < batch.length; j += Math.ceil(batch.length / concurrency)) {
          const subBatch = batch.slice(j, j + Math.ceil(batch.length / concurrency));
          batchPromises.push(processBatchConcurrent(subBatch, processor, onError, errors));
        }
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.flat());
      } else {
        // Process batches sequentially
        const batchResult = await processBatchSequential(batch, processor, onError, errors);
        results.push(...batchResult);
      }

      processed += batch.length;
      
      if (onProgress) {
        onProgress({
          processed,
          total: data.length,
          percentage: Math.round((processed / data.length) * 100),
          errors: errors.length
        });
      }
    }

    return {
      results,
      errors,
      processed,
      success: errors.length === 0
    };

  } catch (error) {
    throw new Error(`Batch processing failed: ${error.message}`);
  }
}

/**
 * Sanitize data for export (remove sensitive information)
 * @param {Object} data - Data to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized data
 */
export function sanitizeForExport(data, options = {}) {
  const {
    removeKeys = ['password', 'token', 'secret', 'key'],
    anonymizeKeys = ['email', 'name', 'username'],
    redactPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    preserveStructure = true,
    placeholder = '[REDACTED]'
  } = options;

  try {
    const sanitized = deepClone(data);

    sanitizeObject(sanitized, {
      removeKeys: new Set(removeKeys.map(k => k.toLowerCase())),
      anonymizeKeys: new Set(anonymizeKeys.map(k => k.toLowerCase())),
      redactPattern,
      preserveStructure,
      placeholder
    });

    return sanitized;

  } catch (error) {
    throw new Error(`Data sanitization failed: ${error.message}`);
  }
}

/**
 * Generate unique identifiers
 * @param {Object} options - ID generation options
 * @returns {string} Unique identifier
 */
export function generateUniqueId(options = {}) {
  const {
    length = 8,
    prefix = '',
    suffix = '',
    charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    includeTimestamp = false,
    format = 'random'
  } = options;

  try {
    let id = '';

    if (format === 'uuid') {
      // Generate UUID v4
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    } else if (format === 'timestamp') {
      id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    } else {
      // Random string generation
      for (let i = 0; i < length; i++) {
        id += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    }

    if (includeTimestamp && format !== 'timestamp') {
      id = Date.now().toString(36) + '_' + id;
    }

    return prefix + id + suffix;

  } catch (error) {
    throw new Error(`ID generation failed: ${error.message}`);
  }
}

/**
 * Validate data format
 * @param {any} data - Data to validate
 * @param {Object} schema - Validation schema
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateDataFormat(data, schema, options = {}) {
  const {
    strict = false,
    allowExtraKeys = true,
    coerceTypes = false,
    collectAllErrors = true
  } = options;

  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    coercions: []
  };

  try {
    validateAgainstSchema(data, schema, result, '', {
      strict,
      allowExtraKeys,
      coerceTypes,
      collectAllErrors
    });

    result.isValid = result.errors.length === 0;
    return result;

  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: [],
      coercions: []
    };
  }
}

// Helper Functions

function flattenObject(obj, maxDepth = 3, currentDepth = 0, prefix = '') {
  const flattened = {};
  
  if (currentDepth >= maxDepth) {
    flattened[prefix] = JSON.stringify(obj);
    return flattened;
  }

  Object.entries(obj).forEach(([key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value, maxDepth, currentDepth + 1, newKey));
    } else if (Array.isArray(value)) {
      flattened[newKey] = value.join(';');
    } else {
      flattened[newKey] = value;
    }
  });

  return flattened;
}

function extractHeaders(records) {
  const headers = new Set();
  
  records.forEach(record => {
    Object.keys(record).forEach(key => headers.add(key));
  });

  return Array.from(headers).sort();
}

function escapeCSVValue(value, delimiter, escape) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  
  // Check if escaping is needed
  if (stringValue.includes(delimiter) || 
      stringValue.includes(escape) || 
      stringValue.includes('\n') || 
      stringValue.includes('\r')) {
    return escape + stringValue.replace(new RegExp(escape, 'g'), escape + escape) + escape;
  }

  return stringValue;
}

function objectToXML(obj, tagName, depth, options) {
  const { indent, attributePrefix, textProperty, cdataElements } = options;
  const indentation = indent.repeat(depth);
  
  if (obj === null || obj === undefined) {
    return `${indentation}<${tagName}/>\n`;
  }

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    const value = Array.isArray(obj) ? 
      obj.map(item => objectToXML(item, 'item', depth + 1, options)).join('') :
      String(obj);
    
    if (cdataElements.has(tagName)) {
      return `${indentation}<${tagName}><![CDATA[${value}]]></${tagName}>\n`;
    } else {
      return `${indentation}<${tagName}>${escapeXML(value)}</${tagName}>\n`;
    }
  }

  let xml = `${indentation}<${tagName}`;
  let content = '';
  
  // Process attributes and content
  Object.entries(obj).forEach(([key, value]) => {
    if (key.startsWith(attributePrefix)) {
      xml += ` ${key.substring(1)}="${escapeXML(String(value))}"`;
    } else if (key === textProperty) {
      content = String(value);
    } else {
      content += objectToXML(value, key, depth + 1, options);
    }
  });

  if (content) {
    xml += '>\n' + content + `${indentation}</${tagName}>\n`;
  } else {
    xml += '/>\n';
  }

  return xml;
}

function escapeXML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function objectToYAML(obj, depth, options) {
  const { indent, sortKeys, quotingType, forceQuotes } = options;
  const indentation = ' '.repeat(depth * indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    const needsQuotes = forceQuotes || 
      obj.includes('\n') || 
      obj.includes(':') || 
      obj.includes('#') ||
      obj.match(/^\s|\s$/);
    
    return needsQuotes ? `${quotingType}${obj}${quotingType}` : obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    
    return obj.map(item => 
      `${indentation}- ${objectToYAML(item, depth, options)}`
    ).join('\n');
  }

  if (typeof obj === 'object') {
    const keys = sortKeys ? Object.keys(obj).sort() : Object.keys(obj);
    
    if (keys.length === 0) return '{}';
    
    return keys.map(key => {
      const value = objectToYAML(obj[key], depth + 1, options);
      const keyStr = key.includes(' ') || key.includes(':') ? 
        `"${key}"` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        return `${indentation}${keyStr}:\n${value}`;
      } else if (Array.isArray(obj[key]) && obj[key].length > 0) {
        return `${indentation}${keyStr}:\n${value}`;
      } else {
        return `${indentation}${keyStr}: ${value}`;
      }
    }).join('\n');
  }

  return String(obj);
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);
  
  target[lastKey] = value;
}

function applyTransformation(data, config, options) {
  const { source, transform, type, default: defaultValue } = config;
  
  let value = source ? getNestedValue(data, source) : data;
  
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (transform && typeof transform === 'function') {
    value = transform(value);
  }

  if (type && options.validateTypes) {
    value = coerceType(value, type);
  }

  return value;
}

function coerceType(value, targetType) {
  switch (targetType) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'array':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}

function preserveUnmappedProperties(source, target, processed, prefix) {
  Object.entries(source).forEach(([key, value]) => {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    
    if (!processed.has(fullPath)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (!target[key]) target[key] = {};
        preserveUnmappedProperties(value, target[key], processed, fullPath);
      } else {
        target[key] = value;
      }
    }
  });
}

async function processBatchSequential(batch, processor, onError, errors) {
  const results = [];
  
  for (const item of batch) {
    try {
      const result = await processor(item);
      results.push(result);
    } catch (error) {
      if (onError === 'stop') {
        throw error;
      } else if (onError === 'collect') {
        errors.push({ item, error });
      }
      // Continue on error
    }
  }

  return results;
}

async function processBatchConcurrent(batch, processor, onError, errors) {
  const promises = batch.map(async item => {
    try {
      return await processor(item);
    } catch (error) {
      if (onError === 'stop') {
        throw error;
      } else if (onError === 'collect') {
        errors.push({ item, error });
      }
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter(result => result !== null);
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone);
  }

  const cloned = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone(obj[key]);
  });

  return cloned;
}

function sanitizeObject(obj, options) {
  const { removeKeys, anonymizeKeys, redactPattern, preserveStructure, placeholder } = options;

  Object.keys(obj).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    if (removeKeys.has(lowerKey)) {
      if (preserveStructure) {
        obj[key] = placeholder;
      } else {
        delete obj[key];
      }
    } else if (anonymizeKeys.has(lowerKey)) {
      if (typeof obj[key] === 'string') {
        obj[key] = 'anonymous_' + Math.random().toString(36).substr(2, 6);
      }
    } else if (typeof obj[key] === 'string' && redactPattern) {
      obj[key] = obj[key].replace(redactPattern, placeholder);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key], options);
    }
  });
}

function validateAgainstSchema(data, schema, result, path, options) {
  // Basic schema validation implementation
  // This is a simplified version - real implementations would be more comprehensive
  
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    
    if (actualType !== schema.type) {
      if (options.coerceTypes) {
        try {
          data = coerceType(data, schema.type);
          result.coercions.push(`${path}: ${actualType} → ${schema.type}`);
        } catch (error) {
          result.errors.push(`${path}: Type mismatch - expected ${schema.type}, got ${actualType}`);
        }
      } else {
        result.errors.push(`${path}: Type mismatch - expected ${schema.type}, got ${actualType}`);
      }
    }
  }

  if (schema.required && (data === undefined || data === null)) {
    result.errors.push(`${path}: Required field is missing`);
  }

  if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
    Object.entries(schema.properties).forEach(([key, subSchema]) => {
      const newPath = path ? `${path}.${key}` : key;
      validateAgainstSchema(data[key], subSchema, result, newPath, options);
    });
  }
}