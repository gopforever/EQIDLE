const SAVE_KEY = 'eqidle_save';
const VERSION = 1;
const AUTO_SAVE_INTERVAL = 30000; // 30s

export class SaveManager {
  constructor(gameState) {
    this.gameState = gameState;
    this._intervalId = null;
  }

  save() {
    try {
      const data = { ...this.gameState, version: VERSION, savedAt: Date.now() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('SaveManager: save failed', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.version) return null;
      return data;
    } catch (e) {
      console.error('SaveManager: load failed', e);
      return null;
    }
  }

  /**
   * Apply a saved state onto the current gameState object in place.
   */
  applyLoad(saved, gameState) {
    Object.assign(gameState, saved);
  }

  getOfflineMs() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 0;
    try {
      const data = JSON.parse(raw);
      const savedAt = data.savedAt || Date.now();
      return Date.now() - savedAt;
    } catch {
      return 0;
    }
  }

  startAutoSave() {
    this.stopAutoSave();
    this._intervalId = setInterval(() => this.save(), AUTO_SAVE_INTERVAL);
    window.addEventListener('beforeunload', () => this.save());
  }

  stopAutoSave() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /** Export save as Base64 string */
  exportBase64() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || '{}';
      return btoa(unescape(encodeURIComponent(raw)));
    } catch (e) {
      console.error('SaveManager: export failed', e);
      return '';
    }
  }

  /** Import save from Base64 string */
  importBase64(b64, gameState) {
    try {
      const raw = decodeURIComponent(escape(atob(b64)));
      const data = JSON.parse(raw);
      localStorage.setItem(SAVE_KEY, raw);
      this.applyLoad(data, gameState);
      return true;
    } catch (e) {
      console.error('SaveManager: import failed', e);
      return false;
    }
  }

  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}
