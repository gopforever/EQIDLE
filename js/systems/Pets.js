import { eventBus } from '../engine/EventBus.js';

const PET_TYPES = {
  skeleton: { name: 'Skeleton', baseHp: 80, baseDamage: 6, type: 'undead' },
  earth_elemental: { name: 'Earth Elemental', baseHp: 120, baseDamage: 10, type: 'elemental' },
  fire_elemental: { name: 'Fire Elemental', baseHp: 100, baseDamage: 14, type: 'elemental' },
  warder: { name: 'Warder', baseHp: 150, baseDamage: 12, type: 'animal' }
};

export class PetsSystem {
  constructor(gameState) {
    this.gameState = gameState;
    if (!this.gameState.pet) this.gameState.pet = null;
  }

  update(delta, tick) {
    const pet = this.gameState.pet;
    if (!pet) return;
    // Pet auto attacks if combat is active
    if (this.gameState.combat.active) {
      if (tick % 3 === 0) {
        this.petAttack();
      }
    }
  }

  summonPet(type, level) {
    if (this.gameState.pet) this.dismissPet();
    const def = PET_TYPES[type];
    if (!def) return false;
    const plvl = level || this.gameState.player.level;
    const pet = {
      type,
      name: def.name,
      level: Math.max(1, plvl - 3),
      maxHp: def.baseHp + plvl * 10,
      hp: def.baseHp + plvl * 10,
      damage: def.baseDamage + Math.floor(plvl * 0.5),
      petType: def.type
    };
    this.gameState.pet = pet;
    eventBus.emit('pet_summoned', { pet });
    return pet;
  }

  petAttack() {
    const pet = this.gameState.pet;
    if (!pet || !this.gameState.combat.active) return 0;
    const dmg = Math.floor(pet.damage * (0.8 + Math.random() * 0.4));
    this.gameState.combat.enemyHp = Math.max(0, (this.gameState.combat.enemyHp || 0) - dmg);
    eventBus.emit('pet_attack', { damage: dmg });
    return dmg;
  }

  healPet(amount) {
    const pet = this.gameState.pet;
    if (!pet) return;
    pet.hp = Math.min(pet.maxHp, pet.hp + amount);
    eventBus.emit('pet_healed', { hp: pet.hp, maxHp: pet.maxHp });
  }

  dismissPet() {
    this.gameState.pet = null;
    eventBus.emit('pet_dismissed', {});
  }

  getPet() {
    return this.gameState.pet;
  }
}
