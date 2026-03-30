export class GameLoop {
  constructor() {
    this.systems = [];
    this.tick = 0;
    this.tickInterval = 600; // ms per tick
    this.running = false;
    this._intervalId = null;
    this._lastTick = Date.now();
  }

  register(system) {
    this.systems.push(system);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._lastTick = Date.now();
    this._intervalId = setInterval(() => this._doTick(), this.tickInterval);
  }

  stop() {
    this.running = false;
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _doTick() {
    const now = Date.now();
    const delta = now - this._lastTick;
    this._lastTick = now;
    this.tick++;
    for (const system of this.systems) {
      try {
        system.update(delta, this.tick);
      } catch (e) {
        console.error('GameLoop system error:', e);
      }
    }
  }

  /**
   * Process ticks that elapsed while the game was closed.
   * @param {number} elapsedMs - milliseconds offline
   */
  processOfflineTicks(elapsedMs) {
    const maxOfflineMs = 24 * 60 * 60 * 1000; // cap at 24 hours
    const capped = Math.min(elapsedMs, maxOfflineMs);
    const ticks = Math.floor(capped / this.tickInterval);
    for (let i = 0; i < ticks; i++) {
      this.tick++;
      for (const system of this.systems) {
        try {
          if (typeof system.updateOffline === 'function') {
            system.updateOffline(this.tickInterval, this.tick);
          } else {
            system.update(this.tickInterval, this.tick);
          }
        } catch (e) {
          console.error('GameLoop offline tick error:', e);
        }
      }
    }
    return ticks;
  }
}
