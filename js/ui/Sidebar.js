export class Sidebar {
  constructor(panels) {
    this.panels = panels; // object: { panelId: HTMLElement }
    this.active = 'combat';
    this.navItems = [];
  }

  init() {
    this.navItems = document.querySelectorAll('.sidebar-nav-item');

    for (const item of this.navItems) {
      item.addEventListener('click', () => {
        const panelId = item.dataset.panel;
        if (panelId) this.showPanel(panelId);
      });
    }

    // Show initial panel
    this.showPanel(this.active);
  }

  showPanel(panelId) {
    // Hide all panels
    const allPanels = document.querySelectorAll('#panels .panel');
    for (const panel of allPanels) {
      panel.classList.add('hidden');
      panel.classList.remove('active-panel');
    }

    // Show target panel
    const target = document.getElementById(`panel-${panelId}`);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active-panel');
    }

    // Update active nav item
    for (const item of this.navItems) {
      item.classList.remove('active');
      if (item.dataset.panel === panelId) {
        item.classList.add('active');
      }
    }

    this.active = panelId;
  }
}
