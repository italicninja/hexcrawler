/**
 * AIEngine.js - Hybrid Behavior Tree + Utility AI Engine
 * Core AI decision-making system for enemy combatants
 */

import { executeCondition } from './conditions.js';
import { executeAction } from './actions.js';
import { calculateScore } from './scorers.js';
import logger from '../../utils/logger.js';

/**
 * AI configuration cache
 * Maps "family/variant" to loaded config
 */
const aiCache = new Map();

/**
 * Main AI Engine class
 */
export class AIEngine {
  /**
   * Load AI configuration for a combatant
   * @param {string} familyName - AI family name (e.g., 'goblinoid', 'beast')
   * @param {string|null} variantName - AI variant name (e.g., 'berserker', 'dire')
   * @param {boolean} forceReload - Force reload from server (bypass cache)
   * @returns {Promise<Object>} AI configuration object
   */
  static async loadAI(familyName, variantName = null, forceReload = false) {
    const cacheKey = `${familyName}${variantName ? '/' + variantName : ''}`;

    // Check cache first
    if (!forceReload && aiCache.has(cacheKey)) {
      logger.combat.debug('AI config loaded from cache', { cacheKey });
      return aiCache.get(cacheKey);
    }

    logger.combat.info('Loading AI config', { family: familyName, variant: variantName });

    try {
      // Load family base
      const familyUrl = `/ai/families/${familyName}.json`;
      const familyResponse = await fetch(familyUrl);

      if (!familyResponse.ok) {
        throw new Error(`Failed to load family AI: ${familyUrl}`);
      }

      const familyConfig = await familyResponse.json();

      // Load variant if specified
      let variantConfig = null;
      if (variantName) {
        const variantUrl = `/ai/variants/${variantName}.json`;
        const variantResponse = await fetch(variantUrl);

        if (variantResponse.ok) {
          variantConfig = await variantResponse.json();
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
        error: error.message,
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
  static merge(baseConfig, variantConfig) {
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
  static getFallbackAI() {
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
  static decideAction(combatant, battlefield, turnOrder, movementRemaining) {
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

    if (!actionNode) {
      logger.combat.warn('Behavior tree returned no action', {
        combatant: combatant.name,
      });
      return { type: 'wait' };
    }

    // If action needs a target, use utility scoring to select one
    let target = null;
    if (actionNode.needsTarget) {
      target = this.selectTarget(
        combatant.aiConfig.scorers[actionNode.action],
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
    const action = executeAction(actionNode.action, {
      ...context,
      params: actionNode,
      target,
    });

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
  static traverseTree(node, context) {
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
  static traverseSelector(node, context) {
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
  static traverseSequence(node, context) {
    if (!node.children || node.children.length === 0) {
      logger.combat.warn('Sequence node has no children');
      return null;
    }

    let lastResult = null;

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
  static traverseCondition(node, context) {
    if (!node.check) {
      logger.combat.error('Condition node missing check field');
      return false;
    }

    const result = executeCondition(node.check, {
      ...context,
      params: node,
    });

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
  static selectTarget(scorerConfigs, combatant, turnOrder, battlefield) {
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
      const score = calculateScore(scorerConfigs, {
        combatant,
        target,
        battlefield,
        turnOrder,
      });

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
