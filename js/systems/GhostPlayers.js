const GHOST_NAMES = [
  'Thoribas', 'Dornath', 'Seraphix', 'Velithor', 'Kyntara', 'Grubknuckle', 'Zordak', 'Mireille',
  'Thaelindra', 'Vrix', 'Keldoryn', 'Bramblestump', 'Graknak', 'Syltheria', 'Aldren', 'Nommik',
  'Craxus', 'Fenwick', 'Lorathas', 'Quidian', 'Harkenna', 'Tristavar', 'Gulbrak', 'Santhis',
  'Peregon', 'Umbrax', 'Chelindra', 'Vondrak', 'Izalith', 'Brandor', 'Seraphis', 'Thyrak',
  'Mordecai', 'Zelphira', 'Grimbane', 'Asterion', 'Dunveth', 'Calix', 'Wrennal', 'Sithara',
  'Brokenfang', 'Torvath', 'Lirael', 'Xandeth', 'Grethok', 'Mirasha', 'Caldran', 'Phylax',
  'Sindora', 'Halven', 'Orbek', 'Crindel', 'Tharzek', 'Neladra', 'Vorath', 'Kestrix',
  'Dranna', 'Wolfmane', 'Pyraxis', 'Sandor', 'Thelyx', 'Grethis', 'Carvex', 'Illara',
  'Brondan', 'Skalex', 'Mirthul', 'Yendris', 'Gobnar', 'Thanthra', 'Xervak', 'Kelindra',
  'Durrok', 'Aethis', 'Morvak', 'Sindath', 'Galwyn', 'Zekkar', 'Torven', 'Lysara',
  'Grimholt', 'Vyxara', 'Porthen', 'Skaldrak', 'Illysia', 'Brandeth', 'Cruxis', 'Nalmira',
  'Gorvax', 'Thelandra', 'Vikris', 'Morthak', 'Selyra', 'Drakkon', 'Phyxis', 'Aldrath',
  'Zendara', 'Thurvak', 'Lycoris', 'Snarlpaw', 'Grethkan', 'Ithara'
];

const CLASS_IDS = [
  'warrior', 'paladin', 'shadowknight', 'ranger', 'bard', 'rogue', 'monk', 'beastlord',
  'berserker', 'cleric', 'druid', 'shaman', 'wizard', 'magician', 'enchanter', 'necromancer'
];

const PERSONALITIES = ['farmer', 'raider', 'merchant', 'crafter', 'social'];

const CHAT_TEMPLATES = [
  'LFG {level} {class}, need healer for {zone}',
  'WTS {item} {price}pp, PST',
  'WTB {item}, paying well',
  'Anyone have SoW? Heading to {zone}',
  'LFM for {zone}, need {class}',
  'Just hit level {level}! Woot!',
  '{zone} is dead, need more players',
  'Can someone port me to {zone}?',
  'WTS {item} {price}pp OBO',
  'WTB resist gear, PST',
  'Any clerics available for {zone} run?',
  'Camp check {zone}',
  '{level} {class} LFG, know all fights',
  'How much is {item} worth these days?',
  'Anyone have a spare KEI? Please?',
  'Selling power leveling services in {zone}',
  'WTS tradeskill services - Smithing 300+',
  'LFM to farm {zone} for {item}',
  'Anyone doing {zone} tonight?',
  'Need enchanter for buffs, paying 100pp',
  'WTS {item} rare drop {price}pp',
  'Cleric LFG, have KEI, full buffs',
  '{level} necro LFG with pet',
  'Bard LFG anywhere, have all songs',
  'Need tank for {zone} group',
  'WTS stack of {item} {price}pp',
  'Anyone farming {zone}? Need spot',
  'LFM {zone} raid, need numbers',
  'Just got {item}!! Best day ever!',
  'Warning: trains in {zone}',
  'Any shamans selling slow buffs?',
  'WTS {item} or best offer',
  'This camp is taken FYI',
  'LFG patient group for {zone}',
  'Selling ports to all planes!',
  'Anyone have Extra Planar Strength?',
  'WTB Flowing Black Silk Sash, paying 3kpp',
  'Anyone know a good camp in {zone}?',
  'Need rogue for {zone} lockpicks',
  'The server feels alive today!',
  '{class} checking in, ready to adventure',
  'WTS spell components, PST with list',
  'LFM for trash clearing in {zone}',
  '{item} dropped! So excited!',
  'Anyone got a spare res? Died in {zone}',
  'Need buffs before raid, paying 200pp',
  'Bard songs available for groups',
  'WTS Alchemy potions, cheap!',
  '{level} {class} available for hire',
  'What level should I be for {zone}?',
  'LFG East Karana, level {level}'
];

