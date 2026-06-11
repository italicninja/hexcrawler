/**
 * Quest.ts
 * Quest management system with objectives, rewards, and completion tracking
 */

export const QuestStatus = {
  AVAILABLE: 'available',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const ObjectiveType = {
  KILL: 'kill',
  COLLECT: 'collect',
  VISIT: 'visit',
  DELIVER: 'deliver',
} as const;

export interface QuestObjective {
  type: string;
  target: string;
  recipient?: string;
  current: number;
  required: number;
  description: string;
}

export interface QuestRewards {
  xp: number;
  gold: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
}

export interface QuestConfig {
  id?: string;
  title?: string;
  description?: string;
  objectives?: QuestObjective[];
  rewards?: QuestRewards;
  status?: string;
  questGiver?: string;
  location?: string;
  /** Recommended/difficulty level for the quest (set by QuestGenerator). */
  level?: number;
}

/**
 * Quest class
 * Manages quest state, objectives, and completion
 */
export class Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  status: string;
  questGiver: string;
  location: string;
  level: number;

  constructor(config: QuestConfig = {}) {
    this.id = config.id || `quest_${Date.now()}`;
    this.title = config.title || 'Untitled Quest';
    this.description = config.description || '';
    this.objectives = config.objectives || [];
    this.rewards = config.rewards || { xp: 0, gold: 0, items: [] };
    this.status = config.status || QuestStatus.AVAILABLE;
    this.questGiver = config.questGiver || 'Unknown';
    this.location = config.location || 'Unknown';
    this.level = config.level ?? 1;
  }

  /**
   * Check if all objectives are complete
   */
  isComplete(): boolean {
    if (this.objectives.length === 0) return false;
    return this.objectives.every(obj => obj.current >= obj.required);
  }

  /**
   * Get quest completion percentage
   * @returns 0-100
   */
  getProgress(): number {
    if (this.objectives.length === 0) return 0;

    const totalProgress = this.objectives.reduce((sum, obj) => {
      const objProgress = Math.min(obj.current, obj.required) / obj.required;
      return sum + objProgress;
    }, 0);

    return Math.round((totalProgress / this.objectives.length) * 100);
  }

  /**
   * Update progress for a specific objective
   */
  updateObjective(objectiveIndex: number, amount = 1): boolean {
    if (objectiveIndex < 0 || objectiveIndex >= this.objectives.length) {
      return false;
    }

    const objective = this.objectives[objectiveIndex];
    objective.current = Math.min(objective.current + amount, objective.required);
    return true;
  }

  /**
   * Update progress for objectives matching criteria
   */
  updateObjectivesByTarget(type: string, target: string, amount = 1): boolean {
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
   */
  getIncompleteObjectives(): QuestObjective[] {
    return this.objectives.filter(obj => obj.current < obj.required);
  }

  /**
   * Get objectives that are complete
   */
  getCompleteObjectives(): QuestObjective[] {
    return this.objectives.filter(obj => obj.current >= obj.required);
  }

  /**
   * Serialize quest to JSON
   */
  toJSON(): QuestConfig & { id: string } {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      objectives: this.objectives.map(obj => ({ ...obj })), // Deep copy
      rewards: { ...this.rewards, items: [...this.rewards.items] }, // Deep copy
      status: this.status,
      questGiver: this.questGiver,
      location: this.location,
      level: this.level,
    };
  }

  /**
   * Deserialize quest from JSON
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(json: any): Quest {
    return new Quest({
      id: json.id,
      title: json.title,
      description: json.description,
      objectives: json.objectives.map((obj: QuestObjective) => ({ ...obj })), // Deep copy
      rewards: { ...json.rewards, items: [...(json.rewards.items || [])] }, // Deep copy
      status: json.status,
      questGiver: json.questGiver,
      location: json.location,
      level: json.level,
    });
  }

  /**
   * Create a kill objective
   */
  static createKillObjective(target: string, required: number): QuestObjective {
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
   */
  static createCollectObjective(target: string, required: number): QuestObjective {
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
   */
  static createVisitObjective(target: string, required = 1): QuestObjective {
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
   */
  static createDeliverObjective(target: string, recipient: string, required = 1): QuestObjective {
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
