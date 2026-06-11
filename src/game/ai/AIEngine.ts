/**
 * AIEngine.js - Hybrid Behavior Tree + Utility AI Engine
 * Core AI decision-making system for enemy combatants
 */

import { executeCondition, type ConditionContext } from './conditions';
import { executeAction } from './actions';
import { calculateScore, type ScorerContext } from './scorers';
import logger from '../../utils/logger';

interface AITreeNode {
  type?: string;
  action?: string;
  check?: string;
  value?: unknown;
  needsTarget?: boolean;
  children?: AITreeNode[];
  [key: string]: unknown;
}

interface AIConfig {
  family?: string;
  variant?: string;
  tree?: AITreeNode;
  scorers?: Record<string, unknown[]>;
  config?: Record<string, unknown>;
  overrides?: {
    tree?: AITreeNode;
    scorers?: Record<string, unknown[]>;
    config?: Record<string, unknown>;
  };
}

interface HexPos {
  col: number;
  row: number;
}

interface Combatant {
  name?: string;
  currentHP: number;
  maxHP: number;
  position?: HexPos;
  isEnemy?: boolean;
  isAlly?: boolean;
  aiConfig?: AIConfig;
  [key: string]: unknown;
}

interface AIContext {
  combatant: Combatant;
  battlefield: unknown;
  turnOrder: Combatant[];
  movementRemaining: number;
}

interface AIAction {
  type: string;
  [key: string]: unknown;
}

/** Tree traversal yields an action node, a condition boolean, or null. */
type TreeResult = AITreeNode | boolean | null;

/**
 * AI configuration cache
 * Maps "family/variant" to loaded config
 */
const aiCache = new Map<string, AIConfig>();

/**
 * Main AI Engine class
 */
