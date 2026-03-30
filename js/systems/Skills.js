// EQ combat skills and tradeskills tracked as integers 0-350
const COMBAT_SKILLS = [
  '1h_slash', '1h_blunt', '2h_slash', '2h_blunt', 'piercing', 'hand_to_hand',
  'archery', 'throwing', 'defense', 'dodge', 'parry', 'riposte', 'block',
  'dual_wield', 'double_attack', 'kick', 'bash', 'flying_kick', 'frenzy',
  'backstab', 'taunt', 'intimidation', 'sneak', 'hide', 'meditate',
  'channeling', 'abjuration', 'alteration', 'conjuration', 'divination',
  'evocation', 'singing', 'pick_lock', 'pick_pockets', 'sense_heading',
  'forage', 'swimming', 'fishing', 'tracking', 'endurance'
];

const TRADESKILL_IDS = [
  'smithing', 'tailoring', 'baking', 'brewing', 'fletching', 'pottery', 'jewelcraft', 'research'
];

// Cap table per class for combat skills
const CLASS_SKILL_CAPS = {
  warrior:     { '1h_slash': 250, '2h_slash': 250, '1h_blunt': 250, '2h_blunt': 250, piercing: 250, hand_to_hand: 100, dual_wield: 250, double_attack: 250, bash: 250, taunt: 200, defense: 250, dodge: 200, parry: 200, riposte: 200, block: 150, meditate: 0 },
  paladin:     { '1h_slash': 225, '2h_slash': 225, '1h_blunt': 225, bash: 200, taunt: 200, defense: 220, dodge: 175, parry: 175, meditate: 200, channeling: 200 },
  shadowknight:{ '1h_slash': 225, '2h_slash': 225, '1h_blunt': 225, bash: 200, taunt: 200, defense: 220, dodge: 175, parry: 175, meditate: 200, channeling: 200 },
  ranger:      { '1h_slash': 225, '2h_slash': 225, archery: 250, dual_wield: 230, defense: 220, dodge: 200, kick: 200, meditate: 200, channeling: 200, forage: 200, tracking: 200, sneak: 150, hide: 125 },
  bard:        { '1h_slash': 210, '2h_slash': 210, '1h_blunt': 210, dual_wield: 200, kick: 200, defense: 210, dodge: 175, singing: 300, channeling: 200, meditate: 0 },
  rogue:       { '1h_slash': 200, piercing: 250, dual_wield: 250, backstab: 250, sneak: 250, hide: 250, pick_lock: 250, pick_pockets: 250, defense: 210, dodge: 200, meditate: 0 },
  monk:        { hand_to_hand: 250, '1h_blunt': 200, dual_wield: 200, flying_kick: 250, kick: 250, dodge: 250, defense: 250, meditate: 200, channeling: 200 },
  beastlord:   { hand_to_hand: 250, '1h_blunt': 200, kick: 200, dual_wield: 200, defense: 220, dodge: 200, meditate: 200, channeling: 200, forage: 150 },
  berserker:   { '1h_slash': 200, '2h_slash': 250, '2h_blunt': 250, dual_wield: 200, frenzy: 250, bash: 0, defense: 230, dodge: 175, taunt: 200, meditate: 0 },
  cleric:      { '1h_blunt': 200, bash: 200, defense: 175, dodge: 150, meditate: 300, channeling: 250, abjuration: 300, alteration: 300, divination: 300, evocation: 200 },
  druid:       { '1h_blunt': 175, bash: 175, defense: 165, dodge: 140, meditate: 300, channeling: 250, abjuration: 200, alteration: 300, conjuration: 200, divination: 200, evocation: 250, forage: 200, tracking: 150 },
  shaman:      { '1h_blunt': 200, bash: 200, defense: 175, dodge: 150, meditate: 300, channeling: 250, alteration: 300, conjuration: 250, abjuration: 200 },
  wizard:      { '1h_blunt': 100, defense: 140, dodge: 115, meditate: 350, channeling: 300, abjuration: 200, alteration: 200, conjuration: 200, divination: 200, evocation: 350 },
  magician:    { '1h_blunt': 100, defense: 140, dodge: 115, meditate: 350, channeling: 300, abjuration: 200, alteration: 200, conjuration: 350, divination: 200, evocation: 200 },
  enchanter:   { '1h_blunt': 100, defense: 140, dodge: 115, meditate: 350, channeling: 300, abjuration: 200, alteration: 350, conjuration: 200, divination: 200, evocation: 200 },
  necromancer: { '1h_blunt': 100, defense: 140, dodge: 115, meditate: 350, channeling: 300, abjuration: 200, alteration: 250, conjuration: 300, divination: 200, evocation: 250 }
};

