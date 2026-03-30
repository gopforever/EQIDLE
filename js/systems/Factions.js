import { eventBus } from '../engine/EventBus.js';

const ALLY_GAIN_RATIO = 0.5;
const ENEMY_LOSS_RATIO = 0.5;

const STANDING_LABELS = [
  { min: 1100, label: 'Ally' },
  { min: 750, label: 'Warmly' },
  { min: 500, label: 'Kindly' },
  { min: 100, label: 'Amiably' },
  { min: -100, label: 'Indifferent' },
  { min: -500, label: 'Apprehensively' },
  { min: -750, label: 'Dubiously' },
  { min: -1000, label: 'Threateningly' },
  { min: -Infinity, label: 'Kill on Sight' }
];

export class FactionsSystem {
  constructor(gameState, data) {
    this.gameState = gameState;
    this.factions = data.factions;
    this._init();
  }

  _init() {
    if (!this.gameState.factions) this.gameState.factions = {};
    for (const faction of this.factions) {
      if (!(faction.id in this.gameState.factions)) {
        this.gameState.factions[faction.id] = faction.startingValue || 0;
      }
    }
  }

  update(delta, tick) {}

  adjustFaction(factionId, amount) {
    const factionDef = this.factions.find(f => f.id === factionId);
    if (!factionDef) return;
    const prev = this.gameState.factions[factionId] || 0;
    this.gameState.factions[factionId] = Math.max(-2000, Math.min(2000, prev + amount));
    // Cascade to allies (gain)
    if (amount > 0 && factionDef.allies) {
      for (const allyId of factionDef.allies) {
        const allyVal = this.gameState.factions[allyId] || 0;
        this.gameState.factions[allyId] = Math.max(-2000, Math.min(2000, allyVal + Math.floor(amount * ALLY_GAIN_RATIO)));
      }
    }
    // Cascade to enemies (lose)
    if (amount > 0 && factionDef.enemies) {
      for (const enemyId of factionDef.enemies) {
        const enemyVal = this.gameState.factions[enemyId] || 0;
        this.gameState.factions[enemyId] = Math.max(-2000, Math.min(2000, enemyVal - Math.floor(amount * ENEMY_LOSS_RATIO)));
      }
    }
    eventBus.emit('faction_change', { factionId, value: this.gameState.factions[factionId] });
  }

  getStanding(factionId) {
    const value = this.gameState.factions[factionId] || 0;
    for (const entry of STANDING_LABELS) {
      if (value >= entry.min) return entry.label;
    }
    return 'Kill on Sight';
  }

  isKOS(factionId) {
    return this.getStanding(factionId) === 'Kill on Sight';
  }

  getFactionValue(factionId) {
    return this.gameState.factions[factionId] || 0;
  }
}
