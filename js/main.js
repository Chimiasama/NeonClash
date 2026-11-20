(function (NB) {
  'use strict';

  /* Ponto de entrada (Bootstrap) do NEON BREACH // CARD FIGHTERS */
  function boot() {
    NB.Save.load();
    NB.Sprites.initAssets();
    NB.Input.bindEvents();
    NB.City.bindEvents();
    NB.StoryUI.bindEvents();
    NB.Physics.init();
    NB.State.reset({ mode: 'campaign', boss: NB.Campaign.NODES[0] });
    NB.UI.renderEnemyAvatar(NB.Campaign.NODES[0]);
    NB.UI.renderTitleStats();
    NB.UI.renderAll();
    document.getElementById('game-ui').inert = true;
    NB.Audio.restorePreference();
    if (new URLSearchParams(window.location.search).get('android') === '1') {
      NB.Audio.activateOnEntry();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.NB = window.NB || {});
