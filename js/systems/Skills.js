import { eventBus } from '../engine/EventBus.js';

// All EQ skills with class skill caps at level 60
const SKILL_DEFS = [
  // Combat skills
  { id: '1h_slashing', name: '1H Slashing', type: 'combat' },
  { id: '1h_blunt', name: '1H Blunt', type: 'combat' },
  { id: '1h_piercing', name: '1H Piercing', type: 'combat' },
  { id: '2h_slashing', name: '2H Slashing', type: 'combat' },
  { id: '2h_blunt', name: '2H Blunt', type: 'combat' },
  { id: 'hand_to_hand', name: 'Hand to Hand', type: 'combat' },
  { id: 'archery', name: 'Archery', type: 'combat' },
  { id: 'throwing', name: 'Throwing', type: 'combat' },
  { id: 'dual_wield', name: 'Dual Wield', type: 'combat' },
  { id: 'dodge', name: 'Dodge', type: 'combat' },
  { id: 'parry', name: 'Parry', type: 'combat' },
  { id: 'riposte', name: 'Riposte', type: 'combat' },
  { id: 'block', name: 'Block', type: 'combat' },
  { id: 'offense', name: 'Offense', type: 'combat' },
  { id: 'defense', name: 'Defense', type: 'combat' },
  { id: 'backstab', name: 'Backstab', type: 'combat' },
  { id: 'kick', name: 'Kick', type: 'combat' },
  { id: 'bash', name: 'Bash', type: 'combat' },
  { id: 'flying_kick', name: 'Flying Kick', type: 'combat' },
  { id: 'dragon_punch', name: 'Dragon Punch', type: 'combat' },
  // Tradeskills
  { id: 'smithing', name: 'Smithing', type: 'tradeskill' },
  { id: 'tailoring', name: 'Tailoring', type: 'tradeskill' },
  { id: 'baking', name: 'Baking', type: 'tradeskill' },
  { id: 'brewing', name: 'Brewing', type: 'tradeskill' },
  { id: 'fletching', name: 'Fletching', type: 'tradeskill' },
  { id: 'pottery', name: 'Pottery', type: 'tradeskill' },
  { id: 'jewelcraft', name: 'Jewelcraft', type: 'tradeskill' },
  { id: 'research', name: 'Research', type: 'tradeskill' },
  // Other
  { id: 'sense_heading', name: 'Sense Heading', type: 'passive' },
  { id: 'swimming', name: 'Swimming', type: 'passive' },
  { id: 'sneak', name: 'Sneak', type: 'active' },
  { id: 'hide', name: 'Hide', type: 'active' },
  { id: 'track', name: 'Track', type: 'active' },
  { id: 'forage', name: 'Forage', type: 'active' },
  { id: 'pick_lock', name: 'Pick Lock', type: 'active' },
  { id: 'pick_pockets', name: 'Pick Pockets', type: 'active' },
  { id: 'meditate', name: 'Meditate', type: 'active' },
  { id: 'bind_wound', name: 'Bind Wound', type: 'active' },
  { id: 'safe_fall', name: 'Safe Fall', type: 'passive' },
  { id: 'begging', name: 'Begging', type: 'active' }
];

// Skill caps by class at level 60 (simplified)
const CLASS_CAPS = {
  warrior:    { offense: 250, defense: 250, '1h_slashing': 250, '2h_slashing': 250, bash: 150, kick: 150 },
  paladin:    { offense: 230, defense: 230, '1h_slashing': 230, bash: 150, meditate: 200 },
  shadowknight: { offense: 230, defense: 230, '1h_slashing': 230, bash: 150, meditate: 200 },
  ranger:     { offense: 220, defense: 220, '1h_slashing': 220, archery: 250, meditate: 180 },
  bard:       { offense: 200, defense: 200, '1h_slashing': 200, meditate: 150 },
  rogue:      { offense: 220, defense: 190, '1h_piercing': 220, backstab: 220, sneak: 200, hide: 200 },
  monk:       { offense: 230, defense: 230, hand_to_hand: 250, flying_kick: 230, dragon_punch: 200, safe_fall: 200 },
  beastlord:  { offense: 200, defense: 200, hand_to_hand: 200, meditate: 150 },
  berserker:  { offense: 250, defense: 220, '2h_slashing': 250, dual_wield: 220 },
  cleric:     { offense: 100, defense: 150, bash: 100, meditate: 235 },
  druid:      { offense: 100, defense: 130, forage: 200, meditate: 220 },
  shaman:     { offense: 130, defense: 150, meditate: 220 },
  wizard:     { offense: 80, defense: 100, meditate: 252 },
  magician:   { offense: 80, defense: 100, meditate: 252 },
  enchanter:  { offense: 80, defense: 100, meditate: 252 },
  necromancer: { offense: 80, defense: 100, meditate: 252 }
};

export class SkillsSystem {
  constructor(gameState) {
    this.gameState = gameState;
    this.skillDefs = SKILL_DEFS;
    this._initSkills();
  }

  _initSkills() {
    if (!this.gameState.skills) this.gameState.skills = {};
    for (const skill of SKILL_DEFS) {
      if (!(skill.id in this.gameState.skills)) {
        this.gameState.skills[skill.id] = 0;
      }
    }
  }

  update(delta, tick) {
    // Passive skill gain on combat ticks
    if (this.gameState.combat.active) {
      this._tryGainSkill('offense');
      this._tryGainSkill('defense');
    }
  }

  _tryGainSkill(skillId) {
    const cap = this.getSkillCap(skillId);
    const current = this.gameState.skills[skillId] || 0;
    if (current >= cap) return;
    // Probability decreases as skill approaches cap
    const chance = 0.05 * (1 - current / cap);
    if (Math.random() < chance) {
      this.gameState.skills[skillId] = current + 1;
      eventBus.emit('skill_gain', { skillId, value: current + 1 });
    }
  }

  gainSkill(skillId, amount = 1) {
    const cap = this.getSkillCap(skillId);
    const current = this.gameState.skills[skillId] || 0;
    this.gameState.skills[skillId] = Math.min(cap, current + amount);
  }

  getSkillCap(skillId, classId, level) {
    const cls = classId || this.gameState.player.class || 'warrior';
    const lv = level || this.gameState.player.level || 1;
    const classCaps = CLASS_CAPS[cls] || {};
    const classCap = classCaps[skillId] || 100;
    // Tradeskills cap at 300 for everyone; raised to 350 with AA
    const def = SKILL_DEFS.find(s => s.id === skillId);
    if (def && def.type === 'tradeskill') return 300;
    return Math.min(classCap, Math.floor(classCap * (lv / 60)));
  }

  getSkills() {
    return SKILL_DEFS.map(def => ({
      ...def,
      value: this.gameState.skills[def.id] || 0,
      cap: this.getSkillCap(def.id)
    }));
  }
}
