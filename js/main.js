(function (NB) {
  'use strict';

  /* Ponto de entrada (Bootstrap) do NEON BREACH // CARD FIGHTERS */
  function boot() {
    NB.Save.load();
    NB.Sprites.initAssets();
    NB.Input.bindEvents();
    NB.Physics.init();
    NB.State.reset({ mode: 'campaign', boss: NB.Campaign.NODES[0] });
    NB.UI.renderEnemyAvatar(NB.Campaign.NODES[0]);
    NB.UI.renderTitleStats();
    NB.UI.renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.NB = window.NB || {});
