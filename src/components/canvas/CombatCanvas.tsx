// @ts-nocheck
import { useRef, useEffect, useCallback, useState } from 'react';
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

const HEX_SIZE = 25;
const FIXED_ZOOM = 1.0; // Zoom is disabled - always use 1.0

/**
 * CombatCanvas - Renders 20x20 hex grid battlefield with combatants and interactive controls
 */
// Duration (ms) spent sliding between each individual hex step
const STEP_DURATION_MS = 120;

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
}) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false); // Track if mouse actually moved
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const animationFrameRef = useRef(null);
  const lastHoveredHexRef = useRef(null);
  const lastCameraRef = useRef({ offset: cameraOffset, zoom: FIXED_ZOOM });
  const textureGenerator = useRef(null);

  // Active movement animation state (stored as a ref so rAF reads latest without closures)
  // Shape: { combatantId, path, stepIndex, stepStartTime } | null
  const movementAnimRef = useRef(null);
  // Visual override positions: Map<combatantId, {x, y}> pixel coords
  const visualOverridesRef = useRef(new Map());

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

    if (
      classLower.includes('fighter') ||
      classLower.includes('barbarian') ||
      classLower.includes('paladin')
    ) {
      // Sword icon
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.3);
      ctx.lineTo(x, y + size * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - size * 0.15, y - size * 0.2);
      ctx.lineTo(x + size * 0.15, y - size * 0.2);
      ctx.stroke();
    } else if (
      classLower.includes('wizard') ||
      classLower.includes('sorcerer') ||
      classLower.includes('warlock')
    ) {
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
   * @param {{x:number,y:number}|null} overridePixel - Optional pixel position override for animation
   */
  const drawCombatant = useCallback(
    (ctx, combatant, isCurrentTurn, overridePixel = null) => {
      if (!combatant.position && !overridePixel) return;

      let x, y;
      if (overridePixel) {
        x = overridePixel.x;
        y = overridePixel.y;
      } else {
        const pos = calculateHexPosition(combatant.position.col, combatant.position.row, HEX_SIZE);
        x = pos.x;
        y = pos.y;
      }
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
    },
    [drawClassIcon, drawHPBar]
  );

  /**
   * Main draw function
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('[CombatCanvas] Canvas ref not ready');
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
          hex.terrain,
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
          const hasLoS = checkLineOfSight(currentCombatant.position, target.position, battlefield);

          const pos = calculateHexPosition(target.position.col, target.position.row, HEX_SIZE);
          const outlineColor = hasLoS ? '#00ff00' : '#ff0000';
          drawHexOutline(ctx, pos.x, pos.y, HEX_SIZE, outlineColor, 3);
        }
      });
    }

    // Draw combatants (use animated pixel position if available)
    let drawnCount = 0;
    combatants.forEach((combatant, index) => {
      const overridePixel = visualOverridesRef.current.get(combatant.id) || null;
      if (combatant.position || overridePixel) {
        const isCurrentTurn = index === currentTurnIndex;
        drawCombatant(ctx, combatant, isCurrentTurn, overridePixel);
        drawnCount++;
      } else {
        console.warn('[CombatCanvas] Combatant has no position:', combatant.name);
      }
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

    let rafId = null;
    let running = true;

    const tick = now => {
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
    (clientX, clientY) => {
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
    e => {
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
    e => {
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

        const newHoveredHex = findHexAtPoint(canvasPos.x, canvasPos.y, positionedHexes, HEX_SIZE);

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
    e => {
      // Block clicks while a movement animation is running
      if (movementAnimRef.current) {
        logger.combat.debug('[CombatCanvas] Click ignored - movement animation in progress');
        return;
      }

      console.log('[CombatCanvas] Click event', {
        isDragging,
        hasDragged,
        hasBattlefield: !!battlefield,
      });

      // Don't register clicks if we actually dragged (moved camera)
      if (hasDragged) {
        console.log('[CombatCanvas] Click ignored - was dragging camera');
        return;
      }

      // Null check battlefield
      if (!battlefield || !battlefield.hexes) {
        console.log('[CombatCanvas] Click ignored - no battlefield');
        return;
      }

      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      console.log('[CombatCanvas] Canvas position', canvasPos);

      // Create positioned hexes for hit detection
      const positionedHexes = battlefield.hexes.map(hex => {
        const pos = calculateHexPosition(hex.col, hex.row, HEX_SIZE);
        return { ...hex, x: pos.x, y: pos.y };
      });

      const clickedHex = findHexAtPoint(canvasPos.x, canvasPos.y, positionedHexes, HEX_SIZE);
      console.log('[CombatCanvas] Clicked hex', clickedHex);

      if (clickedHex) {
        console.log('[CombatCanvas] Calling onHexClick with', clickedHex);
        onHexClick(clickedHex);
      } else {
        console.log('[CombatCanvas] No hex found at click position');
      }
    },
    [hasDragged, battlefield, screenToCanvas, onHexClick]
  );

  /**
   * Handle mouse wheel (zoom) - DISABLED for combat
   */
  const handleWheel = useCallback(e => {
    // Note: preventDefault on wheel events can cause warnings
    // Zoom is disabled for combat, so we just ignore the event
  }, []);

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
  const handleTouchStart = useCallback(
    e => {
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
    e => {
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
        touchAction: 'none',
      }}
    />
  );
}

export default CombatCanvas;
