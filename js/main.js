import { EventBus } from './engine/EventBus.js';
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
import { CombatPanel } from './ui/CombatPanel.js';
import { SkillPanel } from './ui/SkillPanel.js';

// ─────────────────────────────────────────────
// Load all JSON data files via fetch
// ─────────────────────────────────────────────
async function loadData() {
  const [classes, zones, monsters, items, spells, tradeskills, factions, deities] = await Promise.all([
    fetch('./js/data/classes.json').then(r => r.json()),
    fetch('./js/data/zones.json').then(r => r.json()),
    fetch('./js/data/monsters.json').then(r => r.json()),
    fetch('./js/data/items.json').then(r => r.json()),
    fetch('./js/data/spells.json').then(r => r.json()),
    fetch('./js/data/tradeskills.json').then(r => r.json()),
    fetch('./js/data/factions.json').then(r => r.json()),
    fetch('./js/data/deities.json').then(r => r.json()),
  ]);
  return { classes, zones, monsters, items, spells, tradeskills, factions, deities };
}

// ─────────────────────────────────────────────
// Build default game state for a new character
// ─────────────────────────────────────────────
function buildDefaultGameState(classData, classId, charName, deityId) {
  const cls = classData.find(c => c.id === classId) || classData[0];
  const ss = cls.startingStats || {};

  return {
    player: {
      name: charName || 'Unnamed',
      classId: cls.id,
      className: cls.name,
      deityId: deityId || '',
      level: 1,
      xp: 0,
      aaPoints: 0,
      totalAA: 0,
      aaSpent: {},
      aaEffects: {},
      gold: 100,
      hp: ss.hp || 100,
      maxHp: ss.hp || 100,
      currentHp: ss.hp || 100,
      mana: ss.mana || 0,
      maxMana: ss.mana || 0,
      currentMana: ss.mana || 0,
      endurance: ss.endurance || 100,
      maxEndurance: ss.endurance || 100,
      currentEndurance: ss.endurance || 100,
      str: ss.str || 75,
      sta: ss.sta || 75,
      agi: ss.agi || 75,
      dex: ss.dex || 75,
      wis: ss.wis || 75,
      int: ss.int || 75,
      cha: ss.cha || 55,
      ac: 10,
      inventory: [],
      skills: {},
      spells: cls.spellList || []
    },
    combat: {
      inCombat: false,
      currentEnemy: null
    },
    currentZoneId: 'qeynos_hills',
    autoFight: false,
    factions: {},
    pet: null,
    ghosts: [],
    ghostAuctionHouse: [],
    activeBuffs: [],
    activeTraining: null,
    spellRecastTimers: {},
    xpNeeded: 1000,
    totalTicks: 0
  };
}

// ─────────────────────────────────────────────
// Character Creation Modal
// ─────────────────────────────────────────────
function showCharCreateModal(data, onComplete) {
  const modal = document.getElementById('modal-char-create');
  const classSelect = document.getElementById('char-create-class');
  const deitySelect = document.getElementById('char-create-deity');
  const classDesc = document.getElementById('class-description');

  // Populate class select
  for (const cls of data.classes) {
    const opt = document.createElement('option');
    opt.value = cls.id;
    opt.textContent = `${cls.name} (${cls.combatStyle})`;
    classSelect.appendChild(opt);
  }

  // Populate deity select
  for (const deity of data.deities) {
    const opt = document.createElement('option');
    opt.value = deity.id;
    opt.textContent = `${deity.name} (${deity.alignment})`;
    deitySelect.appendChild(opt);
  }

  // Update description on class change
  function updateDesc() {
    const cls = data.classes.find(c => c.id === classSelect.value);
    if (cls) {
      classDesc.innerHTML = `<strong style="color:var(--gold)">${cls.name}</strong><br>${cls.description}<br><em style="color:var(--muted)">Primary Stat: ${cls.primaryStat} | Style: ${cls.combatStyle}</em>`;
    }
  }
  classSelect.addEventListener('change', updateDesc);
  updateDesc();

  document.getElementById('btn-create-char').addEventListener('click', () => {
    const name = document.getElementById('char-create-name').value.trim() || 'Adventurer';
    const classId = classSelect.value || 'warrior';
    const deityId = deitySelect.value || '';
    modal.style.display = 'none';
    onComplete(name, classId, deityId);
  });
}

