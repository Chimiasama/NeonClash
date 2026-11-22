(function (NB) {
  'use strict';

  /* Motor de Física Visual, Game Juice & Vibração Android:
     - Grade digital animada de fundo (Canvas)
     - Simulação de partículas com atrito, gravidade leve e ondas de choque expansivas
     - Feixes de laser animados (Exploits, Overclock Unite Attack e Bloqueio Ativo)
     - Tremor de tela (screen shake), popups flutuantes e navigator.vibrate() seguro */
  let bgCanvas = null;
  let bgCtx = null;
  let fxCanvas = null;
  let fxCtx = null;
  const particles = [];
  const shockwaves = [];
  const transientBeams = [];
  const scanSweeps = [];
  const uiTransitions = [];
  const glowTimers = new WeakMap();
  let gridOffset = 0;
  let toastTimer = null;

  function init() {
    bgCanvas = document.getElementById('bg-canvas');
    bgCtx = bgCanvas.getContext('2d');
    fxCanvas = document.getElementById('fx-canvas');
    fxCtx = fxCanvas.getContext('2d');
    resize();
    requestAnimationFrame(tick);
  }

  function resize() {
    if (!bgCanvas || !fxCanvas) return;
    const shell = document.getElementById('console-shell');
    const rect = shell.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [bgCanvas, fxCanvas].forEach(c => {
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  /* Vibração Android WebView / Mobile segura */
  function vibrate(pattern) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  function vibrateCard() { vibrate(18); }
  function vibrateExploit() { vibrate([25, 25, 35]); }
  function vibrateDamage() { vibrate([65, 30, 95]); }
  function vibrateDestroy() { vibrate([40, 25, 65]); }
  function vibrateOverclock() { vibrate([45, 28, 55, 28, 125]); }

  function spawnBurst(x, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.8 + Math.random() * 4.8;
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        drag: 0.955,
        life: 1,
        decay: 0.022 + Math.random() * 0.028,
        size: 2.2 + Math.random() * 3.8,
        color
      });
    }
  }

  function spawnShockwave(x, y, color, maxRadius = 64) {
    shockwaves.push({
      x, y,
      radius: 8,
      maxRadius,
      life: 1,
      color
    });
  }

  /* Dispara feixe de laser animado no Canvas FX entre dois elementos */
  function fireLaserBeam(fromEl, toEl, color = '#00F0FF', width = 6) {
    if (!fromEl || !toEl) return;
    const p1 = getElCenterInShell(fromEl);
    const p2 = getElCenterInShell(toEl);
    transientBeams.push({
      x1: p1.x, y1: p1.y,
      x2: p2.x, y2: p2.y,
      color,
      width,
      life: 1,
      decay: 0.045
    });
    spawnBurst(p2.x, p2.y, color, 20);
    spawnShockwave(p2.x, p2.y, color, 54);
  }

  function getElCenterInShell(el) {
    const shellRect = document.getElementById('console-shell').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: r.left - shellRect.left + r.width / 2,
      y: r.top - shellRect.top + r.height / 2
    };
  }

  const impactPops = new WeakMap();

  function spawnFloatText(targetEl, text, color, offsetY = 0, detail = null) {
    if (!targetEl) return;
    const pos = getElCenterInShell(targetEl);
    const pop = document.createElement('div');
    pop.className = 'float-pop';
    pop.textContent = text;
    if (detail !== null) {
      pop.classList.add('float-impact');
      pop.setAttribute('aria-hidden', 'true');
      if (detail) {
        const cause = document.createElement('small');
        cause.textContent = detail;
        pop.appendChild(cause);
      }
    }
    const layer = document.getElementById('float-layer');
    const duration = detail === null ? 1650 : 3000;
    pop.style.setProperty('--float-duration', `${duration}ms`);
    pop.style.color = color;
    if (detail === null) {
      pop.style.left = pos.x + 'px';
      pop.style.top = (pos.y + offsetY) + 'px';
      layer.appendChild(pop);
    } else {
      const active = (impactPops.get(targetEl) || []).filter(item => item.pop.isConnected);
      if (active.length === 3) active.shift().pop.remove();
      const lane = [0, 1, 2].find(number => !active.some(item => item.lane === number));
      layer.appendChild(pop);
      const margin = pop.offsetWidth / 2 + 4;
      pop.style.left = `${Math.max(margin, Math.min(layer.clientWidth - margin, pos.x))}px`;
      pop.style.top = `${pos.y + (lane ? (lane % 2 ? 1 : -1) * 40 : offsetY)}px`;
      active.push({ lane, pop });
      impactPops.set(targetEl, active);
    }
    setTimeout(() => pop.remove(), duration);
  }

  function shakeScreen(heavy) {
    const shell = document.getElementById('console-shell');
    shell.classList.remove('shake-light', 'shake-heavy');
    void shell.offsetWidth;
    shell.classList.add(heavy ? 'shake-heavy' : 'shake-light');
  }

  function showToast(msg, color = 'var(--amber)') {
    const el = document.getElementById('toast-banner');
    el.textContent = msg;
    el.style.borderColor = color;
    el.style.color = color;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* =========================================================================
     ANIMAÇÕES DE ENTRADA DO HUD (FADE-IN + SLIDE UP + VARREDURA NEON)
     Controladas diretamente no loop requestAnimationFrame da fxEngine.js
  ========================================================================= */
  function spawnScanSweep(el, color = '#00F0FF') {
    if (!el) return;
    const shell = document.getElementById('console-shell');
    if (!shell) return;
    const sRect = shell.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = r.left - sRect.left;
    const y = r.top - sRect.top;
    scanSweeps.push({
      x,
      y,
      w: r.width,
      h: r.height,
      progress: 0,
      speed: 0.055,
      color
    });
    // Faíscas sutis nas extremidades do painel ao travar no lugar
    spawnBurst(x + 10, y + r.height / 2, color, 6);
    spawnBurst(x + r.width - 10, y + r.height / 2, color, 6);
  }

  function clearElementTransition(el) {
    if (!el) return;
    el.style.opacity = '';
    el.style.transform = '';
    el.style.willChange = '';
    el.classList.remove('hud-boot-glow');
    const prevTimer = glowTimers.get(el);
    if (prevTimer) {
      clearTimeout(prevTimer);
      glowTimers.delete(el);
    }
  }

  function cancelUiTransitions() {
    while (uiTransitions.length > 0) {
      const tr = uiTransitions.pop();
      clearElementTransition(tr.el);
    }
    scanSweeps.length = 0;
  }

  function animateElementEntrance(el, options = {}) {
    if (!el) return;
    const delay = options.delay || 0;
    const duration = options.duration || 420;
    const fromY = options.fromY !== undefined ? options.fromY : 24;
    const accent = options.accent || '#00F0FF';
    const withFx = Boolean(options.withFx);

    // Substitui qualquer transição anterior ativa no mesmo elemento
    for (let i = uiTransitions.length - 1; i >= 0; i--) {
      if (uiTransitions[i].el === el) {
        uiTransitions.splice(i, 1);
      }
    }

    el.style.willChange = 'transform, opacity';
    el.style.opacity = '0';
    el.style.transform = `translate3d(0, ${fromY}px, 0)`;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    uiTransitions.push({
      el,
      startTime: now + delay,
      duration,
      fromY,
      accent,
      withFx,
      fxTriggered: false
    });
  }

  /* Coreografia completa de entrada da partida (menu -> arena) */
  function playMatchHudEntrance(bossAccent = '#FF0055') {
    cancelUiTransitions();

    const topBar = document.querySelector('.top-bar');
    const enemyPanel = document.getElementById('enemy-panel');
    const arena = document.getElementById('arena-container');
    const playerHud = document.getElementById('player-hud');
    const handZone = document.getElementById('hand-zone');

    animateElementEntrance(topBar, { delay: 0, duration: 300, fromY: 12 });
    animateElementEntrance(enemyPanel, {
      delay: 70,
      duration: 420,
      fromY: 22,
      accent: bossAccent,
      withFx: true
    });
    animateElementEntrance(arena, { delay: 125, duration: 380, fromY: 16 });
    animateElementEntrance(playerHud, {
      delay: 180,
      duration: 440,
      fromY: 26,
      accent: '#00F0FF',
      withFx: true
    });
    animateElementEntrance(handZone, { delay: 250, duration: 400, fromY: 24 });
  }

  function clearLasers() {
    const svg = document.getElementById('laser-svg');
    if (svg) svg.innerHTML = '';
  }

  function drawDefenseLasers(attackerSide, blockMap) {
    const svg = document.getElementById('laser-svg');
    if (!svg) return;
    svg.innerHTML = '';
    const arenaRect = document.getElementById('arena-container').getBoundingClientRect();
    const defenderSide = attackerSide === 'player' ? 'enemy' : 'player';

    const state = NB.State.get();
    const badges = [];
    Object.entries(blockMap).forEach(([atkSlotStr, defSlot]) => {
      const atkEl = NB.State.getSlotEl(attackerSide, Number(atkSlotStr));
      const defEl = NB.State.getSlotEl(defenderSide, Number(defSlot));
      if (!atkEl || !defEl) return;

      const r1 = defEl.getBoundingClientRect();
      const r2 = atkEl.getBoundingClientRect();
      const x1 = r1.left - arenaRect.left + r1.width / 2;
      const y1 = r1.top - arenaRect.top + r1.height / 2;
      const x2 = r2.left - arenaRect.left + r2.width / 2;
      const y2 = r2.top - arenaRect.top + r2.height / 2;

      const color = attackerSide === 'enemy' ? '#00F0FF' : '#FF0055';

      const lineGlow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineGlow.setAttribute('x1', x1);
      lineGlow.setAttribute('y1', y1);
      lineGlow.setAttribute('x2', x2);
      lineGlow.setAttribute('y2', y2);
      lineGlow.setAttribute('stroke', color);
      lineGlow.setAttribute('stroke-width', '6');
      lineGlow.setAttribute('stroke-opacity', '0.28');
      svg.appendChild(lineGlow);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('stroke-dasharray', '6 4');
      svg.appendChild(line);

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x2);
      dot.setAttribute('cy', y2);
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', '#FFB800');
      svg.appendChild(dot);

      const attacker = state[attackerSide].field[atkSlotStr];
      const defender = state[defenderSide].field[defSlot];
      if (!attacker || !defender || (attackerSide === 'enemy' && state.enemyOverclock)) return;
      const bonuses = NB.Combat.clashAffinity(attacker, defender, state[attackerSide].field);
      if (bonuses.attack || bonuses.counter) {
        const fraction = bonuses.attack ? .67 : .33;
        const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        badge.setAttribute('class', 'affinity-line-bonus');
        badge.setAttribute('x', x1 + (x2 - x1) * fraction);
        badge.setAttribute('y', y1 + (y2 - y1) * fraction);
        badge.setAttribute('aria-label', bonuses.attack ? '+1 de afinidade no ataque' : '+1 de afinidade no contra-ataque');
        badge.textContent = '+1';
        badges.push(badge);
      }
    });
    svg.append(...badges);
  }

  /* Conecta 2 unidades aliadas com feixe de energia neon durante o Overclock (Unite Attack) */
  function drawOverclockLink(slotA, slotB) {
    const svg = document.getElementById('laser-svg');
    if (!svg) return;
    svg.innerHTML = '';
    const elA = NB.State.getSlotEl('player', slotA);
    const elB = NB.State.getSlotEl('player', slotB);
    if (!elA || !elB) return;

    const arenaRect = document.getElementById('arena-container').getBoundingClientRect();
    const rA = elA.getBoundingClientRect();
    const rB = elB.getBoundingClientRect();
    const x1 = rA.left - arenaRect.left + rA.width / 2;
    const y1 = rA.top - arenaRect.top + rA.height / 2;
    const x2 = rB.left - arenaRect.left + rB.width / 2;
    const y2 = rB.top - arenaRect.top + rB.height / 2;

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    glow.setAttribute('x1', x1);
    glow.setAttribute('y1', y1);
    glow.setAttribute('x2', x2);
    glow.setAttribute('y2', y2);
    glow.setAttribute('stroke', '#39FF14');
    glow.setAttribute('stroke-width', '12');
    glow.setAttribute('stroke-opacity', '0.32');
    svg.appendChild(glow);

    const core = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    core.setAttribute('x1', x1);
    core.setAttribute('y1', y1);
    core.setAttribute('x2', x2);
    core.setAttribute('y2', y2);
    core.setAttribute('stroke', '#00F0FF');
    core.setAttribute('stroke-width', '4');
    svg.appendChild(core);

    const spark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    spark.setAttribute('cx', (x1 + x2) / 2);
    spark.setAttribute('cy', (y1 + y2) / 2);
    spark.setAttribute('r', '9');
    spark.setAttribute('fill', '#39FF14');
    spark.setAttribute('stroke', '#FFFFFF');
    spark.setAttribute('stroke-width', '2');
    svg.appendChild(spark);
  }

  /* Conecta 2 unidades inimigas (Archon) com arco de energia Magenta/Âmbar durante Overclock inimigo */
  function drawEnemyOverclockLink(slotA, slotB) {
    const svg = document.getElementById('laser-svg');
    if (!svg) return;
    const elA = NB.State.getSlotEl('enemy', slotA);
    const elB = NB.State.getSlotEl('enemy', slotB);
    if (!elA || !elB) return;

    const arenaRect = document.getElementById('arena-container').getBoundingClientRect();
    const rA = elA.getBoundingClientRect();
    const rB = elB.getBoundingClientRect();
    const x1 = rA.left - arenaRect.left + rA.width / 2;
    const y1 = rA.top - arenaRect.top + rA.height / 2;
    const x2 = rB.left - arenaRect.left + rB.width / 2;
    const y2 = rB.top - arenaRect.top + rB.height / 2;

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    glow.setAttribute('x1', x1); glow.setAttribute('y1', y1);
    glow.setAttribute('x2', x2); glow.setAttribute('y2', y2);
    glow.setAttribute('stroke', '#FF0055');
    glow.setAttribute('stroke-width', '12');
    glow.setAttribute('stroke-opacity', '0.38');
    svg.appendChild(glow);

    const core = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    core.setAttribute('x1', x1); core.setAttribute('y1', y1);
    core.setAttribute('x2', x2); core.setAttribute('y2', y2);
    core.setAttribute('stroke', '#FFB800');
    core.setAttribute('stroke-width', '4');
    svg.appendChild(core);
  }

  function tick(now) {
    const ts = now || (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const shell = document.getElementById('console-shell');
    const w = shell.clientWidth;
    const h = shell.clientHeight;

    // Atualiza transições de entrada do HUD (fade-in + slide up com ease-out cúbico)
    for (let i = uiTransitions.length - 1; i >= 0; i--) {
      const tr = uiTransitions[i];
      if (ts < tr.startTime) continue;

      const raw = Math.min(1, (ts - tr.startTime) / tr.duration);
      const ease = 1 - Math.pow(1 - raw, 3);
      const curY = tr.fromY * (1 - ease);

      tr.el.style.opacity = ease.toFixed(3);
      tr.el.style.transform = `translate3d(0, ${curY.toFixed(2)}px, 0)`;

      if (tr.withFx && !tr.fxTriggered && raw >= 0.42) {
        tr.fxTriggered = true;
        spawnScanSweep(tr.el, tr.accent);
        tr.el.classList.add('hud-boot-glow');
        const prev = glowTimers.get(tr.el);
        if (prev) clearTimeout(prev);
        const timerId = setTimeout(() => {
          tr.el.classList.remove('hud-boot-glow');
          glowTimers.delete(tr.el);
        }, 360);
        glowTimers.set(tr.el, timerId);
      }

      if (raw >= 1) {
        tr.el.style.opacity = '';
        tr.el.style.transform = '';
        tr.el.style.willChange = '';
        uiTransitions.splice(i, 1);
      }
    }

    bgCtx.clearRect(0, 0, w, h);
    gridOffset = (gridOffset + 0.32) % 34;

    bgCtx.strokeStyle = 'rgba(0, 240, 255, 0.055)';
    bgCtx.lineWidth = 1;
    for (let x = 0; x <= w; x += 34) {
      bgCtx.beginPath();
      bgCtx.moveTo(x, 0);
      bgCtx.lineTo(x, h);
      bgCtx.stroke();
    }
    for (let y = gridOffset - 34; y <= h; y += 34) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, y);
      bgCtx.lineTo(w, y);
      bgCtx.stroke();
    }

    bgCtx.strokeStyle = 'rgba(255, 0, 85, 0.08)';
    bgCtx.beginPath();
    bgCtx.moveTo(0, h * 0.42);
    bgCtx.lineTo(w, h * 0.42);
    bgCtx.stroke();

    fxCtx.clearRect(0, 0, w, h);

    // Varredura holográfica neon durante entrada dos painéis do HUD
    for (let i = scanSweeps.length - 1; i >= 0; i--) {
      const sw = scanSweeps[i];
      sw.progress += sw.speed;
      if (sw.progress >= 1) {
        scanSweeps.splice(i, 1);
        continue;
      }
      const alpha = Math.sin(sw.progress * Math.PI) * 0.72;
      const sweepX = sw.x + sw.w * sw.progress;
      fxCtx.save();
      fxCtx.beginPath();
      fxCtx.rect(sw.x, sw.y, sw.w, sw.h);
      fxCtx.clip();

      const grad = fxCtx.createLinearGradient(sweepX - 36, sw.y, sweepX + 14, sw.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.75, sw.color);
      grad.addColorStop(1, 'rgba(255,255,255,0.9)');
      fxCtx.globalAlpha = alpha;
      fxCtx.fillStyle = grad;
      fxCtx.fillRect(sweepX - 36, sw.y, 50, sw.h);
      fxCtx.restore();
    }

    // Feixes de laser transitórios (Exploits / Overclock)
    for (let i = transientBeams.length - 1; i >= 0; i--) {
      const b = transientBeams[i];
      b.life -= b.decay;
      if (b.life <= 0) {
        transientBeams.splice(i, 1);
        continue;
      }
      fxCtx.save();
      fxCtx.globalAlpha = b.life;
      fxCtx.strokeStyle = b.color;
      fxCtx.shadowColor = b.color;
      fxCtx.shadowBlur = 18;
      fxCtx.lineWidth = b.width * (0.6 + b.life * 0.8);
      fxCtx.lineCap = 'round';
      fxCtx.beginPath();
      fxCtx.moveTo(b.x1, b.y1);
      fxCtx.lineTo(b.x2, b.y2);
      fxCtx.stroke();

      fxCtx.strokeStyle = '#FFFFFF';
      fxCtx.lineWidth = Math.max(1.5, b.width * 0.32 * b.life);
      fxCtx.beginPath();
      fxCtx.moveTo(b.x1, b.y1);
      fxCtx.lineTo(b.x2, b.y2);
      fxCtx.stroke();
      fxCtx.restore();
    }

    // Ondas de choque expansivas
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.22;
      sw.life -= 0.05;
      if (sw.life <= 0) {
        shockwaves.splice(i, 1);
        continue;
      }
      fxCtx.save();
      fxCtx.globalAlpha = sw.life * 0.85;
      fxCtx.strokeStyle = sw.color;
      fxCtx.lineWidth = 3 * sw.life;
      fxCtx.beginPath();
      fxCtx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      fxCtx.stroke();
      fxCtx.restore();
    }

    // Partículas neon
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      fxCtx.globalAlpha = p.life;
      fxCtx.fillStyle = p.color;
      fxCtx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    fxCtx.globalAlpha = 1;

    requestAnimationFrame(tick);
  }

  NB.Physics = {
    init,
    resize,
    vibrate,
    vibrateCard,
    vibrateExploit,
    vibrateDamage,
    vibrateDestroy,
    vibrateOverclock,
    spawnBurst,
    spawnShockwave,
    spawnScanSweep,
    fireLaserBeam,
    getElCenterInShell,
    spawnFloatText,
    shakeScreen,
    showToast,
    animateElementEntrance,
    cancelUiTransitions,
    playMatchHudEntrance,
    clearLasers,
    drawDefenseLasers,
    drawOverclockLink,
    drawEnemyOverclockLink
  };
})(window.NB = window.NB || {});