// Skill gain probability: decreases as skill approaches cap
function gainChance(skill, cap) {
  if (skill >= cap) return 0;
  const ratio = skill / cap;
  // High chance at low skill, low chance near cap
  return Math.max(0.01, 0.5 * (1 - ratio) + 0.01);
}

export class SkillsSystem {
  constructor(gameState, eventBus) {
    this.gameState = gameState;
    this.eventBus = eventBus;

    // Initialize skills if not present
    const state = this.gameState;
    if (!state.player.skills) {
      state.player.skills = {};
      for (const skill of COMBAT_SKILLS) state.player.skills[skill] = 0;
      for (const ts of TRADESKILL_IDS) state.player.skills[ts] = 0;
    }
  }

  update(delta, tick) {
    const state = this.gameState;
    const player = state.player;

    // Gain skill from active combat every tick when in combat
    if (state.combat && state.combat.inCombat) {
      const classId = player.classId || 'warrior';
      const classCaps = CLASS_SKILL_CAPS[classId] || {};

      // Try to gain combat skill based on class primary skill
      const primarySkill = this._getPrimarySkill(classId);
      if (primarySkill) {
        const cap = this.getSkillCap(primarySkill, classId, player.level);
        if (cap > 0) this.gainSkill(primarySkill);
      }

      // Gain defense skill always in combat
      const defCap = this.getSkillCap('defense', classId, player.level);
      if (defCap > 0) this.gainSkill('defense');
    }

    // Gain tradeskill if actively training
    if (state.activeTraining && state.activeTraining.tradeskillId) {
      this.gainSkill(state.activeTraining.tradeskillId);
    }
  }

  gainSkill(skillId) {
    const state = this.gameState;
    const player = state.player;
    if (!player.skills) player.skills = {};

    const classId = player.classId || 'warrior';
    const cap = this.getSkillCap(skillId, classId, player.level);
    const current = player.skills[skillId] || 0;

    if (current >= cap) return false;

    const chance = gainChance(current, cap);
    if (Math.random() < chance) {
      player.skills[skillId] = current + 1;
      this.eventBus.emit('skill_gain', { skillId, newValue: player.skills[skillId] });
      return true;
    }
    return false;
  }

  getSkillCap(skillId, classId, level) {
    const classCaps = CLASS_SKILL_CAPS[classId] || {};
    let cap = classCaps[skillId];
    if (cap === undefined) {
      // Default caps for tradeskills and unconfigured skills
      if (TRADESKILL_IDS.includes(skillId)) return 350;
      cap = 200;
    }
    if (cap === 0) return 0;
    // Scale with level: cap is reached at level 60, proportional before
    return Math.min(cap, Math.floor((cap / 60) * level));
  }

  _getPrimarySkill(classId) {
    const primary = {
      warrior: '1h_slash', paladin: '1h_slash', shadowknight: '1h_slash',
      ranger: 'archery', bard: 'singing', rogue: 'backstab', monk: 'hand_to_hand',
      beastlord: 'hand_to_hand', berserker: '2h_slash', cleric: '1h_blunt',
      druid: 'evocation', shaman: 'alteration', wizard: 'evocation',
      magician: 'conjuration', enchanter: 'alteration', necromancer: 'conjuration'
    };
    return primary[classId] || '1h_slash';
  }

  getAllSkills() {
    return this.gameState.player.skills || {};
  }

  getCombatSkills() {
    const skills = this.getAllSkills();
    return COMBAT_SKILLS.reduce((acc, id) => {
      acc[id] = skills[id] || 0;
      return acc;
    }, {});
  }

  getTradeskills() {
    const skills = this.getAllSkills();
    return TRADESKILL_IDS.reduce((acc, id) => {
      acc[id] = skills[id] || 0;
      return acc;
    }, {});
  }
}
