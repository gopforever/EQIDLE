import { eventBus } from '../engine/EventBus.js';

export class CombatPanel {
  constructor(gameState, data, systems) {
    this.gameState = gameState;
    this.monsters = data.monsters;
    this.zones = data.zones;
    this.spells = data.spells;
    this.combatSystem = systems.combat;
    this.zonesSystem = systems.zones;
    this._autoAttacking = false;
    this._autoAttackInterval = null;
    this._bindEvents();
  }

  _bindEvents() {
    eventBus.on('combat_update', () => this.renderCombat());
    eventBus.on('combat_start', () => this.renderCombat());
    eventBus.on('combat_end', () => this.renderCombat());
    eventBus.on('kill', () => this.renderLootLog());
    eventBus.on('loot', () => this.renderLootLog());
    eventBus.on('xp_gained', () => this.renderPlayerStats());
    eventBus.on('levelup', () => this.renderPlayerStats());
  }

  render() {
    this.renderPlayerStats();
    this.renderZoneSelect();
    this.renderSpellBar();
    this.renderCombat();
    this.renderLootLog();
    this._bindActions();
  }

  renderPlayerStats() {
    const p = this.gameState.player;
    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const manaPct = Math.max(0, Math.min(100, (p.mana / p.maxMana) * 100));
    const endPct = Math.max(0, Math.min(100, (p.endurance / p.maxEndurance) * 100));

    const el = document.getElementById('player-stats');
    if (!el) return;
    el.innerHTML = `
      <div class="stat-bar">
        <span class="stat-label">HP</span>
        <div class="progress-bar">
          <div class="progress-fill hp-fill" style="width:${hpPct}%"></div>
        </div>
        <span class="stat-value">${p.hp}/${p.maxHp}</span>
      </div>
      <div class="stat-bar">
        <span class="stat-label">Mana</span>
        <div class="progress-bar">
          <div class="progress-fill mana-fill" style="width:${manaPct}%"></div>
        </div>
        <span class="stat-value">${p.mana}/${p.maxMana}</span>
      </div>
      <div class="stat-bar">
        <span class="stat-label">End</span>
        <div class="progress-bar">
          <div class="progress-fill end-fill" style="width:${endPct}%"></div>
        </div>
        <span class="stat-value">${p.endurance}/${p.maxEndurance}</span>
      </div>
      <div class="stat-bar">
        <span class="stat-label">XP</span>
        <div class="progress-bar">
          <div class="progress-fill xp-fill" style="width:${this._xpPct()}%"></div>
        </div>
        <span class="stat-value">Lv ${p.level}</span>
      </div>
    `;
    // Update header
    const nameEl = document.getElementById('char-name');
    if (nameEl) nameEl.textContent = p.name || 'Adventurer';
    const lvEl = document.getElementById('char-level');
    if (lvEl) lvEl.textContent = `Lv ${p.level}`;
    const clsEl = document.getElementById('char-class');
    if (clsEl) clsEl.textContent = p.class || '';
    const zoneEl = document.getElementById('current-zone');
    if (zoneEl) zoneEl.textContent = this.gameState.currentZone || '';
    // Status bar
    const goldEl = document.getElementById('gold-display');
    if (goldEl) goldEl.textContent = `${p.gold || 0}gp`;
  }

  _xpPct() {
    const p = this.gameState.player;
    if (p.level >= 60) return 100;
    const xpNeeded = Math.floor(1000 * Math.pow(p.level, 1.75));
    return Math.min(100, Math.floor(((p.xp || 0) / xpNeeded) * 100));
  }

  renderEnemy(monster) {
    const enemyEl = document.getElementById('enemy-display');
    if (!enemyEl) return;
    const combat = this.gameState.combat;
    const hpPct = Math.max(0, Math.min(100, (combat.enemyHp / monster.hp) * 100));
    enemyEl.innerHTML = `
      <div class="enemy-card">
        <div class="monster-sprite ${monster.spriteClass}"></div>
        <div class="enemy-name">${monster.name}</div>
        <div class="enemy-level">Level ${monster.level}</div>
        <div class="stat-bar">
          <div class="progress-bar">
            <div class="progress-fill hp-fill" style="width: ${hpPct}%"></div>
          </div>
        </div>
        ${combat.castProgress > 0 ? `
          <div class="cast-bar">
            <div class="progress-bar">
              <div class="progress-fill cast-fill" style="width:${(combat.castProgress * 100).toFixed(0)}%"></div>
            </div>
            <span class="cast-label">Casting...</span>
          </div>` : ''}
      </div>
    `;
  }

