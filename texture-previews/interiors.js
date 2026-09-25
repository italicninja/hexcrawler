"use strict";
(() => {
  // src/utils/seededRandom.ts
  function hashSeed(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h, 31) + seed.charCodeAt(i) >>> 0;
    }
    return h;
  }
  function createSeededRNG(seed) {
    let h = hashSeed(seed);
    return () => {
      h = h + 1831565813 >>> 0;
      let t = h;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // src/utils/hexMath.ts
  function offsetToCube(col, row) {
    const x = col - Math.floor(row / 2);
    const z = row;
    const y = -x - z;
    return { x, y, z };
  }
  function getHexDistance(col1, row1, col2, row2) {
    const cube1 = offsetToCube(col1, row1);
    const cube2 = offsetToCube(col2, row2);
    return (Math.abs(cube1.x - cube2.x) + Math.abs(cube1.y - cube2.y) + Math.abs(cube1.z - cube2.z)) / 2;
  }

  // src/game/InteriorGenerator.ts
  var InteriorGenerator = class {
    seed;
    rng;
    terrainTypes;
    constructor() {
      this.seed = null;
      this.rng = null;
      this.terrainTypes = {
        floor: {
          key: "floor",
          name: "Stone Floor",
          color: "#6a6a6a",
          // Lighter gray for better contrast
          walkable: true
        },
        wall: {
          key: "wall",
          name: "Wall",
          color: "#1a1a1a",
          // Darker for better contrast
          walkable: false
        },
        water: {
          key: "water",
          name: "Underground Water",
          color: "#1e3a5f",
          walkable: false
        },
        entrance: {
          key: "entrance",
          name: "Entrance",
          color: "#8B4513",
          walkable: true
        },
        exit: {
          key: "exit",
          name: "Exit",
          color: "#2ecc71",
          walkable: true
        },
        chasm: {
          key: "chasm",
          name: "Chasm",
          color: "#0d0d0d",
          walkable: false
        },
        rubble: {
          key: "rubble",
          name: "Rubble",
          color: "#5a5a5a",
          walkable: true
        }
      };
    }
    /**
     * Set seed for reproducible generation
     * @param {string} seed - Seed string
     */
    setSeed(seed) {
      this.seed = seed;
      this.rng = this.createSeededRNG(seed);
    }
    /**
     * Create a seeded random number generator
     */
    createSeededRNG(seed) {
      return createSeededRNG(seed);
    }
    /**
     * Get random number (0-1)
     */
    random() {
      if (!this.rng) {
        throw new Error("Seed not set. Call setSeed() first.");
      }
      return this.rng();
    }
    /**
     * Get random integer between min and max (inclusive)
     */
    randomInt(min, max) {
      return Math.floor(this.random() * (max - min + 1)) + min;
    }
    /**
     * Pick random element from array
     */
    randomChoice(array) {
      return array[Math.floor(this.random() * array.length)];
    }
    /**
     * Initialize empty grid of the given dimensions.
     */
    initializeGrid(width, height, defaultTerrain) {
      const grid = [];
      for (let row = 0; row < height; row++) {
        grid[row] = [];
        for (let col = 0; col < width; col++) {
          grid[row][col] = {
            col,
            row,
            terrain: defaultTerrain,
            content: null
            // null | 'encounter' | 'loot' | 'hazard' | 'entrance'
          };
        }
      }
      return grid;
    }
    /**
     * Convert 2D grid to flat hex array
     */
    gridToHexes(grid) {
      const hexes = [];
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          hexes.push(grid[row][col]);
        }
      }
      return hexes;
    }
    /**
     * Get hex neighbors (6 directions for hex grid)
     * @param {number} col
     * @param {number} row
     * @param {number} width
     * @returns Array of {col, row} neighbors
     */
    getNeighbors(col, row, width, height) {
      const neighbors = [];
      const offsets = Math.abs(row % 2) === 0 ? [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1]
      ] : [
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
        [1, 1]
      ];
      for (const [dc, dr] of offsets) {
        const newCol = col + dc;
        const newRow = row + dr;
        if (newCol >= 0 && newCol < width && newRow >= 0 && newRow < height) {
          neighbors.push({ col: newCol, row: newRow });
        }
      }
      return neighbors;
    }
    /**
     * Count neighbors of specific terrain type
     * @param {Array} grid - 2D grid
     * @param {number} col
     * @param {number} row
     * @returns Count of neighbors with this terrain
     */
    countNeighborTerrain(grid, col, row, terrainKey) {
      const neighbors = this.getNeighbors(col, row, grid[0].length, grid.length);
      let count = 0;
      for (const { col: nCol, row: nRow } of neighbors) {
        if (grid[nRow][nCol].terrain.key === terrainKey) {
          count++;
        }
      }
      return count;
    }
    /**
     * Flood fill to find connected regions
     * @param {Array} grid - 2D grid
     * @param {number} startCol
     * @param {number} startRow
     * @returns Set of "col,row" keys for connected region
     */
    floodFill(grid, startCol, startRow, isWalkable) {
      const visited = /* @__PURE__ */ new Set();
      const queue = [{ col: startCol, row: startRow }];
      const width = grid[0].length;
      const height = grid.length;
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        const { col, row } = next;
        const key = `${col},${row}`;
        if (visited.has(key)) continue;
        if (!isWalkable(grid[row][col])) continue;
        visited.add(key);
        const neighbors = this.getNeighbors(col, row, width, height);
        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.col},${neighbor.row}`;
          if (!visited.has(neighborKey)) {
            queue.push(neighbor);
          }
        }
      }
      return visited;
    }
    /**
     * Find all walkable tiles
     */
    getWalkableTiles(grid) {
      const walkable = [];
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          if (grid[row][col].terrain.walkable) {
            walkable.push({ col, row });
          }
        }
      }
      return walkable;
    }
    /**
     * Calculate hex distance (cube coordinates)
     * Delegates to the shared hexMath utility. Kept as an instance method
     * so subclasses (CaveGenerator, RuinsGenerator, TownGenerator, etc.)
     * can continue calling this.getHexDistance() without changes.
     * @param {number} col1
     * @param {number} row1
     * @returns Distance
     */
    getHexDistance(col1, row1, col2, row2) {
      return getHexDistance(col1, row1, col2, row2);
    }
    /**
     * Generate interior map (must be implemented by subclasses).
     * The third argument is a CR number for dungeon-type generators, or a
     * settlement-metadata object for the town generator — hence the loose type
     * on this abstract hook point.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    generate(width, height, crOrData) {
      throw new Error("generate() must be implemented by subclass");
    }
  };

  // src/game/BaseGenerator.ts
  var BaseGenerator = class {
    lookupTables;
    constructor() {
      this.lookupTables = {};
    }
    /**
     * Get lookup table for a given CR with fallback to closest lower CR
     * @param cr - Challenge Rating
     * @param maxCR - Maximum CR in tables (default 11)
     * @returns Lookup table data or null
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCRTable(cr, maxCR = 11) {
      const lookupCR = Math.min(cr, maxCR);
      if (this.lookupTables[lookupCR]) {
        return this.lookupTables[lookupCR];
      }
      for (let testCR = lookupCR; testCR >= 0; testCR--) {
        if (this.lookupTables[testCR]) {
          return this.lookupTables[testCR];
        }
      }
      return this.lookupTables[0] || null;
    }
    /**
     * Cap CR at a maximum value
     * @param cr - Challenge Rating
     * @param maxCR - Maximum CR value
     * @returns Capped CR
     */
    capCR(cr, maxCR = 11) {
      return Math.min(cr, maxCR);
    }
    /**
     * Generate random integer in range [min, max] (inclusive)
     * @param min - Minimum value
     * @param max - Maximum value
     * @param random - Random function (0-1)
     * @returns Random integer
     */
    randomInt(min, max, random = Math.random) {
      return Math.floor(random() * (max - min + 1)) + min;
    }
    /**
     * Weighted random selection from array
     * @param items - Items to choose from
     * @param weights - Weights for each item (same length as items)
     * @param random - Random function (0-1)
     * @returns Selected item
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    weightedRandom(items, weights, random = Math.random) {
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      let randomValue = random() * totalWeight;
      for (let i = 0; i < items.length; i++) {
        randomValue -= weights[i];
        if (randomValue <= 0) {
          return items[i];
        }
      }
      return items[items.length - 1];
    }
    /**
     * Roll multiple dice and sum the results
     * @param diceCount - Number of dice to roll
     * @param diceSides - Number of sides per die
     * @param random - Random function (0-1)
     * @returns Total rolled value
     */
    rollDice(diceCount, diceSides, random = Math.random) {
      let total = 0;
      for (let i = 0; i < diceCount; i++) {
        total += Math.floor(random() * diceSides) + 1;
      }
      return total;
    }
    /**
     * Calculate a DC (Difficulty Class) based on CR
     * Uses standard D&D 5e progression: DC = 10 + (CR / 3)
     * @param cr - Challenge Rating
     * @returns DC value
     */
    calculateDC(cr) {
      const baseDC = 10;
      const increment = Math.floor(cr / 3);
      return baseDC + increment;
    }
    /**
     * Select random item from array
     * @param array - Array to choose from
     * @param random - Random function (0-1)
     * @returns Selected item or null if array is empty
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    randomChoice(array, random = Math.random) {
      if (!array || array.length === 0) return null;
      const index = Math.floor(random() * array.length);
      return array[index];
    }
  };

  // src/utils/logger.ts
  var IS_DEV = false;
  var LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  function getLogLevel() {
    if (!IS_DEV) return "error";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlLevel = params.get("logLevel");
      if (urlLevel && LOG_LEVELS[urlLevel] !== void 0) {
        return urlLevel;
      }
    }
    const envLevel = void 0;
    if (envLevel && LOG_LEVELS[envLevel] !== void 0) {
      return envLevel;
    }
    return "debug";
  }
  var CURRENT_LOG_LEVEL = getLogLevel();
  var CATEGORY_COLORS = {
    combat: "#ff6b6b",
    // Red
    mapgen: "#51cf66",
    // Green
    movement: "#4dabf7",
    // Blue
    state: "#ffd43b",
    // Yellow
    storage: "#9775fa",
    // Purple
    render: "#ff922b",
    // Orange
    items: "#20c997",
    // Teal
    general: "#adb5bd"
    // Gray
  };
  var LEVEL_COLORS = {
    debug: "#868e96",
    // Gray
    info: "#339af0",
    // Blue
    warn: "#ffa94d",
    // Orange
    error: "#ff6b6b"
    // Red
  };
  var CategoryLogger = class {
    category;
    color;
    constructor(category) {
      this.category = category;
      this.color = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
    }
    /**
     * Check if log level should be displayed
     */
    _shouldLog(level) {
      if (!IS_DEV) return level === "error";
      return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
    }
    /**
     * Format log message with category and styling
     */
    _formatMessage(level, args) {
      const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
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
      if (!this._shouldLog("debug")) return;
      console.log(...this._formatMessage("debug", args));
    }
    /**
     * Log info message (general information)
     */
    info(...args) {
      if (!this._shouldLog("info")) return;
      console.log(...this._formatMessage("info", args));
    }
    /**
     * Log warning message (recoverable issues)
     */
    warn(...args) {
      if (!this._shouldLog("warn")) return;
      console.warn(...this._formatMessage("warn", args));
    }
    /**
     * Log error message (failures, exceptions)
     */
    error(...args) {
      if (!this._shouldLog("error")) return;
      console.error(...this._formatMessage("error", args));
    }
    /**
     * Start performance timer
     */
    time(label) {
      if (!IS_DEV) return;
      const timerLabel = `[${this.category}] ${label}`;
      console.time(timerLabel);
    }
    /**
     * End performance timer and log duration
     */
    timeEnd(label) {
      if (!IS_DEV) return;
      const timerLabel = `[${this.category}] ${label}`;
      console.timeEnd(timerLabel);
    }
    /**
     * Log a group of related messages
     */
    group(groupLabel, callback) {
      if (!IS_DEV) return;
      console.group(`[${this.category}] ${groupLabel}`);
      callback();
      console.groupEnd();
    }
    /**
     * Log a collapsed group (useful for large data dumps)
     */
    groupCollapsed(groupLabel, callback) {
      if (!IS_DEV) return;
      console.groupCollapsed(`[${this.category}] ${groupLabel}`);
      callback();
      console.groupEnd();
    }
    /**
     * Log table (useful for arrays of objects)
     */
    table(data) {
      if (!IS_DEV) return;
      console.log(`%c[${this.category}]`, `color: ${this.color}; font-weight: bold;`);
      console.table(data);
    }
  };
  var logger = {
    combat: new CategoryLogger("combat"),
    mapgen: new CategoryLogger("mapgen"),
    movement: new CategoryLogger("movement"),
    state: new CategoryLogger("state"),
    storage: new CategoryLogger("storage"),
    render: new CategoryLogger("render"),
    items: new CategoryLogger("items"),
    general: new CategoryLogger("general"),
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
      console.log("%c[Logger Config]", "color: #fa5252; font-weight: bold;");
      console.log("Dev mode:", IS_DEV);
      console.log("Log level:", CURRENT_LOG_LEVEL);
      console.log("Categories:", Object.keys(CATEGORY_COLORS).join(", "));
      console.log("Tip: Add ?logLevel=info to URL to change log level");
    }
  };
  var logger_default = logger;

  // src/game/Item.ts
  var Item = class _Item {
    id;
    name;
    description;
    type;
    rarity;
    slot;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effects;
    weight;
    value;
    damage;
    damageType;
    armorType;
    consumable;
    charges;
    maxCharges;
    twoHanded;
    /**
     * Create a new item
     */
    constructor(config = {}) {
      this.id = config.id || this.generateId();
      this.name = config.name || "Unknown Item";
      this.description = config.description || "";
      this.type = config.type || "misc";
      this.rarity = config.rarity || "common";
      this.slot = config.slot !== void 0 ? config.slot : null;
      this.effects = config.effects || {};
      this.weight = config.weight || 0;
      this.value = config.value || 0;
      this.damage = config.damage || null;
      this.damageType = config.damageType || null;
      this.armorType = config.armorType || null;
      this.consumable = config.consumable || false;
      this.charges = config.charges !== void 0 ? config.charges : null;
      this.maxCharges = config.maxCharges !== void 0 ? config.maxCharges : null;
      this.twoHanded = config.twoHanded || false;
      this.validate();
    }
    /**
     * Generate a unique ID for this item
     */
    generateId() {
      return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Validate item configuration
     */
    validate() {
      const validTypes = ["weapon", "armor", "consumable", "quest", "misc"];
      if (!validTypes.includes(this.type)) {
        logger_default.items.warn("Invalid item type, defaulting to misc", {
          item: this.name,
          type: this.type
        });
        this.type = "misc";
      }
      const validRarities = ["common", "uncommon", "rare", "very rare", "legendary"];
      if (!validRarities.includes(this.rarity)) {
        logger_default.items.warn("Invalid rarity, defaulting to common", {
          item: this.name,
          rarity: this.rarity
        });
        this.rarity = "common";
      }
      const validSlots = [
        "head",
        "neck",
        "chest",
        "hands",
        "legs",
        "feet",
        "ring1",
        "ring2",
        "mainHand",
        "offHand",
        null
      ];
      if (!validSlots.includes(this.slot)) {
        logger_default.items.warn("Invalid slot, setting to null", { item: this.name, slot: this.slot });
        this.slot = null;
      }
    }
    /**
     * Check if item is equippable
     */
    isEquippable() {
      return this.slot !== null;
    }
    /**
     * Check if item can be equipped to a specific slot
     */
    canEquipToSlot(slot) {
      if (!this.isEquippable()) return false;
      if ((this.slot === "ring1" || this.slot === "ring2") && (slot === "ring1" || slot === "ring2")) {
        return true;
      }
      return this.slot === slot;
    }
    /**
     * Get rarity color for UI display
     */
    getRarityColor() {
      const colors = {
        common: "#9d9d9d",
        uncommon: "#1eff00",
        rare: "#0070dd",
        "very rare": "#a335ee",
        legendary: "#ff8000"
      };
      return colors[this.rarity] || colors.common;
    }
    /**
     * Get formatted effects string for display
     */
    getEffectsText() {
      if (Object.keys(this.effects).length === 0) {
        return "No special effects";
      }
      const effectStrings = [];
      const statMap = {
        str: "Strength",
        dex: "Dexterity",
        con: "Constitution",
        int: "Intelligence",
        wis: "Wisdom",
        cha: "Charisma",
        ac: "Armor Class",
        hp: "Hit Points",
        speed: "Speed",
        initiative: "Initiative",
        attackBonus: "Attack Bonus",
        damageBonus: "Damage Bonus"
      };
      Object.keys(this.effects).forEach((key) => {
        const value = this.effects[key];
        const statName = statMap[key] || key;
        const sign = value > 0 ? "+" : "";
        effectStrings.push(`${sign}${value} ${statName}`);
      });
      return effectStrings.join(", ");
    }
    /**
     * Get full item tooltip text
     */
    getTooltip() {
      let tooltip = `${this.name}
