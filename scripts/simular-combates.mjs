import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const games = Number(process.argv[2] || 200);
if (!Number.isInteger(games) || games < 2 || games % 2) throw new Error('Use uma quantidade par de partidas.');
const noop = () => {};
const silent = new Proxy({}, { get: () => noop });
let seed;
const math = Object.create(Math);
math.random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
};
const context = createContext({
  Math: math, document: { querySelector: () => null, getElementById: () => null }
});
context.window = context;
for (const script of [
  'data/cards', 'data/campaign', 'data/challenges', 'data/cityAtlas', 'data/city', 'core/cityCommerce', 'core/cityLife',
  'core/saveManager', 'core/cardEffects', 'core/gameState', 'core/combatEngine',
  'core/aiController', 'ui/inputController'
]) runInContext(readFileSync(new URL(`../js/${script}.js`, import.meta.url), 'utf8'), context);

const { NB } = context;
const { CARD_DB } = NB.Cards;
const { State, Combat, AI, CardEffects } = NB;
const profile = { city: { district: 'terminal', life: { equippedDeck: 'stock' } } };
let deck, interfered, enemyTurn;
const startEnemy = AI.startEnemyTurn;
AI.startEnemyTurn = options => (enemyTurn = startEnemy(options));
State.wait = async () => true;
Object.assign(NB, {
  UI: silent, Audio: silent, Physics: silent, Dialogue: silent, City: silent,
  Story: { eclipseInterference: () => interfered }
});
Object.assign(NB.Save, {
  get: () => profile, getActiveDeck: () => deck, getAffinity: id => CARD_DB[id].affinity || null,
  recordBossVictory: noop, recordMatchLoss: noop
});
NB.CityLife.advance = noop;

const starters = Object.entries(NB.Cards.STARTER_DECKS).map(([id, entry]) => ({
  id, cards: entry.cards?.flatMap(card => [card, card]) ?? NB.Save.buildBalancedDeck(NB.Cards.STARTER_CARD_IDS)
}));
const repeat = list => Array.from({ length: 20 }, (_, index) => list[index % list.length]);
const travel = Array.from({ length: 6 }, (_, index) => {
  const elite = index === 5;
  profile.city.life.routePact = elite ? 3 : 0;
  profile.city.life.travelChallenge = { name: Object.values(NB.CityAtlas.encounters).flat()[0].name,
    destination: 'terminal', tier: Math.min(index, 4), elite };
  const offer = NB.CityLife.getTravelChallenge();
  return { ...offer, id: elite ? 'viagem-especialista' : `viagem-${index + 1}`, deckList: repeat(offer.deck) };
});
const residents = [33, 39, 43, 44, 84].map(id => {
  const entry = NB.CityAtlas.residentDuels[id] || (id === 33
    ? { hp: 14, deck: NB.CityData.sparringBoss.deckList }
    : { hp: 22, deck: NB.CityData.wagerBoss.deckList, canOverclock: true });
  return { id: `morador-${id}`, name: NB.CityAtlas.residents.find(person => person.id === id)?.name, ...entry, deckList: repeat(entry.deck) };
});
const bosses = [...NB.Campaign.NODES, ...travel, ...residents];
const advanced = starters[0].cards.slice();
const upgrades = ['unit_13', 'unit_22', 'unit_23', 'exploit_06', 'exploit_19'];
for (const id of upgrades) {
  const slot = advanced.findIndex((current, index) => CARD_DB[current].kind === CARD_DB[id].kind &&
    !upgrades.includes(current) && advanced.indexOf(current) === index);
  if (slot < 0) throw new Error(`Sem espaço para ${id} no deck de progressão`);
  advanced[slot] = id;
}
starters.push({ id: 'progressao-mista', cards: advanced, cyberdeck: 'relay' });
starters.push({
  id: 'fim-de-campanha', cyberdeck: 'backbone',
  cards: ['unit_07', 'unit_10', 'unit_12', 'unit_13', 'unit_14', 'unit_02', 'unit_08',
    'exploit_01', 'exploit_05', 'exploit_06'].flatMap(id => [id, id])
});

