import { eventBus } from './engine/EventBus.js';
import { GameLoop } from './engine/GameLoop.js';
import { SaveManager } from './engine/SaveManager.js';

import { CombatSystem } from './systems/Combat.js';
import { ProgressionSystem } from './systems/Progression.js';
import { SkillsSystem } from './systems/Skills.js';
import { ZonesSystem } from './systems/Zones.js';
import { FactionsSystem } from './systems/Factions.js';
import { CraftingSystem } from './systems/Crafting.js';
import { PetsSystem } from './systems/Pets.js';
import { GhostPlayerSystem } from './systems/GhostPlayers.js';

import { Notifications } from './ui/Notifications.js';
import { Sidebar } from './ui/Sidebar.js';
import { SkillPanel } from './ui/SkillPanel.js';
import { CombatPanel } from './ui/CombatPanel.js';

// ===================================================================
// 1. Default game state
// ===================================================================
const gameState = {
  version: 1,
  savedAt: Date.now(),
  player: {
    name: '',
    class: '',
    level: 1,
    xp: 0,
    xpToNext: 1000,
    hp: 100, maxHp: 100,
    mana: 100, maxMana: 100,
    endurance: 100, maxEndurance: 100,
    gold: 0,
    stats: { str: 75, sta: 75, agi: 75, dex: 75, wis: 75, int: 75, cha: 75 },
    aaPoints: 0,
    aaSpent: {}
  },
  skills: {},
  inventory: [],
  equippedItems: {},
  factions: {},
  currentZone: 'qeynos_hills',
  combat: { active: false, enemyId: null, enemyHp: 0, castProgress: 0, lootLog: [] },
  ghosts: [],
  auctionHouse: [],
  chatFeed: [],
  settings: { autoSave: true },
  pet: null
};

// ===================================================================
// 2. Load all JSON data in parallel
// ===================================================================
async function loadData() {
  const [monsters, zones, spells, items, tradeskills, factions, deities, classes] = await Promise.all([
    fetch('js/data/monsters.json').then(r => r.json()),
    fetch('js/data/zones.json').then(r => r.json()),
    fetch('js/data/spells.json').then(r => r.json()),
    fetch('js/data/items.json').then(r => r.json()),
    fetch('js/data/tradeskills.json').then(r => r.json()),
    fetch('js/data/factions.json').then(r => r.json()),
    fetch('js/data/deities.json').then(r => r.json()),
    fetch('js/data/classes.json').then(r => r.json())
  ]);
  return { monsters, zones, spells, items, tradeskills, factions, deities, classes };
}

// ===================================================================
// 3. Bootstrap
// ===================================================================
async function main() {
  const data = await loadData();

  // --- Save Manager ---
  const saveManager = new SaveManager(gameState);
  const offlineMs = saveManager.getOfflineMs();
  const saved = saveManager.load();
  const hasSave = !!saved;

  if (saved) {
    saveManager.applyLoad(saved, gameState);
  }

  // If a save exists but name is missing, use a fallback and go straight into the game
  if (hasSave && !gameState.player.name) {
    gameState.player.name = 'Adventurer';
  }

  // --- Show char creation if new game ---
  if (!gameState.player.name) {
    showCharCreationModal(data, saveManager, offlineMs, hasSave);
    return; // wait for modal submission
  }

  startGame(data, saveManager, offlineMs);
}

