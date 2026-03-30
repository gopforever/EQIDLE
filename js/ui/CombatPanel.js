export class CombatPanel {
  constructor(gameState, combatSystem, zonesSystem, eventBus, dataStore, notifications) {
    this.gameState = gameState;
    this.combatSystem = combatSystem;
    this.zonesSystem = zonesSystem;
    this.eventBus = eventBus;
    this.dataStore = dataStore;
    this.notifications = notifications;
    this.lootLog = [];

    // Listen for events to trigger re-render
    this.eventBus.on('damage', () => this.render());
    this.eventBus.on('enemy_damage', () => this.render());
    this.eventBus.on('heal', () => this.render());
    this.eventBus.on('kill', (data) => {
      if (data.loot && data.loot.length > 0) {
        for (const itemId of data.loot) {
          const item = this.dataStore.items ? this.dataStore.items.find(i => i.id === itemId) : null;
          const name = item ? item.name : itemId;
          this.lootLog.unshift(`Looted: ${name}`);
          if (this.notifications) this.notifications.loot(`Looted: ${name}`);
        }
        if (this.lootLog.length > 10) this.lootLog = this.lootLog.slice(0, 10);
      }
      this.render();
    });
    this.eventBus.on('combat_start', () => this.render());
    this.eventBus.on('combat_stop', () => this.render());
    this.eventBus.on('xp_updated', () => this.render());
    this.eventBus.on('levelup', (data) => {
      if (this.notifications) this.notifications.levelup(`Level Up! You are now level ${data.level}!`);
      this.render();
    });
    this.eventBus.on('death', (data) => {
      if (this.notifications) this.notifications.death(`You have died! Lost ${data.xpLoss} XP.`);
      this.render();
    });
    this.eventBus.on('ghost_chat', (data) => this._appendChat(data));
    this.eventBus.on('group_available', (data) => this._showGroupInvite(data));
  }

  render() {
    const state = this.gameState;
    const player = state.player;
    const enemy = state.combat && state.combat.currentEnemy;

    // Player stats bars
    this._updateBar('player-hp', player.currentHp, player.maxHp, `HP: ${player.currentHp}/${player.maxHp}`);
    this._updateBar('player-mana', player.currentMana, player.maxMana, `Mana: ${player.currentMana}/${player.maxMana}`);
    this._updateBar('player-endurance', player.currentEndurance, player.maxEndurance || player.maxHp, `End: ${player.currentEndurance || 0}/${player.maxEndurance || player.maxHp}`);

    // XP bar
    const xpNeeded = state.xpNeeded || 1000;
    this._updateBar('player-xp', player.xp || 0, xpNeeded, `XP: ${player.xp || 0}/${xpNeeded}`);

    // Enemy display
    const enemySection = document.getElementById('enemy-section');
    if (enemy && enemySection) {
      enemySection.innerHTML = `
        <div class="enemy-card">
          <div class="enemy-name">${enemy.name}</div>
          <div class="enemy-level-badge">Lvl ${enemy.level}</div>
          <div class="stat-bar">
            <label>HP</label>
            <div class="progress-bar">
              <div class="progress-fill hp-fill" style="width:${Math.max(0, (enemy.currentHp / enemy.hp) * 100)}%"></div>
            </div>
            <span>${enemy.currentHp}/${enemy.hp}</span>
          </div>
        </div>
      `;
    } else if (enemySection) {
      enemySection.innerHTML = '<div class="no-enemy">No enemy</div>';
    }

    // Loot log
    const lootLogEl = document.getElementById('loot-log');
    if (lootLogEl) {
      lootLogEl.innerHTML = this.lootLog.map(line => `<div class="loot-entry">${line}</div>`).join('');
    }

    // Update status bar
    const actionEl = document.getElementById('current-action');
    if (actionEl) {
      actionEl.textContent = state.combat.inCombat ? `Fighting: ${enemy ? enemy.name : '???'}` : (state.autoFight ? 'Auto-fighting' : 'Idle');
    }

    const goldEl = document.getElementById('gold-display');
    if (goldEl) goldEl.textContent = `${player.gold || 0}pp`;

    const tickEl = document.getElementById('tick-display');
    if (tickEl && state.totalTicks !== undefined) tickEl.textContent = `Tick: ${state.totalTicks}`;
  }

  attachListeners() {
    // Zone select dropdown
    const zoneSelect = document.getElementById('zone-select');
    if (zoneSelect) {
      // Populate zone list
      if (this.dataStore.zones) {
        zoneSelect.innerHTML = '<option value="">-- Select Zone --</option>';
        for (const zone of this.dataStore.zones) {
          const opt = document.createElement('option');
          opt.value = zone.id;
          opt.textContent = `${zone.name} (${zone.levelRange[0]}-${zone.levelRange[1]})`;
          if (this.gameState.currentZoneId === zone.id) opt.selected = true;
          zoneSelect.appendChild(opt);
        }
      }
      zoneSelect.addEventListener('change', () => {
        const zoneId = zoneSelect.value;
        if (zoneId && this.zonesSystem) {
          this.zonesSystem.enterZone(zoneId);
          const zone = this.dataStore.zones.find(z => z.id === zoneId);
          const zoneNameEl = document.getElementById('current-zone');
          if (zoneNameEl && zone) zoneNameEl.textContent = zone.name;
        }
      });
    }

    // Auto-fight toggle
    const autoFightBtn = document.getElementById('btn-autofight');
    if (autoFightBtn) {
      autoFightBtn.addEventListener('click', () => {
        this.gameState.autoFight = !this.gameState.autoFight;
        autoFightBtn.textContent = this.gameState.autoFight ? 'Stop Fighting' : 'Start Fighting';
        autoFightBtn.classList.toggle('btn-active', this.gameState.autoFight);
        if (!this.gameState.autoFight) {
          this.combatSystem.stopCombat();
        }
      });
    }

    // Spell buttons
    const spellBar = document.getElementById('spell-bar');
    if (spellBar && this.dataStore.spells) {
      const player = this.gameState.player;
      const classSpells = this.dataStore.spells.filter(s =>
        s.class === player.classId && s.level <= player.level
      );
      spellBar.innerHTML = '';
      for (const spell of classSpells.slice(0, 8)) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-spell';
        btn.textContent = spell.name;
        btn.title = `${spell.name} - ${spell.manaCost} mana`;
        btn.addEventListener('click', () => {
          const result = this.combatSystem.castSpell(spell);
          if (!result.success) {
            if (this.notifications) this.notifications.warning(result.reason || 'Cannot cast');
          } else {
            if (this.notifications) this.notifications.info(`Cast ${spell.name}`);
          }
        });
        spellBar.appendChild(btn);
      }
    }

    // Group invite button handlers are attached dynamically
    const disbandBtn = document.getElementById('btn-disband-group');
    if (disbandBtn) {
      disbandBtn.addEventListener('click', () => {
        if (this.gameState.ghostSystem) {
          this.gameState.ghostSystem.disbandGroup();
        }
      });
    }
  }

  _updateBar(id, current, max, label) {
    const bar = document.getElementById(id);
    if (!bar) return;
    const fill = bar.querySelector('.progress-fill');
    const lbl = bar.querySelector('.bar-label');
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (lbl) lbl.textContent = label;
  }

  _appendChat(data) {
    const chatFeed = document.getElementById('chat-feed');
    if (!chatFeed) return;
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.innerHTML = `<span class="chat-name">${data.name} (${data.level} ${data.class}):</span> <span class="chat-msg">${data.message}</span>`;
    chatFeed.appendChild(line);
    // Keep last 50 lines
    while (chatFeed.children.length > 50) chatFeed.removeChild(chatFeed.firstChild);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  _showGroupInvite(data) {
    const inviteEl = document.getElementById('group-invite');
    if (!inviteEl) return;
    const names = data.ghosts.map(g => `${g.name} (${g.level} ${g.class})`).join(', ');
    inviteEl.innerHTML = `
      <div class="group-invite-msg">Group invite from: ${names}</div>
      <button class="btn btn-gold" id="btn-accept-group">Accept</button>
      <button class="btn" id="btn-decline-group">Decline</button>
    `;
    inviteEl.classList.remove('hidden');

    document.getElementById('btn-accept-group').addEventListener('click', () => {
      if (this.gameState.ghostSystem) {
        this.gameState.ghostSystem.acceptGroup(data.ghosts.map(g => g.id));
      }
      inviteEl.classList.add('hidden');
      if (this.notifications) this.notifications.success('Joined a group!');
    });
    document.getElementById('btn-decline-group').addEventListener('click', () => {
      inviteEl.classList.add('hidden');
    });
  }
}