export class AIEngine {
  /**
   * Load AI configuration for a combatant.
   */
  static async loadAI(
    familyName: string,
    variantName: string | null = null,
    forceReload = false
  ): Promise<AIConfig> {
    const cacheKey = `${familyName}${variantName ? '/' + variantName : ''}`;

    // Check cache first
    if (!forceReload && aiCache.has(cacheKey)) {
      logger.combat.debug('AI config loaded from cache', { cacheKey });
      return aiCache.get(cacheKey)!;
    }

    logger.combat.info('Loading AI config', { family: familyName, variant: variantName });

    try {
      // Load family base
      const familyUrl = `/ai/families/${familyName}.json`;
      const familyResponse = await fetch(familyUrl);

      if (!familyResponse.ok) {
        throw new Error(`Failed to load family AI: ${familyUrl}`);
      }

      const familyConfig = (await familyResponse.json()) as AIConfig;

      // Load variant if specified
      let variantConfig: AIConfig | null = null;
      if (variantName) {
        const variantUrl = `/ai/variants/${variantName}.json`;
        const variantResponse = await fetch(variantUrl);

        if (variantResponse.ok) {
          variantConfig = (await variantResponse.json()) as AIConfig;
        } else {
          logger.combat.warn('Variant AI not found, using family base', {
            variant: variantName,
          });
        }
      }

      // Merge family + variant
      const mergedConfig = this.merge(familyConfig, variantConfig);

      // Cache result
      aiCache.set(cacheKey, mergedConfig);

      logger.combat.info('AI config loaded successfully', { cacheKey });
      return mergedConfig;
    } catch (error) {
      logger.combat.error('Failed to load AI config', {
        family: familyName,
        variant: variantName,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback AI (wait only)
      return this.getFallbackAI();
    }
  }

  /**
   * Merge family base config with variant overrides
   * @param {Object} baseConfig - Family AI config
   * @param {Object|null} variantConfig - Variant AI config
   * @returns {Object} Merged AI config
   */
  static merge(baseConfig: AIConfig, variantConfig: AIConfig | null): AIConfig {
    if (!variantConfig || !variantConfig.overrides) {
      return baseConfig;
    }

    const overrides = variantConfig.overrides;

    return {
      family: baseConfig.family,
      variant: variantConfig.variant,
      tree: overrides.tree || baseConfig.tree,
      scorers: {
        ...baseConfig.scorers,
        ...overrides.scorers,
      },
      config: {
        ...baseConfig.config,
        ...overrides.config,
      },
    };
  }

  /**
   * Get fallback AI (simple wait behavior)
   * @returns {Object} Fallback AI config
   */
  static getFallbackAI(): AIConfig {
    return {
      family: 'fallback',
      tree: {
        type: 'Action',
        action: 'wait',
      },
      scorers: {},
      config: {},
    };
  }

  /**
   * Decide what action the combatant should take
   * @param {Object} combatant - Combatant object from turnOrder
   * @param {Object} battlefield - Battlefield grid
   * @param {Array} turnOrder - All combatants in combat
   * @param {number} movementRemaining - Movement remaining this turn
   * @returns {Object} Action object { type, target?, destination?, path?, moveCost? }
   */
  static decideAction(
    combatant: Combatant,
    battlefield: unknown,
    turnOrder: Combatant[],
    movementRemaining: number
  ): AIAction {
    logger.combat.info('AI deciding action', {
      combatant: combatant.name,
      hp: `${combatant.currentHP}/${combatant.maxHP}`,
      position: combatant.position,
    });

    // Check if AI config loaded
    if (!combatant.aiConfig) {
      logger.combat.warn('No AI config found, using fallback', {
        combatant: combatant.name,
      });
      return { type: 'wait' };
    }

    // Create context
    const context = {
      combatant,
      battlefield,
      turnOrder,
      movementRemaining,
    };

    // Traverse behavior tree
    const actionNode = this.traverseTree(combatant.aiConfig.tree, context);

    if (!actionNode || typeof actionNode === 'boolean') {
      logger.combat.warn('Behavior tree returned no action', {
        combatant: combatant.name,
      });
      return { type: 'wait' };
    }

    // If action needs a target, use utility scoring to select one
    let target: Combatant | null = null;
    if (actionNode.needsTarget) {
      target = this.selectTarget(
        combatant.aiConfig.scorers?.[actionNode.action ?? ''] ?? [],
        combatant,
        turnOrder,
        battlefield
      );

      if (!target) {
        logger.combat.warn('No valid target found for action', {
          combatant: combatant.name,
          action: actionNode.action,
        });
        return { type: 'wait' };
      }
    }

    // Execute action
    const action = executeAction(actionNode.action ?? 'wait', {
      ...context,
      params: actionNode,
      target,
    } as unknown as Parameters<typeof executeAction>[1]) as AIAction;

    logger.combat.info('AI action decided', {
      combatant: combatant.name,
      actionType: action.type,
      target: target?.name,
    });

    return action;
  }

  /**
   * Traverse behavior tree to find action
   * @param {Object} node - Current tree node
   * @param {Object} context - Execution context
   * @returns {Object|null} Action node or null
   */
  static traverseTree(node: AITreeNode | null | undefined, context: AIContext): TreeResult {
    if (!node) {
      logger.combat.error('Null node in behavior tree');
      return null;
    }

    switch (node.type) {
      case 'Selector':
        return this.traverseSelector(node, context);

      case 'Sequence':
        return this.traverseSequence(node, context);

      case 'Condition':
        return this.traverseCondition(node, context);

      case 'Action':
        return node; // Return action node

      default:
        logger.combat.error('Unknown node type', { type: node.type });
        return null;
    }
  }

  /**
   * Traverse Selector node (try children until one succeeds)
   * @param {Object} node - Selector node
   * @param {Object} context - Execution context
   * @returns {Object|null} First successful child result
   */
  static traverseSelector(node: AITreeNode, context: AIContext): TreeResult {
    if (!node.children || node.children.length === 0) {
      logger.combat.warn('Selector node has no children');
      return null;
    }

    for (const child of node.children) {
      const result = this.traverseTree(child, context);
      if (result) {
        return result; // First success
      }
    }

    return null; // All children failed
  }

  /**
   * Traverse Sequence node (all children must succeed)
   * @param {Object} node - Sequence node
   * @param {Object} context - Execution context
   * @returns {Object|null} Last child result or null if any fails
   */
  static traverseSequence(node: AITreeNode, context: AIContext): TreeResult {
    if (!node.children || node.children.length === 0) {
      logger.combat.warn('Sequence node has no children');
      return null;
    }

    let lastResult: TreeResult = null;

    for (const child of node.children) {
      const result = this.traverseTree(child, context);

      if (child.type === 'Condition') {
        // Condition must succeed for sequence to continue
        if (!result) {
          return null; // Sequence fails
        }
      } else {
        lastResult = result;
      }
    }

    return lastResult;
  }

  /**
   * Traverse Condition node (evaluate condition)
   * @param {Object} node - Condition node
   * @param {Object} context - Execution context
   * @returns {boolean} Condition result
   */
  static traverseCondition(node: AITreeNode, context: AIContext): boolean {
    if (!node.check) {
      logger.combat.error('Condition node missing check field');
      return false;
    }

    const result = executeCondition(node.check, {
      ...context,
      params: node,
    } as unknown as ConditionContext);

    logger.combat.debug('Condition evaluated', {
      check: node.check,
      value: node.value,
      result,
    });

    return result;
  }

  /**
   * Select target using utility scoring
   * @param {Array} scorerConfigs - Scorer configurations from AI config
   * @param {Object} combatant - Current combatant
   * @param {Array} turnOrder - All combatants
   * @param {Object} battlefield - Battlefield grid
   * @returns {Object|null} Highest-scored target or null
   */
  static selectTarget(
    scorerConfigs: unknown[],
    combatant: Combatant,
    turnOrder: Combatant[],
    battlefield: unknown
  ): Combatant | null {
    // Get all valid targets (opposite faction, alive)
    const targets = turnOrder.filter(c => {
      if (c.currentHP <= 0) return false;

      // Opposite faction
      if (combatant.isEnemy) {
        return c.isAlly;
      } else {
        return c.isEnemy;
      }
    });

    if (targets.length === 0) {
      return null;
    }

    if (targets.length === 1) {
      return targets[0];
    }

    // Score each target
    const scores = targets.map(target => {
      // conditions/scorers use their own structurally-compatible combatant types;
      // bridge across the module boundary.
      const score = calculateScore(scorerConfigs as Parameters<typeof calculateScore>[0], {
        combatant,
        target,
        battlefield,
        turnOrder,
      } as unknown as Omit<ScorerContext, 'params'>);

      return { target, score };
    });

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    logger.combat.debug('Target scores', {
      combatant: combatant.name,
      scores: scores.map(s => ({ name: s.target.name, score: s.score.toFixed(2) })),
    });

    // Return highest-scored target
    return scores[0].target;
  }

  /**
   * Clear AI cache (for hot-reloading)
   */
  static clearCache() {
    aiCache.clear();
    logger.combat.info('AI cache cleared');
  }
}

export default AIEngine;
