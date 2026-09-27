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
  CLEAR: 'clear',
} as const;

/**
 * Targets are ids, not display names: VISIT/CLEAR target a "col,row" hex key, DELIVER
 * targets an item name and its recipient is the destination hex key.
 */
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
  /** Hex key of the settlement to hand the quest in at; absent = completes on its own. */
  turnInAt?: string;
  /** Item configs put in the player's inventory on accept (e.g. a courier's letter). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grantItems?: any[];
  /** Hex keys marked as discovered on accept (e.g. places circled on a map). */
  reveal?: string[];
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
  turnInAt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grantItems: any[];
  reveal: string[];

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
    this.turnInAt = config.turnInAt;
    this.grantItems = config.grantItems || [];
    this.reveal = config.reveal || [];
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
      turnInAt: this.turnInAt,
      grantItems: this.grantItems.map(item => ({ ...item })),
      reveal: [...this.reveal],
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
      turnInAt: json.turnInAt,
      grantItems: (json.grantItems || []).map((item: object) => ({ ...item })),
      reveal: [...(json.reveal || [])],
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
   * Create a visit objective (reach the hex)
   */
  static createVisitObjective(hexKey: string, description: string): QuestObjective {
    return { type: ObjectiveType.VISIT, target: hexKey, current: 0, required: 1, description };
  }

  /**
   * Create a clear objective (defeat the site's encounter, or its boss for dungeons/towers)
   */
  static createClearObjective(hexKey: string, description: string): QuestObjective {
    return { type: ObjectiveType.CLEAR, target: hexKey, current: 0, required: 1, description };
  }

  /**
   * Create a deliver objective (carry the named item to the recipient hex)
   */
  static createDeliverObjective(
    itemName: string,
    recipientHexKey: string,
    description: string
  ): QuestObjective {
    return {
      type: ObjectiveType.DELIVER,
      target: itemName,
      recipient: recipientHexKey,
      current: 0,
      required: 1,
      description,
    };
  }
}

export default Quest;
