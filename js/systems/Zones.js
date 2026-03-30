import { eventBus } from '../engine/EventBus.js';

export class ZonesSystem {
  constructor(gameState, data) {
    this.gameState = gameState;
    this.zones = data.zones;
    this.monsters = data.monsters;
    this._bossCountdown = {};
  }

  update(delta, tick) {
    const zone = this._currentZone();
    if (!zone) return;
    // Boss spawn check every 60 ticks
    if (tick % 60 === 0) {
      this.checkBossSpawn(zone.id);
    }
  }

  _currentZone() {
    return this.zones.find(z => z.id === this.gameState.currentZone);
  }

  enterZone(zoneId) {
    const zone = this.zones.find(z => z.id === zoneId);
    if (!zone) return false;
    this.gameState.currentZone = zoneId;
    eventBus.emit('zone_change', { zone });
    return true;
  }

  spawnMonster() {
    const zone = this._currentZone();
    if (!zone || !zone.monsters || zone.monsters.length === 0) return null;
    const pool = zone.monsters.filter(mid => mid !== zone.boss?.id);
    if (pool.length === 0) return null;
    const monsterId = pool[Math.floor(Math.random() * pool.length)];
    return this.monsters.find(m => m.id === monsterId) || null;
  }

  checkBossSpawn(zoneId) {
    const zone = this.zones.find(z => z.id === zoneId);
    if (!zone || !zone.boss) return false;
    const cd = this._bossCountdown[zoneId] || 0;
    if (cd > 0) {
      this._bossCountdown[zoneId] = cd - 1;
      return false;
    }
    if (Math.random() < zone.boss.spawnChance) {
      const boss = this.monsters.find(m => m.id === zone.boss.id);
      if (boss) {
        this._bossCountdown[zoneId] = zone.boss.respawnTicks;
        eventBus.emit('boss_spawn', { zone, boss });
        return true;
      }
    }
    return false;
  }

  getZone(zoneId) {
    return this.zones.find(z => z.id === zoneId) || null;
  }

  getAvailableZones() {
    const player = this.gameState.player;
    return this.zones.filter(z => {
      if (z.factionRequired) {
        const fv = (this.gameState.factions || {})[z.factionRequired] || 0;
        if (fv < 0) return false;
      }
      return player.level >= z.levelRange.min;
    });
  }
}
