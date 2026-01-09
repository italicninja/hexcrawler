import { useRef, useEffect, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { getHexDistance } from '../../contexts/GameStateContext';
import { calculateReachableHexes } from '../../game/Pathfinding.js';
import { checkLineOfSight } from '../../game/LineOfSight.js';
import {
  calculateHexPosition,
  drawHexShape,
  drawHexOutline,
  findHexAtPoint
} from '../../utils/hexRenderer';

const HEX_SIZE = 25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_SPEED = 0.1;

/**
 * CombatCanvas - Renders 20x20 hex grid battlefield with combatants and interactive controls
 */
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
  onCameraChange
}) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const animationFrameRef = useRef(null);

  /**
   * Draw a tree obstacle
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} size - Size scale factor
   */
  const drawTree = useCallback((ctx, x, y, size) => {
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
  const drawRock = useCallback((ctx, x, y, size) => {
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
   * Draw a class icon inside combatant circle
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {string} className - Character class name
   * @param {number} size - Size scale factor
   */
  const drawClassIcon = useCallback((ctx, x, y, className, size) => {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    const classLower = (className || 'fighter').toLowerCase();

    if (classLower.includes('fighter') || classLower.includes('barbarian') || classLower.includes('paladin')) {
      // Sword icon
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.3);
      ctx.lineTo(x, y + size * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - size * 0.15, y - size * 0.2);
      ctx.lineTo(x + size * 0.15, y - size * 0.2);
      ctx.stroke();
    } else if (classLower.includes('wizard') || classLower.includes('sorcerer') || classLower.includes('warlock')) {
      // Staff icon
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.3);
      ctx.lineTo(x, y + size * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - size * 0.3, size * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    } else if (classLower.includes('ranger') || classLower.includes('rogue')) {
      // Bow icon
      ctx.beginPath();
      ctx.arc(x - size * 0.1, y, size * 0.25, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.15, y - size * 0.2);
      ctx.lineTo(x - size * 0.1, y);
      ctx.lineTo(x + size * 0.15, y + size * 0.2);
      ctx.stroke();
    } else {
      // Default: simple cross
      ctx.beginPath();
      ctx.moveTo(x - size * 0.2, y);
      ctx.lineTo(x + size * 0.2, y);
      ctx.moveTo(x, y - size * 0.2);
      ctx.lineTo(x, y + size * 0.2);
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
  const drawHPBar = useCallback((ctx, x, y, width, hpPercent) => {
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
   */
  const drawCombatant = useCallback((ctx, combatant, isCurrentTurn) => {
    if (!combatant.position) return;

    const { x, y } = calculateHexPosition(combatant.position.col, combatant.position.row, HEX_SIZE);
    const radius = HEX_SIZE * 0.4;

    ctx.save();

    // Pulsing glow effect for current turn
    if (isCurrentTurn) {
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

    // Border: gold for ally, red for enemy
    ctx.strokeStyle = combatant.isAlly ? '#FFD700' : '#FF0000';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    // Draw class icon
    drawClassIcon(ctx, x, y, combatant.characterClass, HEX_SIZE * 0.3);

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
    ctx.strokeText(combatant.name, x, nameY);
    ctx.fillText(combatant.name, x, nameY);
    ctx.restore();
  }, [drawClassIcon, drawHPBar]);

  /**
   * Main draw function
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Null check for battlefield
    if (!battlefield || !battlefield.hexes) {
      console.warn('CombatCanvas: battlefield or battlefield.hexes is null');
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply camera transform
    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);
    ctx.scale(cameraZoom, cameraZoom);

    // Create positioned hexes with screen coordinates
    const positionedHexes = battlefield.hexes.map(hex => {
      const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
      return { ...hex, x: pos.x, y: pos.y };
    });

    // Draw hexes
    positionedHexes.forEach(hex => {
      const { x, y } = hex;

      // Base terrain color
      const terrainColor = hex.terrain?.color || '#6B8E23';
      drawHexShape(ctx, x, y, HEX_SIZE, terrainColor, '#444', 1);

      // Difficult terrain overlay
      if (hex.difficultTerrain) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        drawHexShape(ctx, x, y, HEX_SIZE, 'rgba(255, 255, 0, 0.1)', null, 0);
        ctx.restore();
      }

      // Draw obstacles
      if (hex.blocked) {
        const obstacleType = hex.obstacleType || 'rock';
        if (obstacleType === 'tree') {
          drawTree(ctx, x, y, HEX_SIZE * 0.5);
        } else if (obstacleType === 'rock') {
          drawRock(ctx, x, y, HEX_SIZE * 0.5);
        }
      }
    });

    // Draw movement range overlay
    if (selectedAction === 'move' && combatants[currentTurnIndex]?.position) {
      const currentCombatant = combatants[currentTurnIndex];
      const reachableHexes = calculateReachableHexes(
        currentCombatant.position,
        movementRemaining / 5, // Convert feet to hexes (5 feet per hex)
        battlefield,
        combatants
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
      const attackRange = currentCombatant.attackRange || 1; // Default melee range

      combatants.forEach((target, index) => {
        if (index === currentTurnIndex || !target.position) return;
        if (currentCombatant.isAlly === target.isAlly) return; // Same team

        const distance = getHexDistance(
          currentCombatant.position.col,
          currentCombatant.position.row,
          target.position.col,
          target.position.row
        );

        if (distance <= attackRange) {
          const hasLoS = checkLineOfSight(
            currentCombatant.position,
            target.position,
            battlefield
          );

          const pos = calculateHexPosition(target.position.col, target.position.row, HEX_SIZE);
          const outlineColor = hasLoS ? '#00ff00' : '#ff0000';
          drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, outlineColor, 3);
        }
      });
    }

    // Draw combatants
    combatants.forEach((combatant, index) => {
      const isCurrentTurn = index === currentTurnIndex;
      drawCombatant(ctx, combatant, isCurrentTurn);
    });

    // Draw hovered hex
    if (hoveredHex) {
      const pos = calculateHexPosition(hoveredHex.col, hoveredHex.row, HEX_SIZE);
      drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, '#ffffff', 2);
    }

    ctx.restore();
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
    drawCombatant
  ]);

  /**
   * Animation loop for smooth rendering
   */
  useEffect(() => {
    const animate = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  /**
   * Resize canvas to fill parent container
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  /**
   * Convert screen coordinates to canvas coordinates (accounting for camera transform)
   * @param {number} clientX - Screen X coordinate
   * @param {number} clientY - Screen Y coordinate
   * @returns {Object} - {x, y} canvas coordinates
   */
  const screenToCanvas = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - cameraOffset.x) / cameraZoom;
    const y = (clientY - rect.top - cameraOffset.y) / cameraZoom;

    return { x, y };
  }, [cameraOffset, cameraZoom]);

  /**
   * Handle mouse down (start dragging)
   */
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cameraOffset.x, y: e.clientY - cameraOffset.y });
  }, [cameraOffset]);

  /**
   * Handle mouse move (pan camera or hover)
   */
  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      // Pan camera
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      onCameraChange(newOffset, cameraZoom);
    } else {
      // Hover detection
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      
      // Create positioned hexes for hit detection
      const positionedHexes = battlefield.hexes.map(hex => {
        const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
        return { ...hex, x: pos.x, y: pos.y };
      });

      const hoveredHex = findHexAtPoint(canvasPos.x, canvasPos.y, positionedHexes, HEX_SIZE);
      onHexHover(hoveredHex);
    }
  }, [isDragging, dragStart, cameraZoom, battlefield.hexes, screenToCanvas, onCameraChange, onHexHover]);

  /**
   * Handle mouse up (stop dragging)
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Handle mouse click (hex selection)
   */
  const handleClick = useCallback((e) => {
    // Don't register clicks if we were dragging
    if (isDragging) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    // Create positioned hexes for hit detection
    const positionedHexes = battlefield.hexes.map(hex => {
      const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
      return { ...hex, x: pos.x, y: pos.y };
    });

    const clickedHex = findHexAtPoint(canvasPos.x, canvasPos.y, positionedHexes, HEX_SIZE);
    if (clickedHex) {
      onHexClick(clickedHex);
    }
  }, [isDragging, battlefield.hexes, screenToCanvas, onHexClick]);

  /**
   * Handle mouse wheel (zoom)
   */
  const handleWheel = useCallback((e) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? (1 - ZOOM_SPEED) : (1 + ZOOM_SPEED);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cameraZoom * delta));

    onCameraChange(cameraOffset, newZoom);
  }, [cameraZoom, cameraOffset, onCameraChange]);

  /**
   * Calculate distance between two touch points
   */
  const getTouchDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /**
   * Handle touch start (pan or zoom)
   */
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      // Single touch: start panning
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - cameraOffset.x,
        y: e.touches[0].clientY - cameraOffset.y
      });
    } else if (e.touches.length === 2) {
      // Two touches: start zooming
      setIsDragging(false);
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setLastTouchDistance(distance);
    }
  }, [cameraOffset]);

  /**
   * Handle touch move (pan or zoom)
   */
  const handleTouchMove = useCallback((e) => {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      // Single touch: pan
      const newOffset = {
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      };
      onCameraChange(newOffset, cameraZoom);
    } else if (e.touches.length === 2 && lastTouchDistance !== null) {
      // Two touches: zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const delta = distance / lastTouchDistance;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cameraZoom * delta));

      onCameraChange(cameraOffset, newZoom);
      setLastTouchDistance(distance);
    }
  }, [isDragging, dragStart, cameraZoom, cameraOffset, lastTouchDistance, onCameraChange]);

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setLastTouchDistance(null);
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
        touchAction: 'none'
      }}
    />
  );
}

