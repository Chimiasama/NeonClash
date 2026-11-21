(function (NB) {
  'use strict';

  const STORAGE_KEY = 'neon_breach_save_v1';

  function sanitizeDeck(rawDeck, unlockedIds) {
    const unlockedSet = new Set(unlockedIds);
    const counts = {};
    const valid = [];
    if (Array.isArray(rawDeck)) {
      for (const cid of rawDeck) {
        if (!unlockedSet.has(cid) || !NB.Cards.CARD_DB[cid]) continue;
        const c = counts[cid] || 0;
        if (c >= NB.Cards.MAX_COPIES) continue;
        counts[cid] = c + 1;
        valid.push(cid);
        if (valid.length >= NB.Cards.DECK_SIZE) break;
      }
    }
    return valid;
  }

  /* Completa (ou monta do zero) um baralho equilibrado de 20 cartas respeitando max 2 cópias */
  function buildBalancedDeck(unlockedIds, baseDeck = []) {
    const unlocked = unlockedIds.filter(id => Boolean(NB.Cards.CARD_DB[id]));
    const deck = sanitizeDeck(baseDeck, unlocked);
    const counts = {};
    let unitCount = 0;
    let exploitCount = 0;

    deck.forEach(cid => {
      counts[cid] = (counts[cid] || 0) + 1;
      if (NB.Cards.CARD_DB[cid].kind === 'unit') unitCount++;
      else exploitCount++;
    });

    const units = unlocked.filter(id => NB.Cards.CARD_DB[id].kind === 'unit');
    const exploits = unlocked.filter(id => NB.Cards.CARD_DB[id].kind === 'exploit');

    // Prioriza cartas recém-desbloqueadas (ordem reversa favorece recompensas raras) e variedade 1x antes de 2x
    const priorityUnits = [...units].reverse();
    const priorityExploits = [...exploits].reverse();

    const tryAddFrom = (pool, maxCopyCap) => {
      for (const cid of pool) {
        if (deck.length >= NB.Cards.DECK_SIZE) return true;
        const cur = counts[cid] || 0;
        if (cur < maxCopyCap && cur < NB.Cards.MAX_COPIES) {
          deck.push(cid);
          counts[cid] = cur + 1;
          if (NB.Cards.CARD_DB[cid].kind === 'unit') unitCount++;
          else exploitCount++;
          return true;
        }
      }
      return false;
    };

    const TARGET_EXPLOITS = Math.min(6, exploits.length * NB.Cards.MAX_COPIES);
    let safety = 0;
    while (deck.length < NB.Cards.DECK_SIZE && safety++ < 60) {
      const needExploit = exploitCount < TARGET_EXPLOITS && (unitCount >= 14 || (deck.length % 4 === 3));
      const firstPool = needExploit ? priorityExploits : priorityUnits;
      const secondPool = needExploit ? priorityUnits : priorityExploits;
      // Primeiro 1 cópia de cada carta distinta, depois 2ª cópia
      if (tryAddFrom(firstPool, 1)) continue;
      if (tryAddFrom(secondPool, 1)) continue;
      if (tryAddFrom(firstPool, NB.Cards.MAX_COPIES)) continue;
      if (tryAddFrom(secondPool, NB.Cards.MAX_COPIES)) continue;
      break;
    }

    return deck;
  }

  function createDefaultSave() {
    const starter = [...NB.Cards.STARTER_CARD_IDS];
    return {
      defeatedBosses: [],
      clues: [],
      unlockedCards: starter,
      starterDeck: null,
      customDeck: buildBalancedDeck(starter, []),
      deckSlot: 0,
      deckSlots: {},
      challengeWins: [],
      newGamePlus: false,
      seenArt: [],
      prologueSeen: false,
      city: { credits: 35, district: 'kira', traced: [], residentWins: [], encounterWins: [], life: NB.CityLife.normalize() },
      affinities: {},
      story: NB.Story.normalize(),
      wins: 0,
      matches: 0
    };
  }

  let data = null;

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const def = createDefaultSave();
        const unlockedSet = new Set([
          ...NB.Cards.STARTER_CARD_IDS,
          ...(Array.isArray(parsed.unlockedCards) ? parsed.unlockedCards : [])
        ]);
        const unlockedCards = Array.from(unlockedSet).filter(id => Boolean(NB.Cards.CARD_DB[id]));
        const cleanedDeck = sanitizeDeck(parsed.customDeck, unlockedCards);
        const finalDeck = cleanedDeck.length === NB.Cards.DECK_SIZE
          ? cleanedDeck
          : buildBalancedDeck(unlockedCards, cleanedDeck);

        data = {
          defeatedBosses: Array.isArray(parsed.defeatedBosses) ? parsed.defeatedBosses : def.defeatedBosses,
          clues: Array.isArray(parsed.clues) ? parsed.clues : def.clues,
          unlockedCards,
          starterDeck: Object.hasOwn(NB.Cards.STARTER_DECKS, parsed.starterDeck) ? parsed.starterDeck
            : parsed.prologueSeen || parsed.story?.started ? 'balanced' : null,
          customDeck: finalDeck,
          deckSlot: Number.isInteger(parsed.deckSlot) && parsed.deckSlot >= 0 && parsed.deckSlot < 3 ? parsed.deckSlot : 0,
          deckSlots: Object.fromEntries([0, 1, 2].flatMap(slot => {
            const cards = sanitizeDeck(parsed.deckSlots?.[slot], unlockedCards);
            return cards.length === NB.Cards.DECK_SIZE ? [[slot, cards]] : [];
          })),
          challengeWins: [...new Set((Array.isArray(parsed.challengeWins) ? parsed.challengeWins : [])
            .filter(id => NB.Challenges.some(challenge => challenge.id === id)))],
          newGamePlus: parsed.newGamePlus === true,
          prologueSeen: parsed.prologueSeen === true,
          seenArt: [...new Set(Array.isArray(parsed.seenArt) ? parsed.seenArt.filter(path => typeof path === 'string') : [])],
          city: {
            credits: Number.isSafeInteger(parsed.city?.credits) && parsed.city.credits >= 0 ? parsed.city.credits : def.city.credits,
            district: typeof parsed.city?.district === 'string' ? parsed.city.district : def.city.district,
            traced: Array.isArray(parsed.city?.traced) ? parsed.city.traced.filter(id => typeof id === 'string') : [],
            residentWins: [...new Set((Array.isArray(parsed.city?.residentWins) ? parsed.city.residentWins : [])
              .filter(Number.isSafeInteger))],
            encounterWins: (Array.isArray(parsed.city?.encounterWins) ? parsed.city.encounterWins : [])
              .filter(key => typeof key === 'string' && /^(day|night):-?\d+$/.test(key)).slice(-4),
            life: NB.CityLife.normalize(parsed.city?.life)
          },
          story: NB.Story.normalize(parsed.story, parsed.prologueSeen === true && !parsed.defeatedBosses?.length && !parsed.clues?.length),
          affinities: Object.fromEntries(Object.entries(parsed.affinities || {}).filter(([id, type]) =>
            NB.Cards.CARD_DB[id]?.kind === 'unit' && Object.hasOwn(NB.Cards.AFFINITIES, type))),
          wins: Number(parsed.wins) || 0,
          matches: Number(parsed.matches) || 0
        };
        return data;
      }
    } catch (_) {}
    data = createDefaultSave();
    return data;
  }

  function save() {
    if (!data) load();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function get() {
    if (!data) load();
    return data;
  }

  const recalibrationPrice = 15;

  function getAffinity(cardId) {
    return get().affinities[cardId] || NB.Cards.CARD_DB[cardId]?.affinity || null;
  }

  function recalibrate(cardId, affinity) {
    const progress = get();
    const card = NB.Cards.CARD_DB[cardId];
    if (card?.kind !== 'unit' || !progress.unlockedCards.includes(cardId)) return false;
    if ((affinity !== null && !Object.hasOwn(NB.Cards.AFFINITIES, affinity)) || affinity === getAffinity(cardId)) return false;
    const restoring = affinity === (card.affinity || null);
    if (!restoring && (affinity === null || progress.city.credits < recalibrationPrice)) return false;
    if (restoring) {
      delete progress.affinities[cardId];
    } else {
      progress.affinities[cardId] = affinity;
      progress.city.credits -= recalibrationPrice;
    }
    save();
    return true;
  }

  function chooseStarterDeck(id) {
    const progress = get();
    if (progress.starterDeck || progress.prologueSeen || !Object.hasOwn(NB.Cards.STARTER_DECKS, id)) return false;
    const recipe = NB.Cards.STARTER_DECKS[id];
    progress.starterDeck = id;
    progress.unlockedCards = [...new Set([...progress.unlockedCards, ...(recipe.cards || [])])];
    progress.customDeck = recipe.cards ? recipe.cards.flatMap(cardId => [cardId, cardId])
      : buildBalancedDeck(NB.Cards.STARTER_CARD_IDS);
    save();
    return true;
  }

  function getActiveDeck() {
    const s = get();
    const cleaned = sanitizeDeck(s.customDeck, s.unlockedCards);
    if (cleaned.length === NB.Cards.DECK_SIZE) return [...cleaned];
    s.customDeck = buildBalancedDeck(s.unlockedCards, cleaned);
    save();
    return [...s.customDeck];
  }

  function selectDeckSlot(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= 3) return false;
    const progress = get();
    if (progress.deckSlot === slot) return true;
    progress.deckSlots[progress.deckSlot] = getActiveDeck();
    progress.customDeck = progress.deckSlots[slot] || buildBalancedDeck(progress.unlockedCards, []);
    progress.deckSlot = slot;
    save();
    return true;
  }

  function isArchetypeUnlocked(opponent) {
    const progress = get();
    if (opponent === 'archon') return progress.newGamePlus;
    return progress.newGamePlus || isNodeDefeated(opponent) || NB.Story.has(`${opponent}Proof`);
  }

  function startNewGamePlus() {
    const progress = get();
    if (!NB.Story.has('epilogue')) return false;
    const fresh = createDefaultSave();
    fresh.city.life.ownedInitiative = [...progress.city.life.ownedInitiative];
    fresh.city.life.activeInitiative = progress.city.life.activeInitiative;
    Object.assign(progress, {
      newGamePlus: true,
      story: fresh.story,
      city: fresh.city,
      prologueSeen: false,
      defeatedBosses: [],
      clues: []
    });
    save();
    return true;
  }

  function recordChallengeVictory(id) {
    const progress = get();
    const challenge = NB.Challenges.find(entry => entry.id === id);
    if (!challenge || !isArchetypeUnlocked(challenge.opponent)) return [];
    progress.matches++;
    progress.wins++;
    const rewards = [];
    if (!progress.challengeWins.includes(id)) {
      progress.challengeWins.push(id);
      for (const cardId of challenge.cards) {
        if (progress.unlockedCards.includes(cardId)) continue;
        progress.unlockedCards.push(cardId);
        rewards.push(cardId);
      }
    }
    save();
    return rewards;
  }

  function saveCustomDeck(deckIds) {
    const s = get();
    const cleaned = sanitizeDeck(deckIds, s.unlockedCards);
    if (cleaned.length !== NB.Cards.DECK_SIZE) {
      return { ok: false, count: cleaned.length };
    }
    s.customDeck = cleaned;
    save();
    return { ok: true, count: cleaned.length };
  }

  function resetSave() {
    data = createDefaultSave();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    save();
    return data;
  }

  function isNodeDefeated(bossId) {
    return get().defeatedBosses.includes(bossId);
  }

  function isNodeUnlocked(nodeIndex) {
    if (nodeIndex === 0) return true;
    const prevNode = NB.Campaign.NODES[nodeIndex - 1];
    return prevNode ? isNodeDefeated(prevNode.id) : false;
  }

  function recordBossVictory(boss) {
    const s = get();
    s.matches++;
    s.wins++;
    const isFirstClear = !s.defeatedBosses.includes(boss.id);
    if (isFirstClear) {
      s.defeatedBosses.push(boss.id);
      s.city.credits += NB.CityData.campaignCredits(boss);
    }

    if (!s.clues.some(c => c.bossId === boss.id)) {
      s.clues.push({
        bossId: boss.id,
        title: boss.clueTitle,
        text: boss.clueText
      });
    }

    const newlyUnlockedCards = [];
    (boss.rewardCards || []).forEach(cardId => {
      if (!s.unlockedCards.includes(cardId) && NB.Cards.CARD_DB[cardId]) {
        s.unlockedCards.push(cardId);
        newlyUnlockedCards.push(cardId);
      }
    });

    const nextNode = NB.Campaign.NODES[boss.index + 1] || null;
    save();
    return {
      isFirstClear,
      newlyUnlockedCards,
      rewardCards: boss.rewardCards || [],
      nextNodeUnlocked: isFirstClear ? nextNode : null
    };
  }

  function applyInvestigationReward(reward) {
    const progress = get();
    progress.city.credits += reward.credits;
    if (!progress.unlockedCards.includes(reward.card)) progress.unlockedCards.push(reward.card);
  }

  function recordMatchLoss() {
    const s = get();
    s.matches++;
    save();
  }

  function recordQuickDuelWin() {
    const s = get();
    s.matches++;
    s.wins++;
    save();
  }

  NB.Save = {
    load,
    save,
    get,
    getActiveDeck,
    chooseStarterDeck,
    getAffinity,
    recalibrate,
    recalibrationPrice,
    saveCustomDeck,
    selectDeckSlot,
    recordChallengeVictory,
    isArchetypeUnlocked,
    startNewGamePlus,
    buildBalancedDeck,
    resetSave,
    isNodeDefeated,
    isNodeUnlocked,
    recordBossVictory,
    applyInvestigationReward,
    recordMatchLoss,
    recordQuickDuelWin
  };
})(window.NB = window.NB || {});