  renderCombat() {
    const combat = this.gameState.combat;
    const enemyEl = document.getElementById('enemy-display');
    if (!enemyEl) return;
    if (!combat.active || !combat.enemyId) {
      enemyEl.innerHTML = `<div class="no-enemy">No target selected.<br>Select a zone and attack!</div>`;
      return;
    }
    const monster = this.monsters.find(m => m.id === combat.enemyId);
    if (!monster) return;
    this.renderEnemy(monster);
    // Attack toggle button
    const btn = document.getElementById('attack-toggle');
    if (btn) {
      btn.textContent = this._autoAttacking ? '⏸ Stop Attack' : '⚔️ Attack';
      btn.classList.toggle('active', this._autoAttacking);
    }
  }

  renderZoneSelect() {
    const el = document.getElementById('zone-select');
    if (!el) return;
    const zones = this.zonesSystem ? this.zonesSystem.getAvailableZones() : [];
    el.innerHTML = `<label>Zone: </label>
      <select id="zone-dropdown">
        ${zones.map(z => `<option value="${z.id}" ${z.id === this.gameState.currentZone ? 'selected' : ''}>${z.name} (${z.levelRange.min}-${z.levelRange.max})</option>`).join('')}
      </select>
      <button id="attack-toggle" class="btn btn-gold">${this._autoAttacking ? '⏸ Stop' : '⚔️ Attack'}</button>
    `;
    document.getElementById('zone-dropdown')?.addEventListener('change', (e) => {
      if (this.zonesSystem) this.zonesSystem.enterZone(e.target.value);
    });
  }

  renderSpellBar() {
    const el = document.getElementById('spell-bar');
    if (!el) return;
    const playerClass = this.gameState.player.class || '';
    const playerLevel = this.gameState.player.level || 1;
    const available = this.spells.filter(s =>
      (s.class === playerClass || s.class === playerClass.replace(' ', '').toLowerCase()) &&
      s.level <= playerLevel
    ).slice(0, 8);
    if (available.length === 0) {
      el.innerHTML = `<div class="no-spells">No spells available for ${playerClass || 'your class'}.</div>`;
      return;
    }
    el.innerHTML = available.map(spell => `
      <button class="btn spell-btn" data-spell-id="${spell.id}" title="${spell.description}">
        ${spell.name}<br><small>${spell.manaCost}m</small>
      </button>
    `).join('');
    el.querySelectorAll('.spell-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const spell = this.spells.find(s => s.id === btn.dataset.spellId);
        if (spell && this.combatSystem) this.combatSystem.castSpell(spell);
      });
    });
  }

  renderLootLog() {
    const el = document.getElementById('loot-log');
    if (!el) return;
    const log = this.gameState.combat.lootLog || [];
    el.innerHTML = `
      <div class="loot-log-title">Recent Loot</div>
      <ul class="loot-list">
        ${log.length === 0 ? '<li class="muted">No loot yet.</li>' : log.map(name => `<li>🎁 ${name}</li>`).join('')}
      </ul>
    `;
  }

  _bindActions() {
    const btn = document.getElementById('attack-toggle');
    if (btn) {
      btn.addEventListener('click', () => this._toggleAutoAttack());
    }
  }

  _toggleAutoAttack() {
    this._autoAttacking = !this._autoAttacking;
    if (this._autoAttacking) {
      this._startAutoAttack();
    } else {
      this._stopAutoAttack();
    }
    this.renderCombat();
  }

  _startAutoAttack() {
    if (!this.combatSystem) return;
    // Pick a random monster from zone
    const monster = this.zonesSystem ? this.zonesSystem.spawnMonster() : null;
    if (monster) {
      this.combatSystem.startCombat(monster.id);
    }
    this._autoAttackInterval = setInterval(() => {
      if (!this.gameState.combat.active && this._autoAttacking) {
        const m = this.zonesSystem ? this.zonesSystem.spawnMonster() : null;
        if (m) this.combatSystem.startCombat(m.id);
      }
    }, 2000);
  }

  _stopAutoAttack() {
    if (this._autoAttackInterval) {
      clearInterval(this._autoAttackInterval);
      this._autoAttackInterval = null;
    }
    if (this.combatSystem) this.combatSystem.endCombat();
  }

  update() {
    this.renderPlayerStats();
    this.renderCombat();
  }
}