starters.push({
  id: 'fim-pacifista', cyberdeck: 'backbone',
  cards: ['unit_07', 'unit_10', 'unit_14', 'unit_05', 'unit_01', 'unit_02', 'unit_08',
    'exploit_01', 'exploit_05'].flatMap(id => [id, id]).concat('exploit_15', 'exploit_16')
});

for (const { id, cards } of [...starters, ...NB.Challenges.map(({ id, deck }) => ({ id, cards: deck }))]) {
  if (cards.length !== 20 || cards.some(card => !CARD_DB[card] || cards.filter(other => other === card).length > 2)) {
    throw new Error(`Lista de jogador inválida: ${id}`);
  }
}
for (const { id, deckList } of bosses) {
  if (deckList.length !== 20 || deckList.some(card => !CARD_DB[card])) {
    throw new Error(`Lista de oponente inválida: ${id}`);
  }
}

function playCards(state) {
  const { player } = state;
  const slot = player.field.indexOf(null);
  function candidates(kind, evaluate) {
    return player.hand.flatMap(item => {
      const card = CARD_DB[item.cardId];
      if (card.kind !== kind || !State.canPlayHandCard('player', item).ok) return [];
      const targets = card.targetType === 'enemy_unit' || kind === 'exploit'
        ? CardEffects.legalSlots(state, card, 'player') : [slot];
      const options = targets.map(target => ({ target, power: CardEffects.score(state, card, 'player', target) }));
      const best = options.sort((a, b) => b.power - a.power)[0] || { power: 0 };
      return [{ item, target: best.target, power: evaluate(card, best.power) }];
    }).sort((a, b) => b.power - a.power);
  }

  const unit = candidates('unit', (card, effects) => card.atk + 0.75 * card.def + card.ramGain + effects +
    (NB.Cards.hasKeyword(card, 'ZERO_DAY') ? 1.5 : 0))[0];
  if (unit && slot !== -1) {
    State.deployUnit('player', unit.item.uid, slot);
    if (state.pendingTarget?.kind === 'deploy') State.resolveDeployTarget(unit.target);
  }
  for (let count = 0; count < 6 && !state.winner; count++) {
    const next = candidates('exploit', (card, effects) => effects - card.cost * 0.65)[0];
    if (!next || next.power <= 0 || !State.executeExploit('player', next.item.uid, next.target)) break;
  }
}

function defend(state) {
  const { enemy, player, defenseMap } = state;
  const incoming = slot => state.enemyOverclock?.combinedAtk ?? CardEffects.attackPower(enemy.field[slot], enemy.field);
  for (const slot of [...state.enemyAttackers].sort((a, b) => incoming(b) - incoming(a))) {
    if (defenseMap[slot] !== undefined) continue;
    const attacker = enemy.field[slot];
    const blocks = player.field.flatMap((unit, idx) => {
      if (!Combat.hasBlockRoom(unit, player, defenseMap, idx)) return [];
      const damage = state.enemyOverclock ? incoming(slot) : Combat.clashDamage(attacker, unit, enemy.field);
      const takesOut = unit.atk + Combat.affinityBonus(unit, attacker) >= attacker.def;
      return [{ idx, score: (unit.def > damage ? 3 : -unit.atk * 0.45) + (takesOut ? 2 : 0) }];
    }).sort((a, b) => b.score - a.score);
    if (blocks.length) defenseMap[slot] = blocks[0].idx;
  }
}

