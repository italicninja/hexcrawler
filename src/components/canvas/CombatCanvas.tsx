import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  type MouseEvent,
  type WheelEvent,
  type TouchEvent,
} from 'react';
import { getHexDistance } from '../../utils/hexMath';
import { calculateReachableHexes } from '../../game/Pathfinding';
import { checkLineOfSight } from '../../game/LineOfSight';
import {
  calculateHexPosition,
  drawHexShape,
  drawHexOutline,
  findHexAtPoint,
  sizeCanvasForDpr,
} from '../../utils/hexRenderer';
import { HexTextureGenerator } from '../../utils/hexTextureGenerator';
import { PerlinNoise } from '../../noise';
import logger from '../../utils/logger';
import { drawPoiAmbient } from '../../utils/combatPoiRenderer';
import { drawWeatherOverlay } from '../../utils/combatWeatherRenderer';
import { drawLandmark } from '../../utils/combatLandmarkRenderer';

const HEX_SIZE = 25;
const FIXED_ZOOM = 1.0; // Zoom is disabled - always use 1.0

/**
 * CombatCanvas - Renders 20x20 hex grid battlefield with combatants and interactive controls
 */
// Duration (ms) spent sliding between each individual hex step
const STEP_DURATION_MS = 120;

interface Coord {
  col: number;
  row: number;
}

interface Pixel {
  x: number;
  y: number;
}

interface BattleHex {
  col: number;
  row: number;
  terrain?: { key?: string; color?: string; type?: string; [key: string]: unknown };
  difficultTerrain?: boolean;
  blocked?: boolean;
  obstacleType?: string;
  [key: string]: unknown;
}

interface Battlefield {
  hexes: BattleHex[];
  hexContext?: { terrainKey?: string; poiType?: string; weather?: string };
  [key: string]: unknown;
}

interface Combatant {
  id?: string | number;
  name?: string;
  position?: Coord | null;
  statusEffects?: Array<{ name: string; [key: string]: unknown }>;
  isAlly?: boolean;
  currentHP: number;
  maxHP: number;
  characterClass?: string;
  attackRange?: number;
  [key: string]: unknown;
}

interface MovementAnim {
  combatantId: string | number;
  path: Coord[];
  stepIndex: number;
  stepStartTime: number;
}

interface CombatCanvasProps {
  battlefield?: Battlefield | null;
  combatants: Combatant[];
  currentTurnIndex: number;
  selectedAction?: string;
  hoveredHex?: Coord | null;
  movementRemaining: number;
  onHexClick: (hex: BattleHex) => void;
  onHexHover: (hex: BattleHex | null) => void;
  cameraOffset: Pixel;
  cameraZoom?: number;
  onCameraChange: (offset: Pixel, zoom: number) => void;
  pendingAnimation?: { combatantId: string | number; path: Coord[] } | null;
  onAnimationComplete?: () => void;
}

