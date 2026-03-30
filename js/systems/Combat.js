export class CombatSystem {
  constructor(gameState, eventBus) {
    this.gameState = gameState;
    this.eventBus = eventBus;
    this.autoAttackTick = 0;
    this.dotTimers = []; // { spellId, remainingTicks, effectValue, targetType }
  }

  update(delta, tick) {
    const state = this.gameState;
    if (!state.combat.inCombat || !state.combat.currentEnemy) return;

    this.autoAttackTick++;

    // Process DoT timers
    this.dotTimers = this.dotTimers.filter(dot => {
      if (dot.remainingTicks <= 0) return false;
      if (dot.targetType === 'enemy') {
        state.combat.currentEnemy.currentHp = Math.max(
          0,
          state.combat.currentEnemy.currentHp - dot.effectValue
        );
        this.eventBus.emit('dot_tick', { spellId: dot.spellId, damage: dot.effectValue });
        if (state.combat.currentEnemy.currentHp <= 0) {
          this.onKill();
          return false;
        }
      }
      dot.remainingTicks--;
      return dot.remainingTicks > 0;
    });

    // Auto-attack every 2 ticks
    if (this.autoAttackTick % 2 === 0) {
      this.autoAttack();

      // Enemy attacks back every 2 ticks (offset by 1)
      if (state.combat.inCombat && state.combat.currentEnemy) {
        this.enemyAttack();
      }
    }
  }

  startCombat(monster) {
    const state = this.gameState;
    state.combat.inCombat = true;
    state.combat.currentEnemy = {
      ...monster,
      currentHp: monster.hp
    };
    state.combat.currentSpriteClass = monster.spriteClass;
    this.dotTimers = [];
    this.autoAttackTick = 0;
    this.eventBus.emit('combat_start', { enemy: state.combat.currentEnemy });
  }

  autoAttack() {
    const state = this.gameState;
    if (!state.combat.currentEnemy) return;

    const player = state.player;
    const enemy = state.combat.currentEnemy;

    // Base damage calculation using STR and equipped weapon
    const strBonus = Math.floor((player.str - 70) / 10);
    const minDmg = Math.max(1, 2 + strBonus);
    const maxDmg = Math.max(minDmg + 1, 8 + strBonus * 2 + Math.floor(player.level / 5));
    let damage = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;

    // Chance to miss (based on level difference)
    const levelDiff = (enemy.level || 1) - player.level;
    const missChance = Math.min(0.4, Math.max(0.05, 0.05 + levelDiff * 0.05));
    if (Math.random() < missChance) {
      this.eventBus.emit('miss', { type: 'player_miss' });
      return;
    }

    // Critical hit (5% base chance)
    if (Math.random() < 0.05) {
      damage = Math.floor(damage * 2);
      this.eventBus.emit('crit', { damage });
    }

    enemy.currentHp = Math.max(0, enemy.currentHp - damage);
    this.eventBus.emit('damage', { source: 'player', damage, enemyHp: enemy.currentHp });

    this.checkPhaseShift(enemy, enemy.currentHp);

    if (enemy.currentHp <= 0) {
      this.onKill();
    }
  }

  checkPhaseShift(monster, currentHp) {
    if (!monster.phaseSprites || !monster.phaseShift) return;
    const hpPercent = currentHp / monster.hp;
    let newPhaseSprite = monster.spriteClass;
    for (const phase of monster.phaseSprites) {
      if (hpPercent <= phase.hpThreshold) {
        newPhaseSprite = phase.spriteClass;
      }
    }
    if (newPhaseSprite !== this.gameState.combat.currentSpriteClass) {
      this.gameState.combat.currentSpriteClass = newPhaseSprite;
      this.eventBus.emit('phase_shift', {
        monsterId: monster.id,
        newSprite: newPhaseSprite,
        hpPercent
      });
      // Show dramatic notification on phase shift
      if (monster.id === 'kerafyrm') {
        const messages = {
          'monster-kerafyrm_enraged': '⚡ KERAFYRM AWAKENS FULLY — HIS WRATH IS UNLEASHED!',
          'monster-kerafyrm': '🐉 THE SLEEPER ASCENDS TO FULL POWER — ALL IS LOST!'
        };
        this.eventBus.emit('notification', {
          message: messages[newPhaseSprite] || `${monster.name} has entered a new phase!`,
          type: 'death'
        });
      }
    }
  }

  castSpell(spell) {
    const state = this.gameState;
    const player = state.player;

    if (!spell) return { success: false, reason: 'Unknown spell' };
    if (player.currentMana < spell.manaCost) {
      return { success: false, reason: 'Not enough mana' };
    }

    // Check recast timer
    const now = Date.now();
    if (state.spellRecastTimers && state.spellRecastTimers[spell.id] && now < state.spellRecastTimers[spell.id]) {
      return { success: false, reason: 'Spell not ready' };
    }

    player.currentMana -= spell.manaCost;
    if (!state.spellRecastTimers) state.spellRecastTimers = {};
    state.spellRecastTimers[spell.id] = now + spell.recastTime * 1000;

    let result = { success: true, spell };

    switch (spell.effect) {
      case 'heal':
        player.currentHp = Math.min(player.maxHp, player.currentHp + spell.effectValue);
        this.eventBus.emit('heal', { amount: spell.effectValue, spellId: spell.id });
        break;

      case 'nuke': {
        // Caster bonus from INT or WIS
        const statBonus = spell.class === 'cleric' ? Math.floor((player.wis - 70) / 5) : Math.floor((player.int - 70) / 5);
        let damage = spell.effectValue + Math.max(0, statBonus);
        if (state.combat.currentEnemy) {
          state.combat.currentEnemy.currentHp = Math.max(0, state.combat.currentEnemy.currentHp - damage);
          this.eventBus.emit('spell_damage', { damage, spellId: spell.id });
          if (state.combat.currentEnemy.currentHp <= 0) this.onKill();
        }
        break;
      }

      case 'dot':
        if (state.combat.currentEnemy) {
          this.dotTimers.push({
            spellId: spell.id,
            remainingTicks: spell.duration,
            effectValue: Math.floor(spell.effectValue / Math.max(1, spell.duration)),
            targetType: 'enemy'
          });
          this.eventBus.emit('dot_applied', { spellId: spell.id });
        }
        break;

      case 'buff':
        // Buffs are handled by the buff system; just emit the event
        if (!state.activeBuffs) state.activeBuffs = [];
        state.activeBuffs.push({
          spellId: spell.id,
          effectValue: spell.effectValue,
          remainingTicks: spell.duration,
          effect: spell.effect
        });
        this.eventBus.emit('buff_applied', { spellId: spell.id });
        break;

      case 'debuff':
        if (state.combat.currentEnemy) {
          if (!state.combat.currentEnemy.debuffs) state.combat.currentEnemy.debuffs = [];
          state.combat.currentEnemy.debuffs.push({
            spellId: spell.id,
            effectValue: spell.effectValue,
            remainingTicks: spell.duration
          });
          this.eventBus.emit('debuff_applied', { spellId: spell.id });
        }
        break;

      case 'mez':
        if (state.combat.currentEnemy) {
          state.combat.currentEnemy.mezTicks = spell.duration;
          this.eventBus.emit('mez_applied', { spellId: spell.id });
        }
        break;

      case 'pet':
        this.eventBus.emit('summon_pet', { spellId: spell.id, petType: spell.class });
        break;

      case 'port':
        this.eventBus.emit('port', { spellId: spell.id });
        break;

      case 'rez':
        this.eventBus.emit('rez_available', { spellId: spell.id });
        break;

      default:
        break;
    }

    this.eventBus.emit('spell_cast', { spell, result });
    return result;
  }

  enemyAttack() {
    const state = this.gameState;
    const enemy = state.combat.currentEnemy;
    const player = state.player;
    if (!enemy || enemy.mezTicks > 0) {
      if (enemy.mezTicks > 0) enemy.mezTicks--;
      return;
    }

    const minDmg = enemy.minDamage || 1;
    const maxDmg = enemy.maxDamage || 5;
    let damage = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;

    // Apply AC mitigation
    const acMitigation = Math.min(0.75, (player.ac || 0) / 500);
    damage = Math.max(1, Math.floor(damage * (1 - acMitigation)));

    player.currentHp = Math.max(0, player.currentHp - damage);
    this.eventBus.emit('enemy_damage', { damage, playerHp: player.currentHp });

    if (player.currentHp <= 0) {
      this.onDeath();
    }
  }

  onKill() {
    const state = this.gameState;
    const enemy = state.combat.currentEnemy;
    if (!enemy) return;

    // Award XP and gold
    const xpGain = enemy.xpReward || 0;
    const goldGain = enemy.goldReward || 0;

    state.player.gold = (state.player.gold || 0) + goldGain;

    // Roll loot table
    const loot = [];
    if (enemy.lootTable && Array.isArray(enemy.lootTable)) {
      for (const entry of enemy.lootTable) {
        if (Math.random() < entry.dropChance) {
          loot.push(entry.itemId);
          if (!state.player.inventory) state.player.inventory = [];
          state.player.inventory.push({ itemId: entry.itemId, quantity: 1 });
        }
      }
    }

    this.eventBus.emit('kill', {
      enemy: { ...enemy },
      xpGain,
      goldGain,
      loot
    });

    // Reset combat state
    state.combat.inCombat = false;
    state.combat.currentEnemy = null;
    this.dotTimers = [];

    // Award XP via progression system
    this.eventBus.emit('xp_gain', { amount: xpGain });
  }

  onDeath() {
    const state = this.gameState;

    // Lose 10% of current XP (not total needed)
    const xpLoss = Math.floor((state.player.xp || 0) * 0.1);
    state.player.xp = Math.max(0, (state.player.xp || 0) - xpLoss);

    // Reset HP to 10%
    state.player.currentHp = Math.max(1, Math.floor(state.player.maxHp * 0.1));
    state.player.currentMana = 0;

    // End combat
    state.combat.inCombat = false;
    state.combat.currentEnemy = null;
    this.dotTimers = [];

    this.eventBus.emit('death', { xpLoss });
  }

  stopCombat() {
    const state = this.gameState;
    state.combat.inCombat = false;
    state.combat.currentEnemy = null;
    this.dotTimers = [];
    this.eventBus.emit('combat_stop', {});
  }
}
