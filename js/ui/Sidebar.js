const PANELS = ['combat', 'skills', 'crafting', 'zones', 'factions', 'aa', 'inventory', 'settings', 'world'];

export class Sidebar {
  constructor() {
    this._active = 'combat';
    this._buildNav();
    this.showPanel('combat');
  }

  _buildNav() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.innerHTML = '';
    const labels = {
      combat: '⚔️ Combat',
      skills: '📊 Skills',
      crafting: '🔨 Crafting',
      zones: '🗺️ Zones',
      factions: '🏰 Factions',
      aa: '✨ AA',
      inventory: '🎒 Inventory',
      settings: '⚙️ Settings',
      world: '🌐 World'
    };
    for (const id of PANELS) {
      const btn = document.createElement('button');
      btn.className = 'sidebar-nav-item';
      btn.dataset.panel = id;
      btn.textContent = labels[id] || id;
      btn.addEventListener('click', () => this.showPanel(id));
      nav.appendChild(btn);
    }
  }

  showPanel(panelId) {
    this._active = panelId;
    // Hide all panels
    for (const id of PANELS) {
      const el = document.getElementById(`panel-${id}`);
      if (el) el.classList.remove('panel-active');
    }
    // Show target
    const target = document.getElementById(`panel-${panelId}`);
    if (target) target.classList.add('panel-active');
    // Update nav active state
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panelId);
    });
  }

  getActive() {
    return this._active;
  }
}
