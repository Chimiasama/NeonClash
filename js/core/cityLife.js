(function (NB) {
  'use strict';

  const { districts } = NB.CityData;
  const { jobs } = NB.CityAtlas;
  const relayModes = {
    signal: { name: 'Sinal Padrão', symbols: 4, previewMs: 4000, inputMs: 12000, pay: 12, minutes: 30, energy: 5 },
    encrypted: { name: 'Sinal Criptografado', symbols: 6, previewMs: 3500, inputMs: 12000, pay: 22, minutes: 45, energy: 8 }
  };
  const jobIds = [...Object.keys(jobs), ...Object.keys(relayModes), 'kiosk'];
  const day = minute => Math.floor(minute / 1440);
  const distanceBetween = (from, to) => Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 10));
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
  const streetRest = { minutes: 300, energy: 60, robberyChance: 30, creditsLost: 60 };
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
    const minute = integer(raw?.minute, 480, 0, Number.MAX_SAFE_INTEGER - 10000);
    const delivery = raw?.activeDelivery;
    const activeDelivery = delivery && districts.some(place => place.id === delivery.targetId) &&
      Number.isSafeInteger(delivery.startMinute) && delivery.startMinute >= 0 && delivery.startMinute <= minute &&
      Number.isSafeInteger(delivery.distance) && delivery.distance >= 4 && delivery.distance <= 15
      ? { targetId: delivery.targetId, startMinute: delivery.startMinute, distance: delivery.distance } : null;
    return {
      minute,
      dailyJobDay: day(minute),
      dailyJobCounts: raw?.dailyJobDay === day(minute) ? Object.fromEntries(jobIds.flatMap(id => {
        const count = integer(raw.dailyJobCounts?.[id], 0, 0, 3);
        return count ? [[id, count]] : [];
      })) : {},
      activeDelivery,
      awake: integer(raw?.awake, 0, 0, maxAwake({ implant })),
      energy: integer(raw?.energy, 100, 0, maxEnergy({ implant })),
      implant,
      inventory,
      vehicles: ['bike', 'motorbike'].filter(id => Array.isArray(raw?.vehicles) && raw.vehicles.includes(id)),
      favors: ['hillPath', 'pumpRelay'].filter(id => Array.isArray(raw?.favors) && raw.favors.includes(id)),
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
    const distance = distanceBetween(from, to);
    const neighborhoods = NB.CityAtlas.neighborhoods;
    const between = (first, second) => {
      const pair = [from.id, to.id];
      return pair.some(id => first.includes(id)) && pair.some(id => second.includes(id));
    };
    const shortcut = state.life.favors.includes('hillPath') &&
      between(neighborhoods.find(area => area.id === 'oficinas').locations, neighborhoods.find(area => area.id === 'morro').locations);
    const crossing = state.life.favors.includes('pumpRelay') && between(['pump', 'pension'], ['ferry', 'docks']);
    const modes = Object.entries(transport);
    if (crossing) modes.push(['ferry', { name: 'Balsa', minutes: 2, effort: 1, fare: 3 }]);
    return modes.map(([id, mode]) => {
      const usesShortcut = id === 'bike' && shortcut;
      const length = usesShortcut ? Math.max(2, Math.ceil(distance * 0.55)) : distance;
      const minutes = length * mode.minutes + (id === 'bus' ? 5 : 0);
      const energy = length * mode.effort;
      const dayMinute = state.life.minute % 1440;
      const closed = id === 'ferry' && (dayMinute < 420 || dayMinute >= 1080);
      return {
        id, name: mode.name, minutes, energy, fare: mode.fare,
        note: closed ? 'A balsa opera das 7h às 18h.' : usesShortcut ? 'Atalho da encosta ensinado por Aline.' : '',
        available: !closed && (!mode.price || state.life.vehicles.includes(id)) && state.credits >= mode.fare,
        needsVehicle: Boolean(mode.price && !state.life.vehicles.includes(id)),
        energyAfter: Math.max(0, state.life.energy - energy),
        willCollapse: state.life.energy <= energy || state.life.awake + minutes >= maxAwake(state.life)
      };
    });
  }

  function resetDemand(life, force = false, minute = life.minute) {
    const current = day(minute);
    if (force || life.dailyJobDay !== current) {
      life.dailyJobDay = current;
      life.dailyJobCounts = {};
    }
  }

  function demand(id, pay = 0, minute) {
    const { life } = city();
    resetDemand(life, false, minute);
    const count = life.dailyJobCounts[id] || 0;
    return { count, available: count < 3, pay: count < 2 ? pay : count === 2 ? Math.floor(pay / 2) : 0 };
  }

  function payJob(id, pay, minute) {
    const status = demand(id, pay, minute);
    if (!status.available) return null;
    const state = city();
    state.life.dailyJobCounts[id] = status.count + 1;
    state.credits += status.pay;
    return status.pay;
  }

  function jobQuote(id) {
    const job = jobs[id];
    if (!job || id === 'delivery') return null;
    const state = city();
    let pay = job.pay;
    if (id === 'logs' && NB.Save.get().unlockedCards.length >= 15) pay = 18;
    if (id === 'scrap' && (state.life.favors.includes('hillPath') || state.residentWins.includes(43))) pay = 17;
    if (id === 'drones' && bagCount(state.life) >= bagLimit) pay += 4;
    const hour = Math.floor((state.life.minute % 1440) / 60);
    const [start, end] = job.hours || [0, 24];
    const open = start < end ? hour >= start && hour < end : hour >= start || hour < end;
    return { ...demand(id, pay), basePay: pay, open, local: job.locations.includes(state.district) };
  }

  function work(id) {
    const quote = jobQuote(id);
    if (!quote?.open || !quote.available || !quote.local) return null;
    const credits = payJob(id, quote.basePay);
    const { life } = city();
    let item = null;
    if (id === 'drones' && bagCount(life) < bagLimit) {
      item = Math.random() < 0.5 ? 'coffee' : 'energyDrink';
      life.inventory[item]++;
    }
    advance(jobs[id].minutes, jobs[id].energy);
    return { credits, item };
  }

  function finishSignal(id, success) {
    const mode = relayModes[id];
    if (!mode || city().district !== 'relay') return null;
    const credits = payJob(id, success ? mode.pay : 0);
    if (credits === null) return null;
    advance(mode.minutes, mode.energy);
    return credits;
  }

  function startDelivery() {
    const state = city();
    if (!jobs.delivery.locations.includes(state.district) || state.life.activeDelivery || !demand('delivery').available) return false;
    const origin = districts.find(place => place.id === state.district);
    const options = districts.map(place => ({ targetId: place.id, distance: distanceBetween(origin, place) }))
      .filter(option => option.distance >= 4);
    if (!options.length) return false;
    state.life.activeDelivery = { ...options[Math.floor(Math.random() * options.length)], startMinute: state.life.minute };
    NB.Save.save();
    return true;
  }

  function cancelDelivery() {
    if (!city().life.activeDelivery) return false;
    city().life.activeDelivery = null;
    NB.Save.save();
    return true;
  }

  function finishDelivery(destination, elapsed) {
    const life = city().life;
    const delivery = life.activeDelivery;
    if (delivery?.targetId !== destination) return '';
    life.activeDelivery = null;
    const { distance, startMinute } = delivery;
    const time = life.minute + elapsed - startMinute;
    const walking = 7 * distance;
    const late = time > 8 * distance;
    const base = 6 + 2 * distance;
    const bonus = time <= walking ? Math.min(12, Math.max(0, Math.floor(10 * (1 - time / walking)))) : 0;
    const credits = payJob('delivery', late ? Math.floor(base * 0.75) : base + bonus, life.minute + elapsed);
    const detail = late ? ' · multa de 25% por atraso' : bonus ? ` · bônus de velocidade: +${bonus} antes da saturação` : '';
    return `Entrega concluída: +${credits} créditos${detail}.`;
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
        const lost = Math.random() * 100 < streetRest.robberyChance ? Math.ceil(state.credits * streetRest.creditsLost / 100) : 0;
        state.credits -= lost;
        life.minute += streetRest.minutes;
        life.awake = 0;
        life.energy = streetRest.energy;
        resetDemand(life, true);
        const hours = streetRest.minutes / 60;
        life.notice = lost
          ? `Você apagou na rua, acordou ${hours} horas depois e percebeu que foi assaltado. Perdeu ${lost} créditos.`
          : `Você apagou na rua e acordou ${hours} horas depois.`;
      }
    }
    resetDemand(life);
    NB.Save.save();
  }

  function travel(destination, mode) {
    const route = routes(destination).find(option => option.id === mode);
    if (!route?.available) return false;
    const state = city();
    state.credits -= route.fare;
    state.district = destination;
    const deliveryNotice = finishDelivery(destination, route.minutes);
    advance(route.minutes, route.energy);
    if (deliveryNotice) {
      state.life.notice = [deliveryNotice, state.life.notice].filter(Boolean).join(' ');
      NB.Save.save();
    }
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
    resetDemand(state.life, true);
    NB.Save.save();
    return true;
  }

  function consumablePrice(id) {
    return Math.round(items[id].price * (NB.Story.get().nairTruthEarly === true ? 0.8 : 1));
  }

  function recoverEnergy(amount) {
    const { life } = city();
    const gain = Math.min(amount, maxEnergy(life) - life.energy);
    life.energy += gain;
    return gain;
  }

  function buy(id) {
    const state = city();
    const item = items[id];
    const mode = transport[id];
    if (item && ['kiosk', 'market'].includes(state.district) && state.credits >= consumablePrice(id) && bagCount(state.life) < bagLimit) {
      state.credits -= consumablePrice(id);
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
    if (state.district !== 'kiosk' || !shift.open || shift.done || payJob('kiosk', 14) === null) return false;
    state.life.lastShift = shift.shift;
    advance(60, 12);
    return true;
  }

  function helpContact(id) {
    const state = city();
    if (state.life.favors.includes(id)) return false;
    if (id === 'hillPath' && state.district === 'garage') {
      state.life.favors.push(id);
      NB.Save.save();
      return true;
    }
    if (id === 'pumpRelay' && state.district === 'pump') {
      state.life.favors.push(id);
      state.credits += 16;
      advance(30, 5);
      return true;
    }
    return false;
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

  NB.CityLife = { items, transport, beds, streetRest, bagLimit, implantPrice, normalize, clock, maxEnergy, maxAwake,
    bagCount, routes, advance, travel, sleep, buy, use, nightShift, workNightShift, helpContact, takeNotice, consumablePrice, recoverEnergy,
    relayModes, demand, jobQuote, work, finishSignal, startDelivery, cancelDelivery };
})(window.NB = window.NB || {});