function CombatCanvas({
  battlefield,
  combatants,
  currentTurnIndex,
  selectedAction,
  hoveredHex,
  movementRemaining,
  onHexClick,
  onHexHover,
  cameraOffset,
  cameraZoom,
  onCameraChange,
  pendingAnimation,
  onAnimationComplete,
}: CombatCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Pixel>({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false); // Track if mouse actually moved
  const lastHoveredHexRef = useRef<BattleHex | null>(null);
  const lastCameraRef = useRef<{ offset: Pixel; zoom: number }>({
    offset: cameraOffset,
    zoom: FIXED_ZOOM,
  });
  const textureGenerator = useRef<HexTextureGenerator | null>(null);
  // CSS-pixel size of the canvas; the backing store is this x devicePixelRatio.
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // Active movement animation state (stored as a ref so rAF reads latest without closures)
  const movementAnimRef = useRef<MovementAnim | null>(null);
  // Visual override positions: Map<combatantId, {x, y}> pixel coords
  const visualOverridesRef = useRef<Map<string | number, Pixel>>(new Map());

  // Initialize texture generator once
  useEffect(() => {
    if (!textureGenerator.current) {
      const noise = new PerlinNoise(Date.now());
      textureGenerator.current = new HexTextureGenerator(noise);
    }
  }, []);

  /**
   * Draw a tree obstacle
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawTree = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();

    // OSRS low-poly tree: brown trunk, faceted canopy with hard outline
    ctx.fillStyle = '#5a3c20';
    ctx.strokeStyle = '#2a1c0e';
    ctx.lineWidth = 1;
    ctx.fillRect(x - size * 0.12, y + size * 0.08, size * 0.24, size * 0.4);
    ctx.strokeRect(x - size * 0.12, y + size * 0.08, size * 0.24, size * 0.4);

    // Canopy: chunky hexagonal crown
    const r = size * 0.42;
    const cy = y - size * 0.1;
    ctx.fillStyle = '#2e4423';
    ctx.strokeStyle = '#1d2d16';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lit facet, top-left
    ctx.fillStyle = '#46663a';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, cy - r * 0.15);
    ctx.lineTo(x - r * 0.05, cy - r * 0.7);
    ctx.lineTo(x + r * 0.35, cy - r * 0.25);
    ctx.lineTo(x - r * 0.1, cy + r * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, []);

  /**
   * Draw a rock obstacle
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawRock = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();

    // Faceted grey rock: shadow body + lit face + hard outline
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3, y + size * 0.2);
    ctx.lineTo(x - size * 0.1, y - size * 0.3);
    ctx.lineTo(x + size * 0.2, y - size * 0.2);
    ctx.lineTo(x + size * 0.3, y + size * 0.1);
    ctx.lineTo(x + size * 0.1, y + size * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#6b675e';
    ctx.fill();
    ctx.strokeStyle = '#36332d';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lit facet, upper-left
    ctx.fillStyle = '#7d786c';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.22, y + size * 0.08);
    ctx.lineTo(x - size * 0.1, y - size * 0.26);
    ctx.lineTo(x + size * 0.12, y - size * 0.16);
    ctx.lineTo(x - size * 0.04, y + size * 0.02);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, []);

  /**
   * Draw a wall obstacle (for dungeon/ruins/temple)
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawWall = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    // Weathered stone wall, mortar lines offset like real coursing
    ctx.fillStyle = '#6e6a60';
    ctx.fillRect(x - size * 0.45, y - size * 0.2, size * 0.9, size * 0.4);
    ctx.strokeStyle = '#36332d';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - size * 0.45, y - size * 0.2, size * 0.9, size * 0.4);
    // Mortar lines (staggered blocks)
    ctx.strokeStyle = '#4a463e';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.45, y);
    ctx.lineTo(x + size * 0.45, y);
    ctx.moveTo(x - size * 0.15, y - size * 0.2);
    ctx.lineTo(x - size * 0.15, y);
    ctx.moveTo(x + size * 0.15, y - size * 0.2);
    ctx.lineTo(x + size * 0.15, y);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + size * 0.2);
    ctx.stroke();
    // Top highlight
    ctx.strokeStyle = 'rgba(220, 214, 198, 0.35)';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.43, y - size * 0.17);
    ctx.lineTo(x + size * 0.43, y - size * 0.17);
    ctx.stroke();
    ctx.restore();
  }, []);

  /**
   * Draw a reed/marsh plant (for swamp/river/water)
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawReed = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.strokeStyle = '#4a6030';
    ctx.lineWidth = 1.5;
    // Three reed stalks
    for (let i = -1; i <= 1; i++) {
      const rx = x + i * size * 0.18;
      ctx.beginPath();
      ctx.moveTo(rx, y + size * 0.3);
      ctx.lineTo(rx, y - size * 0.3);
      ctx.stroke();
      // Seed head
      ctx.fillStyle = '#7a5030';
      ctx.beginPath();
      ctx.ellipse(rx, y - size * 0.3, size * 0.05, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, []);

  /**
   * Draw a snow/ice mound (for tundra)
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawIceMound = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.fillStyle = '#d0e8f0';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.1, size * 0.4, size * 0.25, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#a0c8e0';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Ice glint
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.15, y - size * 0.05);
    ctx.lineTo(x, y - size * 0.2);
    ctx.lineTo(x + size * 0.12, y - size * 0.08);
    ctx.stroke();
    ctx.restore();
  }, []);

  /**
   * Draw a sand dune (for desert)
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawDune = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.fillStyle = '#b8a070';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.1, size * 0.45, size * 0.2, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#8a7752';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Crest line
    ctx.strokeStyle = 'rgba(230, 212, 168, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.4, y + size * 0.02);
    ctx.quadraticCurveTo(x, y - size * 0.12, x + size * 0.4, y + size * 0.02);
    ctx.stroke();
    ctx.restore();
  }, []);

  /**
   * Draw a boulder (for plains/hills/grassland)
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawBoulder = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    // Chunky boulder: faceted heptagon instead of a smooth circle
    const r = size * 0.32;
    ctx.fillStyle = '#857c6c';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 - Math.PI / 2;
      const wobble = i % 2 === 0 ? 1 : 0.85;
      const px = x + Math.cos(a) * r * wobble;
      const py = y + Math.sin(a) * r * wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a4438';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Lit facet
    ctx.fillStyle = '#9a9180';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.1);
    ctx.lineTo(x - r * 0.1, y - r * 0.7);
    ctx.lineTo(x + r * 0.3, y - r * 0.3);
    ctx.lineTo(x - r * 0.1, y + r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, []);

  /**
   * Draw a class icon inside combatant circle
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {string} className - Character class name
   * @param {number} size - Size scale factor
   */
  const drawClassIcon = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, className: string, size: number) => {
    ctx.save();
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';

    const classLower = (className || 'fighter').toLowerCase();

    if (classLower === 'barbarian') {
      // Greataxe: vertical haft + broad crescent blade
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.35);
      ctx.lineTo(x, y + size * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.35);
      ctx.bezierCurveTo(
        x - size * 0.3,
        y - size * 0.2,
        x - size * 0.3,
        y + size * 0.1,
        x,
        y + size * 0.1
      );
      ctx.bezierCurveTo(
        x + size * 0.3,
        y + size * 0.1,
        x + size * 0.3,
        y - size * 0.2,
        x,
        y - size * 0.35
      );
      ctx.fill();
      ctx.stroke();
    } else if (classLower === 'bard') {
      // Musical note: filled note head + stem + flag
      ctx.beginPath();
      ctx.ellipse(x - size * 0.1, y + size * 0.2, size * 0.12, size * 0.09, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.02, y + size * 0.2);
      ctx.lineTo(x + size * 0.02, y - size * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.02, y - size * 0.2);
      ctx.quadraticCurveTo(x + size * 0.22, y - size * 0.1, x + size * 0.18, y + size * 0.0);
      ctx.stroke();
    } else if (classLower === 'cleric') {
      // Radiant cross with glow dots at tips
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.35);
      ctx.lineTo(x, y + size * 0.35);
      ctx.moveTo(x - size * 0.35, y - size * 0.08);
      ctx.lineTo(x + size * 0.35, y - size * 0.08);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.lineWidth = 1.8;
      // glow dot at top
      ctx.beginPath();
      ctx.arc(x, y - size * 0.35, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (classLower === 'druid') {
      // Leaf: teardrop shape with center vein
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.35);
      ctx.bezierCurveTo(
        x + size * 0.3,
        y - size * 0.15,
        x + size * 0.3,
        y + size * 0.2,
        x,
        y + size * 0.35
      );
      ctx.bezierCurveTo(
        x - size * 0.3,
        y + size * 0.2,
        x - size * 0.3,
        y - size * 0.15,
        x,
        y - size * 0.35
      );
      ctx.fill();
      ctx.stroke();
      // center vein
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.3);
      ctx.lineTo(x, y + size * 0.3);
      ctx.stroke();
      ctx.restore();
    } else if (classLower === 'fighter') {
      // Sword + shield: sword diagonal, small shield behind
      // shield
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.22, y - size * 0.3);
      ctx.lineTo(x + size * 0.05, y - size * 0.3);
      ctx.lineTo(x + size * 0.05, y + size * 0.1);
      ctx.quadraticCurveTo(x - size * 0.08, y + size * 0.35, x - size * 0.22, y + size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.stroke();
      // sword blade
      ctx.beginPath();
      ctx.moveTo(x + size * 0.25, y - size * 0.3);
      ctx.lineTo(x - size * 0.1, y + size * 0.3);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      // crossguard
      ctx.beginPath();
      ctx.moveTo(x + size * 0.08, y - size * 0.05);
      ctx.lineTo(x + size * 0.3, y + size * 0.1);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else if (classLower === 'monk') {
      // Yin-yang circle
      ctx.beginPath();
      ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      // top half filled
      ctx.beginPath();
      ctx.arc(x, y, size * 0.3, Math.PI, 0);
      ctx.fill();
      // small circles
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y - size * 0.15, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y - size * 0.15, size * 0.09, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + size * 0.15, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (classLower === 'paladin') {
      // Kite shield with cross
      ctx.beginPath();
      ctx.moveTo(x - size * 0.25, y - size * 0.32);
      ctx.lineTo(x + size * 0.25, y - size * 0.32);
      ctx.lineTo(x + size * 0.25, y + size * 0.1);
      ctx.quadraticCurveTo(x, y + size * 0.38, x - size * 0.25, y + size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // cross cutout
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(x - size * 0.04, y - size * 0.28, size * 0.08, size * 0.36);
      ctx.fillRect(x - size * 0.2, y - size * 0.12, size * 0.4, size * 0.08);
      ctx.restore();
    } else if (classLower === 'ranger') {
      // Bow + nocked arrow
      ctx.beginPath();
      ctx.arc(x - size * 0.08, y, size * 0.28, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      // bowstring
      ctx.beginPath();
      ctx.moveTo(x - size * 0.08, y - size * 0.28);
      ctx.lineTo(x - size * 0.08, y + size * 0.28);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.lineWidth = 1.8;
      // arrow
      ctx.beginPath();
      ctx.moveTo(x - size * 0.08, y);
      ctx.lineTo(x + size * 0.32, y);
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(x + size * 0.32, y);
      ctx.lineTo(x + size * 0.2, y - size * 0.08);
      ctx.lineTo(x + size * 0.2, y + size * 0.08);
      ctx.closePath();
      ctx.fill();
    } else if (classLower === 'rogue') {
      // Angled dagger
      ctx.beginPath();
      ctx.moveTo(x - size * 0.25, y + size * 0.28);
      ctx.lineTo(x + size * 0.22, y - size * 0.28);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // crossguard perpendicular
      ctx.beginPath();
      ctx.moveTo(x + size * 0.05, y - size * 0.05);
      ctx.lineTo(x + size * 0.28, y + size * 0.12);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // pommel
      ctx.beginPath();
      ctx.arc(x - size * 0.25, y + size * 0.28, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (classLower === 'sorcerer') {
      // 6-pointed arcane star / snowflake burst
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * size * 0.32, y + Math.sin(angle) * size * 0.32);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (classLower === 'warlock') {
      // Eldritch eye: almond + slit pupil + arcane marks
      ctx.beginPath();
      ctx.moveTo(x - size * 0.3, y);
      ctx.quadraticCurveTo(x, y - size * 0.22, x + size * 0.3, y);
      ctx.quadraticCurveTo(x, y + size * 0.22, x - size * 0.3, y);
      ctx.fill();
      ctx.stroke();
      // pupil slit (destination-out style via lighter fill)
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.06, size * 0.16, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
      // top arcane mark
      ctx.beginPath();
      ctx.moveTo(x - size * 0.08, y - size * 0.28);
      ctx.lineTo(x, y - size * 0.38);
      ctx.lineTo(x + size * 0.08, y - size * 0.28);
      ctx.stroke();
    } else if (classLower === 'wizard') {
      // Staff + 8-point star at top
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.1);
      ctx.lineTo(x, y + size * 0.35);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.lineWidth = 1.8;
      // 4-axis star
      const starY = y - size * 0.22;
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * size * 0.25, starY + Math.sin(angle) * size * 0.25);
        ctx.lineTo(x - Math.cos(angle) * size * 0.25, starY - Math.sin(angle) * size * 0.25);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, starY, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fallback: diamond
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.28);
      ctx.lineTo(x + size * 0.2, y);
      ctx.lineTo(x, y + size * 0.28);
      ctx.lineTo(x - size * 0.2, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  /**
   * Draw HP bar below combatant
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} width - Bar width
   * @param {number} hpPercent - HP percentage (0-1)
   */
  const drawHPBar = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, hpPercent: number) => {
    ctx.save();

    const barHeight = 4;
    const barY = y;

    // Background (black)
    ctx.fillStyle = '#000';
    ctx.fillRect(x - width / 2, barY, width, barHeight);

    // HP bar color based on percentage
    let barColor = '#00ff00'; // Green > 60%
    if (hpPercent < 0.3) {
      barColor = '#ff0000'; // Red < 30%
    } else if (hpPercent < 0.6) {
      barColor = '#ffff00'; // Yellow 30-60%
    }

    ctx.fillStyle = barColor;
    ctx.fillRect(x - width / 2, barY, width * hpPercent, barHeight);

    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2, barY, width, barHeight);

    ctx.restore();
  }, []);

  /**
   * Draw a combatant on the battlefield
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} combatant - Combatant object
   * @param {boolean} isCurrentTurn - Whether it's this combatant's turn
   * @param {{x:number,y:number}|null} overridePixel - Optional pixel position override for animation
   */
  const drawCombatant = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      combatant: Combatant,
      isCurrentTurn: boolean,
      overridePixel: Pixel | null = null
    ) => {
      if (!combatant.position && !overridePixel) return;

      let x: number, y: number;
      if (overridePixel) {
        x = overridePixel.x;
        y = overridePixel.y;
      } else {
        const cpos = combatant.position!;
        const pos = calculateHexPosition(cpos.col, cpos.row, HEX_SIZE);
        x = pos.x;
        y = pos.y;
      }
      const radius = HEX_SIZE * 0.4;

      const isRaging = combatant.statusEffects?.some(e => e.name === 'Rage');

      ctx.save();

      // Glow halo — rage takes priority over turn indicator colour. A translucent
      // ring instead of shadowBlur, which is expensive and only pulsed when some
      // other effect happened to force a redraw.
      const glowColor = isRaging
        ? '#ff6b35'
        : isCurrentTurn
          ? combatant.isAlly
            ? '#FFD700'
            : '#FF0000'
          : null;
      if (glowColor) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = glowColor;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = isRaging && isCurrentTurn ? 7 : 5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Calculate HP percentage
      const hpPercent = combatant.currentHP / combatant.maxHP;

      // Circle fill color based on HP
      let fillColor = '#00ff00'; // Green > 60%
      if (hpPercent < 0.3) {
        fillColor = '#ff0000'; // Red < 30%
      } else if (hpPercent < 0.6) {
        fillColor = '#ffff00'; // Yellow 30-60%
      }

      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Border: orange when raging, gold for ally, red for enemy
      ctx.strokeStyle = isRaging ? '#ff6b35' : combatant.isAlly ? '#FFD700' : '#FF0000';
      ctx.lineWidth = isRaging ? 4 : 3;
      ctx.stroke();

      ctx.restore();

      // Draw class icon
      drawClassIcon(ctx, x, y, combatant.characterClass ?? 'fighter', HEX_SIZE * 0.3);

      // Draw HP bar below circle
      const barY = y + radius + 6;
      drawHPBar(ctx, x, barY, HEX_SIZE * 1.2, hpPercent);

      // Draw name label below HP bar
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.font = `bold ${HEX_SIZE * 0.4}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const nameY = barY + 6;
      ctx.strokeText(combatant.name ?? '', x, nameY);
      ctx.fillText(combatant.name ?? '', x, nameY);
      ctx.restore();
    },
    [drawClassIcon, drawHPBar]
  );

  // Hex pixel positions only change with the battlefield
  const positionedHexes = useMemo(
    () =>
      (battlefield?.hexes ?? []).map(hex => {
        const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
        return { ...hex, x: pos.x, y: pos.y };
      }),
    [battlefield]
  );

  // Pathfinding / LoS are computed when the relevant state changes, not every frame
  const reachableHexes = useMemo(() => {
    const current = combatants[currentTurnIndex];
    if (selectedAction !== 'move' || !current?.position || !battlefield?.hexes) return [];
    return calculateReachableHexes(
      current.position,
      movementRemaining / 5, // Convert feet to hexes (5 feet per hex)
      battlefield as unknown as Parameters<typeof calculateReachableHexes>[2],
      combatants as unknown as Parameters<typeof calculateReachableHexes>[3]
    );
  }, [selectedAction, combatants, currentTurnIndex, movementRemaining, battlefield]);

  const attackTargets = useMemo(() => {
    const current = combatants[currentTurnIndex];
    if (selectedAction !== 'attack' || !current?.position || !battlefield) return [];
    const ccPos = current.position;
    const attackRange = current.attackRange || 1; // Default melee range
    const targets: Array<Coord & { hasLoS: boolean }> = [];
    combatants.forEach((target, index) => {
      if (index === currentTurnIndex || !target.position) return;
      if (current.isAlly === target.isAlly) return; // Same team
      const tPos = target.position;
      if (getHexDistance(ccPos.col, ccPos.row, tPos.col, tPos.row) <= attackRange) {
        targets.push({ ...tPos, hasLoS: checkLineOfSight(ccPos, tPos, battlefield) });
      }
    });
    return targets;
  }, [selectedAction, combatants, currentTurnIndex, battlefield]);

  /**
   * Main draw function
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      logger.render.warn('[CombatCanvas] Canvas ref not ready');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Null check for battlefield
    if (!battlefield || !battlefield.hexes) return;

    // Clear canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw in CSS pixels on a devicePixelRatio backing store
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { width, height } = canvasSizeRef.current;

    // Apply camera transform (zoom is always 1.0)
    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);
    ctx.scale(FIXED_ZOOM, FIXED_ZOOM);

    // Draw hexes inside the viewport (plus a margin)
    const margin = HEX_SIZE * 2;
    positionedHexes.forEach(hex => {
      const { x, y } = hex;
      const sx = x + cameraOffset.x;
      const sy = y + cameraOffset.y;
      if (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin) return;

      // Draw terrain with procedural texture
      if (textureGenerator.current && hex.terrain) {
        const pattern = textureGenerator.current.getPattern(
          ctx,
          hex.terrain as Parameters<HexTextureGenerator['getPattern']>[1],
          HEX_SIZE,
          hex.col,
          hex.row
        );
        drawHexShape(ctx, x, y, HEX_SIZE, pattern, '#444', 1);
      } else {
        // Fallback to solid color
        const terrainColor = hex.terrain?.color || '#6B8E23';
        drawHexShape(ctx, x, y, HEX_SIZE, terrainColor, '#444', 1);
      }

      // Difficult terrain overlay
      if (hex.difficultTerrain) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        drawHexShape(ctx, x, y, HEX_SIZE, 'rgba(255, 255, 0, 0.1)', null, 0);
        ctx.restore();
      }

      // Draw obstacles — terrain-specific
      if (hex.blocked) {
        const obstacleType = hex.obstacleType || hex.terrain?.type || 'rock';
        if (obstacleType === 'tree') {
          drawTree(ctx, x, y, HEX_SIZE * 0.5);
        } else if (obstacleType === 'wall') {
          drawWall(ctx, x, y, HEX_SIZE * 0.5);
        } else if (obstacleType === 'reed') {
          drawReed(ctx, x, y, HEX_SIZE * 0.5);
        } else if (obstacleType === 'ice') {
          drawIceMound(ctx, x, y, HEX_SIZE * 0.5);
        } else if (obstacleType === 'dune') {
          drawDune(ctx, x, y, HEX_SIZE * 0.5);
        } else if (obstacleType === 'boulder') {
          drawBoulder(ctx, x, y, HEX_SIZE * 0.5);
        } else {
          drawRock(ctx, x, y, HEX_SIZE * 0.5);
        }
      }
    });

    // Draw terrain landmark centerpiece in world space (inside camera transform)
    const landmarkTerrainKey = battlefield.hexContext?.terrainKey;
    if (landmarkTerrainKey) {
      const centerPos = calculateHexPosition(9, 9, HEX_SIZE);
      drawLandmark(ctx, centerPos.x, centerPos.y, HEX_SIZE * 2.5, landmarkTerrainKey);
    }

    // Draw movement range overlay (reachable set is memoized above)
    reachableHexes.forEach(reachable => {
      const pos = calculateHexPosition(reachable.col, reachable.row, HEX_SIZE);
      drawHexShape(ctx, pos.x, pos.y, HEX_SIZE, 'rgba(0, 255, 0, 0.2)', null, 0);
    });

    // Draw attack range overlay (targets + line of sight memoized above)
    attackTargets.forEach(target => {
      const pos = calculateHexPosition(target.col, target.row, HEX_SIZE);
      drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, target.hasLoS ? '#00ff00' : '#ff0000', 3);
    });

    // Draw combatants (use animated pixel position if available)
    let _drawnCount = 0;
    combatants.forEach((combatant, index) => {
      const overridePixel = visualOverridesRef.current.get(combatant.id ?? '') || null;
      if (combatant.position || overridePixel) {
        const isCurrentTurn = index === currentTurnIndex;
        drawCombatant(ctx, combatant, isCurrentTurn, overridePixel);
        _drawnCount++;
      } else {
        logger.combat.warn('[CombatCanvas] Combatant has no position:', combatant.name);
      }
    });

    // Draw hovered hex
    if (hoveredHex) {
      const pos = calculateHexPosition(hoveredHex.col, hoveredHex.row, HEX_SIZE);
      drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, '#ffffff', 2);
    }

    ctx.restore(); // end camera transform

    // POI ambient overlay drawn in screen space
    const poiType = battlefield?.hexContext?.poiType;
    if (poiType) {
      drawPoiAmbient(ctx, width, height, performance.now(), poiType);
    }

    // Weather overlay drawn in screen space (after camera restore, not affected by pan)
    const weatherCond = battlefield?.hexContext?.weather;
    if (weatherCond) {
      drawWeatherOverlay(ctx, width, height, performance.now(), weatherCond);
    }
  }, [
    battlefield,
    positionedHexes,
    reachableHexes,
    attackTargets,
    combatants,
    currentTurnIndex,
    hoveredHex,
    cameraOffset,
    cameraZoom,
    drawTree,
    drawRock,
    drawWall,
    drawReed,
    drawIceMound,
    drawDune,
    drawBoulder,
    drawCombatant,
  ]);

  // Latest draw for the resize observer (which is registered once)
  const drawRef = useRef(draw);
  drawRef.current = draw;

  /**
   * Size the backing store to the canvas' CSS box (DPR-aware) and keep it in sync.
   * Declared before the draw effects so the first paint isn't wiped by a later resize.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const prev = canvasSizeRef.current;
      if (prev.width === width && prev.height === height) return;
      canvasSizeRef.current = { width, height };
      sizeCanvasForDpr(canvas, width, height);
      // Setting canvas.width clears it; repaint (the movement loop repaints itself).
      if (!movementAnimRef.current) drawRef.current();
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  /**
   * Hex-by-hex movement animation.
   * Starts a requestAnimationFrame loop whenever pendingAnimation changes.
   * Each step lerps the combatant from one hex center to the next over STEP_DURATION_MS.
   * When all steps complete, clears the visual override and fires onAnimationComplete.
   */
  useEffect(() => {
    if (!pendingAnimation || !pendingAnimation.path || pendingAnimation.path.length < 2) {
      // No animation to run – clear any leftover override and redraw once
      visualOverridesRef.current.clear();
      movementAnimRef.current = null;
      draw();
      return;
    }

    const { combatantId, path } = pendingAnimation;

    // Start animating from step 0 (path[0] → path[1])
    movementAnimRef.current = {
      combatantId,
      path,
      stepIndex: 0,
      stepStartTime: performance.now(),
    };

    let rafId: number | null = null;
    let running = true;

    const tick = (now: number) => {
      if (!running) return;

      const anim = movementAnimRef.current;
      if (!anim) {
        draw();
        return;
      }

      const { path: animPath, stepIndex, stepStartTime } = anim;
      const elapsed = now - stepStartTime;
      const progress = Math.min(elapsed / STEP_DURATION_MS, 1);

      // Ease-out cubic for a natural deceleration into each hex
      const eased = 1 - Math.pow(1 - progress, 3);

      const fromHex = animPath[stepIndex];
      const toHex = animPath[stepIndex + 1];

      if (!fromHex || !toHex) {
        // Path exhausted – clean up
        visualOverridesRef.current.delete(anim.combatantId);
        movementAnimRef.current = null;
        draw();
        running = false;
        if (onAnimationComplete) onAnimationComplete();
        return;
      }

      const fromPx = calculateHexPosition(fromHex.col, fromHex.row, HEX_SIZE);
      const toPx = calculateHexPosition(toHex.col, toHex.row, HEX_SIZE);

      const currentPx = {
        x: fromPx.x + (toPx.x - fromPx.x) * eased,
        y: fromPx.y + (toPx.y - fromPx.y) * eased,
      };

      visualOverridesRef.current.set(anim.combatantId, currentPx);
      draw();

      if (progress >= 1) {
        // Step complete – advance to next hex
        const nextStep = stepIndex + 1;
        if (nextStep >= animPath.length - 1) {
          // Reached final hex – clean up
          visualOverridesRef.current.delete(anim.combatantId);
          movementAnimRef.current = null;
          draw();
          running = false;
          if (onAnimationComplete) onAnimationComplete();
          return;
        }
        // Move to next step
        movementAnimRef.current = {
          ...anim,
          stepIndex: nextStep,
          stepStartTime: now,
        };
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
     
  }, [pendingAnimation]);

  /**
   * Continuous animation loop for ambient effects (POI overlays, weather).
   * Only runs when the battlefield has animated overlays; yields to movement animation.
   */
  useEffect(() => {
    const weatherCondition = battlefield?.hexContext?.weather;
    const hasPoi = !!battlefield?.hexContext?.poiType;
    const needsAnimation =
      hasPoi || (weatherCondition && weatherCondition.toLowerCase() !== 'clear');
    if (!needsAnimation) return;

    let rafId: number | null = null;
    let running = true;

    const animate = () => {
      if (!running) return;
      if (!movementAnimRef.current) {
        draw();
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [battlefield?.hexContext?.weather, battlefield?.hexContext?.poiType, draw]);

  /**
   * Render once when non-animation dependencies change.
   * Skip if a movement animation is actively running (it drives its own draws).
   */
  useEffect(() => {
    if (!movementAnimRef.current) {
      draw();
    }
  }, [draw]);

  /**
   * Convert screen coordinates to canvas coordinates (accounting for camera transform)
   * @param {number} clientX - Screen X coordinate
   * @param {number} clientY - Screen Y coordinate
   * @returns {Object} - {x, y} canvas coordinates
   */
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - cameraOffset.x) / FIXED_ZOOM;
      const y = (clientY - rect.top - cameraOffset.y) / FIXED_ZOOM;

      return { x, y };
    },
    [cameraOffset]
  );

  /**
   * Handle mouse down (start dragging)
   */
  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      setIsDragging(true);
      setHasDragged(false); // Reset drag flag
      setDragStart({ x: e.clientX - cameraOffset.x, y: e.clientY - cameraOffset.y });
    },
    [cameraOffset]
  );

  /**
   * Handle mouse move (pan camera or hover)
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) {
        // Pan camera
        const newOffset = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };

        // Check if mouse moved significantly (more than 3 pixels)
        const lastCamera = lastCameraRef.current;
        const movedSignificantly =
          Math.abs(newOffset.x - lastCamera.offset.x) > 3 ||
          Math.abs(newOffset.y - lastCamera.offset.y) > 3;

        if (movedSignificantly) {
          setHasDragged(true); // Mark as actual drag
          lastCameraRef.current = { offset: newOffset, zoom: FIXED_ZOOM };
          onCameraChange(newOffset, FIXED_ZOOM);
        }
      } else {
        // Hover detection - null check battlefield
        if (!battlefield || !battlefield.hexes) return;

        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        const newHoveredHex = findHexAtPoint(
          canvasPos.x,
          canvasPos.y,
          positionedHexes,
          HEX_SIZE
        ) as BattleHex | null;

        // Only call onHexHover if the hovered hex actually changed
        const lastHex = lastHoveredHexRef.current;
        const hexChanged =
          (!lastHex && newHoveredHex) ||
          (lastHex && !newHoveredHex) ||
          (lastHex &&
            newHoveredHex &&
            (lastHex.col !== newHoveredHex.col || lastHex.row !== newHoveredHex.row));

        if (hexChanged) {
          lastHoveredHexRef.current = newHoveredHex;
          onHexHover(newHoveredHex);
        }
      }
    },
    [
      isDragging,
      dragStart,
      battlefield,
      positionedHexes,
      screenToCanvas,
      onCameraChange,
      onHexHover,
    ]
  );

  /**
   * Handle mouse up (stop dragging)
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Handle mouse click (hex selection)
   */
  const handleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      // Block clicks while a movement animation is running
      if (movementAnimRef.current) {
        logger.combat.debug('[CombatCanvas] Click ignored - movement animation in progress');
        return;
      }

      logger.combat.debug('[CombatCanvas] Click event', {
        isDragging,
        hasDragged,
        hasBattlefield: !!battlefield,
      });

      // Don't register clicks if we actually dragged (moved camera)
      if (hasDragged) {
        logger.combat.debug('[CombatCanvas] Click ignored - was dragging camera');
        return;
      }

      // Null check battlefield
      if (!battlefield || !battlefield.hexes) {
        logger.combat.debug('[CombatCanvas] Click ignored - no battlefield');
        return;
      }

      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      logger.combat.debug('[CombatCanvas] Canvas position', canvasPos);

      const clickedHex = findHexAtPoint(
        canvasPos.x,
        canvasPos.y,
        positionedHexes,
        HEX_SIZE
      ) as BattleHex | null;
      logger.combat.debug('[CombatCanvas] Clicked hex', clickedHex);

      if (clickedHex) {
        logger.combat.debug('[CombatCanvas] Calling onHexClick with', clickedHex);
        onHexClick(clickedHex);
      } else {
        logger.combat.debug('[CombatCanvas] No hex found at click position');
      }
    },
    [hasDragged, battlefield, positionedHexes, screenToCanvas, onHexClick]
  );

  /**
   * Handle mouse wheel (zoom) - DISABLED for combat
   */
  const handleWheel = useCallback((_e: WheelEvent<HTMLCanvasElement>) => {
    // Note: preventDefault on wheel events can cause warnings
    // Zoom is disabled for combat, so we just ignore the event
  }, []);

  /**
   * Handle touch start (pan or zoom)
   */
  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length === 1) {
        // Single touch: start panning
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - cameraOffset.x,
          y: e.touches[0].clientY - cameraOffset.y,
        });
      }
      // Two-finger zoom disabled for combat
    },
    [cameraOffset]
  );

  /**
   * Handle touch move (pan only, zoom disabled)
   */
  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLCanvasElement>) => {
      // Note: Don't call e.preventDefault() here - use touchAction: 'none' in CSS instead
      // to avoid "passive event listener" warnings

      if (e.touches.length === 1 && isDragging) {
        // Single touch: pan
        const newOffset = {
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y,
        };
        onCameraChange(newOffset, FIXED_ZOOM);
      }
      // Two-finger zoom disabled for combat
    },
    [isDragging, dragStart, onCameraChange]
  );

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    />
  );
}

export default CombatCanvas;
