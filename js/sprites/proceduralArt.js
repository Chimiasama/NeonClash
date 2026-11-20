(function (NB) {
  'use strict';

  const assetStatus = {};      // id -> 'loading' | 'loaded' | 'fallback'
  const fallbackDataUrls = {}; // id -> dataURL gerado via Canvas 2D

  function drawCyberGrid(ctx, w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawCircuitTraces(ctx, w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const lines = [
      [[10, 20], [42, 20], [56, 34]],
      [[w - 12, 28], [w - 44, 28], [w - 58, 42]],
      [[14, h - 24], [48, h - 24], [62, h - 38]],
      [[w - 16, h - 18], [w - 56, h - 18], [w - 72, h - 34]]
    ];
    lines.forEach(pts => {
      ctx.beginPath();
      pts.forEach((p, idx) => idx === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.stroke();
      const last = pts[pts.length - 1];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(last[0], last[1], 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function generateProceduralArt(id) {
    if (fallbackDataUrls[id]) return fallbackDataUrls[id];
    const isAvatar = ['kira', 'cipher', 'vex', 'archon'].includes(id);
    const w = 240;
    const h = isAvatar ? 240 : 180;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const card = NB.Cards.CARD_DB[id];
    const avatarColors = {
      kira: '#00F0FF',
      cipher: '#38BDF8',
      vex: '#FF0055',
      archon: '#FFB800'
    };
    const accent = isAvatar ? avatarColors[id] : (card ? card.accent : '#00F0FF');

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#070A14');
    bg.addColorStop(0.55, '#121830');
    bg.addColorStop(1, '#080B14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const rad = ctx.createRadialGradient(w * 0.5, h * 0.48, 8, w * 0.5, h * 0.48, w * 0.58);
    rad.addColorStop(0, accent + '44');
    rad.addColorStop(1, 'transparent');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    drawCyberGrid(ctx, w, h, 'rgba(0, 240, 255, 0.07)');
    drawCircuitTraces(ctx, w, h, accent + '66');

    ctx.save();
    ctx.translate(w / 2, h / 2);

    if (id === 'kira') {
      // KIRA: Rato de Sub-rede — jaqueta com gola neon e visor assimétrico ciano/âmbar
      ctx.fillStyle = '#0D1528';
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-76, 120);
      ctx.lineTo(-50, 38);
      ctx.lineTo(0, 24);
      ctx.lineTo(50, 38);
      ctx.lineTo(76, 120);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cabelo espetado estilo anime cyberpunk
      ctx.fillStyle = '#152242';
      ctx.beginPath();
      ctx.moveTo(-48, 4);
      ctx.lineTo(-62, -46);
      ctx.lineTo(-28, -36);
      ctx.lineTo(-10, -82);
      ctx.lineTo(14, -52);
      ctx.lineTo(44, -76);
      ctx.lineTo(54, -26);
      ctx.lineTo(42, 18);
      ctx.lineTo(0, 38);
      ctx.lineTo(-42, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Visor assimétrico luminoso
      ctx.fillStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(-34, -22);
      ctx.lineTo(38, -28);
      ctx.lineTo(32, -6);
      ctx.lineTo(-26, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFB800';
      ctx.fillRect(10, -22, 16, 8);
    } else if (id === 'cipher') {
      // CIPHER: Cão de Guarda da Vértice — capacete blindado hexagonal
      ctx.fillStyle = '#0D172E';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-84, 120);
      ctx.lineTo(-68, 28);
      ctx.lineTo(68, 28);
      ctx.lineTo(84, 120);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Capacete tático blindado
      ctx.fillStyle = '#142444';
      ctx.beginPath();
      ctx.moveTo(-50, 22);
      ctx.lineTo(-56, -34);
      ctx.lineTo(-28, -76);
      ctx.lineTo(28, -76);
      ctx.lineTo(56, -34);
      ctx.lineTo(50, 22);
      ctx.lineTo(0, 42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Viseira corporativa em T
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 18;
      ctx.fillRect(-38, -28, 76, 14);
      ctx.fillRect(-8, -14, 16, 36);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(-32, -24, 64, 6);
    } else if (id === 'archon') {
      // ARCHON: Diretor de Operações Negras — manto executivo, coroa neural dourada e olhos magenta
      ctx.fillStyle = '#160E1F';
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-88, 120);
      ctx.lineTo(-70, 24);
      ctx.lineTo(-24, 18);
      ctx.lineTo(0, 46);
      ctx.lineTo(24, 18);
      ctx.lineTo(70, 24);
      ctx.lineTo(88, 120);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Rosto cibernético + gola imperial
      ctx.fillStyle = '#1D142B';
      ctx.beginPath();
      ctx.moveTo(-42, 16);
      ctx.lineTo(-46, -42);
      ctx.lineTo(0, -76);
      ctx.lineTo(46, -42);
      ctx.lineTo(42, 16);
      ctx.lineTo(0, 42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Coroa de interface neural dourada
      ctx.strokeStyle = '#FFB800';
      ctx.shadowColor = '#FFB800';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-46, -46);
      ctx.lineTo(-30, -82);
      ctx.lineTo(-10, -56);
      ctx.lineTo(0, -92);
      ctx.lineTo(10, -56);
      ctx.lineTo(30, -82);
      ctx.lineTo(46, -46);
      ctx.stroke();

      // Olhos cibernéticos magenta flamejantes
      ctx.fillStyle = '#FF0055';
      ctx.shadowColor = '#FF0055';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-30, -16); ctx.lineTo(-8, -10); ctx.lineTo(-26, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(30, -16); ctx.lineTo(8, -10); ctx.lineTo(26, -4); ctx.closePath(); ctx.fill();
    } else if (id === 'vex') {
      ctx.fillStyle = '#0D1021';
      ctx.strokeStyle = '#FF0055';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-78, 120);
      ctx.lineTo(-56, 36);
      ctx.lineTo(-28, 22);
      ctx.lineTo(28, 22);
      ctx.lineTo(56, 36);
      ctx.lineTo(78, 120);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-46, 20);
      ctx.lineTo(-52, -38);
      ctx.lineTo(-20, -78);
      ctx.lineTo(20, -78);
      ctx.lineTo(52, -38);
      ctx.lineTo(46, 20);
      ctx.lineTo(0, 38);
      ctx.closePath();
      ctx.fillStyle = '#141932';
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FF0055';
      ctx.shadowColor = '#FF0055';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-36, -24);
      ctx.lineTo(36, -24);
      ctx.lineTo(28, -4);
      ctx.lineTo(-28, -4);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFE0EC';
      ctx.fillRect(-24, -19, 18, 4);
      ctx.fillRect(8, -19, 12, 4);

      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, 12);
      ctx.lineTo(0, 22);
      ctx.lineTo(18, 12);
      ctx.stroke();
    } else if (id === 'unit_01') {
      ctx.strokeStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-66, 54);
      ctx.lineTo(70, -56);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#121933';
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-36, 48);
      ctx.lineTo(-28, -8);
      ctx.lineTo(-42, -32);
      ctx.lineTo(-14, -48);
      ctx.lineTo(14, -48);
      ctx.lineTo(42, -32);
      ctx.lineTo(28, -8);
      ctx.lineTo(36, 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-26, -58);
      ctx.lineTo(0, -34);
      ctx.lineTo(26, -58);
      ctx.stroke();

      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(-20, -18, 40, 8);
    } else if (id === 'unit_02') {
      ctx.strokeStyle = '#39FF14';
      ctx.lineWidth = 3;
      [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(sx * 18, sy * 10);
        ctx.lineTo(sx * 48, sy * 24 - 12);
        ctx.lineTo(sx * 68, sy * 34 + 14);
        ctx.stroke();
      });
      ctx.fillStyle = '#101A28';
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#39FF14';
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#070A14';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'unit_03') {
      ctx.fillStyle = '#101B36';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(a) * 56;
        const py = Math.sin(a) * 56;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(a) * 34;
        const py = Math.sin(a) * 34;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(-14, -4, 28, 8);
      ctx.fillRect(-4, -14, 8, 28);
    } else if (id === 'unit_04') {
      for (let i = 2; i >= 0; i--) {
        ctx.strokeStyle = i === 0 ? '#00F0FF' : 'rgba(0, 240, 255, 0.3)';
        ctx.fillStyle = i === 0 ? '#111A34' : 'transparent';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-18 - i * 16, 46);
        ctx.lineTo(-2 - i * 16, -44);
        ctx.lineTo(30 - i * 16, -24);
        ctx.lineTo(16 - i * 16, 46);
        ctx.closePath();
        if (i === 0) ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#39FF14';
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 12;
      ctx.fillRect(0, -28, 22, 6);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#39FF14';
      ctx.beginPath();
      ctx.moveTo(-74, -10); ctx.lineTo(-26, -10);
      ctx.moveTo(-64, 10); ctx.lineTo(-20, 10);
      ctx.stroke();
    } else if (id === 'unit_05') {
      ctx.strokeStyle = '#FFB800';
      ctx.fillStyle = 'rgba(255, 184, 0, 0.16)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#FFB800';
      ctx.shadowBlur = 12;
      [-1, 1].forEach(s => {
        ctx.beginPath();
        ctx.moveTo(s * 12, -10);
        ctx.lineTo(s * 78, -46);
        ctx.lineTo(s * 62, 6);
        ctx.lineTo(s * 74, 24);
        ctx.lineTo(s * 16, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      ctx.fillStyle = '#151B33';
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(20, 0);
      ctx.lineTo(0, 48);
      ctx.lineTo(-20, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(0, -6, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'unit_06') {
      ctx.fillStyle = '#191026';
      ctx.strokeStyle = '#FF0055';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FF0055';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-48, 20);
      ctx.lineTo(-34, -44);
      ctx.lineTo(-10, -24);
      ctx.lineTo(24, -28);
      ctx.lineTo(66, -4);
      ctx.lineTo(44, 20);
      ctx.lineTo(54, 34);
      ctx.lineTo(10, 26);
      ctx.lineTo(-24, 42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFB800';
      ctx.beginPath();
      ctx.moveTo(4, -14);
      ctx.lineTo(24, -10);
      ctx.lineTo(10, -2);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'unit_07') {
      ctx.fillStyle = '#1E2438';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-62, 54);
      ctx.lineTo(-68, -14);
      ctx.lineTo(-38, -44);
      ctx.lineTo(38, -44);
      ctx.lineTo(68, -14);
      ctx.lineTo(62, 54);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF0055';
      ctx.fillRect(-18, -6, 36, 16);
      ctx.fillStyle = '#FFB800';
      ctx.fillRect(-22, -32, 44, 8);
    } else if (id === 'unit_08') {
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#C084FC';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.ellipse(0, 0, 56, 22, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 56, 22, 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#1C1333';
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(28, -8);
      ctx.lineTo(18, 48);
      ctx.lineTo(0, 32);
      ctx.lineTo(-18, 48);
      ctx.lineTo(-28, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(-14, -20, 9, 5);
      ctx.fillRect(5, -20, 9, 5);
    } else if (id === 'exploit_01') {
      ctx.fillStyle = '#151B2E';
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 3;
      ctx.fillRect(-38, -38, 76, 76);
      ctx.strokeRect(-38, -38, 76, 76);
      for (let i = -24; i <= 24; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, -38); ctx.lineTo(i, -52);
        ctx.moveTo(i, 38); ctx.lineTo(i, 52);
        ctx.moveTo(-38, i); ctx.lineTo(-52, i);
        ctx.moveTo(38, i); ctx.lineTo(52, i);
        ctx.stroke();
      }
      ctx.fillStyle = '#39FF14';
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(6, -26);
      ctx.lineTo(-16, 4);
      ctx.lineTo(2, 4);
      ctx.lineTo(-8, 28);
      ctx.lineTo(18, -4);
      ctx.lineTo(0, -4);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'exploit_02') {
      ctx.strokeStyle = '#FF0055';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FF0055';
      ctx.shadowColor = '#FF0055';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-74, -46);
      ctx.lineTo(18, -6);
      ctx.lineTo(74, 46);
      ctx.lineTo(-16, 8);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'exploit_03') {
      ctx.strokeStyle = '#FF0055';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#FF0055';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-64, 0); ctx.lineTo(-26, 0);
      ctx.moveTo(26, 0); ctx.lineTo(64, 0);
      ctx.moveTo(0, -64); ctx.lineTo(0, -26);
      ctx.moveTo(0, 26); ctx.lineTo(0, 64);
      ctx.stroke();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-22, -22); ctx.lineTo(22, 22);
      ctx.moveTo(22, -22); ctx.lineTo(-22, 22);
      ctx.stroke();
    } else if (id === 'exploit_04') {
      ctx.strokeStyle = '#39FF14';
      ctx.fillStyle = 'rgba(57, 255, 20, 0.22)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-16, -46); ctx.lineTo(16, -46);
      ctx.lineTo(16, -16); ctx.lineTo(46, -16);
      ctx.lineTo(46, 16); ctx.lineTo(16, 16);
      ctx.lineTo(16, 46); ctx.lineTo(-16, 46);
      ctx.lineTo(-16, 16); ctx.lineTo(-46, 16);
      ctx.lineTo(-46, -16); ctx.lineTo(-16, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (id === 'unit_09') {
      // Trojan-Mantis: Louva-a-deus cibernético com foices virais verde ácido
      ctx.strokeStyle = '#39FF14';
      ctx.fillStyle = '#112218';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#39FF14';
      ctx.shadowBlur = 14;
      [-1, 1].forEach(s => {
        ctx.beginPath();
        ctx.moveTo(s * 14, 0);
        ctx.lineTo(s * 54, -36);
        ctx.lineTo(s * 76, 10);
        ctx.lineTo(s * 34, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(24, -18);
      ctx.lineTo(14, 42);
      ctx.lineTo(0, 52);
      ctx.lineTo(-14, 42);
      ctx.lineTo(-24, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFB800';
      ctx.fillRect(-14, -26, 9, 6);
      ctx.fillRect(5, -26, 9, 6);
    } else if (id === 'unit_10') {
      // Bastion-Core: Torre fortaleza firewall com placas concêntricas
      ctx.fillStyle = '#0E1C36';
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#0EA5E9';
      ctx.shadowBlur = 16;
      ctx.fillRect(-52, -44, 104, 88);
      ctx.strokeRect(-52, -44, 104, 88);
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.strokeRect(-34, -28, 68, 56);
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(20, 0);
      ctx.lineTo(0, 20);
      ctx.lineTo(-20, 0);
      ctx.closePath();
      ctx.fill();
    } else if (id === 'unit_11') {
      // Siphon-Viper: Víbora óptica neon violeta/magenta com presas de dreno
      ctx.strokeStyle = '#E879F9';
      ctx.fillStyle = '#1E1130';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#E879F9';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(-64, 48);
      ctx.bezierCurveTo(-50, -30, 10, 40, 26, -38);
      ctx.lineTo(62, -16);
      ctx.lineTo(34, 8);
      ctx.bezierCurveTo(6, 54, -36, 10, -48, 56);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(30, -24, 12, 5);
      ctx.strokeStyle = '#FF0055';
      ctx.beginPath();
      ctx.moveTo(50, -10); ctx.lineTo(54, 6);
      ctx.moveTo(42, -8); ctx.lineTo(44, 8);
      ctx.stroke();
    } else if (id === 'unit_12') {
      // Plague-Node: Barreira hexagonal bio-viral (Firewall + Vírus)
      ctx.fillStyle = '#142014';
      ctx.strokeStyle = '#84CC16';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#84CC16';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * 54;
        const py = Math.sin(a) * 54;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 20, Math.sin(a) * 20, 13, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#39FF14';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'unit_13') {
      // Flash-Ronin: Chapéu cônico cibernético + corte relâmpago Zero-Day
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#22D3EE';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(-84, 34);
      ctx.lineTo(84, -34);
      ctx.stroke();
      ctx.fillStyle = '#111B33';
      ctx.strokeStyle = '#E879F9';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-64, -8);
      ctx.lineTo(0, -48);
      ctx.lineTo(64, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-26, -6);
      ctx.lineTo(-34, 50);
      ctx.lineTo(34, 50);
      ctx.lineTo(26, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(-18, 6, 36, 6);
    } else if (id === 'unit_14') {
      // Malware-Rex: Mandíbula cibernética pesada com núcleo ácido
      ctx.fillStyle = '#172318';
      ctx.strokeStyle = '#A3E635';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#A3E635';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-58, -42);
      ctx.lineTo(54, -34);
      ctx.lineTo(66, -4);
      ctx.lineTo(12, 2);
      ctx.lineTo(58, 28);
      ctx.lineTo(38, 46);
      ctx.lineTo(-54, 36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF0055';
      ctx.fillRect(6, -24, 18, 8);
      ctx.fillStyle = '#39FF14';
      for (let x = 16; x <= 52; x += 12) {
        ctx.fillRect(x, -4, 6, 8);
      }
    } else if (id === 'exploit_05') {
      // Bomba EMP: Ondas concêntricas âmbar/ciano e núcleo de pulso
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FFB800';
      ctx.shadowBlur = 16;
      [20, 38, 56].forEach(r => {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
        ctx.lineTo(Math.cos(a) * 66, Math.sin(a) * 66);
        ctx.stroke();
      }
    } else if (id === 'exploit_06') {
      // Sifão de Memória: Vórtice magenta/verde drenando blocos de RAM
      ctx.strokeStyle = '#E879F9';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#E879F9';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0.2, Math.PI * 1.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 30, Math.PI * 0.5, Math.PI * 2.1);
      ctx.stroke();
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(-52, -26, 12, 12);
      ctx.fillRect(40, 14, 12, 12);
    }

    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(id.toUpperCase(), 8, h - 8);

    const url = c.toDataURL('image/png');
    fallbackDataUrls[id] = url;
    return url;
  }

  function initAssets() {
    NB.Cards.ASSET_LIST.forEach(item => {
      assetStatus[item.id] = 'loading';
      const probe = new Image();
      probe.onload = function () {
        assetStatus[item.id] = probe.naturalWidth > 0 ? 'loaded' : 'fallback';
        if (NB.UI && NB.UI.refreshPngModalIfOpen) NB.UI.refreshPngModalIfOpen();
      };
      probe.onerror = function () {
        assetStatus[item.id] = 'fallback';
        if (NB.UI && NB.UI.refreshPngModalIfOpen) NB.UI.refreshPngModalIfOpen();
      };
      probe.src = item.path;
    });
  }

  function createArtMarkup(id, imgPath, altText, fallbackId = NB.Cards.CARD_DB[id]?.fallbackArt || id) {
    const wrap = document.createDocumentFragment();
    const status = assetStatus[id];
    function fallbackImage(alt, final = false) {
      const img = document.createElement('img');
      img.className = 'art-fallback';
      if (final && imgPath) img.dataset.galleryArt = imgPath;
      img.src = generateProceduralArt(fallbackId);
      img.alt = alt;
      return img;
    }

    if (status === 'fallback') {
      wrap.appendChild(fallbackImage(altText, true));
    } else {
      const fallback = status === 'loaded' ? null : fallbackImage('');
      if (fallback) wrap.appendChild(fallback);

      const real = document.createElement('img');
      real.alt = altText;
      real.onload = () => {
        assetStatus[id] = 'loaded';
        fallback?.remove();
      };
      real.onerror = () => {
        assetStatus[id] = 'fallback';
        if (fallback) {
          fallback.alt = altText;
          fallback.dataset.galleryArt = imgPath;
          real.remove();
        } else {
          real.replaceWith(fallbackImage(altText, true));
        }
        NB.UI?.refreshPngModalIfOpen();
      };
      real.src = imgPath;
      wrap.appendChild(real);
    }
    return wrap;
  }

  NB.Sprites = {
    assetStatus,
    generateProceduralArt,
    initAssets,
    createArtMarkup
  };
})(window.NB = window.NB || {});
