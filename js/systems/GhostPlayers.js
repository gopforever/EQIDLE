import { eventBus } from '../engine/EventBus.js';

const GHOST_NAMES = [
  'Aelindra', 'Baelorn', 'Caeldris', 'Draegon', 'Elorath', 'Fyrandel', 'Gaelthos', 'Haervain',
  'Ilvari', 'Jaedrin', 'Kaelthos', 'Laerindë', 'Maergon', 'Naelara', 'Orvindel', 'Paeldris',
  'Quelyndra', 'Raelindë', 'Saeldris', 'Taelorn', 'Urvindel', 'Vaelith', 'Waerindë', 'Xaeldris',
  'Yaelorn', 'Zaelindra', 'Aldric', 'Brenath', 'Corvin', 'Daerak', 'Elindra', 'Faelon',
  'Gaerith', 'Haeldris', 'Irindra', 'Jaelorn', 'Kaera', 'Lorvindel', 'Maerath', 'Naeldris',
  'Oelindra', 'Paelon', 'Quelorn', 'Raelin', 'Saeldra', 'Taern', 'Urindra', 'Vaelorn',
  'Waeldris', 'Xaelindra', 'Yaeldris', 'Zaelorn', 'Arindra', 'Braelith', 'Caelindra', 'Daelorn',
  'Eraelith', 'Faeldris', 'Gaelindra', 'Haelorn', 'Iraelith', 'Jaeldris', 'Kaelindra', 'Laelorn',
  'Maelith', 'Naelindra', 'Oaeldris', 'Paelorn', 'Qaelith', 'Raelindra', 'Saelorn', 'Taelith',
  'Uaeldris', 'Vaelindra', 'Waelorn', 'Xaelith', 'Yaelindra', 'Zaelorn', 'Aelith', 'Baelindra',
  'Caelorn', 'Daelith', 'Eaeldris', 'Faelindra', 'Gaelorn', 'Haelith', 'Iaeldris', 'Jaelindra',
  'Kaelorn', 'Laelith', 'Maeldris', 'Naelindra', 'Oaelorn', 'Paelith', 'Qaeldris', 'Raelindra',
  'Saelorn', 'Taelith', 'Uaelindra', 'Vaelorn', 'Waelith', 'Xaeldris', 'Yaelindra', 'Zaelorn'
];

const CLASSES = ['warrior', 'paladin', 'shadowknight', 'ranger', 'bard', 'rogue', 'monk',
  'beastlord', 'berserker', 'cleric', 'druid', 'shaman', 'wizard', 'magician', 'enchanter', 'necromancer'];

const PERSONALITIES = ['farmer', 'raider', 'merchant', 'crafter', 'social'];

const ZONE_PROGRESSION = [
  { min: 1, max: 6, zones: ['qeynos_hills', 'misty_thicket'] },
  { min: 5, max: 15, zones: ['blackburrow', 'crushbone', 'east_commonlands'] },
  { min: 10, max: 25, zones: ['befallen', 'unrest'] },
  { min: 14, max: 35, zones: ['solusek_eye'] },
  { min: 25, max: 50, zones: ['lower_guk'] },
  { min: 35, max: 55, zones: ['nagafens_lair'] },
  { min: 45, max: 55, zones: ['plane_of_fear', 'plane_of_hate'] },
  { min: 45, max: 60, zones: ['karnors_castle'] },
  { min: 40, max: 55, zones: ['great_divide', 'crystal_caverns'] },
  { min: 58, max: 60, zones: ['sleepers_tomb'] }
];