CombatCanvas.propTypes = {
  battlefield: PropTypes.shape({
    hexes: PropTypes.arrayOf(PropTypes.shape({
      col: PropTypes.number.isRequired,
      row: PropTypes.number.isRequired,
      terrain: PropTypes.object,
      blocked: PropTypes.bool,
      obstacleType: PropTypes.string,
      difficultTerrain: PropTypes.bool,
      blocksLineOfSight: PropTypes.bool
    })).isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired
  }).isRequired,
  combatants: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    position: PropTypes.shape({
      col: PropTypes.number.isRequired,
      row: PropTypes.number.isRequired
    }),
    currentHP: PropTypes.number.isRequired,
    maxHP: PropTypes.number.isRequired,
    isAlly: PropTypes.bool.isRequired,
    characterClass: PropTypes.string,
    attackRange: PropTypes.number
  })).isRequired,
  currentTurnIndex: PropTypes.number.isRequired,
  selectedAction: PropTypes.oneOf(['move', 'attack', 'spell', 'ability', null]),
  hoveredHex: PropTypes.shape({
    col: PropTypes.number.isRequired,
    row: PropTypes.number.isRequired
  }),
  movementRemaining: PropTypes.number.isRequired,
  onHexClick: PropTypes.func.isRequired,
  onHexHover: PropTypes.func.isRequired,
  cameraOffset: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  cameraZoom: PropTypes.number.isRequired,
  onCameraChange: PropTypes.func.isRequired
};

export default CombatCanvas;
