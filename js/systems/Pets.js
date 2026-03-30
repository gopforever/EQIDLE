const PET_TEMPLATES = {
  skeleton: {
    name: 'Skeleton Pet',
    hpMultiplier: 0.4,
    dmgMultiplier: 0.5,
    levelOffset: -3,
    class: 'necromancer'
  },
  earth_elemental: {
    name: 'Earth Elemental',
    hpMultiplier: 0.6,
    dmgMultiplier: 0.6,
    levelOffset: -2,
    class: 'magician'
  },
  fire_elemental: {
    name: 'Fire Elemental',
    hpMultiplier: 0.4,
    dmgMultiplier: 0.8,
    levelOffset: -2,
    class: 'magician'
  },
  warder: {
    name: 'Warder',
    hpMultiplier: 0.7,
    dmgMultiplier: 0.5,
    levelOffset: 0,
    class: 'beastlord'
  }
};

export class PetsSystem {
  constructor(gameState, eventBus) {
    this.gameState = gameState;
    this.eventBus = eventBus;
  }

  update(delta, tick) {
    const state = this.gameState;
    const pet = state.pet;
    if (!pet || !pet.alive) return;

    // Pet regenerates HP when not in combat
    if (!state.combat.inCombat) {
      const hpRegen = Math.max(1, Math.floor(pet.maxHp * 0.02));
      pet.currentHp = Math.min(pet.maxHp, (pet.currentHp || 0) + hpRegen);
    }

    // Pet auto-attacks in combat every 2 ticks
    if (state.combat.inCombat && state.combat.currentEnemy && tick % 2 === 0) {
      this.petAttack();
    }
  }

  summonPet(petType, casterLevel) {
    const template = PET_TEMPLATES[petType];
    if (!template) {
      console.warn(`PetsSystem: Unknown pet type "${petType}"`);
      return null;
    }

    const petLevel = Math.max(1, casterLevel + template.levelOffset);
    const maxHp = Math.floor(petLevel * 20 * template.hpMultiplier);
    const minDmg = Math.max(1, Math.floor(petLevel * 2 * template.dmgMultiplier));
    const maxDmg = Math.max(2, Math.floor(petLevel * 5 * template.dmgMultiplier));

    const pet = {
      type: petType,
      name: template.name,
      level: petLevel,
      maxHp,
      currentHp: maxHp,
      minDamage: minDmg,
      maxDamage: maxDmg,
      alive: true,
      casterLevel
    };

    // Dismiss any existing pet
    if (this.gameState.pet && this.gameState.pet.alive) {
      this.dismissPet();
    }

    this.gameState.pet = pet;
    this.eventBus.emit('pet_summoned', { pet });
    return pet;
  }

  petAttack() {
    const state = this.gameState;
    const pet = state.pet;
    if (!pet || !pet.alive) return;

    const enemy = state.combat.currentEnemy;
    if (!enemy) return;

    const damage = Math.floor(
      Math.random() * (pet.maxDamage - pet.minDamage + 1) + pet.minDamage
    );

    enemy.currentHp = Math.max(0, enemy.currentHp - damage);
    this.eventBus.emit('pet_damage', { damage, enemyHp: enemy.currentHp });

    // If enemy is dead, the combat system's onKill handles it
    // Just emit the event
    if (enemy.currentHp <= 0) {
      this.eventBus.emit('kill', {
        enemy: { ...enemy },
        xpGain: enemy.xpReward || 0,
        goldGain: enemy.goldReward || 0,
        loot: []
      });
      state.combat.inCombat = false;
      state.combat.currentEnemy = null;
      this.eventBus.emit('xp_gain', { amount: enemy.xpReward || 0 });
    }
  }

  dismissPet() {
    const state = this.gameState;
    if (!state.pet) return;
    const pet = { ...state.pet };
    state.pet = null;
    this.eventBus.emit('pet_dismissed', { pet });
  }

  healPet(amount) {
    const state = this.gameState;
    const pet = state.pet;
    if (!pet || !pet.alive) return;
    pet.currentHp = Math.min(pet.maxHp, (pet.currentHp || 0) + amount);
    this.eventBus.emit('pet_healed', { amount, currentHp: pet.currentHp });
  }

  getPet() {
    return this.gameState.pet || null;
  }
}