function showCharCreationModal(data, saveManager, offlineMs, hasSave) {
  const modal = document.getElementById('char-creation-modal');
  if (modal) modal.classList.remove('hidden');

  document.getElementById('char-create-btn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('char-name-input');
    const classSelect = document.getElementById('char-class-select');
    const name = (nameInput?.value || '').trim();
    const cls = classSelect?.value || '';
    if (!name || !cls) {
      alert('Please enter a name and select a class.');
      return;
    }
    gameState.player.name = name;
    gameState.player.class = cls;
    // Only apply starting stats for a genuinely new game (no existing save with progress)
    if (!hasSave) {
      const classDef = data.classes.find(c => c.id === cls);
      if (classDef && classDef.startingStats) {
        const s = classDef.startingStats;
        gameState.player.maxHp = s.hp;
        gameState.player.hp = s.hp;
        gameState.player.maxMana = s.mana;
        gameState.player.mana = s.mana;
        gameState.player.maxEndurance = s.endurance;
        gameState.player.endurance = s.endurance;
        gameState.player.stats = {
          str: s.str, sta: s.sta, agi: s.agi, dex: s.dex,
          wis: s.wis, int: s.int, cha: s.cha
        };
      }
    }
    if (modal) modal.classList.add('hidden');
    startGame(data, saveManager, hasSave ? offlineMs : 0);
  });
}

function startGame(data, saveManager, offlineMs) {
  // ================================================================
  // 4. Initialize Systems
  // ================================================================
  const combatSystem    = new CombatSystem(gameState, data);
  const progressionSys  = new ProgressionSystem(gameState);
  const skillsSys       = new SkillsSystem(gameState);
  const zonesSys        = new ZonesSystem(gameState, data);
  const factionsSys     = new FactionsSystem(gameState, data);
  const craftingSys     = new CraftingSystem(gameState, data);
  const petsSys         = new PetsSystem(gameState);
  const ghostSys        = new GhostPlayerSystem(gameState, data, 20);

  // ================================================================
  // 5. Game Loop
  // ================================================================
  const gameLoop = new GameLoop();
  gameLoop.register(combatSystem);
  gameLoop.register(progressionSys);
  gameLoop.register(skillsSys);
  gameLoop.register(zonesSys);
  gameLoop.register(factionsSys);
  gameLoop.register(ghostSys);

  // Process offline ticks (capped at 24h)
  if (offlineMs > 60000) {
    const ticks = gameLoop.processOfflineTicks(offlineMs);
    if (ticks > 0) {
      setTimeout(() => {
        notifications.show(`Welcome back! Processed ${ticks} offline ticks.`, 'info');
      }, 500);
    }
  }

  // ================================================================
  // 6. Initialize UI
  // ================================================================
  const notifications = new Notifications();
  const sidebar       = new Sidebar();
  const skillPanel    = new SkillPanel(gameState, skillsSys);
  const combatPanel   = new CombatPanel(gameState, data, {
    combat: combatSystem,
    zones: zonesSys
  });

  combatPanel.render();
  skillPanel.render();
  renderZonesPanel(data, zonesSys);
  renderFactionsPanel(data, factionsSys);
  renderAAPanel(progressionSys);
  renderInventoryPanel(gameState);
  renderWorldPanel(gameState, ghostSys);
  renderCraftingPanel(data, craftingSys, gameState);
  renderSettingsPanel(saveManager, gameState);

  // ================================================================
  // 7. Wire EventBus Events
  // ================================================================
  eventBus.on('levelup', ({ level }) => {
    notifications.show(`🎉 You have reached level ${level}!`, 'levelup');
    renderAAPanel(progressionSys);
  });

  eventBus.on('loot', ({ item }) => {
    notifications.show(`🎁 You found: ${item.name}`, 'loot');
    renderInventoryPanel(gameState);
  });

  eventBus.on('death', ({ xpLoss }) => {
    notifications.show(`💀 You have died! Lost ${xpLoss} XP.`, 'death');
  });

  eventBus.on('ghost_chat', ({ message }) => {
    const feed = document.getElementById('chat-feed');
    if (feed) {
      const div = document.createElement('div');
      div.textContent = message;
      feed.prepend(div);
      // Keep max 50 messages
      while (feed.children.length > 50) feed.lastChild.remove();
    }
  });

  eventBus.on('ghost_levelup', ({ message }) => {
    const feed = document.getElementById('chat-feed');
    if (feed) {
      const div = document.createElement('div');
      div.textContent = `🎉 ${message}`;
      div.style.color = 'var(--gold)';
      feed.prepend(div);
      while (feed.children.length > 50) feed.lastChild.remove();
    }
  });

  eventBus.on('group_invite', ({ ghosts }) => {
    const names = ghosts.map(g => `${g.name} (${g.class} ${g.level})`).join(', ');
    notifications.show(`Group invite from: ${names}`, 'info');
  });

  eventBus.on('auction_listing', () => renderWorldPanel(gameState, ghostSys));
  eventBus.on('zone_change', () => combatPanel.renderZoneSelect());

  eventBus.on('xp_gained', () => {
    const tickEl = document.getElementById('tick-display');
    if (tickEl) tickEl.textContent = gameLoop.tick;
  });

  // Periodic world panel refresh
  setInterval(() => renderWorldPanel(gameState, ghostSys), 5000);

  // ================================================================
  // 8. Start
  // ================================================================
  gameLoop.start();
  if (gameState.settings.autoSave) {
    saveManager.startAutoSave();
  }

  // Tick display
  setInterval(() => {
    const tickEl = document.getElementById('tick-display');
    if (tickEl) tickEl.textContent = gameLoop.tick;
  }, 600);
}