const CHAT_TEMPLATES = [
  'LFG {level} {class} PST',
  'WTS FBSS 2kpp',
  'Anyone have SoW?',
  'Woot! Level {level}!',
  'Need a port to PoK',
  'LFG cleric lfp',
  'WTB Fungi Tunic',
  'Can anyone bind me in EC?',
  'WTS spider silk 5pp ea',
  'LFG {level} {class} looking for group',
  'WTS bone chips 2pp/stack',
  'Anyone selling FBSS?',
  'Ding {level}!! Woot!',
  'WTB Journeyman Boots',
  'LFG {class} {level} all day',
  'Port to Freeport anyone?',
  'WTS banded armor set cheap',
  'Need KEI PST',
  'Selling SoW 5pp',
  'WTB rubicite any slot',
  'PC on Manastone?',
  'Is Cazic Temple open?',
  'WTS gnoll fangs 1pp ea',
  'LFG rogue 45 blackburrow?',
  'Anyone buffing in EC?',
  'WTS Wu tunic 1500pp',
  'Train to zone!',
  'Zone is clear come on in',
  'WTB root rotting please',
  'LFG enchanter LFP',
  '{name} has reached level {level}!',
  'I love this game',
  'WTS spider silk 50 stack',
  'Need a rez in Befallen',
  'WTS orc fangs cheap',
  'LFG 30 warrior PST',
  'WTB green jade maul',
  'Can cleric come KEI group?',
  'Selling DS 2pp',
  'WTS troll parts 5pp/ea',
  '{name} slew Emperor Crushbone!',
  'Looking for another for EC kiting grp',
  'WTS wolf fur stacks 5pp',
  'WTB banded set any slots',
  'FYI trains in zone watch out',
  'Anyone selling clarity?',
  'WTS bat wings 5pp stack',
  'Selling peridot cheap',
  '{name} killed Fippy!',
  'LFG cleric to join us'
];

export class GhostPlayerSystem {
  constructor(gameState, data, count = 20) {
    this.gameState = gameState;
    this.zones = data.zones || [];
    this.items = data.items || [];
    this.monsters = data.monsters || [];
    this._count = count;
    this._chatInterval = {};
    this._init();
  }

  _init() {
    if (!this.gameState.ghosts || this.gameState.ghosts.length === 0) {
      this.gameState.ghosts = [];
      for (let i = 0; i < this._count; i++) {
        this.gameState.ghosts.push(this._createGhost(i));
      }
    }
    if (!this.gameState.auctionHouse) this.gameState.auctionHouse = [];
    if (!this.gameState.chatFeed) this.gameState.chatFeed = [];
  }

