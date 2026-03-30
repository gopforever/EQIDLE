export class ZonesSystem {
  constructor(gameState, eventBus, dataStore) {
    this.gameState = gameState;
    this.eventBus = eventBus;
    this.dataStore = dataStore; // { zones, monsters }
    this.bossRespawnTimers = {}; // zoneId -> ticks remaining
  }

  update(delta, tick) {
    const state = this.gameState;
    if (!state.currentZoneId) return;

    // Decrease boss respawn timers
    for (const zoneId of Object.keys(this.bossRespawnTimers)) {
      if (this.bossRespawnTimers[zoneId] > 0) {
        this.bossRespawnTimers[zoneId]--;
      }
    }

    // If not in combat, try to spawn next monster
    if (!state.combat.inCombat && state.autoFight) {
      this.checkBossSpawn(state.currentZoneId, tick);
      if (!state.combat.inCombat) {
        this.spawnMonster(state.currentZoneId);
      }
    }
  }

  enterZone(zoneId) {
    const state = this.gameState;
    const zone = this._getZone(zoneId);
    if (!zone) {
      console.warn(`ZonesSystem: Unknown zone "${zoneId}"`);
      return false;
    }

    // Check faction requirement
    if (zone.factionRequired) {
      const factionStanding = state.factions && state.factions[zone.factionRequired];
      if (factionStanding !== undefined && factionStanding < -100) {
        this.eventBus.emit('zone_blocked', { zoneId, reason: 'faction' });
        return false;
      }
    }

    // Check if this is a raid zone
    if (this._isRaidZone(zone) && !state.groupId) {
      this.eventBus.emit('raid_zone_entered', { zoneId, zone });
    }

    // Stop current combat
    if (state.combat.inCombat) {
      state.combat.inCombat = false;
      state.combat.currentEnemy = null;
    }

    state.currentZoneId = zoneId;
    this.eventBus.emit('zone_enter', { zoneId, zone });

    // Spawn initial monster
    if (state.autoFight) {
      this.spawnMonster(zoneId);
    }

    return true;
  }

  spawnMonster(zoneId) {
    const state = this.gameState;
    const zone = this._getZone(zoneId);
    if (!zone || !zone.monsters || zone.monsters.length === 0) return;

    // Pick a random monster from the zone's list
    const monsterIds = zone.monsters;
    const monsterId = monsterIds[Math.floor(Math.random() * monsterIds.length)];
    const monster = this._getMonster(monsterId);

    if (!monster) return;

    this.eventBus.emit('monster_spawned', { monster, zoneId });
    this.eventBus.emit('start_combat', { monster });
  }

  checkBossSpawn(zoneId, tick) {
    const state = this.gameState;
    const zone = this._getZone(zoneId);
    if (!zone || !zone.boss) return false;

    const boss = zone.boss;
    const timerKey = zoneId + '_boss';

    // If boss is on respawn timer, skip
    if (this.bossRespawnTimers[timerKey] > 0) return false;

    // Roll for boss spawn
    if (Math.random() < (boss.spawnChance || 0.01)) {
      const bossMonster = {
        id: boss.id,
        name: boss.name,
        zone: zoneId,
        level: zone.levelRange[1] + 2,
        hp: zone.levelRange[1] * 100,
        minDamage: zone.levelRange[1] * 3,
        maxDamage: zone.levelRange[1] * 6,
        xpReward: zone.levelRange[1] * 50,
        goldReward: zone.levelRange[1] * 10,
        lootTable: (boss.loot || []).map(itemId => ({ itemId, dropChance: 0.3 })),
        faction: 'boss',
        isUndead: false,
        isSocial: false,
        isAnimal: false
      };

      this.bossRespawnTimers[timerKey] = boss.respawnTicks || 200;
      this.eventBus.emit('boss_spawn', { boss: bossMonster, zoneId });
      this.eventBus.emit('start_combat', { monster: bossMonster });
      return true;
    }
    return false;
  }

  getZonesForLevel(level) {
    const zones = this.dataStore.zones || [];
    return zones.filter(z => {
      const [min, max] = z.levelRange;
      return level >= min - 5 && level <= max + 5;
    });
  }

  _getZone(zoneId) {
    if (!this.dataStore.zones) return null;
    return this.dataStore.zones.find(z => z.id === zoneId) || null;
  }

  _getMonster(monsterId) {
    if (!this.dataStore.monsters) return null;
    return this.dataStore.monsters.find(m => m.id === monsterId) || null;
  }

  _isRaidZone(zone) {
    return zone.levelRange && zone.levelRange[0] >= 46;
  }
}