const ZONE_IDS = [
  'qeynos_hills', 'east_commonlands', 'misty_thicket', 'crushbone', 'blackburrow',
  'unrest', 'befallen', 'solusek_eye', 'nagafens_lair', 'lower_guk',
  'field_of_bone', 'frontier_mountains', 'karnors_castle', 'great_divide'
];

const ITEM_NAMES = [
  'Flowing Black Silk Sash', 'Fungi Tunic', "Journeyman's Boots", 'Manastone',
  'Rubicite Breastplate', 'Jade Reaver', 'Velium Boots', 'Coldain Insignia Ring',
  'Crystal Shard', "Nagafen's Scale", 'Dragon Scale', 'Fire Opal', 'Crushbone Belt'
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateChatMessage(ghost) {
  const template = pickRandom(CHAT_TEMPLATES);
  return template
    .replace('{level}', ghost.level)
    .replace('{class}', ghost.class)
    .replace('{zone}', pickRandom(ZONE_IDS).replace(/_/g, ' '))
    .replace('{item}', pickRandom(ITEM_NAMES))
    .replace('{price}', (Math.floor(Math.random() * 50) + 1) * 100);
}

function createGhost(id, namesUsed) {
  let name;
  do { name = pickRandom(GHOST_NAMES); } while (namesUsed.has(name) && namesUsed.size < GHOST_NAMES.length);
  namesUsed.add(name);

  const classId = pickRandom(CLASS_IDS);
  const level = Math.floor(Math.random() * 60) + 1;
  const personality = pickRandom(PERSONALITIES);

  return {
    id,
    name,
    class: classId,
    level,
    zone: pickRandom(ZONE_IDS),
    xp: 0,
    xpToNext: 1000 * Math.floor(Math.pow(1.15, level - 1)),
    gold: Math.floor(Math.random() * 500),
    inventory: [],
    auctionListings: [],
    groupStatus: null,
    tradeskills: {},
    state: 'grinding',
    personality,
    lastAction: Date.now()
  };
}

export class GhostPlayerSystem {
  constructor(gameState, eventBus, dataStore) {
    this.gameState = gameState;
    this.eventBus = eventBus;
    this.dataStore = dataStore;
    this.ghosts = [];
    this.groups = [];
    this.auctionHouse = [];
    this.tickCounter = 0;
    this.chatQueue = [];
    this.nextChatTick = 30 + Math.floor(Math.random() * 90);
  }

  init(count = 20) {
    if (this.gameState.ghosts && this.gameState.ghosts.length > 0) {
      // Restore from save
      this.ghosts = this.gameState.ghosts;
      this.auctionHouse = this.gameState.ghostAuctionHouse || [];
    } else {
      const namesUsed = new Set();
      for (let i = 0; i < count; i++) {
        this.ghosts.push(createGhost(`ghost_${String(i + 1).padStart(3, '0')}`, namesUsed));
      }
      this.gameState.ghosts = this.ghosts;
      this.gameState.ghostAuctionHouse = this.auctionHouse;
    }
  }

  update(delta, tick) {
    this.tickCounter++;

    // Update each ghost
    for (const ghost of this.ghosts) {
      this._updateGhost(ghost, tick);
    }

    // Expire old auction listings (7200 ticks)
    this.auctionHouse = this.auctionHouse.filter(listing => {
      return (this.tickCounter - listing.listedAt) < 7200;
    });
    this.gameState.ghostAuctionHouse = this.auctionHouse;

    // Chat messages
    if (this.tickCounter >= this.nextChatTick) {
      const ghost = pickRandom(this.ghosts);
      if (ghost) {
        const message = generateChatMessage(ghost);
        this.eventBus.emit('ghost_chat', {
          ghostId: ghost.id,
          name: ghost.name,
          class: ghost.class,
          level: ghost.level,
          message
        });
      }
      this.nextChatTick = this.tickCounter + 30 + Math.floor(Math.random() * 90);
    }

    // Check for group opportunities with player every 60 ticks
    if (this.tickCounter % 60 === 0) {
      this._checkGroupOpportunity();
    }

    // Save ghost state
    this.gameState.ghosts = this.ghosts;
  }

  _updateGhost(ghost, tick) {
    switch (ghost.state) {
      case 'grinding':
        this._doGrinding(ghost);
        break;
      case 'crafting':
        this._doCrafting(ghost);
        break;
      case 'auctioning':
        this._doAuctioning(ghost);
        break;
      case 'resting':
        // Rest for a few ticks, then go back to grinding
        ghost._restTicks = (ghost._restTicks || 0) - 1;
        if (ghost._restTicks <= 0) ghost.state = 'grinding';
        break;
      default:
        ghost.state = 'grinding';
    }
  }

  _doGrinding(ghost) {
    if (this.tickCounter % 10 !== 0) return;

    // Find appropriate zone for ghost level
    const zone = this._findZoneForLevel(ghost.level);
    if (zone && ghost.zone !== zone.id) {
      ghost.zone = zone.id;
    }

    // Kill a monster and gain XP
    const monsterXP = ghost.level * 30 + Math.floor(Math.random() * ghost.level * 20);
    const goldGain = Math.floor(Math.random() * ghost.level * 3);
    ghost.xp += monsterXP;
    ghost.gold += goldGain;

    // Roll loot
    if (this.dataStore.monsters) {
      const zoneMonsters = this.dataStore.monsters.filter(m => m.zone === ghost.zone);
      if (zoneMonsters.length > 0) {
        const monster = pickRandom(zoneMonsters);
        for (const entry of (monster.lootTable || [])) {
          if (Math.random() < entry.dropChance * 0.3) { // Ghosts loot at 30% of player rate
            ghost.inventory.push({ itemId: entry.itemId, quantity: 1 });
          }
        }
      }
    }

    // Cap inventory at 80 items
    if (ghost.inventory.length > 60) {
      ghost.state = 'auctioning';
    }

    // Check level up
    if (ghost.xp >= ghost.xpToNext && ghost.level < 60) {
      ghost.xp -= ghost.xpToNext;
      ghost.level++;
      ghost.xpToNext = Math.floor(1000 * Math.pow(1.15, ghost.level - 1));
      this.eventBus.emit('ghost_levelup', {
        ghostId: ghost.id,
        name: ghost.name,
        class: ghost.class,
        level: ghost.level
      });
    }

    // Crafter ghosts occasionally switch to crafting
    if (ghost.personality === 'crafter' && this.tickCounter % 50 === 0) {
      ghost.state = 'crafting';
    }
  }

  _doCrafting(ghost) {
    if (this.tickCounter % 50 !== 0) return;

    // Attempt a random tradeskill recipe
    const tradeskillIds = ['smithing', 'tailoring', 'baking', 'brewing', 'fletching'];
    const tsId = pickRandom(tradeskillIds);
    const tsLevel = ghost.tradeskills[tsId] || 0;

    // Gain tradeskill skill
    if (tsLevel < 350 && Math.random() < 0.3) {
      ghost.tradeskills[tsId] = tsLevel + 1;
    }

    // Create a crafted item (simplified: just add gold equivalent)
    ghost.gold += 50 + tsLevel;

    // After crafting, go back to auctioning if has items
    ghost.state = ghost.inventory.length > 20 ? 'auctioning' : 'grinding';
  }

  _doAuctioning(ghost) {
    // List items for sale on auction house
    const toSell = ghost.inventory.slice(0, Math.min(10, ghost.inventory.length));

    for (const item of toSell) {
      const itemData = this.dataStore.items
        ? this.dataStore.items.find(i => i.id === item.itemId)
        : null;
      if (!itemData || itemData.nodrop) continue;

      const baseValue = itemData.value || 10;
      const price = Math.max(1, Math.floor(baseValue * (0.8 + Math.random() * 0.4)));

      // Check if not already listed
      const alreadyListed = this.auctionHouse.some(
        l => l.ghostId === ghost.id && l.itemId === item.itemId
      );
      if (!alreadyListed) {
        this.auctionHouse.push({
          ghostId: ghost.id,
          ghostName: ghost.name,
          itemId: item.itemId,
          price,
          listedAt: this.tickCounter
        });
      }
    }

    // Remove listed items from inventory
    ghost.inventory = ghost.inventory.slice(toSell.length);
    ghost.state = 'resting';
    ghost._restTicks = 20;
  }

  _checkGroupOpportunity() {
    const player = this.gameState.player;
    if (!player || player.level < 46) return; // Only high-level zones
    if (this.gameState.currentGroup) return; // Already grouped

    const zoneId = this.gameState.currentZoneId;
    if (!zoneId) return;

    // Find ghosts within 10 levels of player in or near this zone
    const suitable = this.ghosts.filter(g => {
      return Math.abs(g.level - player.level) <= 10 &&
             (g.zone === zoneId || g.state === 'grinding');
    }).slice(0, 5);

    if (suitable.length >= 2) {
      this.eventBus.emit('group_available', {
        ghosts: suitable.map(g => ({
          id: g.id,
          name: g.name,
          class: g.class,
          level: g.level
        }))
      });
    }
  }

  acceptGroup(ghostIds) {
    const ghosts = this.ghosts.filter(g => ghostIds.includes(g.id));
    if (ghosts.length === 0) return;

    this.gameState.currentGroup = {
      members: ghosts.map(g => ({ id: g.id, name: g.name, class: g.class, level: g.level })),
      xpBonus: 0.2
    };
    for (const g of ghosts) g.groupStatus = { groupId: 'player_group', role: 'member' };

    this.eventBus.emit('group_formed', { members: this.gameState.currentGroup.members });
  }

  disbandGroup() {
    if (!this.gameState.currentGroup) return;
    const members = this.gameState.currentGroup.members || [];
    for (const member of members) {
      const ghost = this.ghosts.find(g => g.id === member.id);
      if (ghost) ghost.groupStatus = null;
    }
    this.gameState.currentGroup = null;
    this.eventBus.emit('group_disbanded', {});
  }

  buyFromAuction(listingIndex, playerGold) {
    const listing = this.auctionHouse[listingIndex];
    if (!listing) return { success: false, reason: 'Listing not found' };
    if (playerGold < listing.price) return { success: false, reason: 'Not enough gold' };

    this.gameState.player.gold = (this.gameState.player.gold || 0) - listing.price;
    if (!this.gameState.player.inventory) this.gameState.player.inventory = [];
    this.gameState.player.inventory.push({ itemId: listing.itemId, quantity: 1 });

    // Give gold to the ghost seller
    const seller = this.ghosts.find(g => g.id === listing.ghostId);
    if (seller) seller.gold += listing.price;

    this.auctionHouse.splice(listingIndex, 1);
    this.gameState.ghostAuctionHouse = this.auctionHouse;

    this.eventBus.emit('auction_purchase', { listing });
    return { success: true };
  }

  getWhoList() {
    return this.ghosts.map(g => ({
      name: g.name,
      class: g.class,
      level: g.level,
      zone: g.zone,
      state: g.state
    }));
  }

  getAuctionHouse() {
    return this.auctionHouse.map(listing => {
      const item = this.dataStore.items
        ? this.dataStore.items.find(i => i.id === listing.itemId)
        : null;
      return {
        ...listing,
        itemName: item ? item.name : listing.itemId
      };
    });
  }

  _findZoneForLevel(level) {
    if (!this.dataStore.zones) return null;
    const suitable = this.dataStore.zones.filter(z => {
      return level >= z.levelRange[0] && level <= z.levelRange[1];
    });
    return suitable.length > 0 ? pickRandom(suitable) : null;
  }
}