  _createGhost(idx) {
    const name = GHOST_NAMES[idx % GHOST_NAMES.length];
    const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)];
    const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
    return {
      id: `ghost_${idx}`,
      name,
      class: cls,
      level: 1,
      xp: 0,
      gold: 10,
      zone: 'qeynos_hills',
      inventory: [],
      personality,
      state: 'hunting',
      chatTick: Math.floor(30 + Math.random() * 90),
      ticksUntilChat: Math.floor(Math.random() * 90)
    };
  }

  update(delta, tick) {
    for (const ghost of this.gameState.ghosts) {
      this._updateGhost(ghost, tick);
    }
    // Expire old auction listings every 100 ticks
    if (tick % 100 === 0) this._expireAuctions(tick);
  }

  updateOffline(delta, tick) {
    this.update(delta, tick);
  }

  _updateGhost(ghost, tick) {
    // XP gain every 10 ticks
    if (tick % 10 === 0) {
      this._gainXP(ghost, tick);
    }
    // Chat
    ghost.ticksUntilChat--;
    if (ghost.ticksUntilChat <= 0) {
      this._emitChat(ghost);
      ghost.ticksUntilChat = ghost.chatTick + Math.floor(Math.random() * 60);
    }
    // Crafter lists items
    if (ghost.personality === 'crafter' && tick % 50 === 0) {
      this._listItemForSale(ghost, tick);
    }
    // Farmer lists loot
    if (ghost.personality === 'farmer' && ghost.inventory.length > 3 && tick % 30 === 0) {
      this._listItemForSale(ghost, tick);
    }
  }

  _gainXP(ghost, tick) {
    const xpGain = Math.floor(10 * (1 + ghost.level * 0.5));
    ghost.xp += xpGain;
    const xpNeeded = Math.floor(1000 * Math.pow(ghost.level, 1.75));
    if (ghost.xp >= xpNeeded && ghost.level < 60) {
      ghost.level++;
      ghost.xp = 0;
      // Move to better zone
      this._updateZone(ghost);
      // Broadcast level up
      const msg = `${ghost.name} has reached level ${ghost.level}!`;
      this._addChat(msg);
      eventBus.emit('ghost_levelup', { ghost, message: msg });
    }
    // Roll for loot from zone monster
    if (tick % 30 === 0 && Math.random() < 0.3) {
      this._rollLoot(ghost);
    }
  }

  _updateZone(ghost) {
    for (const tier of ZONE_PROGRESSION) {
      if (ghost.level >= tier.min && ghost.level <= tier.max) {
        ghost.zone = tier.zones[Math.floor(Math.random() * tier.zones.length)];
        break;
      }
    }
  }

  _rollLoot(ghost) {
    const zone = this.zones.find(z => z.id === ghost.zone);
    if (!zone || !zone.monsters || zone.monsters.length === 0) return;
    const monsterId = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
    const monster = this.monsters.find(m => m.id === monsterId);
    if (!monster || !monster.lootTable) return;
    for (const entry of monster.lootTable) {
      if (Math.random() < entry.dropChance * 0.5) {
        const item = this.items.find(i => i.id === entry.itemId);
        if (item) ghost.inventory.push({ ...item, qty: 1 });
      }
    }
  }

  _listItemForSale(ghost, tick) {
    if (ghost.inventory.length === 0) return;
    const idx = Math.floor(Math.random() * ghost.inventory.length);
    const item = ghost.inventory.splice(idx, 1)[0];
    if (!item) return;
    const price = Math.floor((item.value || 10) * (0.8 + Math.random() * 0.4));
    const listing = {
      id: `ah_${ghost.id}_${tick}`,
      sellerId: ghost.id,
      sellerName: ghost.name,
      item,
      price,
      expiresAtTick: tick + 7200
    };
    this.gameState.auctionHouse.push(listing);
    eventBus.emit('auction_listing', { listing });
  }

  _expireAuctions(currentTick) {
    const before = this.gameState.auctionHouse.length;
    this.gameState.auctionHouse = this.gameState.auctionHouse.filter(l => l.expiresAtTick > currentTick);
  }

  _emitChat(ghost) {
    const template = CHAT_TEMPLATES[Math.floor(Math.random() * CHAT_TEMPLATES.length)];
    const msg = template
      .replace('{name}', ghost.name)
      .replace('{level}', ghost.level)
      .replace('{class}', ghost.class);
    this._addChat(`[${ghost.name}]: ${msg}`);
    eventBus.emit('ghost_chat', { ghost, message: msg });
  }

  _addChat(msg) {
    this.gameState.chatFeed.unshift(msg);
    if (this.gameState.chatFeed.length > 100) this.gameState.chatFeed.pop();
  }

  buyFromAuction(listingId) {
    const idx = this.gameState.auctionHouse.findIndex(l => l.id === listingId);
    if (idx === -1) return { success: false, message: 'Listing not found.' };
    const listing = this.gameState.auctionHouse[idx];
    if (this.gameState.player.gold < listing.price) {
      return { success: false, message: 'Not enough gold.' };
    }
    this.gameState.player.gold -= listing.price;
    this.gameState.inventory.push({ ...listing.item, qty: 1 });
    this.gameState.auctionHouse.splice(idx, 1);
    eventBus.emit('auction_buy', { listing });
    return { success: true, message: `Purchased ${listing.item.name} for ${listing.price} gold!` };
  }

  checkGroupInvite() {
    const player = this.gameState.player;
    const zone = this.zones.find(z => z.id === this.gameState.currentZone);
    if (!zone || zone.levelRange.min <= 45) return null;
    const nearby = this.gameState.ghosts.filter(g =>
      g.zone === this.gameState.currentZone && Math.abs(g.level - player.level) <= 10
    );
    if (nearby.length === 0) return null;
    const group = nearby.slice(0, 5);
    eventBus.emit('group_invite', { ghosts: group });
    return group;
  }

  assembleRaid() {
    const raiders = this.gameState.ghosts.slice(0, 71); // up to 71 + player = 72
    eventBus.emit('raid_assemble', { raiders });
    return raiders;
  }

  getOnlineList() {
    return this.gameState.ghosts.map(g => ({
      name: g.name,
      class: g.class,
      level: g.level,
      zone: g.zone
    }));
  }
}
