export class SkillPanel {
  constructor(gameState, skillsSystem, eventBus) {
    this.gameState = gameState;
    this.skillsSystem = skillsSystem;
    this.eventBus = eventBus;
    this.activeSkill = null;

    this.eventBus.on('skill_gain', () => this.render());
  }

  render() {
    const combatEl = document.getElementById('skills-combat-grid');
    const tradeskillEl = document.getElementById('skills-tradeskill-grid');

    const classId = this.gameState.player.classId || 'warrior';
    const level = this.gameState.player.level || 1;

    if (combatEl) {
      const combatSkills = this.skillsSystem.getCombatSkills();
      combatEl.innerHTML = '';
      for (const [skillId, value] of Object.entries(combatSkills)) {
        const cap = this.skillsSystem.getSkillCap(skillId, classId, level);
        if (cap === 0) continue;
        combatEl.appendChild(this._createSkillCard(skillId, value, cap));
      }
    }

    if (tradeskillEl) {
      const tradeskills = this.skillsSystem.getTradeskills();
      tradeskillEl.innerHTML = '';
      for (const [skillId, value] of Object.entries(tradeskills)) {
        const cap = 350;
        tradeskillEl.appendChild(this._createSkillCard(skillId, value, cap, true));
      }
    }
  }

  _createSkillCard(skillId, value, cap, isTradeskill = false) {
    const card = document.createElement('div');
    card.className = 'skill-card' + (this.activeSkill === skillId ? ' skill-card-active' : '');
    card.dataset.skill = skillId;

    const displayName = skillId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const pct = cap > 0 ? Math.min(100, (value / cap) * 100) : 0;

    card.innerHTML = `
      <div class="skill-name">${displayName}</div>
      <div class="skill-value">${value} / ${cap}</div>
      <div class="progress-bar skill-xp-bar">
        <div class="progress-fill xp-fill" style="width:${pct}%"></div>
      </div>
    `;

    if (isTradeskill) {
      card.addEventListener('click', () => {
        this.activeSkill = skillId;
        this.gameState.activeTraining = { tradeskillId: skillId };
        document.querySelectorAll('.skill-card').forEach(c => c.classList.remove('skill-card-active'));
        card.classList.add('skill-card-active');
      });
    }

    return card;
  }
}