// ===================================================================
// Panel Renderers
// ===================================================================

function renderZonesPanel(data, zonesSys) {
  const el = document.getElementById('zones-content');
  if (!el) return;
  const zones = zonesSys.getAvailableZones();
  el.innerHTML = zones.map(z => `
    <div class="faction-row">
      <div>
        <strong>${z.name}</strong>
        <div style="font-size:11px;color:var(--muted)">${z.description}</div>
      </div>
      <div style="font-size:12px;color:var(--muted)">Lv ${z.levelRange.min}–${z.levelRange.max}</div>
    </div>
  `).join('');
}

function renderFactionsPanel(data, factionsSys) {
  const el = document.getElementById('factions-content');
  if (!el) return;
  el.innerHTML = data.factions.map(f => {
    const standing = factionsSys.getStanding(f.id);
    const value = factionsSys.getFactionValue(f.id);
    const cls = 'faction-standing-' + standing.toLowerCase().replace(/ /g, '');
    return `
      <div class="faction-row">
        <div>
          <strong>${f.name}</strong>
          <div style="font-size:11px;color:var(--muted)">${f.description}</div>
        </div>
        <div class="${cls}">${standing} (${value})</div>
      </div>
    `;
  }).join('');
}

function renderAAPanel(progressionSys) {
  const el = document.getElementById('aa-content');
  if (!el) return;
  const player = progressionSys.gameState.player;
  const abilities = progressionSys.getAAAbilities();
  document.getElementById('aa-points-display').innerHTML =
    `<p>Available AA Points: <strong style="color:var(--gold)">${player.aaPoints || 0}</strong></p>`;
  document.getElementById('aa-abilities-list').innerHTML = abilities.map(a => `
    <div class="faction-row">
      <div>
        <strong>${a.name}</strong> (Rank ${a.currentRank}/${a.maxRank})
        <div style="font-size:11px;color:var(--muted)">${a.description}</div>
      </div>
      <button class="btn" onclick="window._spendAA('${a.id}')"${a.currentRank >= a.maxRank || !player.aaPoints ? ' disabled' : ''}>
        Spend
      </button>
    </div>
  `).join('');
  window._spendAA = (id) => {
    progressionSys.spendAA(id);
    renderAAPanel(progressionSys);
  };
}

function renderInventoryPanel(gameState) {
  const goldEl = document.getElementById('gold-inv-display');
  if (goldEl) goldEl.textContent = `💰 Gold: ${gameState.player.gold || 0}`;
  const el = document.getElementById('inventory-grid');
  if (!el) return;
  const inv = gameState.inventory;
  if (inv.length === 0) {
    el.innerHTML = '<p class="muted">Your inventory is empty.</p>';
    return;
  }
  el.innerHTML = inv.map(item => `
    <div class="inventory-item">
      <div class="inventory-item-name">${item.name || item.id}</div>
      <div class="inventory-item-type">${item.type || ''}</div>
      ${item.qty > 1 ? `<div class="inventory-item-qty">x${item.qty}</div>` : ''}
    </div>
  `).join('');
}

