/**
 * EverQuest Classic Combat Formulas
 * Based on Project 1999 / classic EQ1 (1999-2001) reverse-engineered mechanics.
 */

// ─── Con Color System ───────────────────────────────────────────────────────
// Returns the "con color" a player sees when considering a mob (relative difficulty)
export function getConColor(playerLevel, mobLevel) {
  const diff = mobLevel - playerLevel;
  if (diff >= 3)  return 'red';
  if (diff >= 1)  return 'yellow';
  if (diff === 0) return 'white';
  if (diff >= -3) return 'blue';
  if (diff >= -6) return 'green';
  return 'grey';
}

// XP multiplier based on con color (grey = 0, grey-ish = low, red = bonus)
export function getConXpMultiplier(playerLevel, mobLevel) {
  const color = getConColor(playerLevel, mobLevel);
  switch (color) {
    case 'grey':   return 0;
    case 'green':  return 0.5;
    case 'blue':   return 0.8;
    case 'white':  return 1.0;
    case 'yellow': return 1.2;
    case 'red':    return 1.5;
    default:       return 1.0;
  }
}

// ─── ATK Calculation ────────────────────────────────────────────────────────
// Player's ATK rating, mirroring classic EQ:
// Base = level * 6
// STR contribution: (STR - 75) * 0.9 (above base 75 STR)
// Offense skill: offenseSkill * 1.05
// Weapon skill: weaponSkill * 0.5
// Caps at ~3000 for level 60 fully buffed warrior
export function calcPlayerATK(player, offenseSkill, weaponSkill) {
  const level = player.level || 1;
  const str   = (player.stats && player.stats.str) || 75;
  const base  = level * 6;
  const strBonus = Math.max(0, str - 75) * 0.9;
  const offenseBonus = (offenseSkill || 0) * 1.05;
  const weaponBonus  = (weaponSkill  || 0) * 0.5;
  return Math.floor(base + strBonus + offenseBonus + weaponBonus);
}

// Monster AC from its level (classic EQ-style: level-derived, bosses are tougher)
// Most mobs have AC ≈ level * 5 to level * 8 (warriors/knights higher)
export function calcMonsterAC(monster) {
  if (monster.ac !== undefined) return monster.ac;  // explicit override in JSON
  const level = monster.level || 1;
  const bossMult = monster.isBoss ? 1.4 : 1.0;
  return Math.floor(level * 6 * bossMult);
}

// ─── To-Hit Formula ─────────────────────────────────────────────────────────
// Classic formula (Project 1999 consensus):
//   hitChance = 70 + (attackerLevel - defenderLevel) * 5
//             + (offenseSkill - defenseSkill) / 5
//             + (ATK - AC) / 10
// Clamped between 5% and 95%
export function calcHitChance(attackerLevel, defenderLevel, atk, ac, offenseSkill, defenseSkill) {
  const base   = 70;
  const lvDiff = (attackerLevel - defenderLevel) * 5;
  const skillDiff = ((offenseSkill || 0) - (defenseSkill || 0)) / 5;
  const atkAcDiff = (atk - ac) / 10;
  const raw = base + lvDiff + skillDiff + atkAcDiff;
  return Math.min(95, Math.max(5, raw)) / 100;  // return as 0–1
}

// ─── Damage Calculation ─────────────────────────────────────────────────────
// Classic two-roll system:
//   1. Roll hit/miss (calcHitChance)
//   2. If hit, roll damage:
//      raw     = random(1, weaponDamage + damageBonus)
//      modified = raw * strMod * skillMod * mitigationMod
//
// weaponDamage: from equipped weapon or fists (class-based)
// damageBonus:  level-based (warriors get it at lv28+, others less)
// strMod:       STR / 100 (clamped 0.5–2.0)
// skillMod:     weaponSkill / skillCap (clamped 0.5–1.0)
// mitigationMod: ATK/(ATK+AC) shaped curve

export function calcDamageBonus(level, playerClass) {
  // Warriors get full damage bonus at level 28+
  // Paladins/SKs get 75% of warrior bonus
  // Other melee get 50%
  // Casters get 0
  const casters = ['wizard','magician','enchanter','necromancer'];
  const hybrids = ['paladin','shadowknight','ranger','bard','beastlord'];
  const fullMelee = ['warrior','monk','rogue','berserker'];
  if (casters.includes(playerClass)) return 0;
  const bonusLevel = Math.max(0, level - 27);  // starts at level 28
  const basebonus  = Math.floor(bonusLevel * 0.4);
  if (fullMelee.includes(playerClass)) return basebonus;
  if (hybrids.includes(playerClass))   return Math.floor(basebonus * 0.75);
  return Math.floor(basebonus * 0.5);
}

