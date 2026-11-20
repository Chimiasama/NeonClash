(function (NB) {
  'use strict';

  const { districts } = NB.CityData;
  const items = {
    coffee: { name: 'Café', price: 4, energy: 15 },
    energyDrink: { name: 'Energético', price: 9, energy: 28 },
    synthetic: { name: 'Estímulo sintético', price: 16, energy: 45 }
  };
  const transport = {
    walk: { name: 'A pé', minutes: 7, effort: 2, fare: 0 },
    bike: { name: 'Bicicleta', minutes: 4, effort: 1, fare: 0, price: 100 },
    bus: { name: 'Ônibus', minutes: 3, effort: 1, fare: 4 },
    motorbike: { name: 'Moto', minutes: 2, effort: 1, fare: 0, price: 450 }
  };
  const beds = {
    home: { minutes: 480, price: 0 },
    pension: { minutes: 420, price: 12 },
    hotel: { minutes: 300, price: 26 }
  };
  const bagLimit = 12;
  const implantPrice = 130;
  const city = () => NB.Save.get().city;
  const maxEnergy = life => life.implant ? 120 : 100;
  const maxAwake = life => life.implant ? 1200 : 960;

  function normalize(raw) {
    const implant = raw?.implant === true;
    const integer = (value, fallback, min, max) =>
      Number.isSafeInteger(value) ? Math.max(min, Math.min(value, max)) : fallback;
    const inventory = {};
    let room = bagLimit;
    for (const id of Object.keys(items)) {
      inventory[id] = integer(raw?.inventory?.[id], 0, 0, room);
      room -= inventory[id];
    }
    return {
      minute: integer(raw?.minute, 480, 0, Number.MAX_SAFE_INTEGER - 10000),
      awake: integer(raw?.awake, 0, 0, maxAwake({ implant })),
      energy: integer(raw?.energy, 100, 0, maxEnergy({ implant })),
      implant,
      inventory,
      vehicles: ['bike', 'motorbike'].filter(id => Array.isArray(raw?.vehicles) && raw.vehicles.includes(id)),
      lastShift: integer(raw?.lastShift, -2, -2, Number.MAX_SAFE_INTEGER),
      notice: typeof raw?.notice === 'string' ? raw.notice.slice(0, 350) : ''
    };
  }

  function clock(minute) {
    const dayMinute = minute % 1440;
    const hour = String(Math.floor(dayMinute / 60)).padStart(2, '0');
    const min = String(dayMinute % 60).padStart(2, '0');
    return `Dia ${Math.floor(minute / 1440) + 1} · ${hour}:${min}`;
  }

  function bagCount(life) {
    return Object.values(life.inventory).reduce((count, quantity) => count + quantity, 0);
  }

  function routes(destination) {
    const state = city();
    const from = districts.find(place => place.id === state.district) || districts.find(place => place.id === 'kira');
    const to = districts.find(place => place.id === destination);
    if (!to || from.id === to.id) return [];
    const distance = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 10));
    return Object.entries(transport).map(([id, mode]) => {
      const minutes = distance * mode.minutes + (id === 'bus' ? 5 : 0);
      const energy = distance * mode.effort;
      return {
        id, name: mode.name, minutes, energy, fare: mode.fare,
        available: (!mode.price || state.life.vehicles.includes(id)) && state.credits >= mode.fare,
        needsVehicle: Boolean(mode.price && !state.life.vehicles.includes(id)),
        willCollapse: state.life.energy <= energy || state.life.awake + minutes >= maxAwake(state.life)
      };
    });
  }

  function advance(minutes, energy) {
    const state = city();
    const life = state.life;
    life.minute += minutes;
    life.awake += minutes;
    life.energy = Math.max(0, life.energy - energy);
    if (life.energy === 0 || life.awake >= maxAwake(life)) {
      if (state.district === 'home') {
        sleep('home');
        life.notice = 'Você chegou no limite e dormiu em casa.';
      } else {
        const lost = Math.random() < 0.3 ? Math.ceil(state.credits * 0.6) : 0;
        state.credits -= lost;
        life.minute += 300;
        life.awake = 0;
        life.energy = 60;
        life.notice = lost
          ? `Você apagou na rua e foi assaltado. Perdeu ${lost} créditos.`
          : 'Você apagou na rua e acordou 5 horas depois.';
      }
    }
    NB.Save.save();
  }

  function travel(destination, mode) {
    const route = routes(destination).find(option => option.id === mode);
    if (!route?.available) return false;
    const state = city();
    state.credits -= route.fare;
    state.district = destination;
    advance(route.minutes, route.energy);
    return true;
  }

  function sleep(bedId) {
    const state = city();
    const bed = beds[bedId];
    if (!bed || districts.find(place => place.id === state.district)?.rest !== bedId || state.credits < bed.price) return false;
    state.credits -= bed.price;
    state.life.minute += bed.minutes;
    state.life.awake = 0;
    state.life.energy = maxEnergy(state.life);
    NB.Save.save();
    return true;
  }

  function buy(id) {
    const state = city();
    const item = items[id];
    const mode = transport[id];
    if (item && state.district === 'kiosk' && state.credits >= item.price && bagCount(state.life) < bagLimit) {
      state.credits -= item.price;
      state.life.inventory[id]++;
    } else if (mode?.price && state.district === 'garage' && state.credits >= mode.price && !state.life.vehicles.includes(id)) {
      state.credits -= mode.price;
      state.life.vehicles.push(id);
    } else if (id === 'implant' && state.district === 'garage' && state.credits >= implantPrice && !state.life.implant) {
      state.credits -= implantPrice;
      state.life.implant = true;
      state.life.energy += 20;
    } else {
      return false;
    }
    NB.Save.save();
    return true;
  }

  function use(id) {
    const life = city().life;
    if (!items[id] || !life.inventory[id] || life.energy >= maxEnergy(life)) return false;
    life.inventory[id]--;
    life.energy = Math.min(maxEnergy(life), life.energy + items[id].energy);
    NB.Save.save();
    return true;
  }

  function nightShift() {
    const state = city();
    const life = state.life;
    const minute = life.minute % 1440;
    const shift = Math.floor((life.minute - 120) / 1440);
    return {
      open: minute >= 1140 || minute <= 60,
      done: life.lastShift === shift,
      shift
    };
  }

  function workNightShift() {
    const state = city();
    const shift = nightShift();
    if (state.district !== 'kiosk' || !shift.open || shift.done) return false;
    state.life.lastShift = shift.shift;
    state.credits += 14;
    advance(60, 12);
    return true;
  }

  function takeNotice() {
    const life = city().life;
    const notice = life.notice;
    if (notice) {
      life.notice = '';
      NB.Save.save();
    }
    return notice;
  }

  NB.CityLife = { items, transport, beds, bagLimit, implantPrice, normalize, clock, maxEnergy, maxAwake,
    bagCount, routes, advance, travel, sleep, buy, use, nightShift, workNightShift, takeNotice };
})(window.NB = window.NB || {});
