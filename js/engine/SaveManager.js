export class SaveManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.saveKey = 'eqidle_save';
    this.saveInterval = 30000;
  }

  save() {
    try {
      const data = JSON.stringify({
        ...this.gameState,
        savedAt: Date.now(),
        version: 1
      });
      localStorage.setItem(this.saveKey, data);
    } catch (err) {
      console.error('SaveManager: Failed to save game:', err);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error('SaveManager: Failed to load game:', err);
      return null;
    }
  }

  getOfflineTime(save) {
    if (!save || !save.savedAt) return 0;
    return Date.now() - save.savedAt;
  }

  exportSave() {
    const raw = localStorage.getItem(this.saveKey);
    if (!raw) return null;
    return btoa(raw);
  }

  importSave(str) {
    try {
      const decoded = atob(str);
      JSON.parse(decoded); // Validate JSON before setting
      localStorage.setItem(this.saveKey, decoded);
      return true;
    } catch (err) {
      console.error('SaveManager: Failed to import save:', err);
      return false;
    }
  }

  deleteSave() {
    localStorage.removeItem(this.saveKey);
  }

  startAutoSave() {
    setInterval(() => this.save(), this.saveInterval);
    window.addEventListener('beforeunload', () => this.save());
  }
}