export function calcPlayerDamage(player, monster, offenseSkill, weaponSkill, weaponSkillCap) {
  const level    = player.level || 1;
  const str      = (player.stats && player.stats.str) || 75;
  const cls      = player.class || 'warrior';

  // Weapon base damage (fists/unarmed baseline if no weapon equipped)
  // Warriors fist = level/2 + 1, casters less
  const casters = ['wizard','magician','enchanter','necromancer'];
  let weaponDamage;
  if (player.equippedWeapon) {
    weaponDamage = player.equippedWeapon.damage || Math.floor(level / 2) + 1;
  } else {
    weaponDamage = casters.includes(cls)
      ? Math.max(1, Math.floor(level / 4))
      : Math.max(2, Math.floor(level / 2) + 1);
  }

  const damageBonus = calcDamageBonus(level, cls);
  const maxBase     = weaponDamage + damageBonus;

  // STR modifier: 1.0 at STR=100, scales up/down
  const strMod = Math.min(2.0, Math.max(0.5, str / 100));

  // Skill modifier: ratio of current skill to cap, clamped 0.5–1.0
  const skillRatio = weaponSkillCap > 0 ? Math.min(1.0, (weaponSkill || 0) / weaponSkillCap) : 1.0;
  const skillMod   = Math.max(0.5, skillRatio);

  // ATK vs AC for mitigation
  const atk = calcPlayerATK(player, offenseSkill, weaponSkill);
  const ac  = calcMonsterAC(monster);

  // Hit check
  const defenseSkill = monster.defenseSkill || monster.level * 4;
  const hitChance    = calcHitChance(level, monster.level, atk, ac, offenseSkill, defenseSkill);
  if (Math.random() > hitChance) return { hit: false, damage: 0, type: 'miss' };

  // Glancing blow: if mob is 3+ levels higher, 30% chance of half-damage
  let glancing = false;
  if (monster.level - level >= 3 && Math.random() < 0.30) {
    glancing = true;
  }

  // Mitigation factor: sigmoid-like based on ATK vs AC
  // At ATK=AC: ~0.65 (most hits are average)
  // At ATK >> AC: approaches 1.0 (full hits)
  // At ATK << AC: approaches 0.3 (very mitigated)
  const atkRatio   = atk / Math.max(1, ac);
  const mitigMod   = Math.min(1.0, Math.max(0.3, 0.3 + 0.7 * (atkRatio / (atkRatio + 1))));

  const rawDamage  = Math.max(1, Math.floor(Math.random() * maxBase) + 1);
  let finalDamage  = Math.floor(rawDamage * strMod * skillMod * mitigMod);
  if (glancing) finalDamage = Math.max(1, Math.floor(finalDamage * 0.5));
  finalDamage = Math.max(1, finalDamage);

  // Critical hit (Combat Fury AA, 2% per rank + base 2% for warriors/rogues)
  const critChance = 0.02 + (0.02 * (player.aaSpent?.combat_fury || 0));
  const isCrit = Math.random() < critChance;
  if (isCrit) finalDamage = Math.floor(finalDamage * 2);

  return {
    hit: true,
    damage: finalDamage,
    type: isCrit ? 'critical' : (glancing ? 'glancing' : 'normal'),
    atk, ac, hitChance
  };
}

// ─── Monster Damage ─────────────────────────────────────────────────────────
// Monster attacks the player. Player's AC reduces damage.
// Player AC is derived from AGI + defense skill + equipped armor
export function calcPlayerAC(player, defenseSkill) {
  const agi = (player.stats && player.stats.agi) || 75;
  const agiBonus = Math.max(0, agi - 75) * 0.4;
  const defenseMod = (defenseSkill || 0) * 0.3;
  const armorBonus = player.totalAC || 0;  // from equipped items
  return Math.floor(10 + agiBonus + defenseMod + armorBonus);
}

