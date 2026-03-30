// XP table for levels 1-60
// Exponential curve; at 51+ a portion goes to AA pool
const XP_TABLE = (() => {
  const table = [0]; // index 0 unused; level 1 needs 0 XP (already level 1)
  for (let lvl = 1; lvl <= 60; lvl++) {
    // Base formula: exponential growth, roughly Everquest-like
    const base = Math.floor(1000 * Math.pow(1.15, lvl - 1));
    table.push(base);
  }
  return table;
})();

const AA_LIST = [
  { id: 'combat_fury', name: 'Combat Fury', maxRank: 5, rankBonus: 0.02, stat: 'damageBonus', description: '+2% melee damage per rank' },
  { id: 'natural_durability', name: 'Natural Durability', maxRank: 5, rankBonus: 0.02, stat: 'hpBonus', description: '+2% max HP per rank' },
  { id: 'mental_clarity', name: 'Mental Clarity', maxRank: 5, rankBonus: 0.02, stat: 'manaRegenBonus', description: '+2% mana regen per rank' },
  { id: 'innate_run_speed', name: 'Innate Run Speed', maxRank: 3, rankBonus: 0.1, stat: 'moveSpeedBonus', description: '+10% move speed per rank' },
  { id: 'ambidexterity', name: 'Ambidexterity', maxRank: 5, rankBonus: 0.05, stat: 'dualWieldBonus', description: '+5% dual wield damage per rank' }
];

// AA cost per rank: scales with rank number
function getAACost(rank) {
  return 3 + (rank - 1) * 3; // rank 1=3, rank 2=6, rank 3=9, etc.
}

export class ProgressionSystem {
  constructor(gameState, eventBus) {
    this.gameState = gameState;
    this.eventBus = eventBus;
    this.aaList = AA_LIST;
    this.xpTable = XP_TABLE;

    // Listen for XP gain events
    this.eventBus.on('xp_gain', ({ amount }) => this.gainXP(amount));
  }

  update(delta, tick) {
    // Passive HP/mana regen every tick
    const player = this.gameState.player;
    if (!this.gameState.combat.inCombat) {
      // Out-of-combat regen: ~1% per tick
      const hpRegen = Math.max(1, Math.floor(player.maxHp * 0.01));
      const manaRegen = Math.max(1, Math.floor(player.maxMana * 0.01));
      player.currentHp = Math.min(player.maxHp, (player.currentHp || 0) + hpRegen);
      player.currentMana = Math.min(player.maxMana, (player.currentMana || 0) + manaRegen);
    }
  }

  gainXP(amount) {
    const player = this.gameState.player;
    if (player.level >= 60) {
      // All XP at 60 goes to AA
      this.gainAA(Math.floor(amount / 1000));
      return;
    }

    // At level 51+, 50% of XP goes to AA pool
    if (player.level >= 51) {
      const aaXP = Math.floor(amount * 0.5);
      this.gainAA(Math.floor(aaXP / 500));
      amount = Math.floor(amount * 0.5);
    }

    player.xp = (player.xp || 0) + amount;
    player.totalXP = (player.totalXP || 0) + amount;

    // Check for level up
    const needed = this.xpTable[player.level + 1] || Infinity;
    if (player.xp >= needed) {
      player.xp -= needed;
      this.levelUp();
    }

    this.eventBus.emit('xp_updated', { xp: player.xp, needed: this.xpTable[player.level + 1] || 0 });
  }

  levelUp() {
    const player = this.gameState.player;
    player.level = (player.level || 1) + 1;

    // Recalculate stats on level up
    const hpGain = 10 + Math.floor(player.sta / 10);
    const manaGain = player.int > 70 || player.wis > 70
      ? 10 + Math.floor(Math.max(player.int, player.wis) / 10)
      : 0;

    player.maxHp = (player.maxHp || 100) + hpGain;
    player.maxMana = (player.maxMana || 0) + manaGain;
    player.currentHp = player.maxHp;
    player.currentMana = player.maxMana;
    player.ac = (player.ac || 0) + 2;

    this.eventBus.emit('levelup', {
      level: player.level,
      hpGain,
      manaGain
    });
  }

  gainAA(points) {
    if (points <= 0) return;
    const player = this.gameState.player;
    player.aaPoints = (player.aaPoints || 0) + points;
    player.totalAA = (player.totalAA || 0) + points;
    this.eventBus.emit('aa_gained', { points, total: player.aaPoints });
  }

  spendAA(aaId) {
    const player = this.gameState.player;
    const aa = this.aaList.find(a => a.id === aaId);
    if (!aa) return { success: false, reason: 'Unknown AA' };

    if (!player.aaSpent) player.aaSpent = {};
    const currentRank = player.aaSpent[aaId] || 0;
    if (currentRank >= aa.maxRank) return { success: false, reason: 'AA maxed' };

    const cost = getAACost(currentRank + 1);
    if ((player.aaPoints || 0) < cost) return { success: false, reason: 'Not enough AA points' };

    player.aaPoints -= cost;
    player.aaSpent[aaId] = currentRank + 1;

    // Apply AA effect to gameState
    if (!player.aaEffects) player.aaEffects = {};
    player.aaEffects[aa.stat] = ((player.aaEffects[aa.stat] || 0) + aa.rankBonus);

    this.eventBus.emit('aa_spent', { aaId, rank: currentRank + 1, stat: aa.stat });
    return { success: true, rank: currentRank + 1 };
  }

  getXPNeeded() {
    const level = this.gameState.player.level || 1;
    return this.xpTable[level + 1] || 0;
  }

  getAAList() {
    const player = this.gameState.player;
    return this.aaList.map(aa => ({
      ...aa,
      currentRank: (player.aaSpent || {})[aa.id] || 0,
      nextCost: getAACost(((player.aaSpent || {})[aa.id] || 0) + 1)
    }));
  }
}
