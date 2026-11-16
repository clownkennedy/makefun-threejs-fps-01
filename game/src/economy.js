// The match economy: money, buy phase purchases and round rewards.
// One grenade per round is free; weapons and armor cost money.
// Rewards follow the classic pattern: winning pays more than losing,
// kills and plants pay a bonus.
import { WEAPONS, ARMOR_PRICE, ARMOR_AMOUNT } from './weapons.js';

export const START_MONEY = 800;
export const MONEY_CAP = 16000;
export const REWARD_WIN = 3250;
export const REWARD_LOSS = 1900;
export const REWARD_KILL = 300;
export const REWARD_PLANT = 300;

export function createEconomy() {
  const state = {
    money: START_MONEY,
    armor: 0,
    grenades: 1,
    owned: new Set(['p9']),
    primary: 'p9',
  };

  return {
    state,
    reset() {
      state.money = START_MONEY;
      state.armor = 0;
      state.grenades = 1;
      state.owned = new Set(['p9']);
      state.primary = 'p9';
    },
    startRound() {
      state.grenades = 1;
    },
    canAfford(price) { return state.money >= price; },
    buyWeapon(id) {
      const def = WEAPONS[id];
      if (!def) return false;
      if (state.owned.has(id)) {
        state.primary = id;
        return true;
      }
      if (state.money < def.price) return false;
      state.money -= def.price;
      state.owned.add(id);
      state.primary = id;
      return true;
    },
    buyArmor() {
      if (state.armor >= ARMOR_AMOUNT) return false;
      if (state.money < ARMOR_PRICE) return false;
      state.money -= ARMOR_PRICE;
      state.armor = ARMOR_AMOUNT;
      return true;
    },
    addKill() {
      state.money = Math.min(MONEY_CAP, state.money + REWARD_KILL);
    },
    addPlant() {
      state.money = Math.min(MONEY_CAP, state.money + REWARD_PLANT);
    },
    endRound(won) {
      state.money = Math.min(MONEY_CAP, state.money + (won ? REWARD_WIN : REWARD_LOSS));
    },
    // Damage split: armor absorbs half of the incoming damage while it lasts.
    absorb(damage) {
      let rest = damage;
      if (state.armor > 0) {
        const soaked = Math.min(state.armor, Math.ceil(damage / 2));
        state.armor -= soaked;
        rest = damage - soaked;
      }
      return rest;
    },
  };
}
