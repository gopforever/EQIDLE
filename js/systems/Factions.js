const FACTION_THRESHOLDS = {
  kos: -500,
  dubious: -100,
  apprehensive: 0,
  indifferent: 100,
  amiable: 500,
  kindly: 750,
  warmly: 900,
  ally: 1100
};

export class FactionsSystem {
  constructor(gameState, eventBus, dataStore) {
    this.gameState = gameState;
    this.eventBus = eventBus;
    this.dataStore = dataStore; // { factions }

    // Initialize faction values from data
    if (!this.gameState.factions) {
      this.gameState.factions = {};
      if (dataStore.factions) {
        for (const faction of dataStore.factions) {
          this.gameState.factions[faction.id] = faction.startingValue || 0;
        }
      }
    }
  }

  update(delta, tick) {
    // Factions are event-driven; nothing to tick
  }

  adjustFaction(factionId, amount) {
    const state = this.gameState;
    if (!state.factions) state.factions = {};

    const prev = state.factions[factionId] || 0;
    state.factions[factionId] = Math.max(-1000, Math.min(1500, prev + amount));

    this.eventBus.emit('faction_change', {
      factionId,
      newValue: state.factions[factionId],
      delta: amount
    });

    // Cascade to allied/enemy factions
    const faction = this._getFactionData(factionId);
    if (faction) {
      // Allies gain the same direction at 25% rate
      for (const allyId of (faction.allies || [])) {
        const allyVal = state.factions[allyId] || 0;
        const allyChange = Math.floor(amount * 0.25);
        if (allyChange !== 0) {
          state.factions[allyId] = Math.max(-1000, Math.min(1500, allyVal + allyChange));
          this.eventBus.emit('faction_change', { factionId: allyId, newValue: state.factions[allyId], delta: allyChange });
        }
      }

      // Enemies gain the opposite direction at 25% rate
      for (const enemyId of (faction.enemies || [])) {
        const enemyVal = state.factions[enemyId] || 0;
        const enemyChange = Math.floor(-amount * 0.25);
        if (enemyChange !== 0) {
          state.factions[enemyId] = Math.max(-1000, Math.min(1500, enemyVal + enemyChange));
          this.eventBus.emit('faction_change', { factionId: enemyId, newValue: state.factions[enemyId], delta: enemyChange });
        }
      }
    }
  }

  getStanding(factionId) {
    const state = this.gameState;
    const value = (state.factions && state.factions[factionId]) || 0;

    if (value < FACTION_THRESHOLDS.kos) return 'KOS';
    if (value < FACTION_THRESHOLDS.dubious) return 'KOS';
    if (value < FACTION_THRESHOLDS.apprehensive) return 'dubious';
    if (value < FACTION_THRESHOLDS.indifferent) return 'apprehensive';
    if (value < FACTION_THRESHOLDS.amiable) return 'indifferent';
    if (value < FACTION_THRESHOLDS.kindly) return 'amiable';
    if (value < FACTION_THRESHOLDS.warmly) return 'kindly';
    if (value < FACTION_THRESHOLDS.ally) return 'warmly';
    return 'ally';
  }

  isKOS(factionId) {
    const value = (this.gameState.factions && this.gameState.factions[factionId]) || 0;
    return value < FACTION_THRESHOLDS.dubious;
  }

  getFactionValue(factionId) {
    return (this.gameState.factions && this.gameState.factions[factionId]) || 0;
  }

  getAllFactions() {
    if (!this.dataStore.factions) return [];
    return this.dataStore.factions.map(f => ({
      ...f,
      currentValue: this.getFactionValue(f.id),
      standing: this.getStanding(f.id),
      isKOS: this.isKOS(f.id)
    }));
  }

  _getFactionData(factionId) {
    if (!this.dataStore.factions) return null;
    return this.dataStore.factions.find(f => f.id === factionId) || null;
  }
}