async function simulate(player, boss, index, modifier = {}) {
  seed = 0x6218b7a3 ^ Math.imul(index + 1, 0x9e3779b1);
  deck = player.cards;
  profile.city.life.equippedDeck = player.cyberdeck || 'stock';
  interfered = Boolean(modifier.cipher);
  const openingSide = index % 2 ? 'enemy' : 'player';
  State.reset({ mode: 'campaign', boss, openingSide });
  const state = State.get();
  state.player.ram += modifier.ram || 0;
  for (let hand = 0; hand < 4; hand++) {
    State.drawCard('player', true);
    State.drawCard('enemy', true);
  }
  if (openingSide === 'enemy') await AI.startEnemyTurn({ opening: true });
  let rounds = 0;
  while (!state.winner && rounds++ < 30) {
    if (state.phase === 'PLAYER_DEFENSE') {
      defend(state);
      await Combat.confirmPlayerDefense();
    }
    if (state.winner) break;
    if (state.phase !== 'PLAYER_MAIN') throw new Error(`Fase inesperada: ${state.phase}`);
    playCards(state);
    if (state.winner) break;
    const ready = state.player.field.flatMap((unit, idx, field) => Combat.canAttack(unit, field) ? [idx] : []);
    enemyTurn = null;
    if (modifier.overclock && ready.length >= 2 && state.player.ram >= NB.Cards.OVERCLOCK_COST &&
        state.enemy.field.some(unit => Combat.canBlock(unit, state.enemy))) {
      state.phase = 'PLAYER_OVERCLOCK';
      state.overclockUnits = ready.slice(0, 2);
      await Combat.executeOverclockAttack();
    }
    if (!state.winner && !enemyTurn) {
      state.phase = 'PLAYER_ATTACK';
      state.selectedAttackers = ready.filter(slot => Combat.canAttack(state.player.field[slot], state.player.field));
      await Combat.confirmPlayerAttack();
    }
    await enemyTurn;
  }
  return { openingSide, winner: state.winner, turn: state.turn };
}

async function report(player, boss, modifier, label = boss.id) {
  const outcomes = [];
  for (let index = 0; index < games; index++) outcomes.push(await simulate(player, boss, index, modifier));
  const wins = rows => Math.round(1000 * rows.filter(row => row.winner === 'player').length / rows.length) / 10;
  return [player.id, label, wins(outcomes), wins(outcomes.filter(row => row.openingSide === 'player')),
    wins(outcomes.filter(row => row.openingSide === 'enemy')), outcomes.filter(row => !row.winner).length,
    (outcomes.reduce((sum, row) => sum + row.turn, 0) / games).toFixed(1)].join(',');
}

console.log('deck,oponente,vitorias%,kairo_inicia%,npc_inicia%,sem_desfecho,turnos_medios');
for (const player of starters) {
  for (const boss of bosses) console.log(await report(player, boss));
}
const final = NB.Campaign.NODES.at(-1);
for (const player of starters) {
  console.log(await report(player, final, { overclock: true }, 'archon-kairo-overclock'));
  console.log(await report(player, final, { overclock: true, cipher: true }, 'archon-cipher-kairo-overclock'));
  console.log(await report({ ...player, cyberdeck: 'stock' }, final, { ram: 1 }, 'archon-ram-1'));
}

for (const challenge of NB.Challenges) {
  console.log(await report({ id: challenge.id, cards: challenge.deck }, bosses.find(boss => boss.id === challenge.opponent),
    { overclock: true }, `arquetipo-${challenge.opponent}`));
}

for (const attribute of ['atk', 'def', 'ramGain']) {
  const baseline = starters[0];
  const cards = baseline.cards.map(id => {
    const card = CARD_DB[id];
    if (card.kind !== 'unit') return id;
    const variant = `laboratorio-${attribute}-${id}`;
    CARD_DB[variant] = { ...card, id: variant, [attribute]: card[attribute] + 1 };
    return variant;
  });
  const player = { id: `mais-1-${attribute}`, cards };
  for (const boss of [...NB.Campaign.NODES, travel[1], travel[4]]) console.log(await report(player, boss));
}
