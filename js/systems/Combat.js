import { eventBus } from '../engine/EventBus.js';

const AUTO_ATTACK_TICKS = 2;
const SPELL_CAST_TICKS = 5;

export class CombatSystem {
  constructor(gameState, data) {
    this.gameState = gameState;
    this.monsters = data.monsters;
    this.items = data.items;
    this._attackTick = 0;
    this._spellTick = 0;
    this._castingSpell = null;
  }

  update(delta, tick) {
    const combat = this.gameState.combat;
    if (!combat.active || !combat.enemyId) return;

    const monster = this.monsters.find(m => m.id === combat.enemyId);
    if (!monster) { this.endCombat(); return; }

    // Auto-attack
    this._attackTick++;
    if (this._attackTick >= AUTO_ATTACK_TICKS) {
      this._attackTick = 0;
      this._doAutoAttack(monster);
    }

    // Spell cast progress
    if (this._castingSpell) {
      this._spellTick++;
      combat.castProgress = Math.min(1, this._spellTick / SPELL_CAST_TICKS);
      if (this._spellTick >= SPELL_CAST_TICKS) {
        this._resolveSpell(this._castingSpell, monster);
        this._castingSpell = null;
        this._spellTick = 0;
        combat.castProgress = 0;
      }
      eventBus.emit('combat_update', { combat });
      return;
    }

    // Monster attacks back
    this._doMonsterAttack(monster);

    // Check death
    if (combat.enemyHp <= 0) {
      this.onKill(monster);
      return;
    }
    if (this.gameState.player.hp <= 0) {
      this.onDeath();
      return;
    }

    eventBus.emit('combat_update', { combat });
  }

  _doAutoAttack(monster) {
    const player = this.gameState.player;
    const dmg = this._calcPlayerDamage();
    this.gameState.combat.enemyHp = Math.max(0, this.gameState.combat.enemyHp - dmg);
    eventBus.emit('combat_hit', { source: 'player', target: monster.name, damage: dmg });
  }

  _doMonsterAttack(monster) {
    const dmg = Math.floor(monster.minDamage + Math.random() * (monster.maxDamage - monster.minDamage));
    this.gameState.player.hp = Math.max(0, this.gameState.player.hp - dmg);
    eventBus.emit('combat_hit', { source: monster.name, target: 'player', damage: dmg });
  }

  _calcPlayerDamage() {
    const player = this.gameState.player;
    const str = (player.stats && player.stats.str) || 75;
    const base = Math.floor(5 + player.level * 1.5 + str * 0.1);
    return Math.max(1, base + Math.floor(Math.random() * base * 0.5));
  }

  castSpell(spell) {
    if (this._castingSpell) return;
    const player = this.gameState.player;
    if (player.mana < spell.manaCost) {
      eventBus.emit('notification', { message: 'Not enough mana!', type: 'info' });
      return;
    }
    player.mana -= spell.manaCost;
    this._castingSpell = spell;
    this._spellTick = 0;
    this.gameState.combat.castProgress = 0;
    eventBus.emit('cast_start', { spell });
  }

  _resolveSpell(spell, monster) {
    const combat = this.gameState.combat;
    const player = this.gameState.player;
    switch (spell.effect) {
      case 'nuke':
      case 'nuke_undead':
        if (spell.effect === 'nuke_undead' && !monster.isUndead) {
          eventBus.emit('notification', { message: `${spell.name} only affects undead!`, type: 'info' });
          return;
        }
        combat.enemyHp = Math.max(0, combat.enemyHp - spell.effectValue);
        eventBus.emit('combat_hit', { source: 'spell', target: monster.name, damage: spell.effectValue, spellName: spell.name });
        break;
      case 'heal':
        player.hp = Math.min(player.maxHp, player.hp + spell.effectValue);
        eventBus.emit('notification', { message: `Healed for ${spell.effectValue} HP!`, type: 'success' });
        break;
      case 'lifetap':
        combat.enemyHp = Math.max(0, combat.enemyHp - spell.effectValue);
        player.hp = Math.min(player.maxHp, player.hp + spell.effectValue);
        eventBus.emit('combat_hit', { source: 'lifetap', target: monster.name, damage: spell.effectValue, spellName: spell.name });
        break;
      case 'dot':
        combat.dot = (combat.dot || 0) + spell.effectValue;
        eventBus.emit('notification', { message: `${spell.name} applied!`, type: 'info' });
        break;
      default:
        eventBus.emit('notification', { message: `${spell.name} cast!`, type: 'info' });
    }
  }

  startCombat(monsterId) {
    const monster = this.monsters.find(m => m.id === monsterId);
    if (!monster) return;
    const combat = this.gameState.combat;
    combat.active = true;
    combat.enemyId = monsterId;
    combat.enemyHp = monster.hp;
    combat.castProgress = 0;
    combat.dot = 0;
    this._attackTick = 0;
    this._castingSpell = null;
    eventBus.emit('combat_start', { monster });
  }

  endCombat() {
    const combat = this.gameState.combat;
    combat.active = false;
    combat.enemyId = null;
    combat.enemyHp = 0;
    combat.castProgress = 0;
    this._castingSpell = null;
    eventBus.emit('combat_end', {});
  }

  onKill(monster) {
    const player = this.gameState.player;
    // Award XP
    player.xp = (player.xp || 0) + monster.xpReward;
    // Award gold
    player.gold = (player.gold || 0) + monster.goldReward;
    // Roll loot
    const loot = [];
    if (monster.lootTable) {
      for (const entry of monster.lootTable) {
        if (Math.random() < entry.dropChance) {
          const item = this.items.find(i => i.id === entry.itemId);
          if (item) {
            this.gameState.inventory.push({ ...item, qty: 1 });
            loot.push(item);
            eventBus.emit('loot', { item });
          }
        }
      }
    }
    // Update loot log
    for (const item of loot) {
      this.gameState.combat.lootLog.unshift(item.name);
      if (this.gameState.combat.lootLog.length > 10) this.gameState.combat.lootLog.pop();
    }
    // Check for faction social aggro (mock — real social aggro handled in ZonesSystem)
    eventBus.emit('kill', { monster, xp: monster.xpReward, gold: monster.goldReward, loot });
    eventBus.emit('xp_gained', { amount: monster.xpReward });
    this.endCombat();
  }

  onDeath() {
    const player = this.gameState.player;
    // Lose 10% of current XP
    const xpLoss = Math.floor((player.xp || 0) * 0.1);
    player.xp = Math.max(0, (player.xp || 0) - xpLoss);
    player.hp = Math.floor(player.maxHp * 0.1);
    this.endCombat();
    eventBus.emit('death', { xpLoss });
    eventBus.emit('notification', { message: `You have died! Lost ${xpLoss} XP.`, type: 'death' });
  }
}
