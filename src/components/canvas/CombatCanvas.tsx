import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type MouseEvent,
  type WheelEvent,
  type TouchEvent,
} from 'react';
import { getHexDistance } from '../../contexts/GameStateContext';
import { calculateReachableHexes } from '../../game/Pathfinding';
import { checkLineOfSight } from '../../game/LineOfSight';
import {
  calculateHexPosition,
  drawHexShape,
  drawHexOutline,
  findHexAtPoint,
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

    // Brown trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - size * 0.15, y + size * 0.1, size * 0.3, size * 0.4);

    // Green foliage
    ctx.beginPath();
    ctx.arc(x, y - size * 0.1, size * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#228B22';
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

    // Irregular gray polygon
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3, y + size * 0.2);
    ctx.lineTo(x - size * 0.1, y - size * 0.3);
    ctx.lineTo(x + size * 0.2, y - size * 0.2);
    ctx.lineTo(x + size * 0.3, y + size * 0.1);
    ctx.lineTo(x + size * 0.1, y + size * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#808080';
    ctx.fill();
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1;
    ctx.stroke();

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
    ctx.fillStyle = '#555555';
    ctx.fillRect(x - size * 0.45, y - size * 0.2, size * 0.9, size * 0.4);
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - size * 0.45, y - size * 0.2, size * 0.9, size * 0.4);
    // Stone block lines
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.2);
    ctx.lineTo(x, y + size * 0.2);
    ctx.moveTo(x - size * 0.45, y);
    ctx.lineTo(x + size * 0.45, y);
    ctx.strokeStyle = '#444444';
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
    ctx.fillStyle = '#c8902a';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.1, size * 0.45, size * 0.2, 0, Math.PI, 0);
    ctx.fill();
    // Crest line
    ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
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
    ctx.fillStyle = '#9a8a78';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a5a48';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(x - size * 0.1, y - size * 0.1, size * 0.12, 0, Math.PI * 2);
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

      // Shadow / glow — rage takes priority over turn indicator colour
      if (isRaging) {
        // Faster pulse (150 ms) in orange-red to stand out from the turn glow
        const ragePulse = Math.sin(Date.now() / 150) * 6 + 10;
        ctx.shadowBlur = ragePulse + (isCurrentTurn ? 8 : 0);
        ctx.shadowColor = '#ff6b35';
      } else if (isCurrentTurn) {
        const pulseOffset = Math.sin(Date.now() / 300) * 5 + 5;
        ctx.shadowBlur = pulseOffset + 10;
        ctx.shadowColor = combatant.isAlly ? '#FFD700' : '#FF0000';
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply camera transform (zoom is always 1.0)
    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);
    ctx.scale(FIXED_ZOOM, FIXED_ZOOM);

    // Create positioned hexes with screen coordinates
    const positionedHexes = battlefield.hexes.map(hex => {
      const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
      return { ...hex, x: pos.x, y: pos.y };
    });

    // Draw hexes
    positionedHexes.forEach(hex => {
      const { x, y } = hex;

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

    // Draw movement range overlay
    if (selectedAction === 'move' && combatants[currentTurnIndex]?.position) {
      const currentCombatant = combatants[currentTurnIndex];
      const ccPos = currentCombatant.position!;
      const reachableHexes = calculateReachableHexes(
        ccPos,
        movementRemaining / 5, // Convert feet to hexes (5 feet per hex)
        battlefield as unknown as Parameters<typeof calculateReachableHexes>[2],
        combatants as unknown as Parameters<typeof calculateReachableHexes>[3]
      );

      ctx.save();
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      reachableHexes.forEach(reachable => {
        const pos = calculateHexPosition(reachable.col, reachable.row, HEX_SIZE);
        drawHexShape(ctx, pos.x, pos.y, HEX_SIZE, 'rgba(0, 255, 0, 0.2)', null, 0);
      });
      ctx.restore();
    }

    // Draw attack range overlay
    if (selectedAction === 'attack' && combatants[currentTurnIndex]?.position) {
      const currentCombatant = combatants[currentTurnIndex];
      const ccPos = currentCombatant.position!;
      const attackRange = currentCombatant.attackRange || 1; // Default melee range

      combatants.forEach((target, index) => {
        if (index === currentTurnIndex || !target.position) return;
        if (currentCombatant.isAlly === target.isAlly) return; // Same team
        const tPos = target.position;

        const distance = getHexDistance(ccPos.col, ccPos.row, tPos.col, tPos.row);

        if (distance <= attackRange) {
          const hasLoS = checkLineOfSight(ccPos, tPos, battlefield);

          const pos = calculateHexPosition(tPos.col, tPos.row, HEX_SIZE);
          const outlineColor = hasLoS ? '#00ff00' : '#ff0000';
          drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, outlineColor, 3);
        }
      });
    }

    // Draw combatants (use animated pixel position if available)
    let drawnCount = 0;
    combatants.forEach((combatant, index) => {
      const overridePixel = visualOverridesRef.current.get(combatant.id ?? '') || null;
      if (combatant.position || overridePixel) {
        const isCurrentTurn = index === currentTurnIndex;
        drawCombatant(ctx, combatant, isCurrentTurn, overridePixel);
        drawnCount++;
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
    if (poiType && canvas) {
      drawPoiAmbient(ctx, canvas.width, canvas.height, performance.now(), poiType);
    }

    // Weather overlay drawn in screen space (after camera restore, not affected by pan)
    const weatherCond = battlefield?.hexContext?.weather;
    if (weatherCond && canvas) {
      drawWeatherOverlay(ctx, canvas.width, canvas.height, performance.now(), weatherCond);
    }
  }, [
    battlefield,
    combatants,
    currentTurnIndex,
    selectedAction,
    hoveredHex,
    movementRemaining,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
   * Initial canvas size setup (runs once on mount)
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
  }, []);

  /**
   * Handle window resize (independent of draw)
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const newWidth = parent.clientWidth;
      const newHeight = parent.clientHeight;

      // Only resize if dimensions actually changed
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        // Trigger redraw by changing a state value
        draw();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
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

        // Create positioned hexes for hit detection
        const positionedHexes = battlefield.hexes.map(hex => {
          const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
          return { ...hex, x: pos.x, y: pos.y };
        });

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
    [isDragging, dragStart, cameraZoom, battlefield, screenToCanvas, onCameraChange, onHexHover]
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

      // Create positioned hexes for hit detection
      const positionedHexes = battlefield.hexes.map(hex => {
        const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
        return { ...hex, x: pos.x, y: pos.y };
      });

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
    [hasDragged, battlefield, screenToCanvas, onHexClick]
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
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    />
  );
}

export default CombatCanvas;
