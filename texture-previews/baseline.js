"use strict";
(() => {
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

  // src/utils/hexTextureGenerator.ts
  var PATTERN_VARIANTS = 4;
  var TERRAIN_TONES = {
    grassland: ["#4c6b35", "#56793f", "#618748"],
    forest: ["#33492a", "#3d5930", "#466637"],
    hills: ["#5f6140", "#6e7045", "#7c7e4e"],
    mountains: ["#5b574e", "#6b675e", "#7b766b"],
    water: ["#3f5a79", "#4a698c", "#577a9e"],
    river: ["#4d6c8e", "#5a7da3", "#6b8fb5"],
    desert: ["#b9a276", "#c9b385", "#d6c294"],
    swamp: ["#40492e", "#4c5a36", "#56653e"],
    tundra: ["#b4bbc0", "#c7cdd1", "#d5dadd"]
  };
  var HexTextureGenerator = class {
    noise;
    patternCache;
    constructor(noise) {
      this.noise = noise;
      this.patternCache = /* @__PURE__ */ new Map();
      logger_default.render.debug("HexTextureGenerator initialized");
    }
    getPattern(ctx, terrainType, hexSize, col = 0, row = 0) {
      const variant = Math.abs(col * 73856093 ^ row * 19349663) % PATTERN_VARIANTS;
      const key = `${terrainType.key}_${hexSize}_${variant}`;
      if (!this.patternCache.has(key)) {
        const seedOffset = variant * 7919;
        const pattern = this.createPattern(ctx, terrainType, hexSize, seedOffset);
        this.patternCache.set(key, pattern);
      }
      return this.patternCache.get(key);
    }
    createPattern(ctx, terrainType, hexSize, seedOffset = 0) {
      const patternCanvas = document.createElement("canvas");
      const patternSize = Math.max(32, hexSize);
      patternCanvas.width = patternSize;
      patternCanvas.height = patternSize;
      const pctx = patternCanvas.getContext("2d");
      if (!pctx) return null;
      pctx.imageSmoothingEnabled = false;
      switch (terrainType.key) {
        case "grassland":
          this.drawGrasslandPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "forest":
          this.drawForestPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "mountains":
          this.drawMountainsPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "hills":
          this.drawHillsPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "water":
          this.drawWaterPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "river":
          this.drawRiverPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "desert":
          this.drawDesertPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "swamp":
          this.drawSwampPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        case "tundra":
          this.drawTundraPattern(pctx, patternSize, terrainType.color, seedOffset);
          break;
        default:
          this.drawDefaultPattern(pctx, patternSize, terrainType.color, seedOffset);
      }
      return ctx.createPattern(patternCanvas, "repeat");
    }
    // ─── Shared helpers ────────────────────────────────────────────────────────
    /** Deterministic 0..1 hash of an integer texel coordinate + seed. */
    hash(x, y, seed) {
      const h = Math.sin(x * 127.1 + y * 311.7 + seed * 0.137) * 43758.5453;
      return h - Math.floor(h);
    }
    /** Resolve the tone ramp for a terrain key, deriving one from the base color
     *  for unknown keys so custom terrains still get the dithered treatment. */
    tones(key, baseColor) {
      return TERRAIN_TONES[key] ?? [this.shade(baseColor, 0.85), baseColor, this.shade(baseColor, 1.12)];
    }
    /** Multiply a #rrggbb color's channels by a factor. */
    shade(hex, factor) {
      const n = parseInt(hex.replace("#", ""), 16);
      const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
      const r = clamp((n >> 16 & 255) * factor);
      const g = clamp((n >> 8 & 255) * factor);
      const b = clamp((n & 255) * factor);
      return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
    }
    /**
     * The OSRS ground base: chunky texel dithering between three tones.
     * Blotch shape comes from low-frequency noise; per-texel grain from the
     * hash, so the result reads as hand-placed pixels rather than a gradient.
     */
    ditherBase(ctx, size, tones, seedOffset, texel = 3, bandPhase = 0) {
      ctx.fillStyle = tones[1];
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += texel) {
        for (let x = 0; x < size; x += texel) {
          const tx = x / texel;
          const ty = y / texel;
          const blotch = this.noise.noise2D((tx + seedOffset % 977) * 0.45, (ty + seedOffset % 769) * 0.45) * 0.5 + 0.5;
          const grain = this.hash(tx, ty, seedOffset);
          let v = blotch * 0.65 + grain * 0.35;
          if (bandPhase > 0) {
            v += Math.sin(ty * bandPhase + seedOffset * 0.01) * 0.12;
          }
          if (v < 0.38) {
            ctx.fillStyle = tones[0];
            ctx.fillRect(x, y, texel, texel);
          } else if (v > 0.72) {
            ctx.fillStyle = tones[2];
            ctx.fillRect(x, y, texel, texel);
          }
        }
      }
    }
    /** Place n deterministic points inside the tile (with a small margin). */
    scatter(size, n, seedOffset, salt) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        pts.push({
          x: 2 + this.hash(i * 3 + 1, salt, seedOffset) * (size - 4),
          y: 2 + this.hash(salt, i * 5 + 2, seedOffset) * (size - 4),
          r: this.hash(i * 7 + 3, i + salt, seedOffset)
        });
      }
      return pts;
    }
    // ─── Terrain patterns ──────────────────────────────────────────────────────
    drawGrasslandPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("grassland", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset);
      ctx.strokeStyle = "#3c5529";
      ctx.lineWidth = 1;
      for (const p of this.scatter(size, 7, seedOffset, 11)) {
        const h = 2 + p.r * 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 1, p.y - h);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - h - 1);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 1, p.y - h);
        ctx.stroke();
      }
      for (const p of this.scatter(size, 2, seedOffset, 23)) {
        if (p.r < 0.55) continue;
        ctx.fillStyle = "#d8c84a";
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        ctx.fillStyle = "#8a7430";
        ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 2, 1, 1);
      }
    }
    drawForestPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("forest", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset);
      for (const p of this.scatter(size, 5, seedOffset, 31)) {
        const r = 3 + p.r * 3;
        ctx.fillStyle = "rgba(16, 26, 12, 0.45)";
        ctx.beginPath();
        ctx.ellipse(p.x + 1, p.y + 1.5, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2e4423";
        ctx.strokeStyle = "#1d2d16";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i + p.r * 2;
          const px = p.x + Math.cos(a) * r;
          const py = p.y + Math.sin(a) * r * 0.85;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#46663a";
        ctx.beginPath();
        ctx.moveTo(p.x - r * 0.5, p.y - r * 0.2);
        ctx.lineTo(p.x - r * 0.05, p.y - r * 0.75);
        ctx.lineTo(p.x + r * 0.35, p.y - r * 0.3);
        ctx.lineTo(p.x - r * 0.1, p.y + r * 0.05);
        ctx.closePath();
        ctx.fill();
      }
    }
    drawMountainsPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("mountains", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset);
      for (const p of this.scatter(size, 4, seedOffset, 41)) {
        const s = 3 + p.r * 4;
        const peakX = p.x;
        const peakY = p.y - s;
        ctx.fillStyle = "#7d786c";
        ctx.beginPath();
        ctx.moveTo(peakX, peakY);
        ctx.lineTo(p.x - s, p.y + s * 0.6);
        ctx.lineTo(p.x, p.y + s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#504c44";
        ctx.beginPath();
        ctx.moveTo(peakX, peakY);
        ctx.lineTo(p.x, p.y + s * 0.4);
        ctx.lineTo(p.x + s, p.y + s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#36332d";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y + s * 0.6);
        ctx.lineTo(peakX, peakY);
        ctx.lineTo(p.x + s, p.y + s * 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = "#4b4840";
      for (const p of this.scatter(size, 6, seedOffset, 47)) {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      }
    }
    drawHillsPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("hills", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset);
      ctx.strokeStyle = "#57523a";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const baseY = this.hash(i * 13 + 1, 3, seedOffset) * size;
        const w = size * (0.35 + this.hash(i, 9, seedOffset) * 0.3);
        const cx = this.hash(7, i * 11 + 2, seedOffset) * size;
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, baseY);
        ctx.lineTo(cx - w / 6, baseY - 3);
        ctx.lineTo(cx + w / 6, baseY - 3);
        ctx.lineTo(cx + w / 2, baseY);
        ctx.stroke();
      }
      ctx.strokeStyle = "#4c5a32";
      ctx.lineWidth = 1;
      for (const p of this.scatter(size, 4, seedOffset, 53)) {
        const h = 2 + p.r * 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 1, p.y - h);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 1, p.y - h);
        ctx.stroke();
      }
    }
    drawWaterPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("water", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset, 3, 0.9);
      ctx.strokeStyle = "#9fb6cd";
      ctx.lineWidth = 1;
      for (const p of this.scatter(size, 3, seedOffset, 61)) {
        const w = 3 + p.r * 3;
        ctx.beginPath();
        ctx.moveTo(p.x - w, p.y);
        ctx.lineTo(p.x - w / 3, p.y - 1.5);
        ctx.lineTo(p.x + w / 3, p.y);
        ctx.lineTo(p.x + w, p.y - 1.5);
        ctx.stroke();
      }
    }
    drawRiverPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("river", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset, 3, 1.1);
      ctx.strokeStyle = "#b6cade";
      ctx.lineWidth = 1;
      for (const p of this.scatter(size, 5, seedOffset, 67)) {
        const w = 2.5 + p.r * 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x - w, p.y);
        ctx.lineTo(p.x - w / 3, p.y - 1.5);
        ctx.lineTo(p.x + w / 3, p.y);
        ctx.lineTo(p.x + w, p.y - 1.5);
        ctx.stroke();
      }
    }
    drawDesertPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("desert", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset, 3);
      ctx.strokeStyle = "#a8946b";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y0 = this.hash(i * 17 + 5, 7, seedOffset) * size;
        const cx = this.hash(3, i * 19 + 1, seedOffset) * size;
        const w = size * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx - w, y0 + 2);
        ctx.quadraticCurveTo(cx, y0 - 2, cx + w, y0 + 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#94815c";
      for (const p of this.scatter(size, 5, seedOffset, 71)) {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    }
    drawSwampPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("swamp", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset);
      for (const p of this.scatter(size, 3, seedOffset, 79)) {
        const r = 2.5 + p.r * 3;
        ctx.fillStyle = "#333d26";
        ctx.strokeStyle = "#262e1c";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.65, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#5e7040";
        ctx.fillRect(Math.round(p.x - r * 0.3), Math.round(p.y - r * 0.2), 2, 1);
      }
      for (const p of this.scatter(size, 4, seedOffset, 83)) {
        const h = 3 + p.r * 3;
        ctx.strokeStyle = "#5a6638";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - h);
        ctx.stroke();
        ctx.fillStyle = "#6e5a34";
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y - h) - 1, 2, 2);
      }
    }
    drawTundraPattern(ctx, size, baseColor, seedOffset = 0) {
      const tones = this.tones("tundra", baseColor);
      this.ditherBase(ctx, size, tones, seedOffset);
      for (const p of this.scatter(size, 3, seedOffset, 89)) {
        const r = 3 + p.r * 4;
        ctx.fillStyle = "#e6eaec";
        ctx.strokeStyle = "#aeb6bb";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#8a8e92";
      for (const p of this.scatter(size, 4, seedOffset, 97)) {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      }
    }
    drawDefaultPattern(ctx, size, baseColor, seedOffset = 0) {
      this.ditherBase(ctx, size, this.tones("__default__", baseColor), seedOffset);
    }
    clearCache() {
      this.patternCache.clear();
      logger_default.render.debug("Pattern cache cleared");
    }
  };

  // src/noise.ts
  var PerlinNoise = class {
    seed;
    perm;
    constructor(seed = 0) {
      this.seed = seed;
      this.perm = this.buildPermutationTable();
    }
    setSeed(seed) {
      this.seed = seed;
      this.perm = this.buildPermutationTable();
    }
    // Build permutation table from seed
    buildPermutationTable() {
      const p = [];
      for (let i = 0; i < 256; i++) {
        p[i] = i;
      }
      for (let i = 255; i > 0; i--) {
        const n = Math.floor(this.seededRandom(i) * (i + 1));
        const q = p[i];
        p[i] = p[n];
        p[n] = q;
      }
      const perm = new Array(512);
      for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
      }
      return perm;
    }
    // Seeded random number generator
    seededRandom(i) {
      const x = Math.sin(this.seed + i * 0.9123) * 1e4;
      return x - Math.floor(x);
    }
    // Fade function for smooth interpolation
    fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }
    // Linear interpolation
    lerp(t, a, b) {
      return a + t * (b - a);
    }
    // Gradient function
    grad(hash, x, y) {
      const h = hash & 7;
      const u = h < 4 ? x : y;
      const v = h < 4 ? y : x;
      return (h & 1 ? -u : u) + (h & 2 ? -2 * v : 2 * v);
    }
    // 2D Perlin noise
    noise2D(x, y) {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      const u = this.fade(x);
      const v = this.fade(y);
      const A = this.perm[X] + Y;
      const B = this.perm[X + 1] + Y;
      return this.lerp(
        v,
        this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
        this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
      );
    }
    // Octave noise (multiple frequencies layered)
    octaveNoise2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
      let total = 0;
      let frequency = 1;
      let amplitude = 1;
      let maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        total += this.noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      return total / maxValue;
    }
  };

  // texture-previews/baseline-entry.ts
  window.Baseline = { HexTextureGenerator, PerlinNoise };
})();
