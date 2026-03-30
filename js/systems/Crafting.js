export class CraftingSystem {
  constructor(gameState, eventBus, dataStore) {
    this.gameState = gameState;
    this.eventBus = eventBus;
    this.dataStore = dataStore; // { tradeskills, items }
  }

  update(delta, tick) {
    // Crafting is player-initiated; nothing to auto-tick
  }

  craft(recipeId, tradeskillId) {
    const state = this.gameState;
    const player = state.player;

    // Find the recipe
    const recipe = this._findRecipe(recipeId, tradeskillId);
    if (!recipe) return { success: false, reason: 'Unknown recipe' };

    // Check player's tradeskill skill level
    const playerSkill = (player.skills && player.skills[tradeskillId]) || 0;

    // Check components in inventory
    const missingComponents = this._checkComponents(recipe.components);
    if (missingComponents.length > 0) {
      return { success: false, reason: 'Missing components: ' + missingComponents.join(', ') };
    }

    // Roll success
    const chance = this.getSuccessChance(playerSkill, recipe.trivial);
    const success = Math.random() * 100 < chance;

    // Always consume components
    this._consumeComponents(recipe.components);

    if (success) {
      // Add result to inventory
      const quantity = recipe.quantity || 1;
      this._addToInventory(recipe.result, quantity);
      this.gainTradeskillXP(tradeskillId, recipe.trivial, playerSkill);

      this.eventBus.emit('craft_success', {
        recipeId,
        tradeskillId,
        result: recipe.result,
        quantity
      });
      return { success: true, result: recipe.result, quantity };
    } else {
      this.eventBus.emit('craft_fail', { recipeId, tradeskillId });
      return { success: false, reason: 'Crafting failed' };
    }
  }

  getSuccessChance(playerSkill, trivial) {
    if (playerSkill >= trivial) return 95;
    return (playerSkill / trivial) * 90 + 5;
  }

  gainTradeskillXP(tradeskillId, trivial, playerSkill) {
    const state = this.gameState;
    if (!state.player.skills) state.player.skills = {};

    const current = state.player.skills[tradeskillId] || 0;
    if (current >= 350) return;

    // Chance to gain skill point: higher chance when far from trivial
    const ratio = Math.min(1, playerSkill / Math.max(1, trivial));
    const gainChance = Math.max(0.05, 0.8 * (1 - ratio));

    if (Math.random() < gainChance) {
      state.player.skills[tradeskillId] = Math.min(350, current + 1);
      this.eventBus.emit('skill_gain', {
        skillId: tradeskillId,
        newValue: state.player.skills[tradeskillId]
      });
    }
  }

  getAvailableRecipes(tradeskillId) {
    if (!this.dataStore.tradeskills) return [];
    const ts = this.dataStore.tradeskills.find(t => t.id === tradeskillId);
    if (!ts) return [];
    return ts.recipes || [];
  }

  getAllTradeskills() {
    return this.dataStore.tradeskills || [];
  }

  _findRecipe(recipeId, tradeskillId) {
    if (!this.dataStore.tradeskills) return null;
    for (const ts of this.dataStore.tradeskills) {
      if (tradeskillId && ts.id !== tradeskillId) continue;
      const recipe = ts.recipes.find(r => r.id === recipeId);
      if (recipe) return recipe;
    }
    return null;
  }

  _checkComponents(componentIds) {
    const state = this.gameState;
    const inventory = state.player.inventory || [];
    const missing = [];

    // Count needed components
    const needed = {};
    for (const comp of componentIds) {
      needed[comp] = (needed[comp] || 0) + 1;
    }

    // Count available in inventory
    const available = {};
    for (const slot of inventory) {
      available[slot.itemId] = (available[slot.itemId] || 0) + (slot.quantity || 1);
    }

    for (const [itemId, count] of Object.entries(needed)) {
      if ((available[itemId] || 0) < count) {
        missing.push(itemId);
      }
    }
    return missing;
  }

  _consumeComponents(componentIds) {
    const state = this.gameState;
    if (!state.player.inventory) return;

    const needed = {};
    for (const comp of componentIds) {
      needed[comp] = (needed[comp] || 0) + 1;
    }

    for (const [itemId, count] of Object.entries(needed)) {
      let remaining = count;
      for (const slot of state.player.inventory) {
        if (slot.itemId === itemId && remaining > 0) {
          const take = Math.min(remaining, slot.quantity || 1);
          slot.quantity = (slot.quantity || 1) - take;
          remaining -= take;
        }
      }
      // Remove empty slots
      state.player.inventory = state.player.inventory.filter(s => (s.quantity || 1) > 0);
    }
  }

  _addToInventory(itemId, quantity) {
    const state = this.gameState;
    if (!state.player.inventory) state.player.inventory = [];

    // Check if item already in inventory (stack)
    const existing = state.player.inventory.find(s => s.itemId === itemId);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + quantity;
    } else {
      state.player.inventory.push({ itemId, quantity });
    }
  }
}
