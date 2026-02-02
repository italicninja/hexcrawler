/**
 * Quest.js
 * Quest management system with objectives, rewards, and completion tracking
 */

export const QuestStatus = {
  AVAILABLE: 'available',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const ObjectiveType = {
  KILL: 'kill',
  COLLECT: 'collect',
  VISIT: 'visit',
  DELIVER: 'deliver',
};

/**
 * Quest class
 * Manages quest state, objectives, and completion
 */
export class Quest {
  constructor(config = {}) {
    this.id = config.id || `quest_${Date.now()}`;
    this.title = config.title || 'Untitled Quest';
    this.description = config.description || '';
    this.objectives = config.objectives || [];
    this.rewards = config.rewards || { xp: 0, gold: 0, items: [] };
    this.status = config.status || QuestStatus.AVAILABLE;
    this.questGiver = config.questGiver || 'Unknown';
    this.location = config.location || 'Unknown';
  }

  /**
   * Check if all objectives are complete
   * @returns {boolean}
   */
  isComplete() {
    if (this.objectives.length === 0) return false;
    return this.objectives.every(obj => obj.current >= obj.required);
  }

  /**
   * Get quest completion percentage
   * @returns {number} 0-100
   */
  getProgress() {
    if (this.objectives.length === 0) return 0;

    const totalProgress = this.objectives.reduce((sum, obj) => {
      const objProgress = Math.min(obj.current, obj.required) / obj.required;
      return sum + objProgress;
    }, 0);

    return Math.round((totalProgress / this.objectives.length) * 100);
  }

  /**
   * Update progress for a specific objective
   * @param {number} objectiveIndex - Index of objective to update
   * @param {number} amount - Amount to increment (default 1)
   * @returns {boolean} - Whether objective was updated
   */
  updateObjective(objectiveIndex, amount = 1) {
    if (objectiveIndex < 0 || objectiveIndex >= this.objectives.length) {
      return false;
    }

    const objective = this.objectives[objectiveIndex];
    objective.current = Math.min(objective.current + amount, objective.required);
    return true;
  }

  /**
   * Update progress for objectives matching criteria
   * @param {string} type - Objective type (kill, collect, visit, deliver)
   * @param {string} target - Target identifier
   * @param {number} amount - Amount to increment
   * @returns {boolean} - Whether any objectives were updated
   */
  updateObjectivesByTarget(type, target, amount = 1) {
    let updated = false;

    this.objectives.forEach((objective, index) => {
      if (objective.type === type && objective.target === target) {
        this.updateObjective(index, amount);
        updated = true;
      }
    });

    return updated;
  }

  /**
   * Get objectives that are incomplete
   * @returns {Array}
   */
  getIncompleteObjectives() {
    return this.objectives.filter(obj => obj.current < obj.required);
  }

  /**
   * Get objectives that are complete
   * @returns {Array}
   */
  getCompleteObjectives() {
    return this.objectives.filter(obj => obj.current >= obj.required);
  }

  /**
   * Serialize quest to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      objectives: this.objectives.map(obj => ({ ...obj })), // Deep copy
      rewards: { ...this.rewards, items: [...this.rewards.items] }, // Deep copy
      status: this.status,
      questGiver: this.questGiver,
      location: this.location,
    };
  }

  /**
   * Deserialize quest from JSON
   * @param {Object} json
   * @returns {Quest}
   */
  static fromJSON(json) {
    return new Quest({
      id: json.id,
      title: json.title,
      description: json.description,
      objectives: json.objectives.map(obj => ({ ...obj })), // Deep copy
      rewards: { ...json.rewards, items: [...(json.rewards.items || [])] }, // Deep copy
      status: json.status,
      questGiver: json.questGiver,
      location: json.location,
    });
  }

  /**
   * Create a kill objective
   * @param {string} target - Enemy name
   * @param {number} required - Number to kill
   * @returns {Object}
   */
  static createKillObjective(target, required) {
    return {
      type: ObjectiveType.KILL,
      target,
      current: 0,
      required,
      description: `Defeat ${required} ${target}${required > 1 ? 's' : ''}`,
    };
  }

  /**
   * Create a collect objective
   * @param {string} target - Item name
   * @param {number} required - Number to collect
   * @returns {Object}
   */
  static createCollectObjective(target, required) {
    return {
      type: ObjectiveType.COLLECT,
      target,
      current: 0,
      required,
      description: `Collect ${required} ${target}${required > 1 ? 's' : ''}`,
    };
  }

  /**
   * Create a visit objective
   * @param {string} target - Location name or POI type
   * @param {number} required - Number to visit (usually 1)
   * @returns {Object}
   */
  static createVisitObjective(target, required = 1) {
    return {
      type: ObjectiveType.VISIT,
      target,
      current: 0,
      required,
      description: `Visit ${target}`,
    };
  }

  /**
   * Create a deliver objective
   * @param {string} target - Item name
   * @param {string} recipient - NPC name
   * @param {number} required - Number to deliver (usually 1)
   * @returns {Object}
   */
  static createDeliverObjective(target, recipient, required = 1) {
    return {
      type: ObjectiveType.DELIVER,
      target,
      recipient,
      current: 0,
      required,
      description: `Deliver ${required} ${target}${required > 1 ? 's' : ''} to ${recipient}`,
    };
  }
}

export default Quest;
