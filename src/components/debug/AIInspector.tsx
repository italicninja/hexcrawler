// @ts-nocheck
/**
 * AIInspector - Visual AI debugging tool
 * Shows behavior tree, target scoring, and last decisions
 */

import { useState, useEffect } from 'react';
import { AIEngine } from '../../game/ai/AIEngine';
import './AIInspector.css';

function AIInspector({ combatState }) {
  const [selectedCombatant, setSelectedCombatant] = useState(null);
  const [aiConfig, setAiConfig] = useState(null);

  // Show inspector for current enemy turn
  useEffect(() => {
    if (!combatState) {
      setSelectedCombatant(null);
      setAiConfig(null);
      return;
    }

    const current = combatState.turnOrder[combatState.currentTurnIndex];
    if (current && current.isEnemy) {
      setSelectedCombatant(current);
      setAiConfig(current.aiConfig);
    } else {
      setSelectedCombatant(null);
      setAiConfig(null);
    }
  }, [combatState?.currentTurnIndex, combatState]);

  // Hot-reload AI
  const handleReloadAI = async () => {
    if (!selectedCombatant) return;

    const enemy = selectedCombatant.enemy;
    const newConfig = await AIEngine.loadAI(enemy.family, enemy.variant, true); // force reload
    setAiConfig(newConfig);
    selectedCombatant.aiConfig = newConfig;
    enemy.aiConfig = newConfig;
  };

  if (!selectedCombatant || !aiConfig) {
    return (
      <div className="ai-inspector">
        <h3>AI Inspector</h3>
        <p className="no-ai">No enemy turn active. AI Inspector shows when enemy is thinking.</p>
      </div>
    );
  }

  return (
    <div className="ai-inspector">
      <div className="ai-inspector-header">
        <h3>AI Inspector: {selectedCombatant.enemy.name}</h3>
        <button onClick={handleReloadAI} className="reload-btn">
          Reload AI
        </button>
      </div>

      <div className="ai-info">
        <p>
          <strong>Family:</strong> {aiConfig.family}
        </p>
        {aiConfig.variant && (
          <p>
            <strong>Variant:</strong> {aiConfig.variant}
          </p>
        )}
        <p>
          <strong>HP:</strong> {selectedCombatant.currentHP}/{selectedCombatant.maxHP} (
          {Math.round((selectedCombatant.currentHP / selectedCombatant.maxHP) * 100)}
          %)
        </p>
      </div>

      <div className="ai-tree">
        <h4>Behavior Tree</h4>
        <TreeViewer tree={aiConfig.tree} />
      </div>

      <div className="ai-scorers">
        <h4>Target Scorers</h4>
        {aiConfig.scorers && Object.keys(aiConfig.scorers).length > 0 ? (
          Object.entries(aiConfig.scorers).map(([actionType, scorers]) => (
            <div key={actionType} className="scorer-group">
              <h5>{actionType}</h5>
              <ul>
                {scorers.map((scorer, i) => (
                  <li key={i}>
                    {scorer.type} - weight: {scorer.weight}
                    {scorer.curve && ` (${scorer.curve})`}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="no-scorers">No scorers configured</p>
        )}
      </div>
    </div>
  );
}

/**
 * Tree visualization component
 */
function TreeViewer({ tree, depth = 0 }) {
  if (!tree) return null;

  const indent = depth * 20;

  return (
    <div className="tree-node" style={{ marginLeft: `${indent}px` }}>
      <div className={`node-header node-${tree.type?.toLowerCase()}`}>
        <span className="node-type">{tree.type}</span>
        {tree.name && <span className="node-name"> - {tree.name}</span>}
      </div>

      {tree.check && (
        <div className="node-details">
          Check: {tree.check}
          {tree.value !== undefined && ` = ${tree.value}`}
          {tree.ability && ` (${tree.ability})`}
        </div>
      )}

      {tree.action && (
        <div className="node-details">
          Action: {tree.action}
          {tree.attackType && ` (${tree.attackType})`}
          {tree.needsTarget && ' [needs target]'}
        </div>
      )}

      {tree.children && tree.children.length > 0 && (
        <div className="tree-children">
          {tree.children.map((child, i) => (
            <TreeViewer key={i} tree={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AIInspector;
