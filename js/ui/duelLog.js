(function (NB) {
  'use strict';

  const $ = id => document.getElementById(id);
  let side = 'player';
  let zone = 'played';
  let origin = null;
  let selected = null;
  let layers = [];

  function showArt(stage, card) {
    stage.replaceChildren(NB.Sprites.createArtMarkup(card.id, card.img, ''));
  }

  function renderList() {
    const actor = NB.State.get()[side];
    for (const button of $('duel-log-sides').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.side === side));
    }
    for (const button of $('duel-log-zones').querySelectorAll('button')) {
      const key = button.dataset.zone;
      const labels = { played: 'Usadas', discard: 'Descarte', removed: 'Removidas', impacts: 'Efeitos' };
      button.textContent = `${labels[key]} (${actor[key].length})`;
      button.setAttribute('aria-pressed', String(key === zone));
    }
    const grid = $('duel-log-grid');
    grid.replaceChildren();
    const entries = actor[zone];
    const empty = $('duel-log-empty');
    empty.hidden = entries.length > 0;
    empty.textContent = {
      played: 'Este lado ainda não usou cartas.',
      discard: 'O descarte está vazio.',
      removed: 'Nenhuma carta deste lado foi removida da partida.',
      impacts: 'Este lado ainda não recebeu efeitos de combate.'
    }[zone];

    for (const entry of [...entries].reverse()) {
      if (zone === 'impacts') {
        const item = document.createElement('p');
        item.className = 'duel-impact-entry';
        item.textContent = [`T${entry.turn}`, entry.target, entry.text, entry.detail].filter(Boolean).join(' · ');
        grid.append(item);
        continue;
      }
      const card = NB.Cards.CARD_DB[entry.cardId];
      const tile = document.createElement('button');
      tile.type = 'button';
      const art = document.createElement('span');
      art.className = 'duel-log-art';
      showArt(art, card);
      const label = document.createElement('span');
      label.textContent = entry.turn === undefined ? card.name : `${card.name} · T${entry.turn}`;
      tile.append(art, label);
      tile.addEventListener('click', () => showDetail(card, tile));
      grid.append(tile);
    }
  }

  function showDetail(card, tile) {
    selected = tile;
    $('duel-log-list').hidden = true;
    $('duel-log-detail').hidden = false;
    $('duel-log-card').textContent = card.name;
    showArt($('duel-log-art'), card);
    $('duel-log-stats').textContent = card.kind === 'unit'
      ? `${card.atk} ATK · ${card.def} DEF · +${card.ramGain} RAM · ${NB.Cards.affinityLabel(NB.State.getMatchAffinity(card.id, side))}`
      : `Exploit · ${card.cost} RAM`;
    $('duel-log-description').textContent = card.desc;
    $('duel-log-back').focus();
  }

  function open(event) {
    origin = event.currentTarget;
    side = 'player';
    zone = 'played';
    selected = null;
    layers = [$('game-ui'), $('gameover-panel')].map(layer => [layer, layer.inert]);
    for (const [layer] of layers) layer.inert = true;
    $('duel-log-list').hidden = false;
    $('duel-log-detail').hidden = true;
    renderList();
    $('duel-log-modal').classList.add('open');
    $('duel-log-close').focus();
  }

  function close() {
    if (!$('duel-log-modal').classList.contains('open')) return;
    $('duel-log-modal').classList.remove('open');
    for (const [layer, wasInert] of layers) layer.inert = wasInert;
    origin?.focus();
    layers = [];
    origin = selected = null;
  }

  function handleBack() {
    if (!$('duel-log-modal').classList.contains('open')) return false;
    if (selected) {
      $('duel-log-detail').hidden = true;
      $('duel-log-list').hidden = false;
      selected.focus();
      selected = null;
    } else close();
    return true;
  }

  function bindEvents() {
    for (const id of ['btn-duel-log', 'btn-result-log']) $(id).addEventListener('click', open);
    $('duel-log-close').addEventListener('click', close);
    $('duel-log-back').addEventListener('click', handleBack);
    $('duel-log-sides').addEventListener('click', event => {
      const button = event.target.closest('[data-side]');
      if (!button) return;
      side = button.dataset.side;
      renderList();
    });
    $('duel-log-zones').addEventListener('click', event => {
      const button = event.target.closest('[data-zone]');
      if (!button) return;
      zone = button.dataset.zone;
      renderList();
    });
  }

  NB.DuelLog = { bindEvents, close, handleBack };
})(window.NB = window.NB || {});