// Monster hits the player using monster's min/max damage vs player AC
// Player can dodge (AGI/dodge skill), parry, block
export function calcMonsterHit(monster, player, defenseSkill, dodgeSkill, parrySkill) {
  const monsterATK  = (monster.atk !== undefined) ? monster.atk : monster.level * 5;
  const playerAC    = calcPlayerAC(player, defenseSkill);
  const playerLevel = player.level || 1;

  // Dodge check (AGI-based, dodge skill)
  const agi = (player.stats && player.stats.agi) || 75;
  const dodgeChance = Math.min(0.25, ((dodgeSkill || 0) / 1000) + (agi - 75) * 0.001);
  if (Math.random() < dodgeChance) return { hit: false, damage: 0, type: 'dodge' };

  // Parry check (melee classes only, parry skill)
  const parryChance = Math.min(0.20, (parrySkill || 0) / 1200);
  if (Math.random() < parryChance) return { hit: false, damage: 0, type: 'parry' };

  // Monster's to-hit vs player defense skill
  const monsterOffense = monster.level * 4;
  const hitChance = calcHitChance(monster.level, playerLevel, monsterATK, playerAC, monsterOffense, defenseSkill);
  if (Math.random() > hitChance) return { hit: false, damage: 0, type: 'miss' };

  // Damage with mitigation
  const rawDamage  = Math.floor(monster.minDamage + Math.random() * (monster.maxDamage - monster.minDamage + 1));
  const atkRatio   = monsterATK / Math.max(1, playerAC);
  const mitigMod   = Math.min(1.0, Math.max(0.2, 0.2 + 0.8 * (atkRatio / (atkRatio + 1))));
  const finalDamage = Math.max(1, Math.floor(rawDamage * mitigMod));

  return { hit: true, damage: finalDamage, type: 'normal' };
}

// ─── XP Award ───────────────────────────────────────────────────────────────
// Classic EQ XP: base from monster level, modified by con color and class penalty
// Class XP penalties (classic era):
const CLASS_XP_PENALTY = {
  warrior:      1.0,   // baseline (no penalty)
  rogue:        1.0,
  paladin:      0.8,   // 20% penalty = slower XP
  shadowknight: 0.8,
  ranger:       0.85,
  bard:         0.85,
  monk:         0.9,
  beastlord:    0.85,
  berserker:    0.95,
  cleric:       0.95,
  druid:        0.95,
  shaman:       0.9,
  wizard:       0.95,
  magician:     0.95,
  enchanter:    0.95,
  necromancer:  0.9
};

export function calcXpAward(monster, playerLevel, playerClass) {
  const conMult  = getConXpMultiplier(playerLevel, monster.level);
  if (conMult === 0) return 0;  // grey con = no XP
  const penalty  = CLASS_XP_PENALTY[playerClass] || 1.0;
  // Base reward from monster data, scaled by con color and class
  return Math.floor((monster.xpReward || 0) * conMult * penalty);
}

// ─── Ghost Player Combat Simulation ─────────────────────────────────────────
// Used by GhostPlayerSystem to simulate realistic XP gains using the same formulas
export function simulateGhostKill(ghost, monster) {
  // Ghost ATK (simplified — no full stat block, just level-based)
  const ghostATK = ghost.level * 6 + 50;  // average stats
  const monsterAC = calcMonsterAC(monster);
  const hitChance = calcHitChance(ghost.level, monster.level, ghostATK, monsterAC, ghost.level * 4, monster.level * 4);

  // Average DPS ratio: how fast the ghost kills vs gets killed
  const ghostDPS   = Math.max(1, ghost.level * 2) * hitChance;
  const monsterDPS = ((monster.minDamage + monster.maxDamage) / 2) *
    calcHitChance(monster.level, ghost.level, monster.level * 5, ghost.level * 3, monster.level * 4, ghost.level * 4);

  // Can the ghost kill this monster? (rough survival check)
  const ghostHP = 50 + ghost.level * 20;
  const monsterHP = monster.hp;
  const ticksToKill  = Math.ceil(monsterHP / Math.max(1, ghostDPS));
  const ticksTodie   = Math.ceil(ghostHP  / Math.max(1, monsterDPS));

  // Ghost wins if it can kill monster before dying (or survives with tolerance)
  const ghostWins = ticksToKill < ticksTodie * 1.2;
  if (!ghostWins) return { success: false, xp: 0 };

  const xp = calcXpAward(monster, ghost.level, ghost.class);
  return { success: true, xp };
}
