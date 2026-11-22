(function (NB) {
  'use strict';

  const pass = { name: 'Passe de ônibus', price: 12, fare: 1, minutes: 2880, trips: 6 };
  const navigator = { name: 'Scanner de rota', price: 125 };
  const merchants = {
    cards: { name: 'Nara Vira-Fita', location: 'ringArchive', mission: 'Recuperar a caixa de cartas de Nara' },
    gear: { name: 'Breno Frequência', location: 'garage', mission: 'Recuperar a bancada portátil de Breno' }
  };
  const stakeCards = ['unit_33', 'unit_34', 'unit_35'];
  const prizes = ['unit_39', 'unit_40', 'unit_41', 'exploit_20'];
  const state = () => NB.Save.get();
  const life = () => state().city.life;
  const ledger = () => life().commerce;
  const today = () => Math.floor(life().minute / 1440);

  function normalize(raw, minute) {
    const known = id => Object.hasOwn(NB.Cards.CARD_DB, id);
    const listed = (list, id) => Array.isArray(list) && list.includes(id);
    const offer = raw?.offer;
    const pending = raw?.pending;
    const lost = stakeCards.includes(raw?.lost) ? raw.lost : null;
    return {
      pass: Number.isSafeInteger(raw?.pass?.until) && raw.pass.until > minute &&
        Number.isInteger(raw.pass.trips) && raw.pass.trips > 0
        ? { until: Math.min(raw.pass.until, minute + pass.minutes), trips: Math.min(pass.trips, raw.pass.trips) } : null,
      navigator: raw?.navigator === true,
      offer: Object.hasOwn(merchants, offer?.kind) && NB.CityData.districts.some(place => place.id === offer.destination)
        ? { kind: offer.kind, destination: offer.destination,
          stock: [...new Set((Array.isArray(offer.stock) ? offer.stock : []).filter(id => offer.kind === 'cards'
            ? known(id) : ['relay', 'bridge', 'tram', 'navigator'].includes(id)))].slice(0, 3) } : null,
      seen: Object.keys(merchants).filter(kind => listed(raw?.seen, kind)),
      discounts: Object.keys(merchants).filter(kind => listed(raw?.discounts, kind)),
      lastWagerDay: Number.isInteger(raw?.lastWagerDay) ? raw.lastWagerDay : -1,
      recoveryMisses: Number.isInteger(raw?.recoveryMisses) ? Math.max(0, Math.min(2, raw.recoveryMisses)) : 0,
      recoveryDay: Number.isInteger(raw?.recoveryDay) ? raw.recoveryDay : -1,
      recoveryOffer: raw?.recoveryOffer === true,
      lost,
      claimed: prizes.filter(id => listed(raw?.claimed, id)),
      pending: pending && (stakeCards.includes(pending.stake) && prizes.includes(pending.prize) ||
        pending.stake === null && lost && pending.prize === lost) ? { stake: pending.stake, prize: pending.prize } : null
    };
  }

  function activePass() {
    const ticket = ledger().pass;
    return ticket?.until > life().minute && ticket.trips > 0 ? ticket : null;
  }

  function buyPass() {
    if (!['kira', 'terminal'].includes(state().city.district) || activePass() || state().city.credits < pass.price) return false;
    state().city.credits -= pass.price;
    ledger().pass = { until: life().minute + pass.minutes, trips: pass.trips };
    NB.Save.save();
    return true;
  }

  function createOffer(destination) {
    if (NB.Story.get().chapter < 1) return false;
    const roll = Math.random();
    const kind = roll >= 0.9 ? 'gear' : roll >= 0.72 ? 'cards' : null;
    if (!kind) return false;
    const save = state();
    const chapter = NB.Story.get().chapter;
    let stock;
    if (kind === 'cards') {
      const available = NB.CityData.stock.filter(entry => (entry.chapter || 0) <= chapter &&
        entry.id !== ledger().lost && !save.unlockedCards.includes(entry.id));
      const premium = available.filter(entry => entry.price >= 55);
      const featured = premium.length && Math.random() < 0.3 ? premium[Math.floor(Math.random() * premium.length)] : null;
      stock = featured ? [featured.id] : [];
      while (stock.length < 3) {
        const options = available.filter(entry => !stock.includes(entry.id));
        if (!options.length) break;
        stock.push(options[Math.floor(Math.random() * options.length)].id);
      }
    } else {
      stock = ['relay', 'bridge', 'tram'].filter(id => !life().ownedDecks.includes(id) && NB.CityLife.cyberdecks[id].chapter <= chapter).slice(-2);
      if (!ledger().navigator) stock.push('navigator');
    }
    if (!stock.length) return false;
    ledger().offer = { kind, destination, stock };
    if (!ledger().seen.includes(kind)) ledger().seen.push(kind);
    return true;
  }

  function offer() {
    const entry = ledger().offer;
    return entry?.destination === state().city.district ? entry : null;
  }

  function price(kind, id) {
    const base = kind === 'cards' ? (NB.CityData.stock.find(entry => entry.id === id)?.price || 0) :
      id === 'navigator' ? navigator.price : (NB.CityLife.cyberdecks[id]?.price || 0);
    return Math.ceil(base * (kind === 'cards' ? 1.35 : 1) * (ledger().discounts.includes(kind) ? 0.9 : 1));
  }

  function buyOffer(id) {
    const entry = offer();
    if (!entry?.stock.includes(id)) return false;
    const save = state();
    const cost = price(entry.kind, id);
    if (!cost || save.city.credits < cost) return false;
    if (entry.kind === 'cards') {
      if (save.unlockedCards.includes(id) || ledger().lost === id) return false;
      save.unlockedCards.push(id);
    } else if (id === 'navigator') {
      if (ledger().navigator) return false;
      ledger().navigator = true;
    } else {
      if (life().ownedDecks.includes(id)) return false;
      life().ownedDecks.push(id);
      life().equippedDeck = id;
    }
    save.city.credits -= cost;
    entry.stock = entry.stock.filter(item => item !== id);
    NB.Save.save();
    return true;
  }

  function missionAvailable(kind) {
    return merchants[kind]?.location === state().city.district &&
      ledger().seen.includes(kind) && !ledger().discounts.includes(kind);
  }

  function finishMission(kind, won) {
    if (!missionAvailable(kind)) return '';
    if (won) {
      ledger().discounts.push(kind);
      const reward = 15;
      state().city.credits += reward;
      NB.Save.save();
      return `+15 créditos e 10% de desconto com ${merchants[kind].name}.`;
    }
    const fee = Math.min(state().city.credits, 3);
    state().city.credits -= fee;
    NB.Save.save();
    return `O duelo custou ${fee} créditos. Você pode tentar novamente.`;
  }

  function wager() {
    const save = state();
    if (save.city.district !== 'arena' || !NB.Save.isNodeDefeated('kira') ||
      ledger().pending || ledger().lastWagerDay >= today()) return null;
    if (ledger().lost) {
      if (ledger().recoveryDay !== today()) {
        ledger().recoveryDay = today();
        ledger().recoveryOffer = ledger().recoveryMisses >= 2 || Math.random() < 0.5;
        if (!ledger().recoveryOffer) ledger().recoveryMisses++;
        NB.Save.save();
      }
      return ledger().recoveryOffer ? { prize: ledger().lost, stakes: [], fee: 12 } : null;
    }
    const prize = prizes.find(id => !ledger().claimed.includes(id) && !save.unlockedCards.includes(id));
    const stakes = stakeCards.filter(id => save.unlockedCards.includes(id) &&
      NB.Save.buildBalancedDeck(save.unlockedCards.filter(card => card !== id)).length === NB.Cards.DECK_SIZE);
    return prize && stakes.length ? { prize, stakes, fee: 0 } : null;
  }

  function beginWager(stake) {
    const proposal = wager();
    if (!proposal || (proposal.fee ? stake !== null : !proposal.stakes.includes(stake)) ||
      state().city.credits < proposal.fee) return false;
    state().city.credits -= proposal.fee;
    ledger().lastWagerDay = today();
    ledger().pending = { stake, prize: proposal.prize };
    NB.Save.save();
    return true;
  }

  function finishWager(won) {
    const entry = ledger().pending;
    if (!entry) return '';
    const save = state();
    ledger().pending = null;
    if (won) {
      if (!save.unlockedCards.includes(entry.prize)) save.unlockedCards.push(entry.prize);
      if (entry.stake) ledger().claimed.push(entry.prize);
      else {
        ledger().lost = null;
        ledger().recoveryMisses = 0;
      }
    } else if (entry.stake) {
      ledger().lost = entry.stake;
      ledger().recoveryMisses = 0;
      save.unlockedCards = save.unlockedCards.filter(id => id !== entry.stake);
      save.customDeck = NB.Save.buildBalancedDeck(save.unlockedCards, save.customDeck);
      for (const slot of Object.keys(save.deckSlots)) {
        save.deckSlots[slot] = NB.Save.buildBalancedDeck(save.unlockedCards, save.deckSlots[slot]);
      }
    }
    NB.Save.save();
    return won ? `${NB.Cards.CARD_DB[entry.prize].name} disponível em Meu Deck.` :
      entry.stake ? `Risco ficou com ${NB.Cards.CARD_DB[entry.stake].name}. Volte ao Ringue para tentar recuperá-la.`
        : 'A carta continua com Risco. Os 12 créditos da revanche foram consumidos.';
  }

  NB.CityCommerce = { normalize, pass, navigator, merchants, activePass, buyPass, createOffer, offer, price,
    buyOffer, missionAvailable, finishMission, wager, beginWager, finishWager };
})(window.NB = window.NB || {});
