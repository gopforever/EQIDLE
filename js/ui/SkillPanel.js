export class SkillPanel {
  constructor(gameState, skillsSystem) {
    this.gameState = gameState;
    this.skillsSystem = skillsSystem;
    this._container = document.getElementById('panel-skills');
  }

  render() {
    if (!this._container) return;
    const skills = this.skillsSystem.getSkills();
    const combat = skills.filter(s => s.type === 'combat');
    const tradeskills = skills.filter(s => s.type === 'tradeskill');
    const other = skills.filter(s => s.type !== 'combat' && s.type !== 'tradeskill');

    this._container.innerHTML = `
      <h2 class="panel-title">Skills</h2>
      <h3>Combat Skills</h3>
      <div class="skill-grid">${combat.map(s => this._skillCard(s)).join('')}</div>
      <h3>Tradeskills</h3>
      <div class="skill-grid">${tradeskills.map(s => this._skillCard(s)).join('')}</div>
      <h3>Other Skills</h3>
      <div class="skill-grid">${other.map(s => this._skillCard(s)).join('')}</div>
    `;

    // Click to set active skill
    this._container.querySelectorAll('.skill-card').forEach(card => {
      card.addEventListener('click', () => {
        const skillId = card.dataset.skillId;
        this.gameState.activeSkill = skillId;
        this._container.querySelectorAll('.skill-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
  }

  _skillCard(skill) {
    const pct = skill.cap > 0 ? Math.floor((skill.value / skill.cap) * 100) : 0;
    return `
      <div class="skill-card" data-skill-id="${skill.id}">
        <div class="skill-name">${skill.name}</div>
        <div class="skill-value">${skill.value} / ${skill.cap}</div>
        <div class="progress-bar">
          <div class="progress-fill xp-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

  update() {
    this.render();
  }
}
