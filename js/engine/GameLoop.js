export class GameLoop {
  constructor(systems, saveManager) {
    this.tickRate = 600; // ms
    this.systems = systems;
    this.saveManager = saveManager;
    this.totalTicks = 0;
    this.running = false;
    this._interval = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._interval = setInterval(() => this.tick(), this.tickRate);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._interval);
    this._interval = null;
  }

  tick() {
    this.totalTicks++;
    const delta = this.tickRate;
    for (const system of this.systems) {
      try {
        system.update(delta, this.totalTicks);
      } catch (err) {
        console.error(`GameLoop error in system update:`, err);
      }
    }
  }

  processOfflineTicks(offlineMs) {
    // Cap at 24 hours, simulate up to 144000 ticks
    const maxMs = 24 * 60 * 60 * 1000;
    const elapsed = Math.min(offlineMs, maxMs);
    const ticks = Math.floor(elapsed / this.tickRate);
    for (let i = 0; i < ticks; i++) {
      this.tick();
    }
  }
}
