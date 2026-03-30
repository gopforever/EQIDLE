import { eventBus } from '../engine/EventBus.js';

export class CraftingSystem {
  constructor(gameState, data) {
    this.gameState = gameState;
    this.tradeskills = data.tradeskills;
    this._buildRecipeMap();
  }

  _buildRecipeMap() {
    this._recipes = {};
    for (const ts of this.tradeskills) {
      for (const recipe of ts.recipes) {
        this._recipes[recipe.id] = { ...recipe, tradeskillId: ts.id };
      }
    }
  }

  update(delta, tick) {}

  craft(recipeId) {
    const recipe = this._recipes[recipeId];
    if (!recipe) return { success: false, message: 'Unknown recipe.' };
    const tsId = recipe.tradeskillId;
    const skill = this.gameState.skills[tsId] || 0;
    // Check components
    for (const comp of recipe.components) {
      const count = this._countItem(comp.itemId);
      if (count < comp.quantity) {
        return { success: false, message: `Missing ${comp.quantity - count}x ${comp.itemId}.` };
      }
    }
    // Roll success
    const chance = this.getSuccessChance(skill, recipe.trivial);
    if (Math.random() > chance) {
      // On failure still consume components
      for (const comp of recipe.components) this._removeItem(comp.itemId, comp.quantity);
      // Small skill gain on failure
      this._gainSkill(tsId, recipe.trivial);
      return { success: false, message: 'You fail to create the item, and some components are lost.' };
    }
    // Remove components
    for (const comp of recipe.components) this._removeItem(comp.itemId, comp.quantity);
    // Add result
    this._addItem(recipe.result, recipe.quantity || 1);
    // Skill gain
    this._gainSkill(tsId, recipe.trivial);
    eventBus.emit('craft_success', { recipeId, result: recipe.result });
    return { success: true, message: `You successfully created ${recipe.result}!` };
  }

  getSuccessChance(skill, trivial) {
    if (skill >= trivial) return 0.95;
    if (trivial <= 0) return 0.95;
    const ratio = skill / trivial;
    return Math.max(0.05, ratio * 0.9);
  }

  _gainSkill(tsId, trivial) {
    const skill = this.gameState.skills[tsId] || 0;
    if (skill < trivial) {
      const chance = 0.1 * (1 - skill / Math.max(trivial, 1));
      if (Math.random() < chance) {
        this.gameState.skills[tsId] = Math.min(300, skill + 1);
        eventBus.emit('skill_gain', { skillId: tsId, value: this.gameState.skills[tsId] });
      }
    }
  }

  _countItem(itemId) {
    return this.gameState.inventory
      .filter(i => i.id === itemId)
      .reduce((sum, i) => sum + (i.qty || 1), 0);
  }

  _removeItem(itemId, qty) {
    let remaining = qty;
    const inv = this.gameState.inventory;
    for (let i = inv.length - 1; i >= 0 && remaining > 0; i--) {
      if (inv[i].id === itemId) {
        const q = inv[i].qty || 1;
        if (q <= remaining) {
          remaining -= q;
          inv.splice(i, 1);
        } else {
          inv[i].qty = q - remaining;
          remaining = 0;
        }
      }
    }
  }

  _addItem(itemId, qty) {
    // Find existing stack
    const existing = this.gameState.inventory.find(i => i.id === itemId);
    if (existing) {
      existing.qty = (existing.qty || 1) + qty;
    } else {
      this.gameState.inventory.push({ id: itemId, qty });
    }
  }

  getRecipesForSkill(tsId) {
    const ts = this.tradeskills.find(t => t.id === tsId);
    return ts ? ts.recipes : [];
  }
}
