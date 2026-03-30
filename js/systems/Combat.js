import { eventBus } from '../engine/EventBus.js';
import {
  calcPlayerDamage,
  calcMonsterHit,
  calcXpAward,
  getConColor,
  calcPlayerATK,
  calcMonsterAC
} from '../engine/CombatFormulas.js';

const AUTO_ATTACK_TICKS = 2;
const SPELL_CAST_TICKS  = 5;

export class CombatSystem {
  constructor(gameState, data) {
    this.gameState = gameState;
    this.monsters  = data.monsters;
    this.items     = data.items;
    this._attackTick   = 0;
    this._spellTick    = 0;
    this._castingSpell = null;
  }

  // Helper: get relevant skills for the player
  _getPlayerSkills() {
    const skills = this.gameState.skills || {};
    const cls    = this.gameState.player.class || 'warrior';
    // Primary weapon skill by class
    const weaponSkillMap = {
      warrior: '1h_slashing', paladin: '1h_slashing', shadowknight: '1h_slashing',
      ranger: '1h_slashing', bard: '1h_slashing', rogue: '1h_piercing',
      monk: 'hand_to_hand', beastlord: 'hand_to_hand', berserker: '2h_slashing',
      cleric: '1h_blunt', druid: '1h_blunt', shaman: '1h_blunt',
      wizard: '1h_blunt', magician: '1h_blunt', enchanter: '1h_blunt', necromancer: '1h_blunt'
    };
    const weaponSkillId = weaponSkillMap[cls] || '1h_slashing';
    return {
      offense:     skills['offense']     || 0,
      defense:     skills['defense']     || 0,
      dodge:       skills['dodge']       || 0,
      parry:       skills['parry']       || 0,
      weaponSkill: skills[weaponSkillId] || 0,
      weaponSkillId
    };
  }

  // Weapon skill cap for the player's class (used in damage mod)
  _getWeaponSkillCap() {
    // Use SkillsSystem cap if available, otherwise sensible default
    const cls = this.gameState.player.class || 'warrior';
    const CAPS = {
      warrior: 250, paladin: 230, shadowknight: 230, ranger: 220, bard: 200,
      rogue: 220, monk: 250, beastlord: 200, berserker: 250,
      cleric: 200, druid: 200, shaman: 200, wizard: 200, magician: 200,
      enchanter: 200, necromancer: 200
    };
    return CAPS[cls] || 200;
  }

  update(delta, tick) {
    const combat = this.gameState.combat;
    const player = this.gameState.player;

    // ── Out-of-combat regen ──────────────────────────────────────
    if (!combat.active) {
      let changed = false;
      if (player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + Math.max(1, Math.floor(player.maxHp * 0.015)));
        changed = true;
      }
      if (player.mana < player.maxMana) {
        player.mana = Math.min(player.maxMana, player.mana + Math.max(1, Math.floor(player.maxMana * 0.02)));
        changed = true;
      }
      if (changed) eventBus.emit('combat_update', { combat });
      return;
    }

    if (!combat.enemyId) return;
    const monster = this.monsters.find(m => m.id === combat.enemyId);
    if (!monster) { this.endCombat(); return; }

    // ── Auto-attack ──────────────────────────────────────────────
    this._attackTick++;
    if (this._attackTick >= AUTO_ATTACK_TICKS) {
      this._attackTick = 0;
      this._doAutoAttack(monster);
    }

    // ── Spell cast progress ──────────────────────────────────────
    if (this._castingSpell) {
      this._spellTick++;
      combat.castProgress = Math.min(1, this._spellTick / SPELL_CAST_TICKS);
      if (this._spellTick >= SPELL_CAST_TICKS) {
        this._resolveSpell(this._castingSpell, monster);
        this._castingSpell = null;
        this._spellTick    = 0;
        combat.castProgress = 0;
      }
      eventBus.emit('combat_update', { combat });
      return;
    }

    // ── Monster attacks back ─────────────────────────────────────
    this._doMonsterAttack(monster);

    // ── Check death / kill ───────────────────────────────────────
    if (combat.enemyHp <= 0) { this.onKill(monster); return; }
    if (player.hp <= 0)      { this.onDeath();        return; }

    eventBus.emit('combat_update', { combat });
  }

  _doAutoAttack(monster) {
    const player = this.gameState.player;
    const sk     = this._getPlayerSkills();
    const cap    = this._getWeaponSkillCap();

    const result = calcPlayerDamage(player, monster, sk.offense, sk.weaponSkill, cap);

    if (!result.hit) {
      eventBus.emit('combat_hit', {
        source: 'player', target: monster.name,
        damage: 0, type: result.type   // 'miss'
      });
      return;
    }

    this.gameState.combat.enemyHp = Math.max(0, this.gameState.combat.enemyHp - result.damage);
    eventBus.emit('combat_hit', {
      source: 'player', target: monster.name,
      damage: result.damage, type: result.type  // 'normal', 'critical', 'glancing'
    });
  }

  _doMonsterAttack(monster) {
    const player = this.gameState.player;
    const sk     = this._getPlayerSkills();

    const result = calcMonsterHit(monster, player, sk.defense, sk.dodge, sk.parry);

    if (!result.hit) {
      eventBus.emit('combat_hit', {
        source: monster.name, target: 'player',
        damage: 0, type: result.type  // 'miss', 'dodge', 'parry'
      });
      return;
    }

    player.hp = Math.max(0, player.hp - result.damage);
    eventBus.emit('combat_hit', {
      source: monster.name, target: 'player',
      damage: result.damage, type: result.type
    });
  }

  onKill(monster) {
    const player = this.gameState.player;

    // Award XP using the authentic con-color formula
    const xpAwarded = calcXpAward(monster, player.level, player.class);
    player.xp   = (player.xp   || 0) + xpAwarded;
    player.gold = (player.gold || 0) + monster.goldReward;

    // Loot rolls (unchanged)
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
    for (const item of loot) {
      this.gameState.combat.lootLog.unshift(item.name);
      if (this.gameState.combat.lootLog.length > 10) this.gameState.combat.lootLog.pop();
    }

    // Con color label for kill log
    const conColor = getConColor(player.level, monster.level);
    eventBus.emit('kill', { monster, xp: xpAwarded, gold: monster.goldReward, loot, conColor });
    eventBus.emit('xp_gained', { amount: xpAwarded });
    this.endCombat();
  }

  onDeath() {
    const player = this.gameState.player;
    const xpLoss = Math.floor((player.xp || 0) * 0.1);
    player.xp = Math.max(0, (player.xp || 0) - xpLoss);
    player.hp = Math.max(1, Math.floor(player.maxHp * 0.2));
    player.mana = Math.max(0, Math.floor(player.maxMana * 0.2));
    this.endCombat();
    eventBus.emit('death', { xpLoss });
    eventBus.emit('notification', { message: `💀 You have died! Lost ${xpLoss} XP.`, type: 'death' });
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
    this._attackTick    = 0;
    this._castingSpell  = null;

    // Attach con color to combat state so UI can display it
    const player = this.gameState.player;
    combat.conColor = getConColor(player.level, monster.level);
    eventBus.emit('combat_start', { monster, conColor: combat.conColor });
  }

  endCombat() {
    const combat = this.gameState.combat;
    combat.active   = false;
    combat.enemyId  = null;
    combat.enemyHp  = 0;
    combat.castProgress = 0;
    combat.conColor = null;
    this._castingSpell = null;
    eventBus.emit('combat_end', {});
  }
}