`;
      tooltip += `${this.rarity.charAt(0).toUpperCase() + this.rarity.slice(1)} ${this.type}
`;
      if (this.slot) {
        tooltip += `Slot: ${this.slot}
`;
      }
      if (this.damage) {
        tooltip += `Damage: ${this.damage}`;
        if (this.damageType) {
          tooltip += ` ${this.damageType}`;
        }
        tooltip += "\n";
      }
      if (this.armorType) {
        tooltip += `Armor Type: ${this.armorType}
`;
      }
      const effectsText = this.getEffectsText();
      if (effectsText !== "No special effects") {
        tooltip += `Effects: ${effectsText}
`;
      }
      if (this.charges !== null && this.maxCharges !== null) {
        tooltip += `Charges: ${this.charges}/${this.maxCharges}
`;
      }
      tooltip += `
${this.description}
`;
      tooltip += `
Weight: ${this.weight} lbs | Value: ${this.value} gp`;
      return tooltip;
    }
    /**
     * Use the item (for consumables or charged items)
     * @returns True if item was used successfully
     */
    use() {
      if (this.consumable) {
        return true;
      }
      if (this.charges !== null) {
        if (this.charges > 0) {
          this.charges--;
          return true;
        }
        return false;
      }
      return false;
    }
    /**
     * Recharge item to max charges
     */
    recharge() {
      if (this.maxCharges !== null) {
        this.charges = this.maxCharges;
      }
    }
    /**
     * Clone this item (useful for creating multiple instances)
     */
    clone() {
      return _Item.fromJSON(this.toJSON());
    }
    /**
     * Serialize to JSON for saving
     */
    toJSON() {
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        type: this.type,
        rarity: this.rarity,
        slot: this.slot,
        effects: { ...this.effects },
        weight: this.weight,
        value: this.value,
        damage: this.damage,
        damageType: this.damageType,
        armorType: this.armorType,
        consumable: this.consumable,
        charges: this.charges,
        maxCharges: this.maxCharges,
        twoHanded: this.twoHanded
      };
    }
    /**
     * Load from JSON
     */
    static fromJSON(data) {
      return new _Item(data);
    }
    /**
     * Create a basic weapon
     */
    static createWeapon(name, damage, damageType, options = {}) {
      return new _Item({
        name,
        description: options.description || `A ${name.toLowerCase()}.`,
        type: "weapon",
        rarity: options.rarity || "common",
        slot: "mainHand",
        damage,
        damageType,
        effects: options.effects || {},
        weight: options.weight || 3,
        value: options.value || 10,
        twoHanded: options.twoHanded || false
      });
    }
    /**
     * Create basic armor
     */
    static createArmor(name, acBonus, armorType, options = {}) {
      return new _Item({
        name,
        description: options.description || `${name}.`,
        type: "armor",
        rarity: options.rarity || "common",
        slot: options.slot || "chest",
        armorType,
        effects: { ac: acBonus, ...options.effects },
        weight: options.weight || 10,
        value: options.value || 50
      });
    }
    /**
     * Create a consumable item
     */
    static createConsumable(name, effects, options = {}) {
      return new _Item({
        name,
        description: options.description || `A consumable ${name.toLowerCase()}.`,
        type: "consumable",
        rarity: options.rarity || "common",
        effects,
        weight: options.weight || 0.5,
        value: options.value || 5,
        consumable: true
      });
    }
    /**
     * Create a Raft (allows crossing rivers)
     */
    static createRaft() {
      return new _Item({
        name: "Raft",
        description: "A simple wooden raft that allows crossing rivers. Not sturdy enough for deep water.",
        type: "misc",
        rarity: "common",
        slot: null,
        effects: { allowsRiverCrossing: true },
        weight: 50,
        value: 25
      });
    }
    /**
     * Create a Boat (allows crossing water and rivers)
     */
    static createBoat() {
      return new _Item({
        name: "Boat",
        description: "A sturdy rowboat that allows crossing deep water and rivers.",
        type: "misc",
        rarity: "uncommon",
        slot: null,
        effects: { allowsWaterCrossing: true, allowsRiverCrossing: true },
        weight: 100,
        value: 50
      });
    }
  };

  // src/game/LootGenerator.ts
  var LootGenerator = class extends BaseGenerator {
    lootTables;
    itemData;
    constructor() {
      super();
      this.lootTables = {
        // CR 0-1: Common loot, low gold
        0: {
          goldMin: 10,
          goldMax: 50,
          rarity: "common",
          itemCountMin: 0,
          itemCountMax: 1
        },
        1: {
          goldMin: 20,
          goldMax: 100,
          rarity: "common",
          itemCountMin: 0,
          itemCountMax: 1
        },
        // CR 2-4: Uncommon loot, moderate gold
        2: {
          goldMin: 50,
          goldMax: 200,
          rarity: "uncommon",
          itemCountMin: 1,
          itemCountMax: 2
        },
        3: {
          goldMin: 100,
          goldMax: 300,
          rarity: "uncommon",
          itemCountMin: 1,
          itemCountMax: 2
        },
        4: {
          goldMin: 150,
          goldMax: 400,
          rarity: "uncommon",
          itemCountMin: 1,
          itemCountMax: 2
        },
        // CR 5-7: Rare loot, high gold
        5: {
          goldMin: 200,
          goldMax: 1e3,
          rarity: "rare",
          itemCountMin: 1,
          itemCountMax: 3
        },
        6: {
          goldMin: 500,
          goldMax: 1500,
          rarity: "rare",
          itemCountMin: 1,
          itemCountMax: 3
        },
        7: {
          goldMin: 750,
          goldMax: 2e3,
          rarity: "rare",
          itemCountMin: 2,
          itemCountMax: 3
        },
        // CR 8-10: Very rare loot, very high gold
        8: {
          goldMin: 1e3,
          goldMax: 5e3,
          rarity: "very rare",
          itemCountMin: 2,
          itemCountMax: 4
        },
        9: {
          goldMin: 2e3,
          goldMax: 7500,
          rarity: "very rare",
          itemCountMin: 2,
          itemCountMax: 4
        },
        10: {
          goldMin: 3e3,
          goldMax: 1e4,
          rarity: "very rare",
          itemCountMin: 2,
          itemCountMax: 4
        },
        // CR 11+: Legendary loot, massive gold
        11: {
          goldMin: 5e3,
          goldMax: 2e4,
          rarity: "legendary",
          itemCountMin: 2,
          itemCountMax: 5
        }
      };
      this.itemData = {
        common: [
          {
            name: "Rusty Sword",
            type: "weapon",
            slot: "mainHand",
            damage: "1d6",
            damageType: "slashing",
            effects: {},
            weight: 3,
            value: 5,
            description: "A worn but serviceable blade."
          },
          {
            name: "Worn Leather Armor",
            type: "armor",
            slot: "chest",
            armorType: "light",
            effects: { ac: 1 },
            weight: 10,
            value: 10,
            description: "Leather armor that has seen better days."
          },
          {
            name: "Simple Bow",
            type: "weapon",
            slot: "mainHand",
            damage: "1d6",
            damageType: "piercing",
            effects: {},
            weight: 2,
            value: 10,
            description: "A basic hunting bow.",
            twoHanded: true
          },
          {
            name: "Iron Dagger",
            type: "weapon",
            slot: "mainHand",
            damage: "1d4",
            damageType: "piercing",
            effects: {},
            weight: 1,
            value: 2,
            description: "A simple iron dagger."
          },
          {
            name: "Wooden Shield",
            type: "armor",
            slot: "offHand",
            armorType: "shield",
            effects: { ac: 1 },
            weight: 6,
            value: 5,
            description: "A basic wooden shield."
          },
          {
            name: "Potion of Minor Healing",
            type: "consumable",
            effects: { hp: 5 },
            weight: 0.5,
            value: 10,
            consumable: true,
            description: "Restores 5 hit points when consumed."
          },
          {
            name: "Rations (5 days)",
            type: "misc",
            effects: {},
            weight: 5,
            value: 5,
            description: "Dried food that lasts for 5 days."
          },
          {
            name: "Rope (50ft)",
            type: "misc",
            effects: {},
            weight: 10,
            value: 1,
            description: "Sturdy hemp rope."
          },
          {
            name: "Torch",
            type: "misc",
            effects: {},
            weight: 1,
            value: 1,
            description: "Provides light for 1 hour."
          },
          {
            name: "Waterskin",
            type: "misc",
            effects: {},
            weight: 5,
            value: 2,
            description: "Holds 1 day worth of water."
          }
        ],
        uncommon: [
          {
            name: "Silver Longsword",
            type: "weapon",
            slot: "mainHand",
            damage: "1d8",
            damageType: "slashing",
            effects: { attackBonus: 1 },
            weight: 3,
            value: 50,
            description: "A well-crafted silver sword."
          },
          {
            name: "Studded Leather Armor",
            type: "armor",
            slot: "chest",
            armorType: "light",
            effects: { ac: 2 },
            weight: 13,
            value: 45,
            description: "Leather armor reinforced with metal studs."
          },
          {
            name: "Longbow",
            type: "weapon",
            slot: "mainHand",
            damage: "1d8",
            damageType: "piercing",
            effects: { attackBonus: 1 },
            weight: 2,
            value: 50,
            description: "A finely crafted longbow.",
            twoHanded: true
          },
          {
            name: "Steel Dagger +1",
            type: "weapon",
            slot: "mainHand",
            damage: "1d4",
            damageType: "piercing",
            effects: { attackBonus: 1, damageBonus: 1 },
            weight: 1,
            value: 40,
            description: "A magically enhanced steel dagger."
          },
          {
            name: "Iron Shield +1",
            type: "armor",
            slot: "offHand",
            armorType: "shield",
            effects: { ac: 3 },
            weight: 6,
            value: 50,
            description: "A reinforced iron shield."
          },
          {
            name: "Potion of Healing",
            type: "consumable",
            effects: { hp: 10 },
            weight: 0.5,
            value: 50,
            consumable: true,
            description: "Restores 10 hit points when consumed."
          },
          {
            name: "Ring of Protection",
            type: "armor",
            slot: "ring1",
            effects: { ac: 1 },
            weight: 0.1,
            value: 100,
            description: "A magical ring that provides protection."
          },
          {
            name: "Cloak of Resistance",
            type: "armor",
            slot: "chest",
            effects: { ac: 1 },
            weight: 1,
            value: 80,
            description: "A cloak that grants resistance to harm."
          },
          {
            name: "Boots of Elvenkind",
            type: "armor",
            slot: "feet",
            effects: { dex: 1 },
            weight: 1,
            value: 75,
            description: "Boots that enhance agility and stealth."
          },
          {
            name: "Gloves of Strength",
            type: "armor",
            slot: "hands",
            effects: { str: 1 },
            weight: 0.5,
            value: 75,
            description: "Gloves that enhance physical strength."
          }
        ],
        rare: [
          {
            name: "Flaming Longsword +1",
            type: "weapon",
            slot: "mainHand",
            damage: "1d8",
            damageType: "slashing",
            effects: { attackBonus: 1, damageBonus: 1 },
            weight: 3,
            value: 500,
            description: "A sword wreathed in magical flames, dealing extra fire damage."
          },
          {
            name: "Mithril Chain Mail",
            type: "armor",
            slot: "chest",
            armorType: "medium",
            effects: { ac: 4, dex: 1 },
            weight: 20,
            value: 750,
            description: "Lightweight yet strong armor made of mithril."
          },
          {
            name: "Bow of Accuracy +2",
            type: "weapon",
            slot: "mainHand",
            damage: "1d8",
            damageType: "piercing",
            effects: { attackBonus: 2, damageBonus: 2 },
            weight: 2,
            value: 600,
            description: "A bow that never misses its mark.",
            twoHanded: true
          },
          {
            name: "Dagger of Venom",
            type: "weapon",
            slot: "mainHand",
            damage: "1d4",
            damageType: "piercing",
            effects: { attackBonus: 1, damageBonus: 2 },
            weight: 1,
            value: 500,
            description: "A poisoned dagger that inflicts toxic wounds."
          },
          {
            name: "Tower Shield +2",
            type: "armor",
            slot: "offHand",
            armorType: "shield",
            effects: { ac: 5 },
            weight: 10,
            value: 600,
            description: "A massive shield providing exceptional protection."
          },
          {
            name: "Potion of Greater Healing",
            type: "consumable",
            effects: { hp: 20 },
            weight: 0.5,
            value: 150,
            consumable: true,
            description: "Restores 20 hit points when consumed."
          },
          {
            name: "Ring of Spell Storing",
            type: "armor",
            slot: "ring1",
            effects: { int: 2 },
            weight: 0.1,
            value: 800,
            description: "A ring that can store magical energy.",
            charges: 3,
            maxCharges: 3
          },
          {
            name: "Boots of Speed",
            type: "armor",
            slot: "feet",
            effects: { dex: 2, speed: 10 },
            weight: 1,
            value: 700,
            description: "Boots that greatly enhance movement speed."
          },
          {
            name: "Amulet of Health",
            type: "armor",
            slot: "neck",
            effects: { con: 2, hp: 10 },
            weight: 0.5,
            value: 850,
            description: "An amulet that bolsters vitality and health."
          },
          {
            name: "Helm of Brilliance",
            type: "armor",
            slot: "head",
            effects: { int: 2, wis: 1 },
            weight: 3,
            value: 750,
            description: "A helm that enhances mental acuity."
          }
        ],
        "very rare": [
          {
            name: "Vorpal Sword",
            type: "weapon",
            slot: "mainHand",
            damage: "1d8",
            damageType: "slashing",
            effects: { attackBonus: 3, damageBonus: 3 },
            weight: 3,
            value: 5e3,
            description: "A legendary blade that can sever heads with a critical hit."
          },
          {
            name: "Plate Armor +2",
            type: "armor",
            slot: "chest",
            armorType: "heavy",
            effects: { ac: 8 },
            weight: 50,
            value: 6e3,
            description: "Masterwork full plate armor with magical enhancements."
          },
          {
            name: "Oathbow",
            type: "weapon",
            slot: "mainHand",
            damage: "1d8",
            damageType: "piercing",
            effects: { attackBonus: 3, damageBonus: 3 },
            weight: 2,
            value: 5500,
            description: "A bow bound by sacred oath to slay evil.",
            twoHanded: true
          },
          {
            name: "Frost Brand Dagger",
            type: "weapon",
            slot: "mainHand",
            damage: "1d4",
            damageType: "piercing",
            effects: { attackBonus: 2, damageBonus: 3 },
            weight: 1,
            value: 4500,
            description: "A dagger of eternal ice that freezes foes."
          },
          {
            name: "Animated Shield",
            type: "armor",
            slot: "offHand",
            armorType: "shield",
            effects: { ac: 6 },
            weight: 6,
            value: 5500,
            description: "A shield that defends autonomously."
          },
          {
            name: "Potion of Supreme Healing",
            type: "consumable",
            effects: { hp: 50 },
            weight: 0.5,
            value: 500,
            consumable: true,
            description: "Restores 50 hit points when consumed."
          },
          {
            name: "Ring of Invisibility",
            type: "armor",
            slot: "ring1",
            effects: { dex: 3 },
            weight: 0.1,
            value: 7e3,
            description: "A ring that grants the power of invisibility.",
            charges: 3,
            maxCharges: 3
          },
          {
            name: "Winged Boots",
            type: "armor",
            slot: "feet",
            effects: { dex: 3, speed: 20 },
            weight: 1,
            value: 6500,
            description: "Boots that grant the power of flight."
          },
          {
            name: "Amulet of the Planes",
            type: "armor",
            slot: "neck",
            effects: { wis: 3, int: 2 },
            weight: 0.5,
            value: 7500,
            description: "An amulet that allows planar travel."
          },
          {
            name: "Crown of Kings",
            type: "armor",
            slot: "head",
            effects: { cha: 4, wis: 2 },
            weight: 2,
            value: 8e3,
            description: "A crown worn by ancient rulers."
          }
        ],
        legendary: [
          {
            name: "Holy Avenger",
            type: "weapon",
            slot: "mainHand",
            damage: "1d8",
            damageType: "slashing",
            effects: { attackBonus: 5, damageBonus: 5, ac: 2 },
            weight: 3,
            value: 5e4,
            description: "The ultimate weapon against evil, blessed by the gods."
          },
          {
            name: "Armor of Invulnerability",
            type: "armor",
            slot: "chest",
            armorType: "heavy",
            effects: { ac: 12, hp: 20 },
            weight: 50,
            value: 75e3,
            description: "Armor that makes the wearer nearly invincible."
          },
          {
            name: "Bow of Apollyon",
            type: "weapon",
            slot: "mainHand",
            damage: "2d6",
            damageType: "piercing",
            effects: { attackBonus: 5, damageBonus: 5 },
            weight: 2,
            value: 6e4,
            description: "A bow of divine destruction.",
            twoHanded: true
          },
          {
            name: "Luck Blade",
            type: "weapon",
            slot: "mainHand",
            damage: "1d6",
            damageType: "piercing",
            effects: { attackBonus: 5, damageBonus: 5 },
            weight: 1,
            value: 55e3,
            description: "A blade that bends fate itself.",
            charges: 3,
            maxCharges: 3
          },
          {
            name: "Defender Shield",
            type: "armor",
            slot: "offHand",
            armorType: "shield",
            effects: { ac: 10 },
            weight: 6,
            value: 65e3,
            description: "An indestructible shield of legend."
          },
          {
            name: "Potion of Invulnerability",
            type: "consumable",
            effects: { hp: 100, ac: 5 },
            weight: 0.5,
            value: 5e3,
            consumable: true,
            description: "Grants temporary invulnerability and full healing."
          },
          {
            name: "Ring of Three Wishes",
            type: "armor",
            slot: "ring1",
            effects: {},
            weight: 0.1,
            value: 1e5,
            description: "A ring that grants three wishes.",
            charges: 3,
            maxCharges: 3
          },
          {
            name: "Boots of Teleportation",
            type: "armor",
            slot: "feet",
            effects: { dex: 5 },
            weight: 1,
            value: 7e4,
            description: "Boots that allow instant teleportation.",
            charges: 3,
            maxCharges: 3
          },
          {
            name: "Amulet of Resurrection",
            type: "armor",
            slot: "neck",
            effects: { con: 5, hp: 50 },
            weight: 0.5,
            value: 8e4,
            description: "An amulet that can bring the dead back to life.",
            charges: 1,
            maxCharges: 1
          },
          {
            name: "God-Crown",
            type: "armor",
            slot: "head",
            effects: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
            weight: 5,
            value: 15e4,
            description: "A crown forged by the gods themselves."
          }
        ]
      };
      this.lookupTables = this.lootTables;
    }
    /**
     * Generate loot for a given CR
     * @param {number} cr - Challenge Rating
     * @param {Function} random - Random function (0-1)
     * @returns {object} { gold, items: Item[], rarity }
     */
    generateLoot(cr, random = Math.random) {
      const lootTable = this.getCRTable(cr, 11);
      if (!lootTable) {
        return { gold: 0, items: [], rarity: "common" };
      }
      const gold = this.randomInt(lootTable.goldMin, lootTable.goldMax, random);
      const itemCount = this.randomInt(lootTable.itemCountMin, lootTable.itemCountMax, random);
      const items = [];
      const itemPool = this.itemData[lootTable.rarity];
      for (let i = 0; i < itemCount; i++) {
        const itemData = this.randomChoice(itemPool, random);
        if (itemData) {
          const item = new Item({
            ...itemData,
            rarity: lootTable.rarity
          });
          items.push(item);
        }
      }
      return {
        gold,
        items,
        rarity: lootTable.rarity
      };
    }
    /**
     * Get rarity color for display
     * @param {string} rarity
     * @returns {string} Hex color
     */
    getRarityColor(rarity) {
      const colors = {
        common: "#9d9d9d",
        uncommon: "#1eff00",
        rare: "#0070dd",
        "very rare": "#a335ee",
        legendary: "#ff8000"
      };
      return colors[rarity] || colors.common;
    }
    /**
     * Format loot for display. Accepts Item instances or plain strings (legacy).
     */
    formatLoot(loot) {
      let text = `${loot.gold} gold`;
      if (loot.items.length > 0) {
        text += "\n\nItems found:";
        loot.items.forEach((item) => {
          const itemName = typeof item === "string" ? item : item.name;
          const itemRarity = typeof item === "string" ? "" : item.rarity ? ` (${item.rarity})` : "";
          text += `