function renderWorldPanel(gameState, ghostSys) {
  // Who online
  const tbody = document.getElementById('who-online-body');
  if (tbody) {
    const list = ghostSys.getOnlineList();
    tbody.innerHTML = list.map(g => `
      <tr>
        <td>${g.name}</td>
        <td style="text-transform:capitalize">${g.class}</td>
        <td>${g.level}</td>
        <td>${g.zone}</td>
      </tr>
    `).join('');
  }
  // Auction house
  const ahTbody = document.getElementById('auction-house-body');
  if (ahTbody) {
    const listings = gameState.auctionHouse.slice(0, 30);
    ahTbody.innerHTML = listings.length === 0
      ? '<tr><td colspan="4" class="muted" style="padding:8px">No listings.</td></tr>'
      : listings.map(l => `
        <tr>
          <td>${l.item?.name || l.item?.id || '?'}</td>
          <td>${l.sellerName}</td>
          <td style="color:var(--gold)">${l.price}gp</td>
          <td><button class="btn buy-btn" onclick="window._buyAH('${l.id}')">Buy</button></td>
        </tr>
      `).join('');
    window._buyAH = (id) => {
      const result = ghostSys.buyFromAuction(id);
      if (result.success) {
        renderInventoryPanel(gameState);
        renderWorldPanel(gameState, ghostSys);
      }
      alert(result.message);
    };
  }
}

function renderCraftingPanel(data, craftingSys, gameState) {
  const el = document.getElementById('tradeskill-list');
  if (!el) return;
  el.innerHTML = data.tradeskills.map(ts => {
    const skill = gameState.skills[ts.id] || 0;
    return `
      <div style="margin-bottom:16px">
        <div class="section-header">${ts.name} (Skill: ${skill}/300)</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${ts.recipes.map(r => `
            <button class="btn" title="Trivial: ${r.trivial}" onclick="window._craft('${r.id}')">
              ${r.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
  window._craft = (recipeId) => {
    const result = craftingSys.craft(recipeId);
    alert(result.message);
    renderInventoryPanel(gameState);
    renderCraftingPanel(data, craftingSys, gameState);
  };
}

function renderSettingsPanel(saveManager, gameState) {
  document.getElementById('btn-export-save')?.addEventListener('click', () => {
    saveManager.save();
    const b64 = saveManager.exportBase64();
    const out = document.getElementById('export-output');
    const ta = document.getElementById('export-textarea');
    if (out) out.style.display = 'block';
    if (ta) { ta.value = b64; ta.select(); }
  });

  document.getElementById('btn-import-save')?.addEventListener('click', () => {
    const area = document.getElementById('import-area');
    if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-import-confirm')?.addEventListener('click', () => {
    const ta = document.getElementById('import-textarea');
    const b64 = ta?.value?.trim() || '';
    if (!b64) return;
    const ok = saveManager.importBase64(b64, gameState);
    alert(ok ? 'Save imported! Refresh the page.' : 'Import failed. Invalid save data.');
  });

  document.getElementById('btn-delete-save')?.addEventListener('click', () => {
    if (confirm('Delete your save? This cannot be undone.')) {
      saveManager.deleteSave();
      location.reload();
    }
  });

  document.getElementById('setting-autosave')?.addEventListener('change', (e) => {
    gameState.settings.autoSave = e.target.checked;
    if (e.target.checked) saveManager.startAutoSave();
    else saveManager.stopAutoSave();
  });
}

// ===================================================================
// Start
// ===================================================================
main().catch(err => console.error('EQIDLE boot error:', err));
