/* Parley — live two-way conversation translation
   Speech: Web Speech API (browser engine). Translation: pluggable providers.
   Storage: localStorage (prefs) + IndexedDB (conversations + audio). */
(function () {
  'use strict';

  /* ---------------- Languages ---------------- */
  // code: translation code · sr: speech-recognition BCP-47 · tts: synthesis lang
  const LANGS = [
    { code: 'en', sr: 'en-US', name: 'English', native: 'English', short: 'EN' },
    { code: 'es', sr: 'es-MX', name: 'Spanish', native: 'Español', short: 'ES' },
    { code: 'pt', sr: 'pt-BR', name: 'Portuguese', native: 'Português', short: 'PT' },
    { code: 'zh-CN', sr: 'zh-CN', name: 'Chinese (Mandarin)', native: '中文', short: 'ZH' },
    { code: 'hi', sr: 'hi-IN', name: 'Hindi', native: 'हिन्दी', short: 'HI' },
    { code: 'th', sr: 'th-TH', name: 'Thai', native: 'ไทย', short: 'TH' },
    { code: 'ko', sr: 'ko-KR', name: 'Korean', native: '한국어', short: 'KO' },
    { code: 'ja', sr: 'ja-JP', name: 'Japanese', native: '日本語', short: 'JA' },
    { code: 'fr', sr: 'fr-FR', name: 'French', native: 'Français', short: 'FR' },
    { code: 'de', sr: 'de-DE', name: 'German', native: 'Deutsch', short: 'DE' },
    { code: 'it', sr: 'it-IT', name: 'Italian', native: 'Italiano', short: 'IT' },
    { code: 'ar', sr: 'ar-SA', name: 'Arabic', native: 'العربية', short: 'AR' },
    { code: 'ru', sr: 'ru-RU', name: 'Russian', native: 'Русский', short: 'RU' },
    { code: 'id', sr: 'id-ID', name: 'Indonesian', native: 'Bahasa Indonesia', short: 'ID' },
    { code: 'vi', sr: 'vi-VN', name: 'Vietnamese', native: 'Tiếng Việt', short: 'VI' },
    { code: 'tr', sr: 'tr-TR', name: 'Turkish', native: 'Türkçe', short: 'TR' },
    { code: 'nl', sr: 'nl-NL', name: 'Dutch', native: 'Nederlands', short: 'NL' },
    { code: 'pl', sr: 'pl-PL', name: 'Polish', native: 'Polski', short: 'PL' },
    { code: 'tl', sr: 'fil-PH', name: 'Filipino', native: 'Filipino', short: 'FIL' },
    { code: 'sw', sr: 'sw-KE', name: 'Swahili', native: 'Kiswahili', short: 'SW' },
    { code: 'bn', sr: 'bn-BD', name: 'Bengali', native: 'বাংলা', short: 'BN' },
    { code: 'ur', sr: 'ur-PK', name: 'Urdu', native: 'اردو', short: 'UR' },
    { code: 'he', sr: 'he-IL', name: 'Hebrew', native: 'עברית', short: 'HE' },
    { code: 'el', sr: 'el-GR', name: 'Greek', native: 'Ελληνικά', short: 'EL' },
    { code: 'sv', sr: 'sv-SE', name: 'Swedish', native: 'Svenska', short: 'SV' },
    { code: 'uk', sr: 'uk-UA', name: 'Ukrainian', native: 'Українська', short: 'UK' },
    { code: 'ms', sr: 'ms-MY', name: 'Malay', native: 'Bahasa Melayu', short: 'MS' },
    { code: 'fa', sr: 'fa-IR', name: 'Persian', native: 'فارسی', short: 'FA' },
  ];
  const byCode = (c) => LANGS.find((l) => l.code === c) || LANGS[0];
  const base = (c) => String(c || '').toLowerCase().split('-')[0];

  /* ---------------- Prefs ---------------- */
  const PREF_KEY = 'parley.prefs.v1';
  const defaults = {
    langA: 'en', langB: 'es', speak: false, record: true,
    name: 'Traveler', avatar: 0, engine: 'auto', libreUrl: '', libreKey: '', pro: false,
    fast: true, voiceEngine: 'kokoro', voices: {}, browserVoices: {},
  };
  let prefs = Object.assign({}, defaults);
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) {}
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------------- DOM helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let toastTimer;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400); }
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fmtTimer = (s) => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------------- Avatars (10 presets) ---------------- */
  const AVATARS = [
    ['#d9ff3b', '#0a0b00', 'circle'], ['#2f6bff', '#ffffff', 'ring'], ['#ff5a7a', '#1a0006', 'tri'],
    ['#7cffc4', '#002a1a', 'square'], ['#ffb84d', '#2a1600', 'hex'], ['#b48cff', '#140033', 'wave'],
    ['#ff7a2f', '#2a0e00', 'dots'], ['#5ee8ff', '#002a33', 'bars'], ['#f5f5f2', '#050505', 'circle'],
    ['#2a2a2e', '#d9ff3b', 'ring'],
  ];
  function avatarSVG(i) {
    const [bg, fg, shape] = AVATARS[i % AVATARS.length];
    let g = '';
    switch (shape) {
      case 'circle': g = `<circle cx="50" cy="50" r="22" fill="${fg}"/>`; break;
      case 'ring': g = `<circle cx="50" cy="50" r="24" fill="none" stroke="${fg}" stroke-width="9"/>`; break;
      case 'tri': g = `<path d="M50 24 L76 70 L24 70 Z" fill="${fg}"/>`; break;
      case 'square': g = `<rect x="29" y="29" width="42" height="42" rx="8" fill="${fg}" transform="rotate(15 50 50)"/>`; break;
      case 'hex': g = `<path d="M50 24 L73 37 L73 63 L50 76 L27 63 L27 37 Z" fill="${fg}"/>`; break;
      case 'wave': g = `<path d="M22 50 Q36 30 50 50 T78 50" fill="none" stroke="${fg}" stroke-width="9" stroke-linecap="round"/>`; break;
      case 'dots': g = `<circle cx="36" cy="50" r="8" fill="${fg}"/><circle cx="64" cy="50" r="8" fill="${fg}"/>`; break;
      case 'bars': g = `<rect x="30" y="34" width="9" height="32" rx="4" fill="${fg}"/><rect x="46" y="24" width="9" height="52" rx="4" fill="${fg}"/><rect x="62" y="40" width="9" height="20" rx="4" fill="${fg}"/>`; break;
    }
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" fill="${bg}"/>${g}</svg>`;
  }

  /* ---------------- IndexedDB ---------------- */
  const DB_NAME = 'parley', STORE = 'conversations';
  function openDB() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('no idb'));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function dbAll() { try { const db = await openDB(); return await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); } catch (e) { return []; } }
  async function dbPut(obj) { try { const db = await openDB(); await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(obj); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return false; } }
  async function dbDel(id) { try { const db = await openDB(); await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} }
  async function dbClear() { try { const db = await openDB(); await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).clear(); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} }
  const FREE_LIMIT = 5;
  async function enforceLimit() {
    if (prefs.pro) return;
    const all = (await dbAll()).sort((a, b) => b.startedAt - a.startedAt);
    for (const c of all.slice(FREE_LIMIT)) await dbDel(c.id);
  }

  /* ---------------- Translation providers ---------------- */
  async function viaGoogle(text, from, to) {
    const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + encodeURIComponent(from) + '&tl=' + encodeURIComponent(to) + '&dt=t&q=' + encodeURIComponent(text);
    const r = await fetch(u); if (!r.ok) throw new Error('google ' + r.status);
    const j = await r.json();
    return { text: (j[0] || []).map((x) => x[0]).join(''), detected: j[2] || null, provider: 'google' };
  }
  async function viaMyMemory(text, from, to) {
    const pair = (from === 'auto' ? 'autodetect' : from) + '|' + to;
    const u = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(pair);
    const r = await fetch(u); if (!r.ok) throw new Error('mymemory ' + r.status);
    const j = await r.json();
    if (!j.responseData || j.responseStatus && String(j.responseStatus) !== '200') throw new Error('mymemory');
    return { text: j.responseData.translatedText, detected: j.responseData.detectedLanguage || null, provider: 'mymemory' };
  }
  async function viaLibre(text, from, to) {
    if (!prefs.libreUrl) throw new Error('no libre url');
    const body = { q: text, source: from === 'auto' ? 'auto' : base(from), target: base(to), format: 'text' };
    if (prefs.libreKey) body.api_key = prefs.libreKey;
    const r = await fetch(prefs.libreUrl.replace(/\/$/, '') + '/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('libre ' + r.status);
    const j = await r.json();
    return { text: j.translatedText, detected: j.detectedLanguage ? j.detectedLanguage.language : null, provider: 'libre' };
  }
  async function translate(text, from, to) {
    const chain = prefs.engine === 'libre' ? [viaLibre, viaGoogle, viaMyMemory]
      : prefs.engine === 'mymemory' ? [viaMyMemory, viaGoogle]
      : [viaGoogle, viaMyMemory];
    let lastErr;
    for (const fn of chain) { try { return await fn(text, from, to); } catch (e) { lastErr = e; } }
    throw lastErr || new Error('translation failed');
  }

  /* ---------------- Script-based language hints ---------------- */
  // Cheap, offline: decides the speaker when the two languages use different scripts.
  function scriptOf(text) {
    if (/[一-鿿]/.test(text)) return 'han';
    if (/[぀-ヿ]/.test(text)) return 'kana';
    if (/[가-힯]/.test(text)) return 'hangul';
    if (/[฀-๿]/.test(text)) return 'thai';
    if (/[ऀ-ॿ]/.test(text)) return 'deva';
    if (/[ঀ-৿]/.test(text)) return 'beng';
    if (/[؀-ۿ]/.test(text)) return 'arab';
    if (/[֐-׿]/.test(text)) return 'hebr';
    if (/[Ѐ-ӿ]/.test(text)) return 'cyrl';
    if (/[Ͱ-Ͽ]/.test(text)) return 'greek';
    return 'latin';
  }
  const SCRIPT_OF_LANG = { 'zh-CN': 'han', ja: 'kana', ko: 'hangul', th: 'thai', hi: 'deva', bn: 'beng', ar: 'arab', ur: 'arab', fa: 'arab', he: 'hebr', ru: 'cyrl', uk: 'cyrl', el: 'greek' };
  const langScript = (code) => SCRIPT_OF_LANG[code] || 'latin';

  /* ---------------- Talk-back voices ----------------
     "Studio" = Kokoro-82M (Apache-2.0, hexgrad) running in the browser via kokoro-js + ONNX.
     ~90 MB model, downloaded once and cached. Falls back to the device's own voices for
     languages Kokoro doesn't cover, or if the model can't load. */
  const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
  const KOKORO_CDN = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
  // id, label, lang (base), gender
  const KVOICES = [
    ['af_heart', 'Heart', 'en', 'F'], ['af_bella', 'Bella', 'en', 'F'], ['af_nicole', 'Nicole', 'en', 'F'], ['af_sarah', 'Sarah', 'en', 'F'], ['af_sky', 'Sky', 'en', 'F'],
    ['am_adam', 'Adam', 'en', 'M'], ['am_michael', 'Michael', 'en', 'M'], ['am_fenrir', 'Fenrir', 'en', 'M'], ['am_puck', 'Puck', 'en', 'M'],
    ['bf_emma', 'Emma · UK', 'en', 'F'], ['bf_isabella', 'Isabella · UK', 'en', 'F'], ['bm_george', 'George · UK', 'en', 'M'], ['bm_lewis', 'Lewis · UK', 'en', 'M'],
    ['ef_dora', 'Dora', 'es', 'F'], ['em_alex', 'Alex', 'es', 'M'],
    ['pf_dora', 'Dora · BR', 'pt', 'F'], ['pm_alex', 'Alex · BR', 'pt', 'M'],
    ['ff_siwis', 'Siwis', 'fr', 'F'],
    ['if_sara', 'Sara', 'it', 'F'], ['im_nicola', 'Nicola', 'it', 'M'],
    ['hf_alpha', 'Alpha', 'hi', 'F'], ['hm_omega', 'Omega', 'hi', 'M'],
    ['jf_alpha', 'Alpha', 'ja', 'F'], ['jm_kumo', 'Kumo', 'ja', 'M'],
    ['zf_xiaoxiao', 'Xiaoxiao', 'zh', 'F'], ['zm_yunxi', 'Yunxi', 'zh', 'M'],
  ];
  const KLANGS = ['en', 'es', 'pt', 'fr', 'it', 'hi', 'ja', 'zh'];
  const Voice = (() => {
    let tts = null, loading = null, failed = false, queue = [], playing = false, current = null;
    const voiceFor = (lang) => {
      const b = base(lang); const pick = KVOICES.find((v) => v[0] === (prefs.voices || {})[b]);
      return (pick && pick[2] === b) ? pick[0] : (KVOICES.find((v) => v[2] === b) || [null])[0];
    };
    async function load(onProgress) {
      if (tts) return tts; if (failed) throw new Error('kokoro unavailable'); if (loading) return loading;
      loading = (async () => {
        const mod = await import(KOKORO_CDN);
        const device = (navigator.gpu ? 'webgpu' : 'wasm');
        const opts = { dtype: device === 'webgpu' ? 'fp32' : 'q8', device, progress_callback: (p) => { if (onProgress && p && p.status === 'progress' && p.progress != null) onProgress(p.progress); } };
        try { tts = await mod.KokoroTTS.from_pretrained(KOKORO_MODEL, opts); }
        catch (e) { if (device === 'webgpu') { opts.device = 'wasm'; opts.dtype = 'q8'; tts = await mod.KokoroTTS.from_pretrained(KOKORO_MODEL, opts); } else throw e; }
        return tts;
      })().catch((e) => { failed = true; loading = null; throw e; });
      return loading;
    }
    function browserSpeak(text, lang) {
      return new Promise((res) => {
        if (!('speechSynthesis' in window)) return res();
        try {
          const u = new SpeechSynthesisUtterance(text); u.lang = byCode(lang).sr; u.rate = 1.03;
          const want = (prefs.browserVoices || {})[base(lang)];
          const vs = speechSynthesis.getVoices();
          const v = vs.find((x) => x.name === want) || vs.find((x) => x.lang && base(x.lang) === base(lang) && /premium|enhanced|neural|natural/i.test(x.name)) || vs.find((x) => x.lang && base(x.lang) === base(lang));
          if (v) u.voice = v; u.onend = res; u.onerror = res; speechSynthesis.speak(u);
        } catch (e) { res(); }
      });
    }
    async function kokoroSpeak(text, lang) {
      const voice = voiceFor(lang); if (!voice) return browserSpeak(text, lang);
      let model;
      try { model = await load((p) => setBusy(true, 'Downloading voice ' + Math.round(p) + '%')); }
      catch (e) { toast('Studio voice unavailable, using device voice'); return browserSpeak(text, lang); }
      try {
        const audio = await model.generate(text, { voice });
        const blob = audio.toBlob ? audio.toBlob() : new Blob([audio.toWav()], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        await new Promise((res) => { const a = new Audio(url); current = a; a.onended = () => { URL.revokeObjectURL(url); res(); }; a.onerror = () => { URL.revokeObjectURL(url); res(); }; a.play().catch(() => res()); });
      } catch (e) { return browserSpeak(text, lang); }
    }
    function setBusy(on, label) { const b = $('speak-btn'); if (b) { b.classList.toggle('busy', !!on); if (label) setStatus(label); } }
    async function drain() {
      if (playing) return; playing = true;
      while (queue.length) {
        const { text, lang } = queue.shift();
        setBusy(true);
        if (prefs.voiceEngine === 'browser' || !KLANGS.includes(base(lang))) await browserSpeak(text, lang); else await kokoroSpeak(text, lang);
        setBusy(false);
      }
      playing = false;
    }
    function speak(text, lang) { if (!prefs.speak || !text) return; queue.push({ text, lang }); drain(); }
    function stop() { queue = []; try { speechSynthesis && speechSynthesis.cancel(); } catch (e) {} try { if (current) { current.pause(); current = null; } } catch (e) {} }
    function warm() { if (prefs.speak && prefs.voiceEngine !== 'browser') load((p) => { const b = $('voice-dl'); if (b) b.style.width = p + '%'; }).catch(() => {}); }
    return { speak, stop, warm, load, voiceFor, ready: () => !!tts };
  })();
  function speak(text, lang) { Voice.speak(text, lang); }

  /* ---------------- Voxel waveform (Three.js) ---------------- */
  const Wave = (() => {
    let renderer, scene, camera, mesh, cols = 56, rows = 7, dummy, colorA, colorB, colorBase, analyser, data, raf, active = false, mix = 0, targetMix = 0, level = 0;
    const heights = new Float32Array(cols);
    function init(canvas) {
      if (!window.THREE || renderer) return;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-cols / 2, cols / 2, rows, -rows, -50, 50);
      camera.position.set(0, 6, 20); camera.lookAt(0, 0, 0);
      const geo = new THREE.BoxGeometry(0.72, 0.72, 0.72);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
      mesh = new THREE.InstancedMesh(geo, mat, cols * rows);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(-4, 10, 12); scene.add(dl);
      dummy = new THREE.Object3D();
      colorA = new THREE.Color(0xd9ff3b); colorB = new THREE.Color(0x2f6bff); colorBase = new THREE.Color(0x1d1d22);
      resize(); window.addEventListener('resize', resize);
      // Instance colors
      const c = new THREE.Color();
      for (let i = 0; i < cols * rows; i++) mesh.setColorAt(i, c.copy(colorBase));
      mesh.instanceColor.needsUpdate = true;
    }
    function resize() { if (!renderer) return; const c = renderer.domElement; const w = c.clientWidth || 300, h = c.clientHeight || 96; renderer.setSize(w, h, false); const aspect = w / h; camera.left = -cols / 2; camera.right = cols / 2; camera.top = (cols / 2) / aspect; camera.bottom = -(cols / 2) / aspect; camera.updateProjectionMatrix(); }
    function attach(stream) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; const ctx = new AC();
        const src = ctx.createMediaStreamSource(stream); analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78; src.connect(analyser);
        data = new Uint8Array(analyser.frequencyBinCount);
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { analyser = null; }
    }
    function setSpeaker(who) { targetMix = who === 'b' ? 1 : 0; }
    function frame(t) {
      if (!active) return; raf = requestAnimationFrame(frame);
      if (!renderer) return;
      mix += (targetMix - mix) * 0.08;
      let sum = 0;
      if (analyser) { analyser.getByteFrequencyData(data); for (let i = 0; i < 48; i++) sum += data[i]; level = sum / (48 * 255); }
      else level = 0.05;
      const tint = colorA.clone().lerp(colorB, mix);
      const c = new THREE.Color();
      for (let x = 0; x < cols; x++) {
        let v;
        if (analyser) { const bin = Math.floor((x / cols) * 40) + 1; v = data[bin] / 255; }
        else v = 0.08 + 0.06 * Math.sin(t / 420 + x * 0.35);
        // Mirror around the center so it reads as a waveform
        const d = Math.abs(x - cols / 2) / (cols / 2); v = v * (1 - d * 0.55) + 0.04;
        heights[x] += (v - heights[x]) * 0.25;
        const lit = Math.round(heights[x] * rows);
        for (let y = 0; y < rows; y++) {
          const i = x * rows + y; const on = y < lit;
          const yy = (y - rows / 2 + 0.5) * 0.95;
          dummy.position.set(x - cols / 2 + 0.5, yy, on ? Math.sin(t / 600 + x * 0.3) * 0.6 : 0);
          const s = on ? 1 : 0.55; dummy.scale.set(s, s, s); dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          const fade = on ? 0.55 + 0.45 * (1 - y / rows) : 0;
          c.copy(colorBase).lerp(tint, fade);
          mesh.setColorAt(i, c);
        }
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      renderer.render(scene, camera);
    }
    function start(canvas) { init(canvas); active = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    function stop() { active = false; cancelAnimationFrame(raf); analyser = null; }
    return { start, stop, attach, setSpeaker, level: () => level };
  })();

  /* ---------------- Live session ---------------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const live = {
    on: false, rec: null, stream: null, recorder: null, chunks: [], startedAt: 0, timerId: null,
    expected: 'a', lines: [], interimEl: null, forced: null, netErrors: 0, levelId: null, silenceId: null, interimTid: null, detected: null, detectPending: null, carry: null, convoId: null,
  };
  const langOf = (who) => who === 'a' ? prefs.langA : prefs.langB;
  const other = (who) => who === 'a' ? 'b' : 'a';

  const BG = window.GlyphBG ? GlyphBG.mount($('app-bg'), { tilt: 0.25, dim: 0.75, maxDpr: 1.25 }) : null;
  const VOLT_RGB = [0.85, 1.0, 0.23], BLUE_RGB = [0.18, 0.42, 1.0];
  function setStatus(text, who) { const s = $('stage-status'); s.textContent = text; s.className = 'stage-status' + (who ? ' ' + who : ''); }
  function showError(msg) { const s = $('stage-status'); s.textContent = msg; s.className = 'stage-status err'; toast(msg); }
  function setExpected(who, forced) {
    live.expected = who; if (forced !== undefined) live.forced = forced;
    $('who-a').classList.toggle('is-live', who === 'a'); $('who-b').classList.toggle('is-live', who === 'b');
    Wave.setSpeaker(who); if (BG) BG.setTint(who === 'b' ? BLUE_RGB : VOLT_RGB, 0.85);
    setStatus('Listening · ' + byCode(langOf(who)).name, who);
  }

  function makeBubble(who, orig, trans, interim) {
    const b = el('div', 'bubble ' + who + (interim ? ' interim' : ''));
    const o = el('div', 'orig', orig || ''); const t = el('div', 'trans', trans || ''); b.appendChild(o); b.appendChild(t);
    const m = el('div', 'meta', byCode(langOf(who)).short + ' → ' + byCode(langOf(other(who))).short); b.appendChild(m);
    return b;
  }
  function appendBubble(node) { const c = $('convo'); const hint = $('convo-hint'); if (hint) hint.remove(); c.appendChild(node); c.scrollTop = c.scrollHeight; return node; }

  /* ---- Early language detection: decide the speaker from the first two words ---- */
  // Tiny offline lexicon of very common function words. Instant, no network. Covers the
  // same-alphabet pairs where script detection can't help (EN/ES/PT/FR/DE/IT...).
  const LEX = {
    en: 'the a an and is are i you we they it this that what where how yes no hello hi thanks thank please can do have want need my your of to in on for with',
    es: 'el la los las un una y es son yo tú usted nosotros ellos esto eso qué dónde cómo sí no hola gracias por favor puedo tengo quiero necesito mi tu de a en con para buenos buenas',
    pt: 'o a os as um uma e é são eu você nós eles isto isso que onde como sim não olá obrigado obrigada por favor posso tenho quero preciso meu minha seu sua de em com para bom boa',
    fr: 'le la les un une et est sont je tu vous nous ils ceci cela que où comment oui non bonjour merci s\'il peux j\'ai veux besoin mon ma votre de à en avec pour',
    de: 'der die das ein eine und ist sind ich du sie wir dies was wo wie ja nein hallo danke bitte kann habe will brauche mein dein von zu in mit für',
    it: 'il la lo gli le un una e è sono io tu lei noi loro questo quello che dove come sì no ciao grazie per favore posso ho voglio bisogno mio tuo di a in con per buongiorno',
    nl: 'de het een en is zijn ik jij u wij zij dit dat wat waar hoe ja nee hallo dank bedankt alsjeblieft kan heb wil nodig mijn jouw van naar in met voor',
    id: 'yang dan ini itu saya anda kami mereka apa di mana bagaimana ya tidak halo terima kasih tolong bisa punya mau perlu saya ke dari dengan untuk selamat',
    ms: 'yang dan ini itu saya awak kami mereka apa di mana bagaimana ya tidak helo terima kasih tolong boleh ada mahu perlu ke dari dengan untuk selamat',
    tr: 'bir ve bu şu ben sen biz onlar ne nerede nasıl evet hayır merhaba teşekkür lütfen var yok istiyorum benim senin için ile',
    sw: 'na ni hii hiyo mimi wewe sisi wao nini wapi vipi ndiyo hapana habari asante tafadhali naweza nina nataka yangu yako kwa',
    tl: 'ang ng mga at ay ako ikaw kami sila ito iyon ano saan paano oo hindi kumusta salamat paki pwede may gusto ko mo sa para',
    pl: 'i jest są ja ty my oni to co gdzie jak tak nie cześć dziękuję proszę mogę mam chcę potrzebuję mój twój z do w na dla',
    sv: 'och är jag du vi de det här vad var hur ja nej hej tack snälla kan har vill behöver min din av till i med för',
    vi: 'và là tôi bạn chúng họ này đó gì đâu sao vâng không xin chào cảm ơn làm ơn có thể muốn cần của với cho',
  };
  const LEXSET = {}; Object.keys(LEX).forEach((k) => { LEXSET[k] = new Set(LEX[k].split(' ')); });
  function lexScore(words, code) { const s = LEXSET[base(code)]; if (!s) return 0; let n = 0; for (const w of words) if (s.has(w)) n++; return n; }
  // Returns 'a' | 'b' | null — null means "can't tell offline".
  function guessOffline(text) {
    const sA = langScript(prefs.langA), sB = langScript(prefs.langB), sT = scriptOf(text);
    if (sA !== sB) { if (sT === sA) return 'a'; if (sT === sB) return 'b'; return null; }
    const words = text.toLowerCase().replace(/[^\p{L}\p{M}' ]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 4);
    if (!words.length) return null;
    const a = lexScore(words, prefs.langA), b = lexScore(words, prefs.langB);
    if (a > b) return 'a'; if (b > a) return 'b'; return null;
  }
  // Online: ask the translator to detect from the first two words. Cached per utterance.
  async function guessOnline(firstWords) {
    try {
      const r = await translate(firstWords, 'auto', langOf('b'));
      const d = base(r.detected || '');
      if (d && d === base(prefs.langA) && d !== base(prefs.langB)) return 'a';
      if (d && d === base(prefs.langB) && d !== base(prefs.langA)) return 'b';
    } catch (e) {}
    return null;
  }
  function wordCount(t) { return t.trim().split(/\s+/).filter(Boolean).length; }

  // Called as soon as two words are in. Decides speaker, recolors the bubble, swaps recognizer if needed.
  async function earlyDetect(interim) {
    if (live.forced || live.detected) return;
    const firstTwo = interim.trim().split(/\s+/).slice(0, 2).join(' ');
    let who = guessOffline(firstTwo);
    if (!who) {
      live.detectPending = firstTwo;
      who = await guessOnline(firstTwo);
      if (live.detectPending !== firstTwo || live.detected) return; // a newer utterance superseded this
      live.detectPending = null;
    }
    if (!who) return;
    live.detected = who;
    if (live.interimEl) { live.interimEl.className = 'bubble ' + who + ' interim'; live.interimEl.querySelector('.meta').textContent = byCode(langOf(who)).short + ' → ' + byCode(langOf(other(who))).short; }
    if (who !== live.expected) {
      // Wrong speaker guessed: switch recognizer to the right language now, keeping what we already heard.
      live.carry = interim.trim();
      setExpected(who); startRecognizer(langOf(who));
    } else setStatus('Hearing ' + byCode(langOf(who)).name + '…', who);
  }

  function startRecognizer(lang) {
    if (!SR || !live.on) return;
    try { if (live.rec) { live.rec.onend = null; live.rec.abort(); } } catch (e) {}
    const r = new SR(); live.rec = r;
    r.lang = byCode(lang).sr; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (ev) => {
      let interim = '', finals = [];
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const res = ev.results[i]; if (res.isFinal) finals.push(res[0].transcript.trim()); else interim += res[0].transcript; }
      interim = interim.trim();
      if (interim) {
        const shown = live.carry ? (live.carry + ' ' + interim) : interim;
        if (!live.interimEl) live.interimEl = appendBubble(makeBubble(live.detected || live.expected, '', shown, true));
        else { live.interimEl.querySelector('.trans').textContent = shown; $('convo').scrollTop = $('convo').scrollHeight; }
        if (!live.detected) { if (wordCount(interim) >= 2) earlyDetect(interim); else setStatus('Hearing…', live.expected); }
        scheduleInterimTranslate(shown);
        // Snappy turns: if the interim text stops changing, force the final now instead of waiting for the engine.
        if (prefs.fast) { clearTimeout(live.silenceId); live.silenceId = setTimeout(() => { if (live.on && live.rec === r && live.interimEl) { try { r.stop(); } catch (e) {} } }, 650); }
      }
      for (const f of finals) if (f) handleFinal(live.carry ? (live.carry + ' ' + f) : f);
    };
    r.onerror = (ev) => {
      const e = ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed') { showError('Microphone blocked. Allow it in your browser settings, then restart.'); stopLive(); return; }
      if (e === 'network') { live.netErrors++; if (live.netErrors >= 3) { showError(location.protocol === 'file:' ? 'Speech needs a web address. Open Parley over http(s), not as a file.' : 'Speech service unreachable. Check your connection.'); live.netErrors = 0; } return; }
      if (e === 'audio-capture') { showError('No microphone found.'); return; }
      if (e === 'language-not-supported') { showError(byCode(lang).name + ' speech is not supported in this browser.'); return; }
      /* no-speech / aborted: restart in onend */
    };
    r.onend = () => { if (live.on && live.rec === r) setTimeout(() => { if (live.on && live.rec === r) startRecognizer(langOf(live.expected)); }, 120); };
    try { r.start(); } catch (e) {}
  }

  // Translate the in-progress sentence every ~300ms so the translation is on screen before the person finishes.
  const interimCache = new Map();
  function scheduleInterimTranslate(text) {
    clearTimeout(live.interimTid);
    live.interimTid = setTimeout(async () => {
      if (!live.on || !live.interimEl) return;
      const who = live.detected || live.expected; const to = langOf(other(who));
      const key = text + '|' + to; if (interimCache.has(key)) return;
      try {
        const r = await translate(text, langOf(who), to);
        interimCache.set(key, r);
        if (live.interimEl && live.interimEl.querySelector('.trans').textContent.startsWith(text.slice(0, 12))) {
          live.interimEl.querySelector('.orig').textContent = text;
          const t = live.interimEl.querySelector('.trans'); t.textContent = r.text; t.classList.add('pending');
          $('convo').scrollTop = $('convo').scrollHeight;
        }
      } catch (e) {}
    }, 300);
  }

  async function handleFinal(text) {
    clearTimeout(live.silenceId); clearTimeout(live.interimTid);
    // Speaker priority: manual tap > early detection (first two words) > offline guess on full text > turn-taking
    const guess = live.forced || live.detected || guessOffline(text) || live.expected;
    const node = live.interimEl || appendBubble(makeBubble(guess, '', text, true));
    live.interimEl = null; live.carry = null; live.detected = null; live.detectPending = null;
    node.className = 'bubble ' + guess + ' interim';
    node.querySelector('.trans').textContent = text;
    setStatus('Translating…', guess);
    const t0 = Date.now() - live.startedAt;

    let who = guess, result = null;
    const cached = interimCache.get(text + '|' + langOf(other(who)));
    try {
      result = cached || await translate(text, 'auto', langOf(other(who)));
      // Safety net: if the translator is sure it was the other language, flip once.
      if (!live.forced && result.detected) {
        const d = base(result.detected);
        if (d === base(langOf(other(who))) && d !== base(langOf(who))) { who = other(who); result = await translate(text, langOf(who), langOf(other(who))); }
      }
    } catch (e) {
      node.className = 'bubble ' + who; node.querySelector('.orig').textContent = text; node.querySelector('.trans').textContent = '(translation unavailable — check your connection)';
      setExpected(other(who)); return;
    }
    node.className = 'bubble ' + who;
    node.querySelector('.orig').textContent = text;
    node.querySelector('.trans').textContent = result.text; node.querySelector('.trans').classList.remove('pending');
    node.querySelector('.meta').textContent = byCode(langOf(who)).short + ' → ' + byCode(langOf(other(who))).short;
    $('convo').scrollTop = $('convo').scrollHeight;
    live.lines.push({ who, orig: text, trans: result.text, from: langOf(who), to: langOf(other(who)), t: t0 });
    speak(result.text, langOf(other(who)));
    live.forced = null;
    // Expect the other person next (turn-taking). Restart recognizer in their language.
    const next = other(who);
    if (next !== live.expected || langOf(who) !== langOf(next)) { setExpected(next); startRecognizer(langOf(next)); } else setExpected(next);
  }

  async function startLive() {
    if (!SR) { toast('This browser has no speech recognition. Use Chrome or Safari.'); return; }
    if (prefs.langA === prefs.langB) { toast('Pick two different languages.'); return; }
    live.on = true; live.netErrors = 0; live.lines = []; live.chunks = []; live.startedAt = Date.now(); live.convoId = 'c_' + live.startedAt; live.forced = null; live.detected = null; live.carry = null; live.detectPending = null;
    $('live-setup').hidden = true; $('live-stage').hidden = false;
    $('convo').innerHTML = '<p class="convo-hint" id="convo-hint">Start talking. Either of you.</p>';
    $('who-a-label').textContent = byCode(prefs.langA).short; $('who-b-label').textContent = byCode(prefs.langB).short;
    Wave.start($('wave')); renderSpeakBtn(); Voice.warm();
    setExpected('a'); startRecognizer(prefs.langA);
    // Open the audio stream after speech has started (Safari dislikes the reverse order).
    try { live.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); Wave.attach(live.stream); }
    catch (e) { live.stream = null; toast('Mic stream unavailable — transcription still runs, no waveform or recording.'); }
    live.levelId = setInterval(() => { if (BG) BG.setEnergy(Math.min(1, Wave.level() * 2.2)); }, 80);
    // Recording
    if (live.stream && prefs.record && 'MediaRecorder' in window) {
      try { const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'].find((m) => MediaRecorder.isTypeSupported(m)) || ''; live.recorder = new MediaRecorder(live.stream, mime ? { mimeType: mime } : undefined); live.recorder.ondataavailable = (e) => { if (e.data && e.data.size) live.chunks.push(e.data); }; live.recorder.start(1000); $('rec-dot').classList.remove('off'); }
      catch (e) { live.recorder = null; $('rec-dot').classList.add('off'); }
    } else { live.recorder = null; $('rec-dot').classList.add('off'); }
    live.timerId = setInterval(() => { $('stage-timer').textContent = fmtTimer((Date.now() - live.startedAt) / 1000); }, 500);
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
  }

  async function stopLive() {
    if (!live.on) return;
    live.on = false; clearInterval(live.timerId); clearInterval(live.levelId); clearTimeout(live.silenceId); clearTimeout(live.interimTid); interimCache.clear(); Voice.stop(); if (BG) { BG.setEnergy(0); BG.setTint(null, 0); }
    try { if (live.rec) { live.rec.onend = null; live.rec.stop(); } } catch (e) {}
    let audioBlob = null;
    if (live.recorder && live.recorder.state !== 'inactive') {
      await new Promise((res) => { live.recorder.onstop = res; try { live.recorder.stop(); } catch (e) { res(); } });
    }
    if (live.chunks.length) audioBlob = new Blob(live.chunks, { type: live.chunks[0].type || 'audio/webm' });
    try { live.stream && live.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    Wave.stop();
    const duration = (Date.now() - live.startedAt) / 1000;
    if (live.lines.length) {
      const first = live.lines[0];
      const title = (first.orig.length > 42 ? first.orig.slice(0, 42).trim() + '…' : first.orig);
      const ok = await dbPut({ id: live.convoId, startedAt: live.startedAt, duration, langA: prefs.langA, langB: prefs.langB, title, lines: live.lines, audio: audioBlob, mime: audioBlob ? audioBlob.type : null });
      if (ok) { await enforceLimit(); toast('Conversation saved'); } else toast('Could not save on this device');
    }
    $('live-stage').hidden = true; $('live-setup').hidden = false;
    renderHistory();
  }

  /* ---------------- Views ---------------- */
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + name));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.view === name));
    if (name === 'history') renderHistory();
    if (name === 'profile') renderProfile();
  }
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { if (live.on && b.dataset.view !== 'live') { toast('End the conversation first'); return; } showView(b.dataset.view); }));

  /* ---------------- Sheets ---------------- */
  let openSheet = null;
  function sheetOpen(id) { sheetClose(); $('sheet-backdrop').hidden = false; $(id).hidden = false; openSheet = id; }
  function sheetClose() { $('sheet-backdrop').hidden = true; if (openSheet) $(openSheet).hidden = true; openSheet = null; }
  $('sheet-backdrop').addEventListener('click', sheetClose);
  // Swipe down to dismiss
  document.querySelectorAll('.sheet').forEach((s) => { let y0 = null; s.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true }); s.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 80 && s.scrollTop === 0) sheetClose(); y0 = null; }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') sheetClose(); });

  // Language picker
  let pickTarget = 'a';
  function renderLangList(filter) {
    const list = $('lang-list'); list.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    const current = pickTarget === 'a' ? prefs.langA : pickTarget === 'b' ? prefs.langB : prefs.langA;
    LANGS.filter((l) => !q || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.includes(q)).forEach((l) => {
      const row = el('button', 'lang-row' + (l.code === current ? ' is-selected' : '') + (pickTarget === 'b' ? ' b' : ''));
      row.appendChild(el('span', 'lang-code', l.short));
      const mid = el('span'); mid.appendChild(el('div', 'lang-name', l.name)); mid.appendChild(el('div', 'lang-native', l.native)); row.appendChild(mid);
      row.appendChild(el('span', 'lang-check'));
      row.addEventListener('click', () => {
        if (pickTarget === 'a') prefs.langA = l.code; else if (pickTarget === 'b') prefs.langB = l.code; else { prefs.langA = l.code; }
        savePrefs(); renderSetup(); renderProfile(); sheetClose();
      });
      list.appendChild(row);
    });
  }
  function openLangPicker(target, title) { pickTarget = target; $('sheet-title').textContent = title; $('lang-search').value = ''; renderLangList(''); sheetOpen('lang-sheet'); setTimeout(() => { if (window.innerWidth > 720) $('lang-search').focus(); }, 50); }
  $('lang-search').addEventListener('input', (e) => renderLangList(e.target.value));
  $('pick-a').addEventListener('click', () => openLangPicker('a', 'Person 1 speaks…'));
  $('pick-b').addEventListener('click', () => openLangPicker('b', 'Person 2 speaks…'));
  $('swap-langs').addEventListener('click', () => { const t = prefs.langA; prefs.langA = prefs.langB; prefs.langB = t; savePrefs(); renderSetup(); });

  function renderSetup() {
    const a = byCode(prefs.langA), b = byCode(prefs.langB);
    $('label-a').textContent = a.native; $('native-a').textContent = a.name;
    $('label-b').textContent = b.native; $('native-b').textContent = b.name;
    $('opt-speak').checked = !!prefs.speak; $('opt-record').checked = !!prefs.record; $('opt-fast').checked = prefs.fast !== false;
    const note = $('support-note');
    if (!SR) { note.textContent = 'Live speech needs Chrome, Edge, or Safari. Firefox does not support speech recognition yet.'; note.classList.add('warn'); }
    else note.textContent = 'Works best within arm\'s reach. Parley picks the language from the first two words. If it ever guesses wrong, tap the language chip.';
  }
  if (location.protocol === 'file:') { const n = $('origin-note'); n.hidden = false; n.innerHTML = 'Opened as a file, so speech and translation will not run. Serve it instead: in the folder run <code>npx serve</code> (or <code>python3 -m http.server</code>) and open the http://localhost address it prints. Deployed to Vercel this is automatic.'; }
  $('type-btn').addEventListener('click', () => { const row = $('type-row'); row.hidden = !row.hidden; $('type-btn').classList.toggle('on', !row.hidden); if (!row.hidden) $('type-input').focus(); });
  $('type-row').addEventListener('submit', (e) => { e.preventDefault(); const t = $('type-input').value.trim(); if (!t || !live.on) return; $('type-input').value = ''; live.interimEl = null; live.detected = null; handleFinal(t); });
  function renderSpeakBtn() { const b = $('speak-btn'); b.classList.toggle('on', !!prefs.speak); b.setAttribute('aria-pressed', String(!!prefs.speak)); }
  $('speak-btn').addEventListener('click', () => { prefs.speak = !prefs.speak; savePrefs(); renderSpeakBtn(); $('opt-speak').checked = prefs.speak; if (!prefs.speak) Voice.stop(); else Voice.warm(); toast(prefs.speak ? 'Talk-back on' : 'Talk-back off'); });
  $('opt-speak').addEventListener('change', (e) => { prefs.speak = e.target.checked; savePrefs(); if (prefs.speak) Voice.warm(); });
  $('opt-fast').addEventListener('change', (e) => { prefs.fast = e.target.checked; savePrefs(); });
  $('opt-record').addEventListener('change', (e) => { prefs.record = e.target.checked; savePrefs(); });
  $('start-live').addEventListener('click', startLive);
  $('stop-live').addEventListener('click', stopLive);
  $('who-a').addEventListener('click', () => { if (!live.on) return; live.detected = 'a'; live.carry = null; setExpected('a', 'a'); startRecognizer(prefs.langA); });
  $('who-b').addEventListener('click', () => { if (!live.on) return; live.detected = 'b'; live.carry = null; setExpected('b', 'b'); startRecognizer(prefs.langB); });
  window.addEventListener('beforeunload', () => { if (live.on) stopLive(); });

  /* ---------------- History ---------------- */
  function groupLabel(ts) {
    const d = new Date(ts), now = new Date(); const day = 86400000;
    const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), sn = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diff = Math.round((sn - sd) / day);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday'; if (diff < 7) return 'This week'; if (diff < 31) return 'This month'; return 'Earlier';
  }
  async function renderHistory() {
    const list = $('history-list'); list.innerHTML = '';
    const all = (await dbAll()).sort((a, b) => b.startedAt - a.startedAt);
    $('history-count').textContent = prefs.pro ? all.length + ' saved' : all.length + ' / ' + FREE_LIMIT + ' saved';
    $('pro-card').hidden = !!prefs.pro;
    if (!all.length) { list.appendChild(el('div', 'history-empty', 'No conversations yet. Your next one shows up here.')); return; }
    let lastGroup = null;
    all.forEach((c) => {
      const g = groupLabel(c.startedAt); if (g !== lastGroup) { list.appendChild(el('div', 'history-group', g)); lastGroup = g; }
      const item = el('button', 'history-item');
      const pair = el('span', 'hi-pair'); pair.appendChild(el('span', 'pa')); pair.appendChild(el('span', 'pb')); item.appendChild(pair);
      const mid = el('span'); mid.appendChild(el('div', 'hi-title', c.title || 'Conversation'));
      mid.appendChild(el('div', 'hi-sub', byCode(c.langA).short + ' ↔ ' + byCode(c.langB).short + ' · ' + c.lines.length + ' lines' + (c.audio ? ' · audio' : ''))); item.appendChild(mid);
      item.appendChild(el('span', 'hi-time', new Date(c.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })));
      item.addEventListener('click', () => openPlayback(c));
      list.appendChild(item);
    });
  }
  $('go-pro').addEventListener('click', () => { toast('Pro is coming soon. Free keeps your last 5.'); });

  /* ---------------- Playback ---------------- */
  const pb = { c: null, audio: null, url: null, raf: null, playing: false, start: 0, elapsed: 0 };
  function openPlayback(c) {
    pb.c = c; closeAudio();
    $('pb-date').textContent = new Date(c.startedAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    $('pb-title').textContent = c.title || 'Conversation';
    $('pb-noaudio').hidden = !!c.audio;
    $('pb-dur').textContent = fmtTime(c.duration);
    if (c.audio) { pb.url = URL.createObjectURL(c.audio); pb.audio = new Audio(pb.url); pb.audio.addEventListener('ended', () => { pb.playing = false; $('pb-play').classList.remove('playing'); }); }
    renderPlaybackLines(0);
    showView('playback');
  }
  function closeAudio() { if (pb.audio) { try { pb.audio.pause(); } catch (e) {} } if (pb.url) URL.revokeObjectURL(pb.url); pb.audio = null; pb.url = null; pb.playing = false; cancelAnimationFrame(pb.raf); pb.elapsed = 0; $('pb-play').classList.remove('playing'); $('pb-scrub').value = 0; $('pb-cur').textContent = '0:00'; }
  function renderPlaybackLines(timeMs) {
    const box = $('pb-convo'); const liveMode = $('pb-livemode').checked;
    if (!box.childElementCount) {
      pb.c.lines.forEach((l) => {
        const b = el('div', 'bubble ' + l.who); b.appendChild(el('div', 'orig', l.orig)); b.appendChild(el('div', 'trans', l.trans)); b.appendChild(el('div', 'meta', byCode(l.from).short + ' → ' + byCode(l.to).short + ' · ' + fmtTime(l.t / 1000))); b.dataset.t = l.t; box.appendChild(b);
      });
    }
    box.querySelectorAll('.bubble').forEach((b) => { b.classList.toggle('hidden-replay', liveMode && Number(b.dataset.t) > timeMs); });
  }
  function tickPlayback() {
    const cur = pb.audio ? pb.audio.currentTime : (Date.now() - pb.start) / 1000;
    const dur = pb.c.duration || 1;
    $('pb-scrub').value = Math.min(1000, Math.round((cur / dur) * 1000)); $('pb-cur').textContent = fmtTime(cur);
    renderPlaybackLines(cur * 1000);
    if (!pb.audio && cur >= dur) { pb.playing = false; $('pb-play').classList.remove('playing'); return; }
    if (pb.playing) pb.raf = requestAnimationFrame(tickPlayback);
  }
  $('pb-play').addEventListener('click', () => {
    if (!pb.c) return;
    if (pb.playing) { pb.playing = false; if (pb.audio) pb.audio.pause(); else pb.elapsed = (Date.now() - pb.start) / 1000; $('pb-play').classList.remove('playing'); cancelAnimationFrame(pb.raf); return; }
    pb.playing = true; $('pb-play').classList.add('playing');
    if (pb.audio) pb.audio.play().catch(() => {}); else pb.start = Date.now() - pb.elapsed * 1000;
    pb.raf = requestAnimationFrame(tickPlayback);
  });
  $('pb-scrub').addEventListener('input', (e) => { if (!pb.c) return; const frac = Number(e.target.value) / 1000; const t = frac * (pb.c.duration || 0); if (pb.audio) pb.audio.currentTime = t; else { pb.elapsed = t; pb.start = Date.now() - t * 1000; } $('pb-cur').textContent = fmtTime(t); renderPlaybackLines(t * 1000); });
  $('pb-livemode').addEventListener('change', () => { const cur = pb.audio ? pb.audio.currentTime : pb.elapsed; renderPlaybackLines(cur * 1000); });
  $('pb-back').addEventListener('click', () => { closeAudio(); $('pb-convo').innerHTML = ''; showView('history'); });
  $('pb-delete').addEventListener('click', () => confirmSheet('Delete this conversation?', 'Transcript and audio are removed from this device.', async () => { await dbDel(pb.c.id); closeAudio(); $('pb-convo').innerHTML = ''; toast('Deleted'); showView('history'); }));

  /* ---------------- Confirm ---------------- */
  let confirmCb = null;
  function confirmSheet(title, sub, cb) { $('confirm-title').textContent = title; $('confirm-sub').textContent = sub; confirmCb = cb; sheetOpen('confirm-sheet'); }
  $('confirm-no').addEventListener('click', sheetClose);
  $('confirm-yes').addEventListener('click', () => { const cb = confirmCb; confirmCb = null; sheetClose(); if (cb) cb(); });

  /* ---------------- Profile ---------------- */
  function renderProfile() {
    $('profile-avatar').innerHTML = avatarSVG(prefs.avatar); $('topbar-avatar').innerHTML = avatarSVG(prefs.avatar);
    $('profile-name-display').textContent = prefs.name || 'Traveler';
    $('profile-plan').textContent = prefs.pro ? 'Pro plan · unlimited history' : 'Free plan · 5 saved conversations';
    $('profile-lang-btn').textContent = byCode(prefs.langA).name;
    const sub = { auto: 'Auto (Google · MyMemory fallback)', mymemory: 'MyMemory', libre: 'LibreTranslate · ' + (prefs.libreUrl || 'not set') };
    $('engine-sub').textContent = sub[prefs.engine] || sub.auto;
    $('voice-sub').textContent = voiceLabel();
  }
  function renderAvatarGrid() {
    const g = $('avatar-grid'); g.innerHTML = '';
    AVATARS.forEach((_, i) => { const b = el('button', 'avatar-opt' + (i === prefs.avatar ? ' is-selected' : '')); b.innerHTML = avatarSVG(i); b.setAttribute('aria-label', 'Character ' + (i + 1)); b.addEventListener('click', () => { prefs.avatar = i; renderAvatarGrid(); }); g.appendChild(b); });
  }
  $('edit-profile').addEventListener('click', () => { $('profile-name-input').value = prefs.name || ''; renderAvatarGrid(); $('edit-panel').hidden = false; });
  $('cancel-profile').addEventListener('click', () => { $('edit-panel').hidden = true; try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) {} renderProfile(); });
  $('save-profile').addEventListener('click', () => { prefs.name = $('profile-name-input').value.trim() || 'Traveler'; savePrefs(); $('edit-panel').hidden = true; renderProfile(); toast('Profile saved'); });
  $('profile-lang-btn').addEventListener('click', () => openLangPicker('p', 'Your default language'));
  $('clear-all').addEventListener('click', () => confirmSheet('Clear all conversations?', 'Every transcript and recording on this device is removed.', async () => { await dbClear(); toast('Cleared'); renderHistory(); }));

  // Voice sheet
  function voiceLabel() {
    if (prefs.voiceEngine === 'browser') { const v = (prefs.browserVoices || {})[base(prefs.langA)]; return 'Device · ' + (v || 'auto'); }
    const id = Voice.voiceFor(prefs.langA) || 'auto'; const v = KVOICES.find((x) => x[0] === id); return 'Studio · ' + (v ? v[1] + ' (' + v[2].toUpperCase() + ')' : 'auto');
  }
  function renderVoiceSheet() {
    document.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.ve === prefs.voiceEngine));
    const note = $('voice-engine-note'), list = $('voice-list'); list.innerHTML = '';
    if (prefs.voiceEngine === 'kokoro') {
      note.innerHTML = 'Kokoro, open source, runs on your device. One ~90 MB download, then it works offline. Covers EN · ES · PT · FR · IT · HI · JA · ZH; other languages use device voices.<div class="dl-bar"><i id="voice-dl" style="width:' + (Voice.ready() ? 100 : 0) + '%"></i></div>';
      const langs = [...new Set(KVOICES.map((v) => v[2]))];
      langs.forEach((lg) => {
        list.appendChild(el('div', 'history-group', byCode(LANGS.find((l) => base(l.code) === lg).code).name));
        KVOICES.filter((v) => v[2] === lg).forEach((v) => {
          const sel = Voice.voiceFor(lg) === v[0];
          const row = el('button', 'lang-row voice-row' + (sel ? ' is-selected' : ''));
          row.appendChild(el('span', 'lang-code', lg.toUpperCase())); row.appendChild(el('span', 'lang-name', v[1])); row.appendChild(el('span', 'voice-tag', v[3] === 'F' ? 'Female' : 'Male')); row.appendChild(el('span', 'lang-check'));
          row.addEventListener('click', () => { prefs.voices = prefs.voices || {}; prefs.voices[lg] = v[0]; savePrefs(); renderVoiceSheet(); });
          list.appendChild(row);
        });
      });
    } else {
      note.textContent = 'Voices built into this phone or browser. Instant, no download. Quality varies by device.';
      const vs = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
      const codes = [prefs.langA, prefs.langB].map(base);
      codes.forEach((lg) => {
        const mine = vs.filter((v) => v.lang && base(v.lang) === lg);
        list.appendChild(el('div', 'history-group', byCode(LANGS.find((l) => base(l.code) === lg).code).name + (mine.length ? '' : ' · none installed')));
        mine.forEach((v) => {
          const sel = (prefs.browserVoices || {})[lg] === v.name;
          const row = el('button', 'lang-row voice-row' + (sel ? ' is-selected' : ''));
          row.appendChild(el('span', 'lang-code', lg.toUpperCase())); row.appendChild(el('span', 'lang-name', v.name.replace(/\(.*?\)/g, '').trim())); row.appendChild(el('span', 'voice-tag', v.localService ? 'local' : 'cloud')); row.appendChild(el('span', 'lang-check'));
          row.addEventListener('click', () => { prefs.browserVoices = prefs.browserVoices || {}; prefs.browserVoices[lg] = v.name; savePrefs(); renderVoiceSheet(); });
          list.appendChild(row);
        });
      });
    }
    $('voice-sub').textContent = voiceLabel();
  }
  $('voice-btn').addEventListener('click', () => { renderVoiceSheet(); sheetOpen('voice-sheet'); });
  document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => { prefs.voiceEngine = b.dataset.ve; savePrefs(); renderVoiceSheet(); }));
  $('voice-done').addEventListener('click', () => { sheetClose(); renderProfile(); });
  $('voice-preview').addEventListener('click', () => {
    const samples = { en: 'Hi, this is how I sound.', es: 'Hola, así es como sueno.', pt: 'Oi, é assim que eu soo.', fr: 'Salut, voilà comment je sonne.', it: 'Ciao, ecco come suono.', hi: 'नमस्ते, मेरी आवाज़ ऐसी है।', ja: 'こんにちは、こんな声です。', zh: '你好，我的声音是这样的。', de: 'Hallo, so klinge ich.', ko: '안녕하세요, 제 목소리예요.', th: 'สวัสดี นี่คือเสียงของฉัน' };
    const lg = base(prefs.langB) === 'en' ? prefs.langA : prefs.langB; const was = prefs.speak; prefs.speak = true; Voice.speak(samples[base(lg)] || samples.en, lg); prefs.speak = was;
  });
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { if (openSheet === 'voice-sheet') renderVoiceSheet(); };

  // Engine sheet
  function renderEngineSheet() { document.querySelectorAll('.engine-row').forEach((r) => r.classList.toggle('is-selected', r.dataset.engine === prefs.engine)); $('libre-field').classList.toggle('show', prefs.engine === 'libre'); $('libre-url').value = prefs.libreUrl || ''; $('libre-key').value = prefs.libreKey || ''; }
  $('engine-btn').addEventListener('click', () => { renderEngineSheet(); sheetOpen('engine-sheet'); });
  document.querySelectorAll('.engine-row').forEach((r) => r.addEventListener('click', () => { prefs.engine = r.dataset.engine; renderEngineSheet(); }));
  $('engine-save').addEventListener('click', () => { prefs.libreUrl = $('libre-url').value.trim(); prefs.libreKey = $('libre-key').value.trim(); if (prefs.engine === 'libre' && !prefs.libreUrl) { toast('Enter your LibreTranslate URL'); return; } savePrefs(); renderProfile(); sheetClose(); toast('Engine saved'); });

  /* ---------------- PWA ---------------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
  $('install-btn').addEventListener('click', async () => {
    if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; if (r && r.outcome === 'accepted') toast('Installed'); installEvt = null; return; }
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) { toast('Parley is already installed'); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(ios ? 'Safari: tap Share, then "Add to Home Screen"' : 'Use your browser menu: "Install app" or "Add to Home Screen"');
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(() => {}); }

  /* ---------------- Boot ---------------- */
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); } catch (e) {} }
  renderSetup(); renderProfile();
  const hash = (location.hash || '').replace('#', '');
  if (['history', 'profile'].includes(hash)) showView(hash);
  // ?demo=1 — preview the live screen with sample lines, no microphone
  if (/[?&]demo=1/.test(location.search)) {
    $('live-setup').hidden = true; $('live-stage').hidden = false; $('rec-dot').classList.add('off');
    $('who-a-label').textContent = byCode(prefs.langA).short; $('who-b-label').textContent = byCode(prefs.langB).short;
    Wave.start($('wave')); setExpected('b');
    [['a', 'Hey, is this table free?', 'Oye, ¿está libre esta mesa?'], ['b', 'Sí, siéntense. ¿Qué les traigo?', 'Yes, sit down. What can I get you?'], ['a', 'Two cold beers and the fish tacos.', 'Dos cervezas frías y los tacos de pescado.']]
      .forEach((l) => appendBubble(makeBubble(l[0], l[1], l[2])));
  }
})();