\u2022 ${itemName}${itemRarity}`;
        });
      }
      return text;
    }
  };

  // src/game/data/GameTableData.ts
  var SRD_TRAPS = {
    "Collapsing Roof": {
      severity: "deadly",
      trigger: "trip wire",
      description: "Supports collapse, dropping roof on 10\xD710 ft area",
      effect: "Creatures make DC 15 Dex save or take bludgeoning damage",
      damage: {
        levels_1_4: "2d10",
        levels_5_10: "4d10",
        levels_11_16: "10d10",
        levels_17_20: "18d10"
      },
      notes: "Half damage on successful save. Debris creates difficult terrain."
    },
    "Falling Net": {
      severity: "nuisance",
      trigger: "trip wire",
      description: "Net drops on creature triggering trap",
      effect: "Creature makes DC 10 Dex save or restrained until freed",
      damage: "none",
      notes: "DC 10 Str check or dealing 5 slashing damage to AC 10 net frees creature. Net has 5 HP."
    },
    "Fire-Casting Statue": {
      severity: "deadly",
      trigger: "pressure plate",
      description: "Statue shoots gout of magical flame in 30 ft cone",
      effect: "Creatures in cone make Dex save or take fire damage",
      damage: {
        levels_1_4: { dice: "2d10", dc: 15 },
        levels_5_10: { dice: "4d10", dc: 15 },
        levels_11_16: { dice: "10d10", dc: 16 },
        levels_17_20: { dice: "18d10", dc: 18 }
      },
      notes: "Half damage on successful save. DC varies by level bracket."
    },
    "Hidden Pit": {
      severity: "nuisance",
      trigger: "trapdoor",
      description: "Hinged floor section opens into pit",
      effect: "Creature makes DC 15 Dex save or falls, taking damage",
      damage: {
        levels_1_4: "1d6",
        levels_5_10: "3d6",
        levels_11_16: "6d6",
        levels_17_20: "12d6"
      },
      notes: "Damage listed is fall damage. Add spike damage for spiked pit variant."
    },
    "Poisoned Darts": {
      severity: "deadly",
      trigger: "pressure plate",
      description: "Spring-loaded darts shoot from small holes",
      effect: "Creature makes Dex save or hit by 1d3 darts, each dealing damage",
      damage: {
        levels_1_4: { dart: "1d6", dc: 14 },
        levels_5_10: { dart: "2d6", dc: 14 },
        levels_11_16: { dart: "4d6", dc: 16 },
        levels_17_20: { dart: "7d6", dc: 18 }
      },
      damageType: "poison",
      notes: "Each dart deals poison damage. DC and damage scale with level. Roll 1d3 for dart count."
    },
    "Poisoned Needle": {
      severity: "nuisance",
      trigger: "lock or container",
      description: "Needle springs out when lock picked or container opened without key",
      effect: "Creature makes DC 15 Con save or takes poison damage and becomes poisoned for 1 hour",
      damage: {
        levels_1_4: "1d10",
        levels_5_10: "3d10",
        levels_11_16: "6d10",
        levels_17_20: "10d10"
      },
      damageType: "poison",
      notes: "Poisoned condition lasts 1 hour on failed save."
    },
    "Spiked Pit": {
      severity: "deadly",
      trigger: "trapdoor",
      description: "Hinged floor section opens into pit with spikes at bottom",
      effect: "Creature makes DC 15 Dex save or falls onto spikes",
      damage: {
        levels_1_4: { fall: "1d6", spikes: "1d6" },
        levels_5_10: { fall: "3d6", spikes: "4d6" },
        levels_11_16: { fall: "6d6", spikes: "10d6" },
        levels_17_20: { fall: "12d6", spikes: "18d6" }
      },
      notes: "Fall damage + spike damage on failed save. Successful save avoids pit entirely."
    },
    "Rolling Stone": {
      severity: "deadly",
      trigger: "pressure plate",
      description: "Large stone sphere rolls down corridor (high-level trap only)",
      effect: "Creatures in path make Dex save or take bludgeoning damage",
      damage: {
        levels_11_16: { dice: "10d10", dc: 15 },
        levels_17_20: { dice: "10d10", dc: 15 }
      },
      notes: "Only appears in level 11+ dungeons. Stone continues rolling until stopped by obstacle. Half damage on successful save."
    }
  };
  function getScaledTrap(trapName, level) {
    const trap = SRD_TRAPS[trapName];
    if (!trap) {
      logger_default.mapgen.error("Trap not found in SRD_TRAPS", { trapName });
      return null;
    }
    let bracket;
    if (level <= 4) bracket = "levels_1_4";
    else if (level <= 10) bracket = "levels_5_10";
    else if (level <= 16) bracket = "levels_11_16";
    else bracket = "levels_17_20";
    const scaledTrap = { ...trap };
    if (typeof trap.damage === "object" && trap.damage !== null && trap.damage !== "none") {
      const damageForLevel = trap.damage[bracket];
      if (typeof damageForLevel === "string") {
        scaledTrap.scaledDamage = damageForLevel;
      } else if (typeof damageForLevel === "object" && damageForLevel !== null) {
        if (damageForLevel.dice) {
          scaledTrap.scaledDamage = damageForLevel.dice;
          scaledTrap.saveDC = damageForLevel.dc;
        } else if (damageForLevel.dart) {
          scaledTrap.scaledDamage = damageForLevel.dart;
          scaledTrap.saveDC = damageForLevel.dc;
          scaledTrap.dartDamage = damageForLevel.dart;
        } else if (damageForLevel.fall && damageForLevel.spikes) {
          scaledTrap.scaledDamage = `${damageForLevel.fall} + ${damageForLevel.spikes}`;
        } else {
          scaledTrap.scaledDamage = "0";
        }
      } else {
        scaledTrap.scaledDamage = "0";
      }
    } else {
      scaledTrap.scaledDamage = trap.damage === "none" ? "0" : trap.damage;
    }
    scaledTrap.level = level;
    scaledTrap.bracket = bracket;
    return scaledTrap;
  }

  // src/game/HazardGenerator.ts
  var HazardGenerator = class extends BaseGenerator {
    trapWeights;
    constructor() {
      super();
      this.trapWeights = {
        "Collapsing Roof": 0.15,
        "Falling Net": 0.15,
        "Fire-Casting Statue": 0.15,
        "Hidden Pit": 0.15,
        "Poisoned Darts": 0.15,
        "Poisoned Needle": 0.1,
        "Spiked Pit": 0.1,
        "Rolling Stone": 0.05
        // High-level only
      };
    }
    /**
     * Generate a random hazard using SRD traps
     */
    generateHazard(cr, random = Math.random) {
      const level = this._crToLevel(cr);
      const trapName = this._selectRandomTrap(level, random);
      const scaledTrap = getScaledTrap(trapName, level);
      if (!scaledTrap) {
        throw new Error(`getScaledTrap returned null for "${trapName}" (missing from SRD_TRAPS)`);
      }
      const damage = this._calculateTrapDamage(scaledTrap, random);
      return {
        type: trapName,
        category: scaledTrap.type,
        description: scaledTrap.description,
        trigger: scaledTrap.trigger,
        saveType: scaledTrap.saveType,
        damageType: scaledTrap.damageType,
        dc: scaledTrap.saveDC,
        damage,
        triggered: false,
        discovered: false,
        resets: scaledTrap.resets,
        effects: scaledTrap.effects,
        condition: scaledTrap.condition,
        detectDC: scaledTrap.detectDC,
        detectSkill: scaledTrap.detectSkill
      };
    }
    /**
     * Convert CR to character level tier (1, 5, 11, or 17)
     * @private
     */
    _crToLevel(cr) {
      if (cr <= 4) return 1 + Math.floor(cr);
      if (cr <= 10) return 5 + Math.floor((cr - 5) / 2);
      if (cr <= 16) return 11 + Math.floor((cr - 11) / 2);
      return 17 + Math.floor((cr - 17) / 2);
    }
    /**
     * Select random trap using weighted selection
     * @private
     */
    _selectRandomTrap(level, random) {
      const weights = { ...this.trapWeights };
      if (level < 11) {
        const rollingStoneWeight = weights["Rolling Stone"];
        delete weights["Rolling Stone"];
        const numTraps = Object.keys(weights).length;
        const extraWeight = rollingStoneWeight / numTraps;
        for (const trap in weights) {
          weights[trap] += extraWeight;
        }
      }
      const traps = Object.keys(weights);
      const trapWeights = Object.values(weights);
      return this.weightedRandom(traps, trapWeights, random);
    }
    /**
     * Calculate actual trap damage by rolling dice
     * @private
     */
    _calculateTrapDamage(scaledTrap, random) {
      const damageString = scaledTrap.scaledDamage || scaledTrap.damage;
      if (typeof damageString !== "string") {
        logger_default.mapgen.error("Invalid damage string for trap", {
          trap: scaledTrap.type,
          damageString
        });
        return 0;
      }
      if (damageString === "0" || damageString === "none") {
        return 0;
      }
      if (damageString.includes("+")) {
        const parts = damageString.split("+").map((s) => s.trim());
        let totalDamage = 0;
        for (const part of parts) {
          const dice2 = part.split(" ")[0];
          totalDamage += this._rollDamage(dice2, random);
        }
        return totalDamage;
      }
      if (damageString.includes("per dart")) {
        const dartDiceMatch = damageString.match(/\((\d+d\d+) darts?\)/);
        const damageDiceMatch = damageString.match(/^(\d+d\d+)/);
        if (dartDiceMatch && damageDiceMatch) {
          const numDarts = this._rollDamage(dartDiceMatch[1], random);
          const damagePerDart = damageDiceMatch[1];
          let totalDamage = 0;
          for (let i = 0; i < numDarts; i++) {
            totalDamage += this._rollDamage(damagePerDart, random);
          }
          return totalDamage;
        }
      }
      const dice = damageString.split(" ")[0];
      return this._rollDamage(dice, random);
    }
    /**
     * Roll damage dice from notation (e.g., "2d6", "1d10")
     * @private
     */
    _rollDamage(diceString, random) {
      if (!diceString.includes("d")) {
        return parseInt(diceString, 10);
      }
      const [numDice, diceSize] = diceString.split("d").map((s) => parseInt(s, 10));
      return this.rollDice(numDice, diceSize, random);
    }
    /**
     * Get hazard category color for display
     */
    getCategoryColor(category) {
      const colors = {
        trap: "#e67e22",
        environmental: "#e74c3c",
        magical: "#9b59b6"
      };
      return colors[category] || colors.trap;
    }
    /**
     * Get damage type color for display
     */
    getDamageTypeColor(damageType) {
      const colors = {
        fire: "#e74c3c",
        cold: "#3498db",
        lightning: "#f1c40f",
        poison: "#27ae60",
        necrotic: "#8e44ad",
        force: "#9b59b6",
        psychic: "#e91e63",
        piercing: "#95a5a6",
        slashing: "#95a5a6",
        bludgeoning: "#95a5a6",
        falling: "#7f8c8d",
        restraint: "#34495e",
        teleport: "#9b59b6"
      };
      return colors[damageType] || colors.piercing;
    }
    /**
     * Format hazard for display with optional save result
     */
    formatHazard(hazard, saveResult = null) {
      let output = `${hazard.description}
`;
      output += `Trigger: ${hazard.trigger}

`;
      if (!hazard.discovered) {
        output += `Hidden trap (DC ${hazard.detectDC} ${hazard.detectSkill} to detect)

`;
      }
      if (saveResult) {
        const total = saveResult.roll + saveResult.modifier;
        output += `${hazard.saveType.toUpperCase()} save: ${saveResult.roll}+${saveResult.modifier}=${total} vs DC ${hazard.dc}
`;
        if (saveResult.success) {
          output += `Success! `;
          if (hazard.damage > 0) {
            output += `Take ${Math.floor(hazard.damage / 2)} ${hazard.damageType} damage (half damage)`;
          } else {
            output += `Avoided the trap!`;
          }
        } else {
          output += `Failed! `;
          if (hazard.damage > 0) {
            output += `Take ${hazard.damage} ${hazard.damageType} damage`;
          }
          if (hazard.condition) {
            output += ` and ${hazard.condition} condition`;
          }
          if (hazard.effects) {
            output += `
${hazard.effects}`;
          }
        }
      } else {
        output += `DC ${hazard.dc} ${hazard.saveType.toUpperCase()} save required
`;
        if (hazard.damage > 0) {
          output += `Damage: ${hazard.damageType}`;
        }
        if (hazard.condition) {
          output += `
Condition: ${hazard.condition}`;
        }
        if (hazard.effects) {
          output += `