// ─────────────────────────────────────────────
// Render Factions Panel
// ─────────────────────────────────────────────
function renderFactionPanel(factionsSystem) {
  const el = document.getElementById('faction-list');
  if (!el) return;
  const allFactions = factionsSystem.getAllFactions();
  el.innerHTML = allFactions.map(f => `
    <div class="faction-entry">
      <span class="faction-name">${f.name}</span>
      <span class="faction-value">${f.currentValue}</span>
      <span class="standing-${f.standing.toLowerCase()}">${f.standing}</span>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// Render AA Panel
// ─────────────────────────────────────────────
function renderAAPanel(progressionSystem, gameState) {
  const grid = document.getElementById('aa-grid');
  const pointsEl = document.getElementById('aa-points-display');
  if (!grid) return;

  const aaPoints = gameState.player.aaPoints || 0;
  if (pointsEl) pointsEl.textContent = `${aaPoints} AA Points`;

  const aaList = progressionSystem.getAAList();
  grid.innerHTML = '';
  for (const aa of aaList) {
    const card = document.createElement('div');
    card.className = 'aa-card';
    card.innerHTML = `
      <div class="aa-name">${aa.name}</div>
      <div class="aa-desc">${aa.description}</div>
      <div class="aa-rank">Rank: ${aa.currentRank} / ${aa.maxRank}</div>
      <div class="aa-cost">Next: ${aa.currentRank < aa.maxRank ? aa.nextCost + ' AA' : 'MAXED'}</div>
      ${aa.currentRank < aa.maxRank ? `<button class="btn btn-gold" data-aa="${aa.id}" style="margin-top:8px;width:100%;">Buy (${aa.nextCost} AA)</button>` : ''}
    `;
    grid.appendChild(card);
  }

  // Attach buy button listeners
  grid.querySelectorAll('[data-aa]').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = progressionSystem.spendAA(btn.dataset.aa);
      if (!result.success) {
        notifications.warning(result.reason || 'Cannot buy AA');
      } else {
        notifications.success(`Purchased ${btn.dataset.aa} rank ${result.rank}`);
        renderAAPanel(progressionSystem, gameState);
      }
    });
  });
}

// ─────────────────────────────────────────────
// Render Inventory Panel
// ─────────────────────────────────────────────
function renderInventoryPanel(gameState, dataStore) {
  const grid = document.getElementById('inventory-grid');
  const countEl = document.getElementById('inv-count');
  if (!grid) return;

  const inventory = gameState.player.inventory || [];
  if (countEl) countEl.textContent = `${inventory.length} items`;

  grid.innerHTML = '';
  for (const slot of inventory) {
    const itemData = dataStore.items ? dataStore.items.find(i => i.id === slot.itemId) : null;
    const name = itemData ? itemData.name : slot.itemId;
    const div = document.createElement('div');
    div.className = 'inventory-slot';
    div.title = itemData ? `${name}\n${JSON.stringify(itemData.stats)}` : name;
    div.innerHTML = `
      <div class="inventory-slot-name">${name}</div>
      ${slot.quantity > 1 ? `<div class="inventory-slot-qty">x${slot.quantity}</div>` : ''}
    `;
    grid.appendChild(div);
  }
}

// ─────────────────────────────────────────────
// Render Crafting Panel
// ─────────────────────────────────────────────
function renderCraftingPanel(craftingSystem, gameState, notif) {
  const tabs = document.getElementById('crafting-tabs');
  const recipeList = document.getElementById('recipe-list');
  if (!tabs || !recipeList) return;

  const tradeskills = craftingSystem.getAllTradeskills();
  let activeTSId = tradeskills[0] ? tradeskills[0].id : null;

  function renderRecipes(tsId) {
    activeTSId = tsId;
    const recipes = craftingSystem.getAvailableRecipes(tsId);
    const playerSkill = (gameState.player.skills && gameState.player.skills[tsId]) || 0;
    recipeList.innerHTML = '';
    for (const recipe of recipes) {
      const chance = craftingSystem.getSuccessChance(playerSkill, recipe.trivial);
      const card = document.createElement('div');
      card.className = 'recipe-card';
      card.innerHTML = `
        <span class="recipe-name">${recipe.name}</span>
        <span class="recipe-trivial">Trivial: ${recipe.trivial}</span>
        <span class="recipe-chance" style="color:${chance >= 80 ? 'var(--success)' : chance >= 50 ? 'var(--warning)' : 'var(--danger)'}">
          ${Math.floor(chance)}%
        </span>
        <button class="btn btn-gold" data-recipe="${recipe.id}" data-ts="${tsId}" style="margin-left:8px;">Craft</button>
      `;
      recipeList.appendChild(card);
    }

    // Craft button listeners
    recipeList.querySelectorAll('[data-recipe]').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = craftingSystem.craft(btn.dataset.recipe, btn.dataset.ts);
        if (result.success) {
          notif.success(`Crafted ${result.result} x${result.quantity}!`);
        } else {
          notif.warning(result.reason || 'Craft failed');
        }
        renderRecipes(activeTSId);
      });
    });
  }

  tabs.innerHTML = '';
  for (const ts of tradeskills) {
    const tab = document.createElement('div');
    tab.className = 'tradeskill-tab' + (ts.id === activeTSId ? ' active' : '');
    tab.textContent = ts.name;
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.tradeskill-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderRecipes(ts.id);
    });
    tabs.appendChild(tab);
  }

  if (activeTSId) renderRecipes(activeTSId);
}

// ─────────────────────────────────────────────
// Render Zones Panel
// ─────────────────────────────────────────────
function renderZonesPanel(dataStore, zonesSystem, gameState) {
  const el = document.getElementById('zone-list');
  if (!el) return;
  el.innerHTML = '';
  const zones = dataStore.zones || [];
  for (const zone of zones) {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(26,58,92,0.3);font-size:13px;';
    const isActive = gameState.currentZoneId === zone.id;
    div.innerHTML = `
      <span style="color:${isActive ? 'var(--gold)' : 'var(--text)'}">${zone.name}</span>
      <span style="color:var(--muted);font-size:11px;">${zone.expansion} | Lvl ${zone.levelRange[0]}-${zone.levelRange[1]}</span>
      <button class="btn ${isActive ? 'btn-active' : ''}" data-zone="${zone.id}" style="padding:4px 10px;font-size:11px;">
        ${isActive ? 'Current' : 'Travel'}
      </button>
    `;
    div.querySelector('[data-zone]').addEventListener('click', () => {
      zonesSystem.enterZone(zone.id);
      const zoneNameEl = document.getElementById('current-zone');
      if (zoneNameEl) zoneNameEl.textContent = zone.name;
      renderZonesPanel(dataStore, zonesSystem, gameState);
    });
    el.appendChild(div);
  }
}

// ─────────────────────────────────────────────
// Ghost Player UI helpers
// ─────────────────────────────────────────────
let ghostSystem;
let notifications;

function setupWorldPanel(ghostSys, dataStore) {
  window._refreshWho = () => {
    const whoList = document.getElementById('who-list');
    if (!whoList) return;
    const list = ghostSys.getWhoList();
    whoList.innerHTML = list.map(g => `
      <div class="who-entry">
        <span class="who-name">${g.name}</span>
        <span class="who-class">${g.class}</span>
        <span class="who-level">Lvl ${g.level}</span>
        <span class="who-zone">${g.zone.replace(/_/g, ' ')}</span>
      </div>
    `).join('');
  };

  window._refreshAuction = () => {
    const tbody = document.getElementById('auction-tbody');
    if (!tbody) return;
    const listings = ghostSys.getAuctionHouse();
    const playerGold = ghostSys.gameState.player.gold || 0;
    tbody.innerHTML = listings.map((listing, i) => `
      <tr>
        <td>${listing.itemName}</td>
        <td>${listing.ghostName}</td>
        <td style="color:var(--gold)">${listing.price}pp</td>
        <td>
          <button class="btn btn-gold" style="padding:3px 8px;font-size:11px;"
            ${playerGold < listing.price ? 'disabled' : ''}
            data-listing="${i}">Buy</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:10px;">No listings</td></tr>';

    tbody.querySelectorAll('[data-listing]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.listing);
        const result = ghostSys.buyFromAuction(idx, ghostSys.gameState.player.gold || 0);
        if (result.success) {
          notifications.loot('Purchase successful!');
        } else {
          notifications.warning(result.reason || 'Purchase failed');
        }
        window._refreshAuction();
      });
    });
  };

  window._refreshWho();
}

