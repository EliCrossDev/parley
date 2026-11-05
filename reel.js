/* Parley reel: renders a saved conversation as a vertical video (audio + bubbles landing in time + waveform),
   entirely on the device, then hands it to the share sheet. window.Reel.make(convo, helpers, onProgress) -> Blob */
window.Reel = (function () {
  const W = 1080, H = 1920, FPS = 30;
  const FONT_D = '"Outfit", "Manrope", system-ui, sans-serif', FONT_B = '"Manrope", system-ui, sans-serif', FONT_M = '"JetBrains Mono", ui-monospace, monospace';

  function pickMime() {
    const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
    return '';
  }
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

  async function make(c, helpers, onProgress, opts) {
    opts = opts || {}; const brand = opts.brand !== false;
    const { lineStart, lineSpan, short, native, avatarImg } = helpers;
    const starts = c.lines.map((_, i) => lineStart(c, i));
    const fullTotal = Math.max(c.duration * 1000, (starts[starts.length - 1] || 0) + 2500) + 1200;
    const total = opts.cap && fullTotal > opts.cap ? opts.cap : fullTotal; const truncated = total < fullTotal;

    // Audio: decode the recording (if any) and route it to the recorder, silently.
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    let buffer = null; if (c.audio) { try { buffer = await ac.decodeAudioData(await c.audio.arrayBuffer()); } catch (e) { buffer = null; } }
    const dest = ac.createMediaStreamDestination(); const analyser = ac.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6;
    const td = new Uint8Array(analyser.fftSize);
    let src = null; if (buffer) { src = ac.createBufferSource(); src.buffer = buffer; src.connect(analyser); analyser.connect(dest); }
    else { const g = ac.createGain(); g.gain.value = 0; const o = ac.createOscillator(); o.connect(g); g.connect(dest); o.start(); } // silent track keeps the muxer happy

    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(FPS); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = pickMime(); const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
    const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = res; });

    // Pre-render avatars
    const avA = await avatarImg(c.avatarA ?? 3), avB = await avatarImg(c.avatarB ?? 5);
    const logo = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'icon-192.png'; });
    const spans = c.lines.map((_, i) => lineSpan(c, i));

    function draw(t) {
      // Background: the Night sky
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#6a6b74'); g.addColorStop(0.5, '#3a3f4f'); g.addColorStop(1, '#1b1d2a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const v = ctx.createRadialGradient(W * 0.3, H * 0.25, 100, W * 0.3, H * 0.25, H * 0.9); v.addColorStop(0, 'rgba(255,255,255,0.10)'); v.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

      // Header: wordmark, timer, live dot
      if (brand && logo) { ctx.save(); rr(ctx, 72, 104, 92, 92, 22); ctx.clip(); ctx.drawImage(logo, 72, 104, 92, 92); ctx.restore(); }
      const tx = logo ? 186 : 72; ctx.fillStyle = '#f7f7fb'; ctx.font = '700 56px ' + FONT_D; ctx.textBaseline = 'middle'; if (brand) ctx.fillText('Parley', tx, 150); else { ctx.font = '700 52px ' + FONT_D; ctx.fillText(native(c.langA) + '  ↔  ' + native(c.langB), 72, 150); }
      ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.arc(W - 300, 150, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(247,247,251,.8)'; ctx.font = '500 34px ' + FONT_M; const s = Math.floor(t / 1000); ctx.fillText(String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'), W - 270, 150);

      // Waveform
      let level = 0; if (buffer) { analyser.getByteTimeDomainData(td); }
      ctx.save(); ctx.translate(0, 290); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(255,255,255,.6)'; ctx.shadowBlur = 18;
      ctx.beginPath(); const n = 160; for (let i = 0; i <= n; i++) { const x = 72 + (W - 144) * i / n; const idx = Math.floor(i / n * (td.length - 1)); const a = buffer ? (td[idx] - 128) / 128 : 0; level = Math.max(level, Math.abs(a)); const y = a * 70 * Math.sin(Math.PI * i / n); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); for (let i = 0; i <= n; i++) { const x = 72 + (W - 144) * i / n; const idx = Math.floor(((i + 40) % n) / n * (td.length - 1)); const a = buffer ? (td[idx] - 128) / 128 : 0; const y = -a * 50 * Math.sin(Math.PI * i / n); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();

      // Bubbles: those that have started, laid out from the bottom up, newest last
      const visible = []; c.lines.forEach((l, i) => { if (starts[i] <= t) visible.push({ l, i, age: t - starts[i] }); });
      let nowIdx = -1; visible.forEach((v2) => { nowIdx = v2.i; });
      const boxes = []; const maxW = W * 0.78;
      for (const v2 of visible.slice(-6)) {
        const l = v2.l; ctx.font = '400 34px ' + FONT_B; const origLines = wrap(ctx, l.orig, maxW - 80);
        ctx.font = '600 58px ' + FONT_D; const transLines = wrap(ctx, l.trans, maxW - 80);
        const h = 40 + origLines.length * 44 + 14 + transLines.length * 68 + 24 + 56 + 36; const w = Math.min(maxW, 80 + Math.max(...origLines.map((x) => { ctx.font = '400 34px ' + FONT_B; return ctx.measureText(x).width; }), ...transLines.map((x) => { ctx.font = '600 58px ' + FONT_D; return ctx.measureText(x).width; })));
        const sp = spans[v2.i]; const f = Math.max(0, Math.min(1, (t - sp[0]) / Math.max(1, sp[1] - sp[0]))); boxes.push({ l, w, h, origLines, transLines, age: v2.age, now: v2.i === nowIdx, f });
      }
      let y = H - 330; for (let k = boxes.length - 1; k >= 0; k--) { const b = boxes[k]; y -= b.h + 22; b.y = y; }
      for (const b of boxes) {
        if (b.y + b.h < 380) continue;
        const pop = ease(b.age / 260); const x = b.l.who === 'a' ? 60 : W - 60 - b.w; const yy = b.y + (1 - pop) * 24;
        ctx.save(); ctx.globalAlpha = pop;
        ctx.shadowColor = b.l.who === 'a' ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.5)'; ctx.shadowBlur = b.now ? 60 : 30; ctx.shadowOffsetY = 16;
        ctx.fillStyle = b.l.who === 'a' ? 'rgba(233,233,242,.95)' : 'rgba(10,12,22,.82)'; rr(ctx, x, yy, b.w, b.h, 40); ctx.fill(); ctx.shadowColor = 'transparent';
        if (b.l.who === 'b') { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke(); }
        const ink = b.l.who === 'a' ? '#0e0e16' : '#f7f7fb'; let ty = yy + 40;
        ctx.fillStyle = b.l.who === 'a' ? 'rgba(14,14,22,.7)' : 'rgba(247,247,251,.72)'; ctx.font = '400 34px ' + FONT_B; ctx.textBaseline = 'top';
        let ow = Math.ceil(b.f * b.origLines.join(' ').split(/\s+/).length); for (const line of b.origLines) { const ws = line.split(' '); ctx.fillText(ws.slice(0, Math.max(0, ow)).join(' '), x + 40, ty); ow -= ws.length; ty += 44; } ty += 14;
        ctx.fillStyle = ink; ctx.font = '600 58px ' + FONT_D; let tw = Math.ceil(b.f * b.transLines.join(' ').split(/\s+/).length); for (const line of b.transLines) { const ws = line.split(' '); ctx.fillText(ws.slice(0, Math.max(0, tw)).join(' '), x + 40, ty); tw -= ws.length; ty += 68; } ty += 24;
        const av = b.l.who === 'a' ? avA : avB; if (av) { ctx.save(); ctx.beginPath(); ctx.arc(x + 40 + 24, ty + 24, 24, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(av, x + 40, ty, 48, 48); ctx.restore(); }
        ctx.fillStyle = b.l.who === 'a' ? 'rgba(14,14,22,.6)' : 'rgba(247,247,251,.6)'; ctx.font = '500 24px ' + FONT_M; ctx.textBaseline = 'middle'; ctx.fillText(short(b.l.from) + ' → ' + short(b.l.to), x + 40 + 64, ty + 24);
        ctx.restore();
      }

      // Bottom: the two language chips, the live one lit
      const who = nowIdx >= 0 && (t - starts[nowIdx]) < (c.lines[nowIdx].dur || 3000) + 600 ? c.lines[nowIdx].who : null;
      const chip = (label, x, lit, av) => { ctx.save(); ctx.font = '600 36px ' + FONT_B; const w = 100 + ctx.measureText(label).width + 56; rr(ctx, x < 0 ? W + x - w : x, H - 250, w, 96, 48); ctx.fillStyle = lit ? 'rgba(255,255,255,.94)' : 'rgba(255,255,255,.1)'; ctx.fill(); ctx.strokeStyle = lit ? '#fff' : 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.stroke(); const bx = (x < 0 ? W + x - w : x); if (av) { ctx.save(); ctx.beginPath(); ctx.arc(bx + 50, H - 202, 22, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(av, bx + 28, H - 224, 44, 44); ctx.restore(); } ctx.fillStyle = lit ? '#0e0e16' : '#f7f7fb'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx + 92, H - 202); ctx.restore(); };
      chip(native(c.langA), 60, who === 'a', avA); chip(native(c.langB), -60, who === 'b', avB);
      // Footer
      ctx.fillStyle = 'rgba(247,247,251,.75)'; ctx.font = '500 28px ' + FONT_M; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(brand ? 'LIVE TRANSLATION · GETPARLEY.VERCEL.APP' : new Date(c.startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(), W / 2, H - 100); ctx.textAlign = 'left';
      // End card on a clipped free video
      if (truncated && t > total - 3200) {
        const k = Math.min(1, (t - (total - 3200)) / 500); ctx.save(); ctx.globalAlpha = k * 0.94; ctx.fillStyle = '#0b0c14'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = k;
        if (logo) { ctx.save(); rr(ctx, W / 2 - 80, H / 2 - 330, 160, 160, 38); ctx.clip(); ctx.drawImage(logo, W / 2 - 80, H / 2 - 330, 160, 160); ctx.restore(); }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f7f7fb'; ctx.font = '700 84px ' + FONT_D; ctx.fillText(opts.endTitle || 'Full conversation', W / 2, H / 2 - 60);
        ctx.fillStyle = 'rgba(247,247,251,.78)'; ctx.font = '500 44px ' + FONT_B; const sub = wrap(ctx, opts.endSub || '', W - 220); sub.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 + 50 + i * 60));
        ctx.fillStyle = '#f7f7fb'; ctx.font = '600 48px ' + FONT_M; ctx.fillText('getparley.vercel.app', W / 2, H / 2 + 80 + sub.length * 60 + 50); ctx.restore(); ctx.textAlign = 'left';
      }
    }

    // Fonts: make sure they are loaded before the first frame
    try { await Promise.all(['700 54px Outfit', '600 58px Outfit', '400 34px Manrope', '600 36px Manrope', '500 28px JetBrains Mono'].map((f) => document.fonts.load(f))); } catch (e) {}

    rec.start(250); const t0 = ac.currentTime; if (src) src.start();
    await new Promise((resolve) => {
      const tick = () => { const t = (ac.currentTime - t0) * 1000; draw(t); if (onProgress) onProgress(Math.min(1, t / total)); if (t >= total) { resolve(); return; } requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    rec.stop(); await done; try { src && src.stop(); } catch (e) {} try { ac.close(); } catch (e) {}
    const type = (mime || 'video/webm').split(';')[0];
    return new Blob(chunks, { type });
  }
  return { make, pickMime };
})();