Effect: ${hazard.effects}`;
        }
      }
      return output;
    }
  };

  // src/game/TreasureGenerator.ts
  var TreasureGenerator = class extends BaseGenerator {
    COIN_TO_GOLD;
    constructor() {
      super();
      this.COIN_TO_GOLD = {
        cp: 0.01,
        // 100 CP = 1 GP
        sp: 0.1,
        // 10 SP = 1 GP
        ep: 0.5,
        // 2 EP = 1 GP
        gp: 1,
        // 1 GP = 1 GP
        pp: 10
        // 1 PP = 10 GP
      };
    }
    /**
     * Generate treasure hoard based on CR using DMG treasure tables.
     */
    generateTreasureHoard(cr, partySize = 4, random = Math.random) {
      const rarity = this._determineRarity(cr);
      const partyScalar = partySize / 4;
      const baseGold = this.randomInt(10, 100, random) * (cr + 1);
      const totalGold = Math.floor(baseGold * partyScalar);
      return {
        type: "chest",
        gold: totalGold,
        consumables: [],
        // TODO: Replace with actual consumables
        rarity
      };
    }
    /**
     * Roll coins from treasure table and convert to gold.
     * @private
     */
    _rollCoins(coinTable, random = Math.random) {
      let totalGold = 0;
      for (const [coinType, diceString] of Object.entries(coinTable)) {
        if (!diceString) continue;
        const coinAmount = this._parseDiceRoll(diceString, 1, random);
        const coinTypeKey = coinType.toLowerCase();
        const goldValue = coinAmount * (this.COIN_TO_GOLD[coinTypeKey] || 0);
        totalGold += goldValue;
      }
      return Math.floor(totalGold);
    }
    /**
     * Calculate gem value from treasure table.
     * @private
     */
    _calculateGemValue(gemData, random = Math.random) {
      if (!gemData || !gemData.count) return 0;
      const gemCount = this._parseDiceRoll(gemData.count, 1, random);
      if (gemCount === 0) return 0;
      const gemValue = 50;
      return gemCount * gemValue;
    }
    /**
     * Calculate art object value from treasure table.
     * @private
     */
    _calculateArtValue(artData, random = Math.random) {
      if (!artData || !artData.count) return 0;
      const artCount = this._parseDiceRoll(artData.count, 1, random);
      if (artCount === 0) return 0;
      const artValue = 250;
      return artCount * artValue;
    }
    /**
     * Roll consumables (potions/scrolls) from magic item tables.
     * @private
     */
    _rollConsumables(magicItemData, random = Math.random) {
      if (!magicItemData || !magicItemData.count) return [];
      const consumables = [];
      const itemCount = this._parseDiceRoll(magicItemData.count, 1, random);
      for (let i = 0; i < itemCount; i++) {
      }
      return consumables;
    }
    /**
     * Parse dice roll string (e.g., "3d6", "1d4+2", "2d10*100") and apply multiplier.
     * @private
     */
    _parseDiceRoll(diceString, multiplier = 1, random = Math.random) {
      if (!diceString) return 0;
      let finalMultiplier = multiplier;
      let cleanDiceString = diceString;
      const multMatch = diceString.match(/\*(\d+)/);
      if (multMatch) {
        finalMultiplier *= parseInt(multMatch[1], 10);
        cleanDiceString = diceString.replace(/\*\d+/, "");
      }
      const match = cleanDiceString.match(/(\d+)d(\d+)([+-]\d+)?/);
      if (!match) {
        const value = parseInt(diceString, 10);
        return isNaN(value) ? 0 : value * finalMultiplier;
      }
      const diceCount = parseInt(match[1], 10);
      const diceSides = parseInt(match[2], 10);
      const modifier = match[3] ? parseInt(match[3], 10) : 0;
      const rolled = this.rollDice(diceCount, diceSides, random);
      return Math.floor((rolled + modifier) * finalMultiplier);
    }
    /**
     * Determine treasure rarity tier based on CR.
     * @private
     */
    _determineRarity(cr) {
      if (cr >= 17) return "very rare";
      if (cr >= 11) return "rare";
      if (cr >= 5) return "uncommon";
      return "common";
    }
  };

  // src/game/CaveGenerator.ts
  var CaveGenerator = class extends InteriorGenerator {
    lootGenerator;
    hazardGenerator;
    constructor() {
      super();
      this.lootGenerator = new LootGenerator();
      this.hazardGenerator = new HazardGenerator();
    }
    /**
     * Generate a cave interior map
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @param {number} cr - Challenge rating
     * @returns {object} Interior map data
     */
    generate(width, height, cr) {
      const grid = this.generateCaveLayout(width, height);
      this.ensureConnectivity(grid);
      const entrance = this.placeEntrance(grid);
      const hexes = this.gridToHexes(grid);
      return {
        seed: this.seed,
        poiType: "cave",
        cr,
        width,
        height,
        hexes,
        encounters: [],
        // Will be populated later
        loot: [],
        // Will be populated later
        hazards: [],
        // Will be populated later
        entrance
      };
    }
    /**
     * Generate cave layout using cellular automata (4-5 rule).
     * Uses a 40% initial wall density (slightly open) for better connectivity.
     * @param {number} width
     * @param {number} height
     * @returns {Array} 2D grid
     */
    generateCaveLayout(width, height) {
      let grid = this.initializeGrid(width, height, this.terrainTypes.floor);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
            grid[row][col].terrain = this.terrainTypes.wall;
          } else {
            grid[row][col].terrain = this.random() < 0.4 ? this.terrainTypes.wall : this.terrainTypes.floor;
          }
        }
      }
      for (let i = 0; i < 5; i++) {
        grid = this.applyCellularAutomata(grid);
      }
      const allFloor = [];
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (grid[row][col].terrain.walkable) allFloor.push({ col, row });
        }
      }
      if (allFloor.length === 0) {
        const cy = Math.floor(height / 2);
        const cx = Math.floor(width / 2);
        for (let c = 1; c < width - 1; c++) grid[cy][c].terrain = this.terrainTypes.floor;
        for (let r = 1; r < height - 1; r++) grid[r][cx].terrain = this.terrainTypes.floor;
      } else {
        const seed = allFloor[0];
        const connected = this.floodFill(grid, seed.col, seed.row, (h) => h.terrain.walkable);
        const orphans = allFloor.filter((t) => !connected.has(`${t.col},${t.row}`));
        for (const orphan of orphans) {
          this.carvePath(grid, orphan, seed);
        }
      }
      return grid;
    }
    /**
     * Apply cellular automata rules (4-5 rule)
     * If a tile has 5+ wall neighbors, it becomes a wall
     * If a tile has 4+ wall neighbors, it stays the same
     * Otherwise, it becomes floor
     * @param {Array} grid - Current grid
     * @returns {Array} New grid after applying rules
     */
    applyCellularAutomata(grid) {
      const height = grid.length;
      const width = grid[0].length;
      const newGrid = this.initializeGrid(width, height, this.terrainTypes.floor);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
            newGrid[row][col].terrain = this.terrainTypes.wall;
            continue;
          }
          const wallNeighbors = this.countNeighborTerrain(grid, col, row, "wall");
          if (wallNeighbors >= 5) {
            newGrid[row][col].terrain = this.terrainTypes.wall;
          } else if (wallNeighbors >= 4) {
            newGrid[row][col].terrain = grid[row][col].terrain;
          } else {
            newGrid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
      return newGrid;
    }
    /**
     * Ensure all floor tiles are connected
     * Uses flood fill to find isolated regions and connects them
     * @param {Array} grid - Grid to modify
     */
    ensureConnectivity(grid) {
      const height = grid.length;
      const width = grid[0].length;
      const floorTiles = [];
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (grid[row][col].terrain.walkable) {
            floorTiles.push({ col, row });
          }
        }
      }
      if (floorTiles.length === 0) {
        const centerRow = Math.floor(height / 2);
        const centerCol = Math.floor(width / 2);
        grid[centerRow][centerCol].terrain = this.terrainTypes.floor;
        floorTiles.push({ col: centerCol, row: centerRow });
      }
      const startTile = floorTiles[0];
      const connected = this.floodFill(
        grid,
        startTile.col,
        startTile.row,
        (hex) => hex.terrain.walkable
      );
      const isolated = floorTiles.filter((tile) => {
        return !connected.has(`${tile.col},${tile.row}`);
      });
      for (const isolatedTile of isolated) {
        this.carvePath(grid, startTile, isolatedTile);
      }
    }
    /**
     * Carve a path between two points
     * @param {Array} grid
     * @param {object} start - {col, row}
     * @param {object} end - {col, row}
     */
    carvePath(grid, start, end) {
      const current = { ...start };
      while (current.col !== end.col || current.row !== end.row) {
        grid[current.row][current.col].terrain = this.terrainTypes.floor;
        const dx = end.col - current.col;
        const dy = end.row - current.row;
        if (Math.abs(dx) > Math.abs(dy)) {
          current.col += dx > 0 ? 1 : -1;
        } else {
          current.row += dy > 0 ? 1 : -1;
        }
        if (current.row < 0 || current.row >= grid.length || current.col < 0 || current.col >= grid[0].length) {
          break;
        }
      }
    }
    /**
     * Place entrance and exit hexes near the cave mouth.
     *
     * - Entrance (brown): where the player spawns on entry.
     * - Exit    (green):  an adjacent walkable tile the player must reach to leave.
     *   Placing them 1 tile apart means the player can't immediately exit, but also
     *   doesn't need to hunt for the exit after exploring.
     *
     * @param {Array} grid
     * @returns {object} {col, row} of entrance
     */
    placeEntrance(grid) {
      const height = grid.length;
      const width = grid[0].length;
      const edgeCandidates = [];
      for (let col = 1; col < width - 1; col++) {
        if (grid[1][col].terrain.walkable) edgeCandidates.push({ col, row: 1 });
        if (grid[height - 2][col].terrain.walkable) edgeCandidates.push({ col, row: height - 2 });
      }
      for (let row = 2; row < height - 2; row++) {
        if (grid[row][1].terrain.walkable) edgeCandidates.push({ col: 1, row });
        if (grid[row][width - 2].terrain.walkable) edgeCandidates.push({ col: width - 2, row });
      }
      const allWalkable = this.getWalkableTiles(grid);
      const candidates = edgeCandidates.length > 0 ? edgeCandidates : allWalkable;
      if (candidates.length === 0) {
        const fc = { col: Math.floor(width / 2), row: Math.floor(height / 2) };
        grid[fc.row][fc.col].terrain = this.terrainTypes.entrance;
        grid[fc.row][fc.col].content = "exit";
        return fc;
      }
      const entrance = this.randomChoice(candidates);
      grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
      grid[entrance.row][entrance.col].content = "entrance";
      const cardinalOffsets = [
        { dc: 0, dr: -1 },
        { dc: 0, dr: 1 },
        { dc: -1, dr: 0 },
        { dc: 1, dr: 0 }
      ];
      let exitPos = null;
      for (const { dc, dr } of cardinalOffsets) {
        const nc = entrance.col + dc;
        const nr = entrance.row + dr;
        if (nr > 0 && nr < height - 1 && nc > 0 && nc < width - 1 && grid[nr][nc].terrain.walkable && !grid[nr][nc].content) {
          exitPos = { col: nc, row: nr };
          break;
        }
      }
      if (!exitPos) {
        grid[entrance.row][entrance.col].content = "exit";
        return entrance;
      }
      grid[exitPos.row][exitPos.col].terrain = this.terrainTypes.exit;
      grid[exitPos.row][exitPos.col].content = "exit";
      return entrance;
    }
    /**
     * Place encounters in the cave
     * @param {object} interiorMap - Interior map data
     * @param {object} poiData - Original POI data (for creatures info)
     * @returns {Array} Array of encounter objects
     */
    placeEncounters(interiorMap, poiData = {}) {
      const floorTiles = interiorMap.hexes.filter(
        (hex) => hex.terrain.walkable && hex.content === null
      );
      const cr = interiorMap.cr;
      let encounterCount = 1;
      if (cr >= 3 && cr <= 5) encounterCount = 2;
      else if (cr > 5) encounterCount = 3;
      const encounters = [];
      for (let i = 0; i < encounterCount && floorTiles.length > 0; i++) {
        const entrance = interiorMap.entrance;
        const farTiles = floorTiles.filter((tile2) => {
          const dist = this.getHexDistance(tile2.col, tile2.row, entrance.col, entrance.row);
          return dist >= 3;
        });
        const tile = farTiles.length > 0 ? this.randomChoice(farTiles) : this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = "encounter";
        }
        encounters.push({
          col: tile.col,
          row: tile.row,
          cr,
          creatures: poiData.creatures || `CR ${cr} enemies`,
          defeated: false,
          discovered: false
        });
      }
      return encounters;
    }
    /**
     * Place loot in the cave
     * @param {object} interiorMap - Interior map data
     * @param {number} partySize - Party size for treasure hoard generation
     * @returns {Array} Array of loot objects
     */
    placeLoot(interiorMap, partySize = 4) {
      const floorTiles = interiorMap.hexes.filter(
        (hex) => hex.terrain.walkable && hex.content === null
      );
      const cr = interiorMap.cr;
      const lootCount = Math.max(2, Math.floor(2 + cr * 0.5));
      const treasureGenerator = new TreasureGenerator();
      const loot = [];
      for (let i = 0; i < lootCount && floorTiles.length > 0; i++) {
        const tile = this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        const isChest = this.random() < 0.25;
        let lootData;
        let contentType;
        if (isChest) {
          lootData = treasureGenerator.generateTreasureHoard(cr, partySize, () => this.random());
          contentType = "chest";
        } else {
          lootData = this.lootGenerator.generateLoot(cr, () => this.random());
          contentType = "loot";
        }
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = contentType;
        }
        loot.push({
          col: tile.col,
          row: tile.row,
          type: contentType,
          gold: lootData.gold,
          items: "items" in lootData ? lootData.items : [],
          consumables: "consumables" in lootData ? lootData.consumables : [],
          rarity: lootData.rarity,
          collected: false,
          discovered: false
        });
      }
      return loot;
    }
    /**
     * Place hazards in the cave
     * @param {object} interiorMap - Interior map data
     * @returns {Array} Array of hazard objects
     */
    placeHazards(interiorMap) {
      const floorTiles = interiorMap.hexes.filter(
        (hex) => hex.terrain.walkable && hex.content === null
      );
      const cr = interiorMap.cr;
      const hazardPercentage = 0.1 + this.random() * 0.1;
      const hazardCount = Math.floor(floorTiles.length * hazardPercentage);
      const hazards = [];
      for (let i = 0; i < hazardCount && floorTiles.length > 0; i++) {
        const tile = this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = "hazard";
        }
        const generatedHazard = this.hazardGenerator.generateHazard(cr, () => this.random());
        hazards.push({
          col: tile.col,
          row: tile.row,
          ...generatedHazard,
          triggered: false,
          discovered: false
        });
      }
      return hazards;
    }
  };

  // src/game/DungeonGenerator.ts
  var DungeonGenerator = class extends InteriorGenerator {
    lootGenerator;
    hazardGenerator;
    constructor() {
      super();
      this.lootGenerator = new LootGenerator();
      this.hazardGenerator = new HazardGenerator();
      this.terrainTypes.stairsDown = {
        key: "stairsDown",
        name: "Stairs Down",
        color: "#5a4a2a",
        walkable: true
      };
      this.terrainTypes.stairsUp = {
        key: "stairsUp",
        name: "Stairs Up",
        color: "#6a5a3a",
        walkable: true
      };
    }
    /**
     * Generate a dungeon interior map using BSP algorithm.
     * CR ≥ 3 dungeons get a second "boss floor" accessible via stairsDown
     * in the deepest room.
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @param {number} cr - Challenge rating
     * @returns {object} Interior map data
     */
    generate(width, height, cr) {
      const { grid, rooms, bossRoom } = this.generateDungeonLayout(width, height, cr);
      const entrance = this.placeEntrance(grid, rooms[0]);
      const hasSecondFloor = cr >= 3 && rooms.length >= 3;
      let stairsPos = null;
      if (hasSecondFloor) {
        stairsPos = this.placeBossStairs(grid, bossRoom);
      }
      const hexes = this.gridToHexes(grid);
      return {
        seed: this.seed,
        poiType: "dungeon",
        cr,
        width,
        height,
        hexes,
        encounters: [],
        loot: [],
        hazards: [],
        entrance,
        rooms,
        bossRoom,
        floorCount: hasSecondFloor ? 2 : 1,
        floorIndex: 0,
        stairsPos
        // position of the stairs to floor 1 (null if single-floor)
      };
    }
    /**
     * Generate the boss floor (floor 1) for a multi-level dungeon.
     * A single large chamber with the boss encounter and rich loot.
     */
    generateBossFloor(width, height, cr) {
      const grid = this.initializeGrid(width, height, this.terrainTypes.wall);
      const margin = 2;
      const chamberW = width - margin * 2;
      const chamberH = height - margin * 2;
      for (let row = margin; row < margin + chamberH; row++) {
        for (let col = margin; col < margin + chamberW; col++) {
          if (row > 0 && row < height - 1 && col > 0 && col < width - 1) {
            grid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);
      const pillarRad = Math.floor(Math.min(chamberW, chamberH) / 3);
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = angle * Math.PI / 180;
        const pc = Math.round(cx + Math.cos(rad) * pillarRad);
        const pr = Math.round(cy + Math.sin(rad) * pillarRad);
        if (pr > 0 && pr < height - 1 && pc > 0 && pc < width - 1) {
          grid[pr][pc].terrain = this.terrainTypes.wall;
        }
      }
      const stairsUpRow = margin + 1;
      const stairsUpCol = cx;
      if (grid[stairsUpRow] && grid[stairsUpRow][stairsUpCol]) {
        grid[stairsUpRow][stairsUpCol].terrain = this.terrainTypes.stairsUp;
        grid[stairsUpRow][stairsUpCol].content = "stairsUp";
        grid[stairsUpRow][stairsUpCol].connectedFloor = 0;
      }
      if (grid[cy] && grid[cy][cx]) {
        grid[cy][cx].content = "encounter";
      }
      const hexes = this.gridToHexes(grid);
      const bossFloorCR = Math.ceil(cr * 1.5);
      const spawnUp = { col: stairsUpCol, row: stairsUpRow };
      const floorMap = {
        seed: `${this.seed}:boss`,
        poiType: "dungeon",
        cr: bossFloorCR,
        width,
        height,
        hexes,
        encounters: [],
        loot: [],
        hazards: [],
        entrance: spawnUp,
        spawnUp,
        floorIndex: 1,
        floorCount: 2
      };
      floorMap.encounters = [
        {
          col: cx,
          row: cy,
          floor: 1,
          cr: bossFloorCR,
          creatures: `Boss: CR ${bossFloorCR} dungeon lord`,
          defeated: false,
          discovered: false,
          isBoss: true
        }
      ];
      const treasureGenerator = new TreasureGenerator();
      const lootCount = Math.max(2, Math.floor(2 + cr * 0.5));
      const lootTiles = hexes.filter((h) => h.terrain.walkable && h.content === null);
      const floorLoot = [];
      for (let i = 0; i < lootCount && lootTiles.length > 0; i++) {
        const tile = this.randomChoice(lootTiles);
        lootTiles.splice(lootTiles.indexOf(tile), 1);
        const lootData = treasureGenerator.generateTreasureHoard(bossFloorCR, 4, () => this.random());
        const idx = hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (idx !== -1) hexes[idx].content = "chest";
        floorLoot.push({
          col: tile.col,
          row: tile.row,
          floor: 1,
          type: "chest",
          gold: lootData.gold,
          items: "items" in lootData ? lootData.items : [],
          consumables: "consumables" in lootData ? lootData.consumables : [],
          rarity: lootData.rarity,
          collected: false,
          discovered: false
        });
      }
      floorMap.loot = floorLoot;
      return floorMap;
    }
    /**
     * Place a stairsDown tile in the boss room.
     * Tries the center first, then spirals outward through all room tiles
     * to find a free walkable tile. Returns null only if the room is fully occupied.
     */
    placeBossStairs(grid, bossRoom) {
      const stairCol = Math.floor(bossRoom.x + bossRoom.width / 2);
      const stairRow = Math.floor(bossRoom.y + bossRoom.height / 2);
      const candidates = [];
      for (let row2 = bossRoom.y; row2 < bossRoom.y + bossRoom.height; row2++) {
        for (let col2 = bossRoom.x; col2 < bossRoom.x + bossRoom.width; col2++) {
          if (row2 > 0 && row2 < grid.length - 1 && col2 > 0 && col2 < grid[0].length - 1 && grid[row2][col2].terrain.walkable && !grid[row2][col2].content) {
            candidates.push({ col: col2, row: row2, d: (col2 - stairCol) ** 2 + (row2 - stairRow) ** 2 });
          }
        }
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.d - b.d);
      const { col, row } = candidates[0];
      grid[row][col].terrain = this.terrainTypes.stairsDown;
      grid[row][col].content = "stairsDown";
      grid[row][col].connectedFloor = 1;
      return { col, row };
    }
    /**
     * Generate dungeon layout using Binary Space Partitioning
     * @param {number} width
     * @param {number} height
     * @param {number} cr
     * @returns {object} { grid, rooms, bossRoom }
     */
    generateDungeonLayout(width, height, cr) {
      const grid = this.initializeGrid(width, height, this.terrainTypes.wall);
      const minRoomSize = 4;
      const rootNode = {
        x: 1,
        y: 1,
        width: width - 2,
        height: height - 2,
        leftChild: null,
        rightChild: null,
        room: null
      };
      const targetDepth = Math.min(4, Math.max(2, 2 + Math.floor(cr / 3)));
      this.partitionNode(rootNode, 0, targetDepth, minRoomSize);
      const rooms = [];
      this.createRooms(rootNode, rooms);
      for (const room of rooms) {
        for (let row = room.y; row < room.y + room.height; row++) {
          for (let col = room.x; col < room.x + room.width; col++) {
            if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
              grid[row][col].terrain = this.terrainTypes.floor;
            }
          }
        }
      }
      this.connectRooms(grid, rootNode);
      const bossRoom = rooms[rooms.length - 1];
      return { grid, rooms, bossRoom };
    }
    /**
     * Recursively partition BSP node
     * @param {object} node - BSP node
     * @param {number} depth - Current depth
     * @param {number} maxDepth - Maximum depth
     * @param {number} minRoomSize - Minimum room size
     */
    partitionNode(node, depth, maxDepth, minRoomSize) {
      if (depth >= maxDepth) {
        return;
      }
      const canSplitHorizontally = node.height >= minRoomSize * 2;
      const canSplitVertically = node.width >= minRoomSize * 2;
      if (!canSplitHorizontally && !canSplitVertically) {
        return;
      }
      let splitHorizontally;
      if (canSplitHorizontally && !canSplitVertically) {
        splitHorizontally = true;
      } else if (!canSplitHorizontally && canSplitVertically) {
        splitHorizontally = false;
      } else {
        splitHorizontally = node.height > node.width ? true : this.random() > 0.5;
      }
      if (splitHorizontally) {
        const splitPos = this.randomInt(minRoomSize, node.height - minRoomSize);
        node.leftChild = {
          x: node.x,
          y: node.y,
          width: node.width,
          height: splitPos,
          leftChild: null,
          rightChild: null,
          room: null
        };
        node.rightChild = {
          x: node.x,
          y: node.y + splitPos,
          width: node.width,
          height: node.height - splitPos,
          leftChild: null,
          rightChild: null,
          room: null
        };
      } else {
        const splitPos = this.randomInt(minRoomSize, node.width - minRoomSize);
        node.leftChild = {
          x: node.x,
          y: node.y,
          width: splitPos,
          height: node.height,
          leftChild: null,
          rightChild: null,
          room: null
        };
        node.rightChild = {
          x: node.x + splitPos,
          y: node.y,
          width: node.width - splitPos,
          height: node.height,
          leftChild: null,
          rightChild: null,
          room: null
        };
      }
      this.partitionNode(node.leftChild, depth + 1, maxDepth, minRoomSize);
      this.partitionNode(node.rightChild, depth + 1, maxDepth, minRoomSize);
    }
    /**
     * Create rooms in leaf nodes of BSP tree
     * @param {object} node - BSP node
     * @param {Array} rooms - Array to collect rooms
     */
    createRooms(node, rooms) {
      if (node.leftChild === null && node.rightChild === null) {
        const roomWidth = this.randomInt(
          Math.max(3, Math.floor(node.width * 0.5)),
          Math.max(3, node.width - 1)
        );
        const roomHeight = this.randomInt(
          Math.max(3, Math.floor(node.height * 0.5)),
          Math.max(3, node.height - 1)
        );
        const roomX = node.x + this.randomInt(0, node.width - roomWidth);
        const roomY = node.y + this.randomInt(0, node.height - roomHeight);
        node.room = {
          x: roomX,
          y: roomY,
          width: roomWidth,
          height: roomHeight
        };
        rooms.push(node.room);
      } else {
        if (node.leftChild) {
          this.createRooms(node.leftChild, rooms);
        }
        if (node.rightChild) {
          this.createRooms(node.rightChild, rooms);
        }
      }
    }
    /**
     * Connect rooms in BSP tree with corridors
     * @param {Array} grid - 2D grid
     * @param {object} node - BSP node
     */
    connectRooms(grid, node) {
      if (node.leftChild === null && node.rightChild === null) {
        return;
      }
      if (node.leftChild) {
        this.connectRooms(grid, node.leftChild);
      }
      if (node.rightChild) {
        this.connectRooms(grid, node.rightChild);
      }
      const leftRoom = this.getRandomRoom(node.leftChild);
      const rightRoom = this.getRandomRoom(node.rightChild);
      if (leftRoom && rightRoom) {
        const leftCenter = {
          col: Math.floor(leftRoom.x + leftRoom.width / 2),
          row: Math.floor(leftRoom.y + leftRoom.height / 2)
        };
        const rightCenter = {
          col: Math.floor(rightRoom.x + rightRoom.width / 2),
          row: Math.floor(rightRoom.y + rightRoom.height / 2)
        };
        this.carveDungeonCorridor(grid, leftCenter, rightCenter);
      }
    }
    /**
     * Get a random room from BSP subtree
     * @param {object} node - BSP node
     * @returns {object|null} Room object
     */
    getRandomRoom(node) {
      if (!node) return null;
      if (node.room) {
        return node.room;
      }
      if (this.random() > 0.5 && node.leftChild) {
        return this.getRandomRoom(node.leftChild);
      } else if (node.rightChild) {
        return this.getRandomRoom(node.rightChild);
      } else if (node.leftChild) {
        return this.getRandomRoom(node.leftChild);
      }
      return null;
    }
    /**
     * Carve L-shaped corridor between two points
     * @param {Array} grid
     * @param {object} start - {col, row}
     * @param {object} end - {col, row}
     */
    carveDungeonCorridor(grid, start, end) {
      const horizontalFirst = this.random() > 0.5;
      if (horizontalFirst) {
        for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
          if (start.row >= 0 && start.row < grid.length && col >= 0 && col < grid[0].length) {
            grid[start.row][col].terrain = this.terrainTypes.floor;
          }
        }
        for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
          if (row >= 0 && row < grid.length && end.col >= 0 && end.col < grid[0].length) {
            grid[row][end.col].terrain = this.terrainTypes.floor;
          }
        }
      } else {
        for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
          if (row >= 0 && row < grid.length && start.col >= 0 && start.col < grid[0].length) {
            grid[row][start.col].terrain = this.terrainTypes.floor;
          }
        }
        for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
          if (end.row >= 0 && end.row < grid.length && col >= 0 && col < grid[0].length) {
            grid[end.row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
    }
    /**
     * Place entrance and exit hex in the first room.
     *
     * - Entrance (brown): center of first room — where the player spawns.
     * - Exit (green):     one tile to the left of entrance — step on to leave.
     *
     * Towns use a button to exit freely; dungeons/caves/ruins/towers require
     * the player to return to this Exit Hex before they can leave.
     *
     * @param {Array} grid
     * @param {object} firstRoom - First room object
     * @returns {object} {col, row} of entrance
     */
    placeEntrance(grid, firstRoom) {
      const entrance = {
        col: Math.floor(firstRoom.x + firstRoom.width / 2),
        row: Math.floor(firstRoom.y + firstRoom.height / 2)
      };
      if (entrance.row >= 0 && entrance.row < grid.length && entrance.col >= 0 && entrance.col < grid[0].length) {
        grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
        grid[entrance.row][entrance.col].content = "entrance";
      }
      const exitCol = firstRoom.x + 1;
      const exitRow = entrance.row;
      if (exitRow >= 0 && exitRow < grid.length && exitCol >= 0 && exitCol < grid[0].length) {
        grid[exitRow][exitCol].terrain = this.terrainTypes.exit;
        grid[exitRow][exitCol].content = "exit";
      }
      return entrance;
    }
    /**
     * Place encounters in the dungeon (one per room, boss in last room)
     * @param {object} interiorMap - Interior map data
     * @param {object} poiData - Original POI data
     * @returns {Array} Array of encounter objects
     */
    placeEncounters(interiorMap, poiData = {}) {
      const rooms = interiorMap.rooms;
      const bossRoom = interiorMap.bossRoom;
      const encounters = [];
      for (let i = 1; i < rooms.length; i++) {
        const room = rooms[i];
        const roomTiles = interiorMap.hexes.filter((hex) => {
          return hex.col >= room.x && hex.col < room.x + room.width && hex.row >= room.y && hex.row < room.y + room.height && hex.terrain.walkable && hex.content === null && hex.terrain.key !== "stairsDown" && hex.terrain.key !== "stairsUp";
        });
        if (roomTiles.length === 0) continue;
        const tile = this.randomChoice(roomTiles);
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = "encounter";
        }
        const isBoss = room === bossRoom && interiorMap.floorCount === 1;
        const encounterCR = isBoss ? Math.ceil(interiorMap.cr * 1.5) : interiorMap.cr;
        encounters.push({
          col: tile.col,
          row: tile.row,
          cr: encounterCR,
          creatures: isBoss ? `Boss: CR ${encounterCR} ${poiData.creatures || "dungeon lord"}` : poiData.creatures || `CR ${encounterCR} enemies`,
          defeated: false,
          discovered: false,
          isBoss
        });
      }
      return encounters;
    }
    /**
     * Place loot in the dungeon (concentrated in later rooms)
     * @param {object} interiorMap - Interior map data
     * @param {number} partySize - Party size for treasure hoard generation
     * @returns {Array} Array of loot objects
     */
    placeLoot(interiorMap, partySize = 4) {
      const cr = interiorMap.cr;
      const rooms = interiorMap.rooms;
      const lootCount = Math.max(3, Math.floor(3 + cr * 0.8));
      const treasureGenerator = new TreasureGenerator();
      const loot = [];
      for (let i = 0; i < lootCount; i++) {
        const targetRoomIndex = this.random() > 0.4 ? Math.floor(rooms.length / 2) + this.randomInt(0, Math.floor(rooms.length / 2)) : this.randomInt(0, Math.floor(rooms.length / 2) - 1);
        const room = rooms[Math.min(targetRoomIndex, rooms.length - 1)];
        const roomTiles = interiorMap.hexes.filter((hex) => {
          return hex.col >= room.x && hex.col < room.x + room.width && hex.row >= room.y && hex.row < room.y + room.height && hex.terrain.walkable && hex.content === null;
        });
        if (roomTiles.length === 0) continue;
        const tile = this.randomChoice(roomTiles);
        const isChest = this.random() < 0.25;
        let lootData;
        let contentType;
        if (isChest) {
          lootData = treasureGenerator.generateTreasureHoard(cr, partySize, () => this.random());
          contentType = "chest";
        } else {
          lootData = this.lootGenerator.generateLoot(cr, () => this.random());
          contentType = "loot";
        }
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = contentType;
        }
        loot.push({
          col: tile.col,
          row: tile.row,
          type: contentType,
          gold: lootData.gold,
          items: "items" in lootData ? lootData.items : [],
          consumables: "consumables" in lootData ? lootData.consumables : [],
          rarity: lootData.rarity,
          collected: false,
          discovered: false
        });
      }
      return loot;
    }
    /**
     * Place hazards in the dungeon (traps in corridors and rooms)
     * @param {object} interiorMap - Interior map data
     * @returns {Array} Array of hazard objects
     */
    placeHazards(interiorMap) {
      const floorTiles = interiorMap.hexes.filter(
        (hex) => hex.terrain.walkable && hex.content === null
      );
      const cr = interiorMap.cr;
      const hazardPercentage = 0.2 + this.random() * 0.15;
      const hazardCount = Math.floor(floorTiles.length * hazardPercentage);
      const hazards = [];
      for (let i = 0; i < hazardCount && floorTiles.length > 0; i++) {
        const tile = this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = "hazard";
        }
        const generatedHazard = this.hazardGenerator.generateHazard(cr, () => this.random());
        hazards.push({
          col: tile.col,
          row: tile.row,
          ...generatedHazard,
          triggered: false,
          discovered: false
        });
      }
      return hazards;
    }
  };

  // src/game/RuinsGenerator.ts
  var RuinsGenerator = class extends InteriorGenerator {
    lootGenerator;
    hazardGenerator;
    _rooms;
    constructor() {
      super();
      this.lootGenerator = new LootGenerator();
      this.hazardGenerator = new HazardGenerator();
      this._rooms = [];
      this.terrainTypes.rubble = {
        key: "rubble",
        name: "Rubble",
        color: "#5a5a5a",
        walkable: true
      };
    }
    /**
     * Generate a ruins interior map
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @param {number} cr - Challenge rating
     * @returns {object} Interior map data
     */
    generate(width, height, cr) {
      const grid = this.generateRuinsLayout(width, height, cr);
      const entrance = this.placeEntrance(grid);
      const hexes = this.gridToHexes(grid);
      return {
        seed: this.seed,
        poiType: "ruins",
        cr,
        width,
        height,
        hexes,
        encounters: [],
        // Will be populated later
        loot: [],
        // Will be populated later
        hazards: [],
        // Will be populated later
        entrance
      };
    }
    /**
     * Generate ruins layout with room-based generation.
     * Creates 4-8 rooms connected by corridors with crumbling walls.
     * Guarantees full connectivity via flood-fill after carving.
     * @param {number} width
     * @param {number} height
     * @param {number} cr - Challenge rating affects room count and density
     * @returns {Array} 2D grid
     */
    generateRuinsLayout(width, height, cr) {
      const grid = this.initializeGrid(width, height, this.terrainTypes.wall);
      const roomCount = Math.min(8, Math.max(4, 4 + Math.floor(cr / 2)));
      logger_default.mapgen.info("Generating ruins", { width, height, cr, roomCount });
      const rooms = [];
      const maxAttempts = 300;
      let attempts = 0;
      while (rooms.length < roomCount && attempts < maxAttempts) {
        attempts++;
        const roomWidth = this.randomInt(3, Math.min(6, Math.floor(width / 3)));
        const roomHeight = this.randomInt(3, Math.min(6, Math.floor(height / 3)));
        const maxCol = width - roomWidth - 1;
        const maxRow = height - roomHeight - 1;
        if (maxCol < 1 || maxRow < 1) break;
        const roomCol = this.randomInt(1, maxCol);
        const roomRow = this.randomInt(1, maxRow);
        const buffer = 1;
        const overlaps = rooms.some(
          (room) => !(roomCol + roomWidth + buffer <= room.col || roomCol >= room.col + room.width + buffer || roomRow + roomHeight + buffer <= room.row || roomRow >= room.row + room.height + buffer)
        );
        if (!overlaps) {
          rooms.push({ col: roomCol, row: roomRow, width: roomWidth, height: roomHeight });
        }
      }
      logger_default.mapgen.info("Generated rooms", { roomCount: rooms.length, attempts });
      if (rooms.length === 0) {
        const fw = Math.min(5, Math.floor(width / 2));
        const fh = Math.min(5, Math.floor(height / 2));
        rooms.push({
          col: Math.floor((width - fw) / 2),
          row: Math.floor((height - fh) / 2),
          width: fw,
          height: fh
        });
      }
      if (rooms.length === 1) {
        const r = rooms[0];
        const col2 = Math.min(width - 4, r.col + r.width + 2);
        const row2 = Math.min(height - 4, r.row + r.height + 2);
        rooms.push({
          col: col2,
          row: row2,
          width: Math.min(4, width - col2 - 1),
          height: Math.min(4, height - row2 - 1)
        });
      }
      for (const room of rooms) {
        for (let row = room.row; row < room.row + room.height; row++) {
          for (let col = room.col; col < room.col + room.width; col++) {
            if (row > 0 && row < height - 1 && col > 0 && col < width - 1) {
              grid[row][col].terrain = this.terrainTypes.floor;
            }
          }
        }
      }
      for (let i = 0; i < rooms.length - 1; i++) {
        const a = rooms[i];
        const b = rooms[i + 1];
        this.carveRuinsCorridor(
          grid,
          { col: Math.floor(a.col + a.width / 2), row: Math.floor(a.row + a.height / 2) },
          { col: Math.floor(b.col + b.width / 2), row: Math.floor(b.row + b.height / 2) }
        );
      }
      if (rooms.length >= 3) {
        const extraConnections = Math.floor(rooms.length / 2);
        for (let i = 0; i < extraConnections; i++) {
          const a = this.randomChoice(rooms);
          const b = this.randomChoice(rooms);
          if (a !== b) {
            this.carveRuinsCorridor(
              grid,
              { col: Math.floor(a.col + a.width / 2), row: Math.floor(a.row + a.height / 2) },
              { col: Math.floor(b.col + b.width / 2), row: Math.floor(b.row + b.height / 2) }
            );
          }
        }
      }
      const allFloor = [];
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (grid[row][col].terrain.walkable) allFloor.push({ col, row });
        }
      }
      if (allFloor.length > 0) {
        const seed = allFloor[0];
        const connected = this.floodFill(grid, seed.col, seed.row, (h) => h.terrain.walkable);
        const orphans = allFloor.filter((t) => !connected.has(`${t.col},${t.row}`));
        for (const orphan of orphans) {
          const cur = { ...orphan };
          while (cur.col !== seed.col || cur.row !== seed.row) {
            if (cur.row > 0 && cur.row < height - 1 && cur.col > 0 && cur.col < width - 1) {
              grid[cur.row][cur.col].terrain = this.terrainTypes.floor;
            }
            const dx = seed.col - cur.col;
            const dy = seed.row - cur.row;
            if (Math.abs(dx) >= Math.abs(dy)) cur.col += dx > 0 ? 1 : -1;
            else cur.row += dy > 0 ? 1 : -1;
          }
        }
      }
      const rubbleMin = Math.min(0.05 + cr * 0.01, 0.12);
      const rubbleMax = Math.min(0.12 + cr * 0.01, 0.2);
      const chasmMin = Math.min(0.01 + cr * 3e-3, 0.03);
      const chasmMax = Math.min(0.02 + cr * 5e-3, 0.05);
      this.addRubble(grid, rubbleMin, rubbleMax);
      this.addChasms(grid, chasmMin, chasmMax);
      const allFloor2 = [];
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (grid[row][col].terrain.walkable) allFloor2.push({ col, row });
        }
      }
      if (allFloor2.length > 0) {
        const seed2 = allFloor2[0];
        const connected2 = this.floodFill(grid, seed2.col, seed2.row, (h) => h.terrain.walkable);
        const orphans2 = allFloor2.filter((t) => !connected2.has(`${t.col},${t.row}`));
        for (const orphan of orphans2) {
          const cur = { ...orphan };
          while (cur.col !== seed2.col || cur.row !== seed2.row) {
            if (cur.row > 0 && cur.row < height - 1 && cur.col > 0 && cur.col < width - 1) {
              if (!grid[cur.row][cur.col].terrain.walkable) {
                grid[cur.row][cur.col].terrain = this.terrainTypes.floor;
              }
            }
            const dx = seed2.col - cur.col;
            const dy = seed2.row - cur.row;
            if (Math.abs(dx) >= Math.abs(dy)) cur.col += dx > 0 ? 1 : -1;
            else cur.row += dy > 0 ? 1 : -1;
          }
        }
      }
      this._rooms = rooms;
      return grid;
    }
    /**
     * Carve L-shaped corridor between two points
     * @param {Array} grid
     * @param {object} start - {col, row}
     * @param {object} end - {col, row}
     */
    carveRuinsCorridor(grid, start, end) {
      const horizontalFirst = this.random() > 0.5;
      if (horizontalFirst) {
        for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
          if (start.row >= 0 && start.row < grid.length && col >= 0 && col < grid[0].length) {
            grid[start.row][col].terrain = this.terrainTypes.floor;
          }
        }
        for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
          if (row >= 0 && row < grid.length && end.col >= 0 && end.col < grid[0].length) {
            grid[row][end.col].terrain = this.terrainTypes.floor;
          }
        }
      } else {
        for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row++) {
          if (row >= 0 && row < grid.length && start.col >= 0 && start.col < grid[0].length) {
            grid[row][start.col].terrain = this.terrainTypes.floor;
          }
        }
        for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col++) {
          if (end.row >= 0 && end.row < grid.length && col >= 0 && col < grid[0].length) {
            grid[end.row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
    }
    /**
     * Add rubble to simulate crumbling structures
     * @param {Array} grid
     * @param {number} minPercent - Minimum percentage of floor tiles to convert
     * @param {number} maxPercent - Maximum percentage of floor tiles to convert
     */
    addRubble(grid, minPercent, maxPercent) {
      const floorTiles = [];
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          if (grid[row][col].terrain.key === "floor") {
            floorTiles.push({ col, row });
          }
        }
      }
      const rubblePercent = minPercent + this.random() * (maxPercent - minPercent);
      const rubbleCount = Math.floor(floorTiles.length * rubblePercent);
      for (let i = 0; i < rubbleCount; i++) {
        const tile = this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        grid[tile.row][tile.col].terrain = this.terrainTypes.rubble;
      }
    }
    /**
     * Add chasms (collapsed floors)
     * @param {Array} grid
     * @param {number} minPercent - Minimum percentage
     * @param {number} maxPercent - Maximum percentage
     */
    addChasms(grid, minPercent, maxPercent) {
      const floorTiles = [];
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          if (grid[row][col].terrain.key === "floor" || grid[row][col].terrain.key === "rubble") {
            floorTiles.push({ col, row });
          }
        }
      }
      const chasmPercent = minPercent + this.random() * (maxPercent - minPercent);
      const chasmCount = Math.floor(floorTiles.length * chasmPercent);
      for (let i = 0; i < chasmCount; i++) {
        const tile = this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        grid[tile.row][tile.col].terrain = this.terrainTypes.chasm;
      }
    }
    /**
     * Place entrance hex at the edge tile of the first (smallest col) room.
     * Falls back to any walkable edge tile, then any walkable tile, then the
     * centre of the grid as an absolute last resort.
     *
     * Crucially, after the entrance tile is chosen we ALWAYS carve a straight
     * corridor from it to the nearest existing floor tile so the player is
     * never left standing in an isolated cell surrounded by walls.
     *
     * @param {Array} grid
     * @returns {object} {col, row} of entrance
     */
    placeEntrance(grid) {
      const height = grid.length;
      const width = grid[0].length;
      let entrance = null;
      if (this._rooms && this._rooms.length > 0) {
        const sorted = [...this._rooms].sort((a, b) => a.row - b.row || a.col - b.col);
        const firstRoom = sorted[0];
        for (let col = firstRoom.col; col < firstRoom.col + firstRoom.width; col++) {
          const row = firstRoom.row;
          if (row > 0 && row < height - 1 && col > 0 && col < width - 1 && grid[row][col].terrain.walkable) {
            entrance = { col, row };
            break;
          }
        }
        if (!entrance) {
          const fc = Math.floor(firstRoom.col + firstRoom.width / 2);
          const fr = Math.floor(firstRoom.row + firstRoom.height / 2);
          if (grid[fr] && grid[fr][fc] && grid[fr][fc].terrain.walkable) {
            entrance = { col: fc, row: fr };
          }
        }
      }
      if (!entrance) {
        const candidates = [];
        for (let col = 1; col < width - 1; col++) {
          if (grid[1][col].terrain.walkable) candidates.push({ col, row: 1 });
          if (grid[height - 2][col].terrain.walkable) candidates.push({ col, row: height - 2 });
        }
        for (let row = 1; row < height - 1; row++) {
          if (grid[row][1].terrain.walkable) candidates.push({ col: 1, row });
          if (grid[row][width - 2].terrain.walkable) candidates.push({ col: width - 2, row });
        }
        if (candidates.length > 0) entrance = this.randomChoice(candidates);
      }
      if (!entrance) {
        const walkable = this.getWalkableTiles(grid);
        if (walkable.length > 0) entrance = this.randomChoice(walkable);
      }
      if (!entrance) {
        entrance = { col: Math.floor(width / 2), row: Math.floor(height / 2) };
      }
      grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
      grid[entrance.row][entrance.col].content = "exit";
      const allFloor = [];
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const t = grid[r][c].terrain;
          if (t.walkable && !(r === entrance.row && c === entrance.col)) {
            allFloor.push({ col: c, row: r });
          }
        }
      }
      if (allFloor.length > 0) {
        allFloor.sort(
          (a, b) => Math.abs(a.col - entrance.col) + Math.abs(a.row - entrance.row) - (Math.abs(b.col - entrance.col) + Math.abs(b.row - entrance.row))
        );
        const target = allFloor[0];
        let cur = { col: entrance.col, row: entrance.row };
        while (cur.col !== target.col || cur.row !== target.row) {
          const dx = target.col - cur.col;
          const dy = target.row - cur.row;
          if (Math.abs(dx) >= Math.abs(dy)) {
            cur = { col: cur.col + (dx > 0 ? 1 : -1), row: cur.row };
          } else {
            cur = { col: cur.col, row: cur.row + (dy > 0 ? 1 : -1) };
          }
          if (cur.row > 0 && cur.row < height - 1 && cur.col > 0 && cur.col < width - 1 && !grid[cur.row][cur.col].terrain.walkable) {
            grid[cur.row][cur.col].terrain = this.terrainTypes.floor;
          }
        }
      }
      return entrance;
    }
    /**
     * Place encounters in the ruins
     * @param {object} interiorMap - Interior map data
     * @param {object} poiData - Original POI data
     * @returns {Array} Array of encounter objects
     */
    placeEncounters(interiorMap, poiData = {}) {
      const floorTiles = interiorMap.hexes.filter(
        (hex) => hex.terrain.walkable && hex.content === null
      );
      const cr = interiorMap.cr;
      let encounterCount = 1;
      if (cr >= 3 && cr <= 5) encounterCount = 2;
      else if (cr > 5) encounterCount = 3;
      const encounters = [];
      for (let i = 0; i < encounterCount && floorTiles.length > 0; i++) {
        const entrance = interiorMap.entrance;
        const farTiles = floorTiles.filter((tile2) => {
          const dist = this.getHexDistance(tile2.col, tile2.row, entrance.col, entrance.row);
          return dist >= 4;
        });
        const tile = farTiles.length > 0 ? this.randomChoice(farTiles) : this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = "encounter";
        }
        encounters.push({
          col: tile.col,
          row: tile.row,
          cr,
          creatures: poiData.creatures || `CR ${cr} guardians`,
          defeated: false,
          discovered: false
        });
      }
      return encounters;
    }
    /**
     * Place loot in the ruins (ancient treasures)
     * @param {object} interiorMap - Interior map data
     * @param {number} partySize - Party size for treasure hoard generation
     * @returns {Array} Array of loot objects
     */
    placeLoot(interiorMap, partySize = 4) {
      const floorTiles = interiorMap.hexes.filter(
        (hex) => hex.terrain.walkable && hex.content === null
      );
      const cr = interiorMap.cr;
      const lootCount = Math.max(3, Math.floor(3 + cr * 0.6));
      const treasureGenerator = new TreasureGenerator();
      const loot = [];
      for (let i = 0; i < lootCount && floorTiles.length > 0; i++) {
        const tile = this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        const isChest = this.random() < 0.25;
        let lootData;
        let contentType;
        if (isChest) {
          lootData = treasureGenerator.generateTreasureHoard(cr, partySize, () => this.random());
          contentType = "chest";
        } else {
          lootData = this.lootGenerator.generateLoot(cr, () => this.random());
          contentType = "loot";
        }
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = contentType;
        }
        loot.push({
          col: tile.col,
          row: tile.row,
          type: contentType,
          gold: lootData.gold,
          items: "items" in lootData ? lootData.items : [],
          consumables: "consumables" in lootData ? lootData.consumables : [],
          rarity: lootData.rarity,
          collected: false,
          discovered: false
        });
      }
      return loot;
    }
    /**
     * Place hazards in the ruins (traps, unstable floors)
     * @param {object} interiorMap - Interior map data
     * @returns {Array} Array of hazard objects
     */
    placeHazards(interiorMap) {
      const floorTiles = interiorMap.hexes.filter(
        (hex) => hex.terrain.walkable && hex.content === null
      );
      const cr = interiorMap.cr;
      const hazardPercentage = 0.15 + this.random() * 0.15;
      const hazardCount = Math.floor(floorTiles.length * hazardPercentage);
      const hazards = [];
      for (let i = 0; i < hazardCount && floorTiles.length > 0; i++) {
        const tile = this.randomChoice(floorTiles);
        const index = floorTiles.indexOf(tile);
        floorTiles.splice(index, 1);
        const hexIndex = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (hexIndex !== -1) {
          interiorMap.hexes[hexIndex].content = "hazard";
        }
        const generatedHazard = this.hazardGenerator.generateHazard(cr, () => this.random());
        hazards.push({
          col: tile.col,
          row: tile.row,
          ...generatedHazard,
          triggered: false,
          discovered: false
        });
      }
      return hazards;
    }
  };

  // src/game/TowerGenerator.ts
  var TowerGenerator = class extends InteriorGenerator {
    lootGenerator;
    hazardGenerator;
    constructor() {
      super();
      this.lootGenerator = new LootGenerator();
      this.hazardGenerator = new HazardGenerator();
      this.terrainTypes.stairsUp = {
        key: "stairsUp",
        name: "Stairs Up",
        color: "#6a5a3a",
        walkable: true
      };
      this.terrainTypes.stairsDown = {
        key: "stairsDown",
        name: "Stairs Down",
        color: "#5a4a2a",
        walkable: true
      };
    }
    /**
     * Generate the ground floor (floor 0) of the tower.
     * Higher floors are generated on demand via generateFloor().
     * @param {number} width - Grid width per floor
     * @param {number} height - Grid height per floor
     * @param {number} cr - Challenge rating
     * @returns {object} Interior map for floor 0
     */
    generate(width, height, cr) {
      const floorCount = Math.min(6, Math.max(3, 3 + Math.floor(cr / 2)));
      const { grid, stairsUpPos } = this.generateFloorGrid(width, height, cr, 0, floorCount);
      const entrance = this.placeEntranceAndExit(grid, stairsUpPos);
      const hexes = this.gridToHexes(grid);
      return {
        seed: this.seed,
        poiType: "tower",
        cr,
        width,
        height,
        hexes,
        encounters: [],
        loot: [],
        hazards: [],
        entrance,
        floorCount,
        currentFloor: 0,
        bossFloor: floorCount - 1
      };
    }
    /**
     * Generate a specific floor of the tower.
     * Called by the stair-transition logic to lazily create higher floors.
     * @param {number} width
     * @param {number} height
     * @param {number} cr
     * @param {number} floorIndex - 0 = ground, floorCount-1 = top
     * @param {number} floorCount - total floors
     * @returns {object} Interior map for this floor
     */
    generateFloor(width, height, cr, floorIndex, floorCount) {
      const { grid, stairsUpPos, stairsDownPos } = this.generateFloorGrid(
        width,
        height,
        cr,
        floorIndex,
        floorCount
      );
      const spawnUp = stairsDownPos;
      const spawnDown = stairsUpPos;
      const hexes = this.gridToHexes(grid);
      const floorCR = cr + Math.floor(floorIndex * 1.5);
      const floorMap = {
        seed: `${this.seed}:floor${floorIndex}`,
        poiType: "tower",
        cr: floorCR,
        width,
        height,
        hexes,
        encounters: [],
        loot: [],
        hazards: [],
        entrance: spawnUp || spawnDown || { col: Math.floor(width / 2), row: Math.floor(height / 2) },
        spawnUp,
        spawnDown,
        floorIndex,
        floorCount,
        bossFloor: floorCount - 1
      };
      floorMap.encounters = this.placeEncountersForFloor(floorMap, floorIndex, floorCount);
      floorMap.loot = this.placeLootForFloor(floorMap, floorIndex, floorCount);
      floorMap.hazards = this.placeHazardsForFloor(floorMap);
      return floorMap;
    }
    /**
     * Build the raw 2D grid for a single tower floor.
     * Returns the grid and positions of stair tiles placed.
     */
    generateFloorGrid(width, height, cr, floorIndex, floorCount) {
      const grid = this.initializeGrid(width, height, this.terrainTypes.wall);
      const sizeModifier = Math.max(0.6, 1 - floorIndex * 0.08);
      const radius = Math.floor((Math.min(width, height) / 2 - 1) * sizeModifier);
      const centerCol = Math.floor(width / 2);
      const centerRow = Math.floor(height / 2);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const dx = col - centerCol;
          const dy = row - centerRow;
          if (Math.sqrt(dx * dx + dy * dy) <= radius) {
            grid[row][col].terrain = this.terrainTypes.floor;
          }
        }
      }
      this.addPillars(grid, 0.15);
      let stairsUpPos = null;
      let stairsDownPos = null;
      if (floorIndex > 0) {
        const preferredCol = Math.max(1, centerCol - Math.floor(radius * 0.55));
        stairsDownPos = this._placeStairTile(
          grid,
          width,
          height,
          preferredCol,
          centerRow,
          this.terrainTypes.stairsDown,
          "stairsDown",
          floorIndex - 1
        );
      }
      if (floorIndex < floorCount - 1) {
        const preferredCol = Math.min(width - 2, centerCol + Math.floor(radius * 0.55));
        stairsUpPos = this._placeStairTile(
          grid,
          width,
          height,
          preferredCol,
          centerRow,
          this.terrainTypes.stairsUp,
          "stairsUp",
          floorIndex + 1
        );
      }
      return { grid, stairsUpPos, stairsDownPos };
    }
    /**
     * Place a single stair tile at the preferred position, falling back to the
     * nearest free floor tile (by Manhattan distance) if the preferred spot is
     * occupied or is a wall.
     *
     * @param {Array}  grid
     * @param {number} width
     * @param {number} height
     * @param {number} preferredCol
     * @param {number} preferredRow
     * @param {object} terrainType   - stairsUp or stairsDown terrain object
     * @param {string} contentKey    - 'stairsUp' or 'stairsDown'
     * @param {number} connectedFloor
     * @returns {{ col, row } | null}
     */
    _placeStairTile(grid, width, height, preferredCol, preferredRow, terrainType, contentKey, connectedFloor) {
      const candidates = [];
      for (let row2 = 1; row2 < height - 1; row2++) {
        for (let col2 = 1; col2 < width - 1; col2++) {
          if (grid[row2][col2].terrain.key === "floor" && !grid[row2][col2].content) {
            candidates.push({
              col: col2,
              row: row2,
              d: Math.abs(col2 - preferredCol) + Math.abs(row2 - preferredRow)
            });
          }
        }
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.d - b.d);
      const { col, row } = candidates[0];
      grid[row][col].terrain = terrainType;
      grid[row][col].content = contentKey;
      grid[row][col].connectedFloor = connectedFloor;
      return { col, row };
    }
    /**
     * Place entrance + exit on the ground floor.
     * The entrance is on the opposite side from the stairs up.
     * Returns the entrance position.
     */
    placeEntranceAndExit(grid, stairsUpPos) {
      const height = grid.length;
      const width = grid[0].length;
      const candidates = [];
      for (let row = 1; row < height - 1; row++) {
        for (let col = 1; col < width - 1; col++) {
          if (grid[row][col].terrain.key === "floor" && !grid[row][col].content) {
            if (!stairsUpPos || col <= Math.floor(width / 2)) {
              candidates.push({ col, row });
            }
          }
        }
      }
      if (candidates.length === 0) {
        for (let row = 1; row < height - 1; row++) {
          for (let col = 1; col < width - 1; col++) {
            if (grid[row][col].terrain.key === "floor") candidates.push({ col, row });
          }
        }
      }
      const entrance = candidates.length > 0 ? this.randomChoice(candidates) : { col: Math.floor(width / 2), row: Math.floor(height / 2) };
      grid[entrance.row][entrance.col].terrain = this.terrainTypes.entrance;
      grid[entrance.row][entrance.col].content = "exit";
      return entrance;
    }
    /**
     * Add pillars to a single floor grid.
     */
    addPillars(grid, percentage) {
      const floorTiles = [];
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          if (grid[row][col].terrain.key === "floor" && !grid[row][col].content) {
            floorTiles.push({ col, row });
          }
        }
      }
      const pillarCount = Math.floor(floorTiles.length * percentage);
      for (let i = 0; i < pillarCount; i++) {
        const tile = this.randomChoice(floorTiles);
        if (!tile) break;
        floorTiles.splice(floorTiles.indexOf(tile), 1);
        grid[tile.row][tile.col].terrain = this.terrainTypes.wall;
      }
    }
    // ── placeEncounters / placeLoot / placeHazards (whole-map versions) ────────
    // Used for the ground floor via the standard pipeline in useHexInteraction
    placeEncounters(interiorMap, poiData = {}) {
      return this.placeEncountersForFloor(interiorMap, 0, interiorMap.floorCount, poiData);
    }
    placeLoot(interiorMap, partySize = 4) {
      return this.placeLootForFloor(interiorMap, 0, interiorMap.floorCount, partySize);
    }
    placeHazards(interiorMap) {
      return this.placeHazardsForFloor(interiorMap);
    }
    // ── Per-floor content placement ────────────────────────────────────────────
    placeEncountersForFloor(interiorMap, floorIndex, floorCount, poiData = {}) {
      const floorTiles = interiorMap.hexes.filter((h) => h.terrain.walkable && h.content === null);
      const cr = interiorMap.cr;
      const isBossFloor = floorIndex === floorCount - 1;
      const encounterCount = isBossFloor ? 1 : cr >= 5 ? 2 : 1;
      const encounters = [];
      for (let i = 0; i < encounterCount && floorTiles.length > 0; i++) {
        const entrance = interiorMap.entrance;
        const farTiles = floorTiles.filter(
          (t) => this.getHexDistance(t.col, t.row, entrance.col, entrance.row) >= 3
        );
        const tile = farTiles.length > 0 ? this.randomChoice(farTiles) : this.randomChoice(floorTiles);
        floorTiles.splice(floorTiles.indexOf(tile), 1);
        const idx = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (idx !== -1) interiorMap.hexes[idx].content = "encounter";
        const encounterCR = isBossFloor ? Math.ceil(cr * 1.5) : cr;
        encounters.push({
          col: tile.col,
          row: tile.row,
          floor: floorIndex,
          cr: encounterCR,
          creatures: isBossFloor ? `Boss: CR ${encounterCR} ${poiData.creatures || "guardian"}` : poiData.creatures || `CR ${encounterCR} enemies`,
          defeated: false,
          discovered: false,
          isBoss: isBossFloor
        });
      }
      return encounters;
    }
    placeLootForFloor(interiorMap, floorIndex, floorCount, partySize = 4) {
      const floorTiles = interiorMap.hexes.filter((h) => h.terrain.walkable && h.content === null);
      const cr = interiorMap.cr;
      const lootCount = Math.max(1, Math.floor(1 + cr * 0.5 + floorIndex * 0.5));
      const treasureGenerator = new TreasureGenerator();
      const loot = [];
      for (let i = 0; i < lootCount && floorTiles.length > 0; i++) {
        const tile = this.randomChoice(floorTiles);
        floorTiles.splice(floorTiles.indexOf(tile), 1);
        const isChest = this.random() < 0.3 || floorIndex === floorCount - 1;
        let lootData;
        if (isChest) {
          lootData = treasureGenerator.generateTreasureHoard(cr, partySize, () => this.random());
        } else {
          lootData = this.lootGenerator.generateLoot(cr, () => this.random());
        }
        const idx = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (idx !== -1) interiorMap.hexes[idx].content = isChest ? "chest" : "loot";
        loot.push({
          col: tile.col,
          row: tile.row,
          floor: floorIndex,
          type: isChest ? "chest" : "loot",
          gold: lootData.gold,
          items: "items" in lootData ? lootData.items : [],
          consumables: "consumables" in lootData ? lootData.consumables : [],
          rarity: lootData.rarity,
          collected: false,
          discovered: false
        });
      }
      return loot;
    }
    placeHazardsForFloor(interiorMap) {
      const floorTiles = interiorMap.hexes.filter((h) => h.terrain.walkable && h.content === null);
      const cr = interiorMap.cr;
      const hazardPercentage = 0.08 + this.random() * 0.1;
      const hazardCount = Math.floor(floorTiles.length * hazardPercentage);
      const hazards = [];
      for (let i = 0; i < hazardCount && floorTiles.length > 0; i++) {
        const tile = this.randomChoice(floorTiles);
        floorTiles.splice(floorTiles.indexOf(tile), 1);
        const idx = interiorMap.hexes.findIndex((h) => h.col === tile.col && h.row === tile.row);
        if (idx !== -1) interiorMap.hexes[idx].content = "hazard";
        hazards.push({
          col: tile.col,
          row: tile.row,
          ...this.hazardGenerator.generateHazard(cr, () => this.random()),
          triggered: false,
          discovered: false
        });
      }
      return hazards;
    }
  };

  // src/game/TownGenerator.ts
  var TownGenerator = class extends InteriorGenerator {
    buildingTypes;
    constructor() {
      super();
      this.terrainTypes = {
        ...this.terrainTypes,
        road: {
          key: "road",
          name: "Cobblestone Road",
          color: "#8B7355",
          walkable: true
        },
        grass: {
          key: "grass",
          name: "Grass",
          color: "#567d46",
          walkable: true
        },
        townSquare: {
          key: "townSquare",
          name: "Town Square",
          color: "#a89968",
          walkable: true
        },
        building: {
          key: "building",
          name: "Building",
          color: "#8B4513",
          walkable: false
        },
        buildingEntrance: {
          key: "buildingEntrance",
          name: "Building Entrance",
          color: "#654321",
          walkable: true,
          isInteractive: true
        },
        gate: {
          key: "gate",
          name: "Town Gate",
          color: "#5C4033",
          walkable: true
        },
        fence: {
          key: "fence",
          name: "Fence",
          color: "#4a3f35",
          walkable: false
        }
      };
      this.buildingTypes = {
        inn: {
          key: "inn",
          name: "The Weary Traveler Inn",
          icon: "\u{1F3E8}",
          size: { width: 3, height: 3 },
          entranceOffset: { col: 1, row: 2 }
          // Bottom center
        },
        shop: {
          key: "shop",
          name: "General Store",
          icon: "\u{1F3EA}",
          size: { width: 3, height: 2 },
          entranceOffset: { col: 1, row: 1 }
          // Bottom center
        },
        questBoard: {
          key: "questBoard",
          name: "Quest Board",
          icon: "\u{1F4CB}",
          size: { width: 2, height: 2 },
          entranceOffset: { col: 0, row: 1 }
          // Bottom left
        },
        blacksmith: {
          key: "blacksmith",
          name: "Blacksmith",
          icon: "\u2692\uFE0F",
          size: { width: 3, height: 2 },
          entranceOffset: { col: 1, row: 1 }
        },
        temple: {
          key: "temple",
          name: "Temple",
          icon: "\u26EA",
          size: { width: 4, height: 3 },
          entranceOffset: { col: 2, row: 2 }
        },
        house: {
          key: "house",
          name: "House",
          icon: "\u{1F3E0}",
          size: { width: 2, height: 2 },
          entranceOffset: { col: 0, row: 1 }
        },
        tent: {
          key: "tent",
          name: "Tent",
          icon: "\u26FA",
          size: { width: 2, height: 1 },
          entranceOffset: { col: 0, row: 0 }
        },
        campfire: {
          key: "campfire",
          name: "Campfire",
          icon: "\u{1F525}",
          size: { width: 1, height: 1 },
          entranceOffset: { col: 0, row: 0 }
        },
        supplyWagon: {
          key: "supplyWagon",
          name: "Supply Wagon",
          icon: "\u{1F6D2}",
          size: { width: 2, height: 1 },
          entranceOffset: { col: 0, row: 0 }
        },
        market: {
          key: "market",
          name: "Market",
          icon: "\u{1F3EC}",
          size: { width: 3, height: 2 },
          entranceOffset: { col: 1, row: 1 }
        },
        barracks: {
          key: "barracks",
          name: "Barracks",
          icon: "\u{1F6E1}\uFE0F",
          size: { width: 4, height: 2 },
          entranceOffset: { col: 2, row: 1 }
        }
      };
    }
    /**
     * Generate a settlement interior map (routed by settlement size)
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @param {object} townData - Settlement metadata (name, settlementSize, etc.)
     * @returns {object} Interior map data
     */
    generate(width, height, townData = {}) {
      const settlementSize = townData.settlementSize || "town";
      switch (settlementSize) {
        case "camp":
          return this.generateCampLayout(width, height, townData);
        case "village":
          return this.generateVillageLayout(width, height, townData);
        case "town":
          return this.generateTownLayout(width, height, townData);
        case "city":
          return this.generateCityLayout(width, height, townData);
        case "metropolis":
          return this.generateMetropolisLayout(width, height, townData);
        default:
          return this.generateTownLayout(width, height, townData);
      }
    }
    /**
     * Generate a camp layout (smallest settlement)
     * @param {number} width - Map width (12×10)
     * @param {number} height - Map height
     * @param {object} townData - Camp metadata
     * @returns {object} Interior map data
     */
    generateCampLayout(width, height, _townData) {
      const grid = this.initializeGrid(width, height, this.terrainTypes.grass);
      const centerCol = Math.floor(width / 2);
      const centerRow = Math.floor(height / 2);
      const buildings = [];
      const campfire = this.placeBuilding(grid, this.buildingTypes.campfire, centerCol, centerRow);
      if (campfire) buildings.push(campfire);
      const numTents = this.randomInt(2, 3);
      const tentPositions = [
        { col: centerCol - 3, row: centerRow - 2 },
        { col: centerCol + 2, row: centerRow - 2 },
        { col: centerCol - 1, row: centerRow + 2 }
      ];
      for (let i = 0; i < numTents && i < tentPositions.length; i++) {
        const tent = this.placeBuilding(
          grid,
          this.buildingTypes.tent,
          tentPositions[i].col,
          tentPositions[i].row
        );
        if (tent) buildings.push(tent);
      }
      const wagon = this.placeBuilding(
        grid,
        this.buildingTypes.supplyWagon,
        centerCol + 3,
        centerRow + 1
      );
      if (wagon) buildings.push(wagon);
      const questBoard = this.placeBuilding(
        grid,
        this.buildingTypes.questBoard,
        centerCol - 4,
        centerRow + 1
      );
      if (questBoard) buildings.push(questBoard);
      const entranceCol = centerCol;
      const entranceRow = height - 2;
      grid[entranceRow][entranceCol].terrain = this.terrainTypes.gate;
      grid[entranceRow][entranceCol].content = "entrance";
      const hexes = this.gridToHexes(grid);
      const entrance = { col: entranceCol, row: entranceRow };
      const centerSquare = { col: centerCol, row: centerRow, radius: 1 };
      return {
        seed: this.seed,
        poiType: "camp",
        width,
        height,
        hexes,
        buildings,
        encounters: [],
        loot: [],
        hazards: [],
        entrance,
        centerSquare
      };
    }
    /**
     * Generate a village layout (small settlement)
     * @param {number} width - Map width (18×14)
     * @param {number} height - Map height
     * @param {object} townData - Village metadata
     * @returns {object} Interior map data
     */
    generateVillageLayout(width, height, _townData) {
      const grid = this.initializeGrid(width, height, this.terrainTypes.grass);
      this.generateTownWalls(grid);
      const centerCol = Math.floor(width / 2);
      const centerRow = Math.floor(height / 2);
      const buildings = [];
      const squareRadius = 1;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const distance = this.getHexDistance(col, row, centerCol, centerRow);
          if (distance <= squareRadius) {
            grid[row][col].terrain = this.terrainTypes.townSquare;
          }
        }
      }
      for (let col = 0; col < width; col++) {
        if (grid[centerRow][col].terrain.key !== "townSquare") {
          grid[centerRow][col].terrain = this.terrainTypes.road;
        }
      }
      const inn = this.placeBuilding(grid, this.buildingTypes.inn, centerCol - 5, centerRow - 3);
      if (inn) buildings.push(inn);
      const shop = this.placeBuilding(grid, this.buildingTypes.shop, centerCol + 3, centerRow - 3);
      if (shop) buildings.push(shop);
      const questBoard = this.placeBuilding(
        grid,
        this.buildingTypes.questBoard,
        centerCol - 1,
        centerRow - 4
      );
      if (questBoard) buildings.push(questBoard);
      const numHouses = this.randomInt(2, 4);
      let housesPlaced = 0;
      let attempts = 0;
      while (housesPlaced < numHouses && attempts < 30) {
        attempts++;
        const col = this.randomInt(3, width - 4);
        const row = this.randomInt(3, height - 4);
        if (this.getHexDistance(col, row, centerCol, centerRow) < 3) {
          continue;
        }
        const house = this.placeBuilding(grid, this.buildingTypes.house, col, row);
        if (house) {
          buildings.push(house);
          housesPlaced++;
        }
      }
      this.placeGate(grid);
      const hexes = this.gridToHexes(grid);
      const entrance = this.findEntrance(grid);
      const centerSquare = { col: centerCol, row: centerRow, radius: squareRadius };
      return {
        seed: this.seed,
        poiType: "village",
        width,
        height,
        hexes,
        buildings,
        encounters: [],
        loot: [],
        hazards: [],
        entrance,
        centerSquare
      };
    }
    /**
     * Generate a town layout (original logic)
     * @param {number} width - Map width (typically 20-25)
     * @param {number} height - Map height (typically 15-20)
     * @param {object} townData - Town metadata
     * @returns {object} Interior map data
     */
    generateTownLayout(width, height, townData) {
      const grid = this.initializeGrid(width, height, this.terrainTypes.grass);
      this.generateTownWalls(grid);
      const centerSquare = this.generateTownSquare(grid);
      this.generateMainRoads(grid, centerSquare);
      const buildings = this.placeBuildings(grid, townData);
      this.generateSecondaryRoads(grid, buildings);
      this.placeGate(grid);
      const hexes = this.gridToHexes(grid);
      const entrance = this.findEntrance(grid);
      return {
        seed: this.seed,
        poiType: "town",
        width,
        height,
        hexes,
        buildings,
        // Building metadata with positions
        encounters: [],
        // Towns have no random encounters
        loot: [],
        // Towns have no random loot
        hazards: [],
        // Towns have no hazards
        entrance,
        centerSquare
      };
    }
    /**
     * Generate a city or metropolis layout (larger settlement)
     * @param {number} width - Map width (30×24 for city, 36×30 for metropolis)
     * @param {number} height - Map height
     * @param {object} townData - City metadata
     * @returns {object} Interior map data
     */
    generateCityLayout(width, height, townData) {
      const isMetropolis = townData.settlementSize === "metropolis";
      const grid = this.initializeGrid(width, height, this.terrainTypes.grass);
      this.generateTownWalls(grid);
      const centerCol = Math.floor(width / 2);
      const centerRow = Math.floor(height / 2);
      const squareRadius = isMetropolis ? 3 : 2;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const distance = this.getHexDistance(col, row, centerCol, centerRow);
          if (distance <= squareRadius) {
            grid[row][col].terrain = this.terrainTypes.townSquare;
          }
        }
      }
      for (let col = 0; col < width; col += 6) {
        for (let row = 0; row < height; row++) {
          if (grid[row][col].terrain.key !== "townSquare" && grid[row][col].terrain.key !== "fence") {
            grid[row][col].terrain = this.terrainTypes.road;
          }
        }
      }
      for (let row = 0; row < height; row += 6) {
        for (let col = 0; col < width; col++) {
          if (grid[row][col].terrain.key !== "townSquare" && grid[row][col].terrain.key !== "fence") {
            grid[row][col].terrain = this.terrainTypes.road;
          }
        }
      }
      for (let col = 0; col < width; col++) {
        if (grid[centerRow][col].terrain.key !== "townSquare") {
          grid[centerRow][col].terrain = this.terrainTypes.road;
        }
      }
      for (let row = 0; row < height; row++) {
        if (grid[row][centerCol].terrain.key !== "townSquare") {
          grid[row][centerCol].terrain = this.terrainTypes.road;
        }
      }
      const buildings = [];
      const essentialPositions = [
        { type: this.buildingTypes.inn, position: { col: centerCol - 8, row: centerRow - 6 } },
        { type: this.buildingTypes.shop, position: { col: centerCol + 5, row: centerRow - 6 } },
        { type: this.buildingTypes.questBoard, position: { col: centerCol - 1, row: centerRow - 7 } },
        { type: this.buildingTypes.blacksmith, position: { col: centerCol - 8, row: centerRow + 5 } },
        { type: this.buildingTypes.temple, position: { col: centerCol + 4, row: centerRow + 5 } },
        { type: this.buildingTypes.market, position: { col: centerCol - 12, row: centerRow - 2 } },
        { type: this.buildingTypes.barracks, position: { col: centerCol + 8, row: centerRow - 2 } }
      ];
      if (isMetropolis) {
        essentialPositions.push(
          { type: this.buildingTypes.inn, position: { col: centerCol - 14, row: centerRow + 8 } },
          { type: this.buildingTypes.shop, position: { col: centerCol + 10, row: centerRow + 8 } }
        );
      }
      for (const { type, position } of essentialPositions) {
        const building = this.placeBuilding(grid, type, position.col, position.row);
        if (building) {
          buildings.push(building);
        }
      }
      const numHouses = isMetropolis ? this.randomInt(12, 18) : this.randomInt(8, 12);
      let housesPlaced = 0;
      let attempts = 0;
      while (housesPlaced < numHouses && attempts < 100) {
        attempts++;
        const col = this.randomInt(3, width - 4);
        const row = this.randomInt(3, height - 4);
        if (this.getHexDistance(col, row, centerCol, centerRow) < squareRadius + 3) {
          continue;
        }
        const house = this.placeBuilding(grid, this.buildingTypes.house, col, row);
        if (house) {
          buildings.push(house);
          housesPlaced++;
        }
      }
      this.generateSecondaryRoads(grid, buildings);
      this.placeGate(grid);
      const hexes = this.gridToHexes(grid);
      const entrance = this.findEntrance(grid);
      const centerSquare = { col: centerCol, row: centerRow, radius: squareRadius };
      return {
        seed: this.seed,
        poiType: isMetropolis ? "metropolis" : "city",
        width,
        height,
        hexes,
        buildings,
        encounters: [],
        loot: [],
        hazards: [],
        entrance,
        centerSquare
      };
    }
    /**
     * Generate a metropolis layout (alias to city with larger dimensions)
     * @param {number} width - Map width (36×30)
     * @param {number} height - Map height
     * @param {object} townData - Metropolis metadata
     * @returns {object} Interior map data
     */
    generateMetropolisLayout(width, height, townData) {
      return this.generateCityLayout(width, height, townData);
    }
    /**
     * Generate town walls/fence around perimeter
     * @param {Array} grid - 2D grid
     */
    generateTownWalls(grid) {
      const height = grid.length;
      const width = grid[0].length;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
            grid[row][col].terrain = this.terrainTypes.fence;
          }
        }
      }
    }
    /**
     * Generate central town square
     * @param {Array} grid - 2D grid
     * @returns {object} Center square coordinates {col, row, radius}
     */
    generateTownSquare(grid) {
      const height = grid.length;
      const width = grid[0].length;
      const centerCol = Math.floor(width / 2);
      const centerRow = Math.floor(height / 2);
      const radius = 2;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const distance = this.getHexDistance(col, row, centerCol, centerRow);
          if (distance <= radius) {
            grid[row][col].terrain = this.terrainTypes.townSquare;
          }
        }
      }
      return { col: centerCol, row: centerRow, radius };
    }
    /**
     * Generate main roads radiating from town square
     * @param {Array} grid - 2D grid
     * @param {object} centerSquare - Center square data
     */
    generateMainRoads(grid, centerSquare) {
      const height = grid.length;
      const width = grid[0].length;
      const { col: centerCol, row: centerRow } = centerSquare;
      for (let col = 0; col < width; col++) {
        if (grid[centerRow][col].terrain.key !== "townSquare") {
          grid[centerRow][col].terrain = this.terrainTypes.road;
        }
      }
      for (let row = 0; row < height; row++) {
        if (grid[row][centerCol].terrain.key !== "townSquare") {
          grid[row][centerCol].terrain = this.terrainTypes.road;
        }
      }
    }
    /**
     * Place buildings in the town
     * @param {Array} grid - 2D grid
     * @param {object} townData - Town metadata
     * @returns {Array} Array of placed buildings with metadata
     */
    placeBuildings(grid, _townData) {
      const buildings = [];
      const height = grid.length;
      const width = grid[0].length;
      const centerCol = Math.floor(width / 2);
      const centerRow = Math.floor(height / 2);
      const essentialBuildings = [
        { type: this.buildingTypes.inn, position: { col: centerCol - 6, row: centerRow - 4 } },
        { type: this.buildingTypes.shop, position: { col: centerCol + 4, row: centerRow - 4 } },
        { type: this.buildingTypes.questBoard, position: { col: centerCol - 1, row: centerRow - 5 } },
        { type: this.buildingTypes.blacksmith, position: { col: centerCol - 6, row: centerRow + 3 } },
        { type: this.buildingTypes.temple, position: { col: centerCol + 3, row: centerRow + 3 } }
      ];
      for (const { type, position } of essentialBuildings) {
        const building = this.placeBuilding(grid, type, position.col, position.row);
        if (building) {
          buildings.push(building);
        }
      }
      const numHouses = this.randomInt(3, 6);
      let attempts = 0;
      let housesPlaced = 0;
      while (housesPlaced < numHouses && attempts < 50) {
        attempts++;
        const col = this.randomInt(3, width - 5);
        const row = this.randomInt(3, height - 5);
        if (this.getHexDistance(col, row, centerCol, centerRow) < 4) {
          continue;
        }
        const house = this.placeBuilding(grid, this.buildingTypes.house, col, row);
        if (house) {
          buildings.push(house);
          housesPlaced++;
        }
      }
      return buildings;
    }
    /**
     * Place a single building on the grid
     * @param {Array} grid - 2D grid
     * @param {object} buildingType - Building type metadata
     * @param {number} startCol - Top-left column
     * @param {number} startRow - Top-left row
     * @returns {object|null} Building data or null if placement failed
     */
    placeBuilding(grid, buildingType, startCol, startRow) {
      const { width: bWidth, height: bHeight } = buildingType.size;
      const height = grid.length;
      const width = grid[0].length;
      for (let r = 0; r < bHeight; r++) {
        for (let c = 0; c < bWidth; c++) {
          const col = startCol + c;
          const row = startRow + r;
          if (col < 0 || col >= width || row < 0 || row >= height) {
            return null;
          }
          const terrain = grid[row][col].terrain;
          if (terrain.key !== "grass" && terrain.key !== "road") {
            return null;
          }
        }
      }
      for (let r = 0; r < bHeight; r++) {
        for (let c = 0; c < bWidth; c++) {
          const col = startCol + c;
          const row = startRow + r;
          grid[row][col].terrain = this.terrainTypes.building;
          grid[row][col].buildingType = buildingType.key;
        }
      }
      const entranceCol = startCol + buildingType.entranceOffset.col;
      const entranceRow = startRow + buildingType.entranceOffset.row;
      grid[entranceRow][entranceCol].terrain = this.terrainTypes.buildingEntrance;
      grid[entranceRow][entranceCol].buildingType = buildingType.key;
      return {
        type: buildingType.key,
        name: buildingType.name,
        icon: buildingType.icon,
        col: startCol,
        row: startRow,
        width: bWidth,
        height: bHeight,
        entrance: { col: entranceCol, row: entranceRow }
      };
    }
    /**
     * Generate secondary roads connecting buildings
     * @param {Array} grid - 2D grid
     * @param {Array} buildings - Placed buildings
     */
    generateSecondaryRoads(grid, buildings) {
      for (const building of buildings) {
        const { entrance } = building;
        this.connectToNearestRoad(grid, entrance.col, entrance.row);
      }
    }
    /**
     * Connect a point to the nearest road
     * @param {Array} grid - 2D grid
     * @param {number} startCol
     * @param {number} startRow
     */
    connectToNearestRoad(grid, startCol, startRow) {
      const height = grid.length;
      const width = grid[0].length;
      const centerCol = Math.floor(width / 2);
      const centerRow = Math.floor(height / 2);
      const current = { col: startCol, row: startRow };
      while (grid[current.row][current.col].terrain.key !== "road" && grid[current.row][current.col].terrain.key !== "townSquare") {
        const dx = centerCol - current.col;
        const dy = centerRow - current.row;
        if (Math.abs(dx) > Math.abs(dy) && dx !== 0) {
          current.col += dx > 0 ? 1 : -1;
        } else if (dy !== 0) {
          current.row += dy > 0 ? 1 : -1;
        } else {
          break;
        }
        if (current.col < 0 || current.col >= width || current.row < 0 || current.row >= height) {
          break;
        }
        const currentTerrain = grid[current.row][current.col].terrain;
        if (currentTerrain.key === "grass") {
          grid[current.row][current.col].terrain = this.terrainTypes.road;
        } else if (currentTerrain.key === "building" || currentTerrain.key === "fence") {
          break;
        }
      }
    }
    /**
     * Place town gate (entrance/exit)
     * @param {Array} grid - 2D grid
     */
    placeGate(grid) {
      const height = grid.length;
      const width = grid[0].length;
      const gateCol = Math.floor(width / 2);
      const gateRow = height - 1;
      grid[gateRow][gateCol].terrain = this.terrainTypes.gate;
      grid[gateRow][gateCol].content = "entrance";
    }
    /**
     * Find entrance hex
     * @param {Array} grid - 2D grid
     * @returns {object} {col, row}
     */
    findEntrance(grid) {
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          if (grid[row][col].content === "entrance") {
            return { col, row };
          }
        }
      }
      return { col: Math.floor(grid[0].length / 2), row: grid.length - 1 };
    }
    /**
     * No encounters in towns (override parent method)
     */
    placeEncounters(_interiorMap, _poi) {
      return [];
    }
    /**
     * No loot in towns (override parent method)
     */
    placeLoot(_interiorMap) {
      return [];
    }
    /**
     * No hazards in towns (override parent method)
     */
    placeHazards(_interiorMap) {
      return [];
    }
  };

  // texture-previews/interiors-entry.ts
  window.Interiors = { CaveGenerator, DungeonGenerator, RuinsGenerator, TowerGenerator, TownGenerator };
})();