// ─────────────────────────────────────────────
// Settings Panel
// ─────────────────────────────────────────────
function setupSettingsPanel(saveManager) {
  document.getElementById('btn-export').addEventListener('click', () => {
    saveManager.save();
    const exported = saveManager.exportSave();
    const box = document.getElementById('export-box');
    if (box && exported) box.value = exported;
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    const str = document.getElementById('import-box').value.trim();
    if (!str) return;
    const ok = saveManager.importSave(str);
    if (ok) {
      notifications.success('Save imported! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      notifications.warning('Import failed: invalid save data');
    }
  });

  document.getElementById('btn-delete-save').addEventListener('click', () => {
    if (confirm('Delete your save? This cannot be undone!')) {
      saveManager.deleteSave();
      window.location.reload();
    }
  });
}

// ─────────────────────────────────────────────
// MAIN BOOTSTRAP
// ─────────────────────────────────────────────
async function main() {
  const data = await loadData();
  const eventBus = new EventBus();

  notifications = new Notifications();

  // Check for existing save
  const tempSave = new SaveManager({});
  const existingSave = tempSave.load();

  function startGame(gameState) {
    // Wire up references
    gameState.totalTicks = gameState.totalTicks || 0;
    gameState.xpNeeded = gameState.xpNeeded || 1000;

    const saveManager = new SaveManager(gameState);

    // Initialize systems
    const combatSystem = new CombatSystem(gameState, eventBus);
    const progressionSystem = new ProgressionSystem(gameState, eventBus);
    const skillsSystem = new SkillsSystem(gameState, eventBus);
    const zonesSystem = new ZonesSystem(gameState, eventBus, data);
    const factionsSystem = new FactionsSystem(gameState, eventBus, data);
    const craftingSystem = new CraftingSystem(gameState, eventBus, data);
    const petsSystem = new PetsSystem(gameState, eventBus);
    ghostSystem = new GhostPlayerSystem(gameState, eventBus, data);
    ghostSystem.init(20);
    gameState.ghostSystem = ghostSystem;

    // Zone system: listen for start_combat
    eventBus.on('start_combat', ({ monster }) => {
      combatSystem.startCombat(monster);
    });

    // XP needed tracking
    eventBus.on('levelup', (data) => {
      gameState.xpNeeded = progressionSystem.getXPNeeded();
      updateHeaderUI(gameState);
    });

    // Tick counter sync
    const systems = [
      combatSystem, progressionSystem, skillsSystem,
      zonesSystem, factionsSystem, craftingSystem,
      petsSystem, ghostSystem
    ];

    const gameLoop = new GameLoop(systems, saveManager);
    gameLoop.totalTicks = gameState.totalTicks || 0;

    // Sync totalTicks to gameState on each tick
    const origTick = gameLoop.tick.bind(gameLoop);
    gameLoop.tick = function() {
      origTick();
      gameState.totalTicks = gameLoop.totalTicks;
      const tickEl = document.getElementById('tick-display');
      if (tickEl) tickEl.textContent = `Tick: ${gameLoop.totalTicks}`;
    };

    // Process offline ticks if > 60 seconds
    if (existingSave && existingSave.savedAt) {
      const offlineMs = saveManager.getOfflineTime(existingSave);
      if (offlineMs > 60000) {
        notifications.info(`Processing ${Math.floor(offlineMs / 60000)} minutes of offline progress...`);
        setTimeout(() => {
          gameLoop.processOfflineTicks(offlineMs);
          notifications.success('Offline progress applied!');
        }, 500);
      }
    }

    // Initialize UI
    const sidebar = new Sidebar({});
    sidebar.init();

    const combatPanel = new CombatPanel(gameState, combatSystem, zonesSystem, eventBus, data, notifications);
    combatPanel.attachListeners();
    combatPanel.render();

    const skillPanel = new SkillPanel(gameState, skillsSystem, eventBus);
    skillPanel.render();

    // Sidebar tab change re-renders
    sidebar.on = (panel) => {};
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const panel = item.dataset.panel;
        setTimeout(() => {
          if (panel === 'factions') renderFactionPanel(factionsSystem);
          if (panel === 'aa') renderAAPanel(progressionSystem, gameState);
          if (panel === 'inventory') renderInventoryPanel(gameState, data);
          if (panel === 'crafting') renderCraftingPanel(craftingSystem, gameState, notifications);
          if (panel === 'zones') renderZonesPanel(data, zonesSystem, gameState);
          if (panel === 'world') { window._refreshWho && window._refreshWho(); }
          if (panel === 'skills') skillPanel.render();
        }, 50);
      });
    });

    // Setup world panel ghost UI
    setupWorldPanel(ghostSystem, data);

    // Setup settings panel
    setupSettingsPanel(saveManager);

    // Ghost event listeners
    eventBus.on('ghost_levelup', (d) => {
      notifications.info(`[${d.name}] has reached level ${d.level}!`);
    });
    eventBus.on('ghost_chat', () => {
      // Chat is handled in CombatPanel._appendChat
    });
    eventBus.on('group_formed', (d) => {
      const gw = document.getElementById('group-window');
      const gm = document.getElementById('group-members');
      if (gw) gw.classList.remove('hidden');
      if (gm) {
        gm.innerHTML = d.members.map(m => `
          <div class="group-member">
            <span class="group-member-name">${m.name}</span>
            <span class="group-member-class">${m.class}</span>
            <span class="group-member-level">Lvl ${m.level}</span>
          </div>
        `).join('');
      }
    });
    eventBus.on('group_disbanded', () => {
      const gw = document.getElementById('group-window');
      if (gw) gw.classList.add('hidden');
    });

    // Pet summoning from spells
    eventBus.on('summon_pet', ({ spellId }) => {
      const classId = gameState.player.classId;
      let petType = 'skeleton';
      if (classId === 'magician') petType = 'earth_elemental';
      if (classId === 'beastlord') petType = 'warder';
      petsSystem.summonPet(petType, gameState.player.level);
      notifications.success('Pet summoned!');
    });

    // Initial zone entry
    const startZone = gameState.currentZoneId || 'qeynos_hills';
    const zoneData = data.zones.find(z => z.id === startZone);
    const zoneNameEl = document.getElementById('current-zone');
    if (zoneNameEl && zoneData) zoneNameEl.textContent = zoneData.name;

    // Update header
    updateHeaderUI(gameState);

    // Start the game loop and auto-save
    gameLoop.start();
    saveManager.startAutoSave();

    // Periodic UI updates
    setInterval(() => {
      combatPanel.render();
      updateHeaderUI(gameState);
    }, 2000);
  }

  function updateHeaderUI(gameState) {
    const p = gameState.player;
    const nameEl = document.getElementById('char-name');
    const levelEl = document.getElementById('char-level');
    const classEl = document.getElementById('char-class');
    if (nameEl) nameEl.textContent = p.name;
    if (levelEl) levelEl.textContent = p.level;
    if (classEl) classEl.textContent = p.className;
  }

  if (existingSave) {
    // Load existing save
    const gameState = existingSave;
    // Ensure all required fields exist
    if (!gameState.combat) gameState.combat = { inCombat: false, currentEnemy: null };
    if (!gameState.factions) gameState.factions = {};
    if (!gameState.ghosts) gameState.ghosts = [];
    if (!gameState.ghostAuctionHouse) gameState.ghostAuctionHouse = [];
    if (!gameState.activeBuffs) gameState.activeBuffs = [];
    if (!gameState.spellRecastTimers) gameState.spellRecastTimers = {};

    // Hide modal
    const modal = document.getElementById('modal-char-create');
    if (modal) modal.style.display = 'none';
    startGame(gameState);
  } else {
    // Show character creation
    showCharCreateModal(data, (name, classId, deityId) => {
      const gameState = buildDefaultGameState(data.classes, classId, name, deityId);
      startGame(gameState);
    });
  }
}

main().catch(err => {
  console.error('EQIDLE failed to start:', err);
});
