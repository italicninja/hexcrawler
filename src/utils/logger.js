/**
 * Development Logger Utility
 * 
 * Provides categorized, color-coded logging for development and debugging.
 * Automatically disabled in production builds (zero runtime cost).
 * 
 * Categories:
 * - combat: Combat flow, AI decisions, turn order, attack calculations
 * - mapgen: Terrain generation, room placement, POI spawning, dungeon creation
 * - movement: Player movement, pathfinding, hex distance calculations
 * - state: GameState reducer actions, state transitions, context updates
 * - storage: Save/load operations, localStorage, serialization
 * - render: Canvas redraws, React renders, performance metrics
 * - items: Inventory changes, equipment, loot generation
 * - general: Uncategorized logs, utilities, misc operations
 * 
 * Usage:
 * ```javascript
 * import logger from './utils/logger.js';
 * 
 * // Basic logging
 * logger.combat.info('Starting combat', { allies: 1, enemies: 3 });
 * logger.mapgen.debug('Generating terrain', { seed: 42, algorithm: 'perlin' });
 * logger.state.warn('Missing player position, using default');
 * logger.storage.error('Failed to save game', error);
 * 
 * // Performance timing
 * logger.render.time('canvas-draw');
 * drawHexGrid();
 * logger.render.timeEnd('canvas-draw'); // Logs: "canvas-draw: 12.4ms"
 * ```
 */

// Only enable logging in development mode
const IS_DEV = import.meta.env.DEV;

// Log level priority (higher = more severe)
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Get log level from env or URL param (default: debug in dev, error in prod)
function getLogLevel() {
  if (!IS_DEV) return 'error'; // Production: only errors
  
  // Check URL param: ?logLevel=info
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlLevel = params.get('logLevel');
    if (urlLevel && LOG_LEVELS[urlLevel] !== undefined) {
      return urlLevel;
    }
  }
  
  // Check env var
  const envLevel = import.meta.env.VITE_LOG_LEVEL;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  
  return 'debug'; // Default: show everything in dev
}

const CURRENT_LOG_LEVEL = getLogLevel();

// Category colors (for console styling)
const CATEGORY_COLORS = {
  combat: '#ff6b6b',      // Red
  mapgen: '#51cf66',      // Green
  movement: '#4dabf7',    // Blue
  state: '#ffd43b',       // Yellow
  storage: '#9775fa',     // Purple
  render: '#ff922b',      // Orange
  items: '#20c997',       // Teal
  general: '#adb5bd'      // Gray
};

// Level colors
const LEVEL_COLORS = {
  debug: '#868e96',       // Gray
  info: '#339af0',        // Blue
  warn: '#ffa94d',        // Orange
  error: '#ff6b6b'        // Red
};

/**
 * Category-specific logger
 */
class CategoryLogger {
  constructor(category) {
    this.category = category;
    this.color = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  }

  /**
   * Check if log level should be displayed
   */
  _shouldLog(level) {
    if (!IS_DEV) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  /**
   * Format log message with category and styling
   */
  _formatMessage(level, args) {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const categoryStyle = `color: ${this.color}; font-weight: bold;`;
    const levelStyle = `color: ${LEVEL_COLORS[level]}; font-weight: normal;`;
    const timeStyle = `color: #868e96; font-weight: normal;`;
    
    return [
      `%c[${this.category}]%c[${level.toUpperCase()}]%c[${timestamp}]`,
      categoryStyle,
      levelStyle,
      timeStyle,
      ...args
    ];
  }

  /**
   * Log debug message (detailed diagnostics)
   */
  debug(...args) {
    if (!this._shouldLog('debug')) return;
    console.log(...this._formatMessage('debug', args));
  }

  /**
   * Log info message (general information)
   */
  info(...args) {
    if (!this._shouldLog('info')) return;
    console.log(...this._formatMessage('info', args));
  }

  /**
   * Log warning message (recoverable issues)
   */
  warn(...args) {
    if (!this._shouldLog('warn')) return;
    console.warn(...this._formatMessage('warn', args));
  }

  /**
   * Log error message (failures, exceptions)
   */
  error(...args) {
    if (!this._shouldLog('error')) return;
    console.error(...this._formatMessage('error', args));
  }

  /**
   * Start performance timer
   * @param {string} label - Timer label
   */
  time(label) {
    if (!IS_DEV) return;
    const timerLabel = `[${this.category}] ${label}`;
    console.time(timerLabel);
  }

  /**
   * End performance timer and log duration
   * @param {string} label - Timer label (must match time() call)
   */
  timeEnd(label) {
    if (!IS_DEV) return;
    const timerLabel = `[${this.category}] ${label}`;
    console.timeEnd(timerLabel);
  }

  /**
   * Log a group of related messages
   * @param {string} groupLabel - Group label
   * @param {Function} callback - Function that logs messages
   */
  group(groupLabel, callback) {
    if (!IS_DEV) return;
    console.group(`[${this.category}] ${groupLabel}`);
    callback();
    console.groupEnd();
  }

  /**
   * Log a collapsed group (useful for large data dumps)
   * @param {string} groupLabel - Group label
   * @param {Function} callback - Function that logs messages
   */
  groupCollapsed(groupLabel, callback) {
    if (!IS_DEV) return;
    console.groupCollapsed(`[${this.category}] ${groupLabel}`);
    callback();
    console.groupEnd();
  }

  /**
   * Log table (useful for arrays of objects)
   * @param {Array|Object} data - Data to display as table
   */
  table(data) {
    if (!IS_DEV) return;
    console.log(`%c[${this.category}]`, `color: ${this.color}; font-weight: bold;`);
    console.table(data);
  }
}

/**
 * Main logger object with all categories
 */
const logger = {
  combat: new CategoryLogger('combat'),
  mapgen: new CategoryLogger('mapgen'),
  movement: new CategoryLogger('movement'),
  state: new CategoryLogger('state'),
  storage: new CategoryLogger('storage'),
  render: new CategoryLogger('render'),
  items: new CategoryLogger('items'),
  general: new CategoryLogger('general'),

  /**
   * Check if dev mode is enabled
   */
  get isEnabled() {
    return IS_DEV;
  },

  /**
   * Get current log level
   */
  get level() {
    return CURRENT_LOG_LEVEL;
  },

  /**
   * Log logger configuration (useful for debugging the logger itself)
   */
  logConfig() {
    if (!IS_DEV) return;
    console.log('%c[Logger Config]', 'color: #fa5252; font-weight: bold;');
    console.log('Dev mode:', IS_DEV);
    console.log('Log level:', CURRENT_LOG_LEVEL);
    console.log('Categories:', Object.keys(CATEGORY_COLORS).join(', '));
    console.log('Tip: Add ?logLevel=info to URL to change log level');
  }
};

export default logger;
