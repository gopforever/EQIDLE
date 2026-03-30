import { eventBus } from '../engine/EventBus.js';

// XP required to reach each level (index = level, value = total XP needed)
const XP_TABLE = (() => {
  const table = [0, 0]; // level 0 unused, level 1 = 0 XP
  for (let lv = 2; lv <= 60; lv++) {
    // Classic EQ-style curve
    const prev = table[lv - 1];
    const needed = Math.floor(1000 * Math.pow(lv - 1, 1.75));
    table.push(prev + needed);
  }
  return table;
})();

// AA abilities available at 51+
const AA_ABILITIES = [
  { id: 'combat_fury', name: 'Combat Fury', maxRank: 5, description: 'Increases critical hit chance by 2% per rank.' },
  { id: 'natural_durability', name: 'Natural Durability', maxRank: 5, description: 'Increases max HP by 50 per rank.' },
  { id: 'mental_clarity', name: 'Mental Clarity', maxRank: 5, description: 'Increases mana regeneration by 1 per rank.' },
  { id: 'innate_run_speed', name: 'Innate Run Speed', maxRank: 5, description: 'Increases movement speed by 5% per rank.' },
  { id: 'ambidexterity', name: 'Ambidexterity', maxRank: 5, description: 'Reduces dual wield penalty by 5% per rank.' }
];

export class ProgressionSystem {
  constructor(gameState) {
    this.gameState = gameState;
    this.xpTable = XP_TABLE;
    this.aaAbilities = AA_ABILITIES;
  }

  update(delta, tick) {
    this._checkLevelUp();
  }

  _checkLevelUp() {
    const player = this.gameState.player;
    if (player.level >= 60) return;
    const nextLvXp = this.xpTable[player.level + 1];
    if (player.xp >= nextLvXp) {
      this.levelUp();
    }
  }

  levelUp() {
    const player = this.gameState.player;
    if (player.level >= 60) return;
    player.level++;
    // Increase stats
    player.maxHp += 20;
    player.hp = player.maxHp;
    player.maxMana += 15;
    player.mana = player.maxMana;
    player.maxEndurance += 10;
    player.endurance = player.maxEndurance;
    // Grant AA at 51+
    if (player.level >= 51) {
      player.aaPoints = (player.aaPoints || 0) + 1;
    }
    eventBus.emit('levelup', { level: player.level });
    eventBus.emit('notification', { message: `You have reached level ${player.level}!`, type: 'levelup' });
  }

  getXpToNext() {
    const player = this.gameState.player;
    if (player.level >= 60) return 0;
    return this.xpTable[player.level + 1] - (player.xp || 0);
  }

  getXpPercent() {
    const player = this.gameState.player;
    if (player.level >= 60) return 100;
    const curLvXp = this.xpTable[player.level] || 0;
    const nextLvXp = this.xpTable[player.level + 1] || 1;
    const xp = player.xp || 0;
    return Math.min(100, Math.floor(((xp - curLvXp) / (nextLvXp - curLvXp)) * 100));
  }

  spendAA(abilityId) {
    const player = this.gameState.player;
    if ((player.aaPoints || 0) <= 0) return false;
    const ability = this.aaAbilities.find(a => a.id === abilityId);
    if (!ability) return false;
    const spent = player.aaSpent || {};
    const currentRank = spent[abilityId] || 0;
    if (currentRank >= ability.maxRank) return false;
    player.aaPoints--;
    spent[abilityId] = currentRank + 1;
    player.aaSpent = spent;
    eventBus.emit('aa_spent', { abilityId, rank: currentRank + 1 });
    return true;
  }

  getAAAbilities() {
    return this.aaAbilities.map(a => ({
      ...a,
      currentRank: (this.gameState.player.aaSpent || {})[a.id] || 0
    }));
  }
}
