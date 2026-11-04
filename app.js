/* Parley - live two-way conversation translation
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
    name: 'Traveler', avatar: 3, engine: 'auto', libreUrl: '', libreKey: '', pro: false, license: '', proEmail: '', proChecked: 0,
    voiceEngine: 'kokoro', voices: {}, browserVoices: {}, palette: 'night', keep: 0, paletteV2: false, visits: 0, nudgeAt: 0, improve: false, offline: false, tabletop: false, cues: true,
  };
  let prefs = Object.assign({}, defaults);
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) {}
  if (!prefs.paletteV2) { prefs.palette = 'night'; prefs.paletteV2 = true; } // Night became the default for everyone
  const T = (k) => (window.I18N ? I18N.t(k) : k);
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
    const [bg, fg, shape] = AVATARS[((i % AVATARS.length) + AVATARS.length) % AVATARS.length] || AVATARS[3];
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
  /* ---------------- Pro (Stripe) ----------------
     /api/checkout → Stripe Checkout (one-time). Success redirects back with ?session_id, /api/verify confirms
     payment and returns a signed token for this device. /api/restore unlocks another device from the purchase
     email. No database: Stripe is the source of truth. Env vars: see .env.example. */
  let proConfigured = null;
  async function proStatus() { if (proConfigured != null) return proConfigured; try { const r = await fetch('/api/status'); proConfigured = !!(await r.json()).configured; } catch (e) { proConfigured = false; } return proConfigured; }
  async function proApi(path, body) {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const j = await r.json().catch(() => ({})); if (!r.ok || j.ok === false) throw new Error(j.error || 'Something went wrong.'); return j;
  }
  function setPro(on, token, email) { prefs.pro = !!on; if (on) { const n = $('nudge'); if (n) n.hidden = true; } prefs.license = on ? token : ''; prefs.proEmail = on ? (email || '') : ''; savePrefs(); renderProfile(); renderHistory(); }

  const FREE_LIMIT = 5;
  function keepLimit() { return prefs.pro ? (Number(prefs.keep) || 0) : FREE_LIMIT; } // 0 = keep everything
  async function enforceLimit() {
    const lim = keepLimit(); if (!lim) return;
    const all = (await dbAll()).sort((a, b) => b.startedAt - a.startedAt);
    for (const c of all.slice(lim)) await dbDel(c.id);
  }
  function renderKeep() {
    const lim = keepLimit();
    document.querySelectorAll('.keep-seg .seg-btn').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.keep) === lim));
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
  const tCache = new Map();
  /* Built-in browser translator (Chrome 138+, downloads language packs, runs on the device, works offline). */
  const builtin = { cache: new Map() };
  async function viaBuiltin(text, from, to) {
    if (!('Translator' in self)) throw new Error('no built-in translator');
    const src = base(from) === 'auto' ? null : base(from), dst = base(to);
    if (!src) throw new Error('built-in translator needs a source language');
    const key = src + '>' + dst;
    if (!builtin.cache.has(key)) {
      const avail = await Translator.availability({ sourceLanguage: src, targetLanguage: dst });
      if (avail === 'unavailable') throw new Error('pair unavailable');
      builtin.cache.set(key, Translator.create({ sourceLanguage: src, targetLanguage: dst }));
    }
    const tr = await builtin.cache.get(key);
    return { text: await tr.translate(text), detected: src };
  }
  async function translate(text, from, to) {
    const key = from + '|' + to + '|' + text; if (tCache.has(key)) return tCache.get(key);
    if (prefs.offline || !navigator.onLine) {
      try { const r = await viaBuiltin(text, from, to); tCache.set(key, r); return r; } catch (e) { if (!navigator.onLine) throw new Error('offline'); }
    }
    const chain = prefs.engine === 'libre' ? [viaLibre, viaGoogle, viaMyMemory]
      : prefs.engine === 'mymemory' ? [viaMyMemory, viaGoogle]
      : [viaGoogle, viaMyMemory];
    // Primary gets a 900 ms head start; if it hasn't answered (or fails), the fallbacks fire and the first good answer wins.
    const result = await new Promise((resolve, reject) => {
      let settled = false, failed = 0, fallbacksStarted = false, lastErr = null;
      const startFallbacks = () => { if (fallbacksStarted) return; fallbacksStarted = true; chain.slice(1).forEach(attempt); if (chain.length === 1) check(); };
      const check = () => { if (!settled && failed >= chain.length) reject(lastErr || new Error('translation failed')); };
      const attempt = (fn) => fn(text, from, to).then((r) => { if (!settled) { settled = true; resolve(r); } }).catch((e) => { lastErr = e; failed++; if (!fallbacksStarted) startFallbacks(); else check(); });
      attempt(chain[0]);
      setTimeout(() => { if (!settled) startFallbacks(); }, 900);
    });
    if (tCache.size > 300) tCache.clear(); tCache.set(key, result);
    return result;
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
    let lastErr = null;
    function browserSpeak(text, lang, voiceName) {
      return new Promise((res) => {
        if (!('speechSynthesis' in window)) return res();
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text); u.lang = byCode(lang).sr; u.rate = 1.03;
          const want = voiceName || (prefs.browserVoices || {})[base(lang)];
          const vs = speechSynthesis.getVoices();
          const v = vs.find((x) => x.name === want) || vs.find((x) => x.lang && base(x.lang) === base(lang) && /premium|enhanced|neural|natural/i.test(x.name)) || vs.find((x) => x.lang && base(x.lang) === base(lang));
          if (v) u.voice = v; u.onend = res; u.onerror = res; speechSynthesis.speak(u);
        } catch (e) { res(); }
      });
    }
    async function kokoroSpeak(text, lang, voiceId) {
      const voice = voiceId || voiceFor(lang); if (!voice) return browserSpeak(text, lang);
      let model;
      try { model = await load((p) => { setBusy(true, 'Downloading voice ' + Math.round(p) + '%'); const b = $('voice-dl'); if (b) b.style.width = p + '%'; }); }
      catch (e) { lastErr = e; console.warn('Kokoro load failed', e); toast('Studio voice unavailable, using device voice'); setVoiceStatus(); return browserSpeak(text, lang); }
      try {
        setVoiceStatus('Generating…');
        const audio = await model.generate(text, { voice });
        setVoiceStatus();
        const blob = audio.toBlob ? audio.toBlob() : new Blob([audio.toWav()], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        await new Promise((res) => { const a = new Audio(url); current = a; a.onended = () => { URL.revokeObjectURL(url); res(); }; a.onerror = () => { URL.revokeObjectURL(url); res(); }; a.play().catch(() => res()); });
      } catch (e) { lastErr = e; console.warn('Kokoro generate failed', e); setVoiceStatus(); return browserSpeak(text, lang); }
    }
    function setVoiceStatus(msg) {
      const n = $('voice-status'); if (!n) return;
      n.textContent = msg || (failed ? 'Studio engine failed to load on this device (' + String((lastErr && lastErr.message) || lastErr || 'unknown').slice(0, 80) + '). Previews use device voices.' : tts ? 'Studio engine ready.' : loading ? 'Downloading studio engine…' : 'Studio engine loads on first play (~90 MB, once).');
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
    // Preview one specific voice regardless of prefs. engine: 'kokoro' | 'browser'
    async function preview(text, lang, engine, voiceKey) {
      stop(); queue = []; setBusy(true);
      try { if (engine === 'browser') await browserSpeak(text, lang, voiceKey); else await kokoroSpeak(text, lang, voiceKey); } finally { setBusy(false); }
    }
    function stop() { queue = []; try { speechSynthesis && speechSynthesis.cancel(); } catch (e) {} try { if (current) { current.pause(); current = null; } } catch (e) {} }
    function warm() { if (prefs.speak && prefs.voiceEngine !== 'browser') load((p) => { const b = $('voice-dl'); if (b) b.style.width = p + '%'; }).catch(() => {}); }
    return { speak, stop, warm, load, voiceFor, preview, status: setVoiceStatus, ready: () => !!tts };
  })();
  function speak(text, lang) { Voice.speak(text, lang); }

  /* ---------------- Mic level + Siri ribbon ---------------- */
  const Wave = (() => {
    let analyser = null, data = null, level = 0, raf = null, active = false, ribbon = null, floor = 0.02;
    function attach(stream) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; const ctx = new AC();
        const src = ctx.createMediaStreamSource(stream); analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.7; src.connect(analyser);
        data = new Uint8Array(analyser.frequencyBinCount);
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { analyser = null; }
    }
    function tick() {
      if (!active) return; raf = requestAnimationFrame(tick);
      if (analyser) { analyser.getByteFrequencyData(data); let sum = 0; for (let i = 2; i < 60; i++) sum += data[i]; const raw = sum / (58 * 255); level += (raw - level) * 0.35;
        // Ambient floor: falls quickly toward quiet moments, rises slowly, so a noisy room still has a usable "quiet".
        floor = level < floor ? floor + (level - floor) * 0.05 : floor + (level - floor) * 0.002; }
      else level = 0;
      if (ribbon) ribbon.setLevel(Math.min(1, level * 2.4));
    }
    function start(canvas) { if (!ribbon && window.Ribbon) ribbon = Ribbon.mount(canvas); active = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
    function stop() { active = false; cancelAnimationFrame(raf); analyser = null; level = 0; floor = 0.02; if (ribbon) { ribbon.setLevel(0); ribbon.setTalking(false); } }
    function setSpeaker(who) { if (ribbon) ribbon.setColor(who === 'b' ? 'rgba(255,255,255,0.75)' : '#ffffff'); }
    function setTalking(b) { if (ribbon) ribbon.setTalking(b); }
    // "Quiet" means close to the room's own floor, not an absolute number.
    function quiet() { return level < Math.max(0.03, floor * 1.6 + 0.012); }
    return { start, stop, attach, setSpeaker, setTalking, level: () => level, floor: () => floor, quiet };
  })();
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  /* ---------------- Live session ---------------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // Two people at different distances: let the device lift the far voice and tame the room.
  const MIC = { audio: { autoGainControl: true, noiseSuppression: true, echoCancellation: true } };
  const live = {
    on: false, rec: null, stream: null, recorder: null, chunks: [], startedAt: 0, timerId: null,
    avatars: { a: 3, b: -1 },
    expected: 'a', lines: [], interimEl: null, forced: null, netErrors: 0, levelId: null, epId: null, epQuiet: 0, turnId: null, interimTid: null, detected: null, detectPending: null, carry: null, convoId: null,
  };
  const langOf = (who) => who === 'a' ? prefs.langA : prefs.langB;
  const other = (who) => who === 'a' ? 'b' : 'a';

  const BG = window.Aurora ? Aurora.mount($('app-bg'), { dim: 0.9, maxDpr: 1, colors: [cssVar('--bg-c1'), cssVar('--bg-c2'), cssVar('--bg-c3')] }) : null;
  function applyPalette(p) {
    prefs.palette = p || 'night'; document.documentElement.setAttribute('data-palette', prefs.palette);
    if (BG) BG.setColors(cssVar('--bg-c1'), cssVar('--bg-c2'), cssVar('--bg-c3'));
    document.querySelectorAll('.palette-seg .seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.pal === prefs.palette));
    const sub = $('palette-sub'); if (sub) sub.textContent = { aurora: 'Sky', dawn: 'Dawn', sea: 'Sea', dusk: 'Dusk', night: 'Night', tide: 'Tide', volt: 'Volt' }[prefs.palette] || 'Sea';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = '#050505';
  }
  function setStatus(text, who) { const s = $('stage-status'); s.textContent = text; s.className = 'stage-status' + (who ? ' ' + who : ''); }
  function showError(msg) { const s = $('stage-status'); s.textContent = msg; s.className = 'stage-status err'; toast(msg); }
  /* Turn chime: a soft two-note blip, a touch higher for the left language, lower for the right. Off in setup. */
  let cueCtx = null, chimeTid = null;
  function playChime(who) {
    try {
      cueCtx = cueCtx || new (window.AudioContext || window.webkitAudioContext)(); if (cueCtx.state === 'suspended') cueCtx.resume();
      const t = cueCtx.currentTime;
      // Left language rises (E5 -> B5), right language falls (B5 -> E5): opposite shapes, easy to tell apart by ear.
      const notes = who === 'a' ? [659.3, 987.8] : [987.8, 659.3];
      notes.forEach((f, i) => { const o = cueCtx.createOscillator(), g = cueCtx.createGain(); o.type = who === 'a' ? 'sine' : 'triangle'; o.frequency.value = f; const at = t + i * 0.11; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(who === 'a' ? 0.13 : 0.09, at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2); o.connect(g); g.connect(cueCtx.destination); o.start(at); o.stop(at + 0.22); });
    } catch (e) {}
  }
  // Only sound once the new side has held for a beat: a flip that flips straight back stays silent.
  function chime(who) { if (!prefs.cues) return; clearTimeout(chimeTid); chimeTid = setTimeout(() => { if (live.on && live.litWho === who) playChime(who); }, 350); }
  const GO = { en: 'Ready, go ahead', es: 'Listo, habla', pt: 'Pronto, pode falar', fr: 'Prêt, parlez', de: 'Bereit, sprich', it: 'Pronto, parla', zh: '准备好了，请说', ja: '準備完了、どうぞ', ko: '준비됐어요, 말씀하세요', hi: 'तैयार, बोलिए', th: 'พร้อมแล้ว พูดได้เลย', ar: 'جاهز، تفضل', ru: 'Готово, говорите', id: 'Siap, silakan bicara', vi: 'Sẵn sàng, mời nói', tr: 'Hazır, konuşun', nl: 'Klaar, zeg het maar', pl: 'Gotowe, mów' };
  function goCue(who) { return GO[base(langOf(who))] || GO.en; }
  let cueTid = null;
  function showCue(who) {
    const txt = goCue(who); const near = $('near-cue'), far = $('far-cue');
    if (near) { near.textContent = txt; near.classList.add('show'); }
    if (far) { far.textContent = who === 'b' ? txt : ''; far.classList.toggle('show', who === 'b'); }
    clearTimeout(cueTid); cueTid = setTimeout(() => { near && near.classList.remove('show'); far && far.classList.remove('show'); }, 2800);
  }
  function leaveNeutral(picked) { if (!live.neutral) return; live.neutral = false; $('live-stage').classList.remove('neutral'); const h = $('convo-hint'); if (h) h.textContent = picked ? T('live.hintpicked').replace('{lang}', byCode(langOf(picked)).native) : T('live.hint'); }
  function setExpected(who, forced) {
    if (live.on && !live.neutral && live.litWho && live.litWho !== who) { if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} } chime(who); }
    live.litWho = who;
    live.expected = who; if (forced !== undefined) live.forced = forced;
    $('who-a').classList.toggle('is-live', !live.neutral && who === 'a'); $('who-b').classList.toggle('is-live', !live.neutral && who === 'b'); const ft = $('far-talk'); if (ft) ft.classList.toggle('is-live', !live.neutral && who === 'b');
    Wave.setSpeaker(who); if (BG) BG.setTint(cssVar(who === 'b' ? '--bg-c1' : '--bg-c3'), 0.5);
    const sg = $('siri'); sg.className = 'siri on ' + who;
    setStatus(T('live.listening'), who);
  }

  function makeBubble(who, orig, trans, interim) {
    const b = el('div', 'bubble ' + who + (interim ? ' interim' : ''));
    const o = el('div', 'orig', orig || ''); const t = el('div', 'trans', trans || ''); b.appendChild(o); b.appendChild(t);
    const m = el('div', 'meta'); const av = el('span', 'bav'); av.innerHTML = avatarSVG(live.avatars[who]); m.appendChild(av); m.appendChild(el('span', 'ml', byCode(langOf(who)).short + ' → ' + byCode(langOf(other(who))).short)); b.appendChild(m);
    return b;
  }
  function setBubbleWho(node, who) { node.querySelector('.ml').textContent = byCode(langOf(who)).short + ' → ' + byCode(langOf(other(who))).short; node.querySelector('.bav').innerHTML = avatarSVG(live.avatars[who]); }
  // Guest avatar: a new colorful character each conversation, never the same as yours, never the two plain ones.
  function pickGuest() {
    const a = prefs.avatar % AVATARS.length;
    const pool = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => i !== a);
    live.avatars = { a, b: pool[Math.floor(Math.random() * pool.length)] };
  }
  function renderAvatarsUI() {
    live.avatars.a = prefs.avatar % AVATARS.length; if (!(live.avatars.b >= 0) || live.avatars.b === live.avatars.a) pickGuest();
    const da = $('who-a').querySelector('.who-dot'), db = $('who-b').querySelector('.who-dot'); if (da) da.innerHTML = avatarSVG(live.avatars.a); if (db) db.innerHTML = avatarSVG(live.avatars.b);
    const sa = document.querySelector('.sw.a'), sb = document.querySelector('.sw.b'); if (sa) sa.innerHTML = avatarSVG(live.avatars.a); if (sb) sb.innerHTML = avatarSVG(live.avatars.b);
  }
  function pickAvatars() { renderAvatarsUI(); }
  function appendBubble(node) { const c = $('convo'); const hint = $('convo-hint'); if (hint) hint.remove(); c.appendChild(node); c.scrollTop = c.scrollHeight; return node; }

  /* ---- Early language detection: decide the speaker from the first two words ---- */
  // Tiny offline lexicon of very common function words. Instant, no network. Covers the
  // same-alphabet pairs where script detection can't help (EN/ES/PT/FR/DE/IT...).
  const LEX = {
    en: "the a an and is are am was were be been i you he she we they it this that these those what where when how why who yes no not hello hi hey thanks thank please can could do does did have has had want need like my your his her our their of to in on for with from at by about just so very really okay ok sure maybe here there now today tomorrow good great fine sorry excuse me much many some any all one two three table check bill water beer food",
    es: "el la los las un una unos unas y o es son soy eres está están estoy estás ser estar yo tú usted ustedes nosotros ellos ellas esto eso esta este qué dónde cuándo cómo por qué quién sí no hola buenos buenas días tardes noches gracias por favor puedo puede tengo tiene quiero quiere necesito necesita me te le mi tu su nuestro de a en con para sin muy bien mal mucho poco aquí allí ahora hoy mañana ahorita vale claro perdón disculpe oye mira pues entonces también todo nada algo uno dos tres mesa cuenta agua cerveza comida",
    pt: "o a os as um uma uns umas e ou é são sou está estão estou ser estar eu você vocês nós eles elas isto isso este esta que onde quando como por que quem sim não olá oi bom boa dia tarde noite obrigado obrigada por favor posso pode tenho tem quero quer preciso precisa me te lhe meu minha seu sua nosso de em com para sem muito bem mal pouco aqui ali agora hoje amanhã tá beleza claro desculpa desculpe olha então também tudo nada algo um dois três mesa conta água cerveja comida",
    fr: "le la les un une des et ou est sont suis es être je tu il elle on nous vous ils elles ceci cela ce cette que quoi où quand comment pourquoi qui oui non bonjour salut merci s'il vous plaît peux peut ai as a veux veut besoin me te lui mon ma ton ta son sa notre votre de à en avec pour sans très bien mal beaucoup peu ici là maintenant aujourd'hui demain d'accord bien sûr pardon excusez alors aussi tout rien quelque un deux trois table addition eau bière",
    de: "der die das ein eine und oder ist sind bin bist sein ich du er sie es wir ihr dies das was wo wann wie warum wer ja nein hallo guten morgen tag abend danke bitte kann kannst habe hast hat will möchte brauche mich dich ihm mein dein sein ihr unser von zu in mit für ohne sehr gut schlecht viel wenig hier dort jetzt heute morgen okay klar entschuldigung also auch alles nichts etwas eins zwei drei tisch rechnung wasser bier essen",
    it: "il lo la i gli le un uno una e o è sono sei essere io tu lui lei noi voi loro questo questa quello che cosa dove quando come perché chi sì no ciao buongiorno buonasera grazie per favore posso può ho hai ha voglio vuole bisogno mi ti gli mio mia tuo tua suo sua nostro di a in con per senza molto bene male tanto poco qui lì adesso oggi domani va bene certo scusa scusi allora anche tutto niente qualcosa uno due tre tavolo conto acqua birra cibo",
    nl: "de het een en of is zijn ben bent ik jij je u wij we zij ze dit dat wat waar wanneer hoe waarom wie ja nee hallo hoi dank bedankt alsjeblieft kan kun heb hebt wil moet nodig mij me jou mijn jouw zijn haar ons van naar in met voor zonder heel goed slecht veel weinig hier daar nu vandaag morgen oké prima sorry dus ook alles niets iets een twee drie tafel rekening water bier eten",
    id: "yang dan atau ini itu saya aku kamu anda kami kita mereka dia apa di mana kapan bagaimana mengapa siapa ya tidak halo selamat pagi siang malam terima kasih tolong bisa punya mau ingin perlu saya ke dari dengan untuk tanpa sangat baik buruk banyak sedikit sini sana sekarang hari ini besok oke jadi juga semua satu dua tiga meja air",
    ms: "yang dan atau ini itu saya awak anda kami kita mereka dia apa di mana bila bagaimana kenapa siapa ya tidak helo selamat pagi tengah malam terima kasih tolong boleh ada mahu nak perlu ke dari dengan untuk tanpa sangat baik teruk banyak sedikit sini sana sekarang hari ini esok okey jadi juga semua satu dua tiga meja air",
    tr: "bir ve veya bu şu o ben sen biz siz onlar ne nerede ne zaman nasıl neden kim evet hayır merhaba selam günaydın teşekkür teşekkürler lütfen var yok istiyorum lazım beni seni benim senin bizim için ile çok iyi kötü az burada orada şimdi bugün yarın tamam peki pardon yani de da her şey hiç bir iki üç masa hesap su bira",
    sw: "na au ni hii hiyo hili mimi wewe yeye sisi ninyi wao nini wapi lini vipi kwa nini nani ndiyo hapana habari jambo asante tafadhali naweza nina nataka nahitaji yangu yako yake yetu kwa katika bila sana vizuri vibaya nyingi kidogo hapa pale sasa leo kesho sawa basi pia yote moja mbili tatu meza maji",
    tl: "ang ng mga at o ay ako ikaw siya kami tayo sila ito iyon ano saan kailan paano bakit sino oo hindi kumusta magandang umaga hapon gabi salamat paki pwede may gusto kailangan ko mo niya akin iyo sa para nang napaka mabuti masama marami kaunti dito doon ngayon bukas sige okay pasensya kasi din lahat wala isa dalawa tatlo mesa tubig",
    pl: "i lub to ten ta jest są jestem jesteś ja ty on ona my wy oni co gdzie kiedy jak dlaczego kto tak nie cześć dzień dobry dziękuję proszę mogę może mam masz chcę chce potrzebuję mnie cię mój twój nasz z do w na dla bez bardzo dobrze źle dużo mało tu tam teraz dzisiaj jutro okej jasne przepraszam więc też wszystko nic coś jeden dwa trzy stół rachunek woda piwo",
    sv: "och eller är var jag du han hon vi ni de det här vad var när hur varför vem ja nej hej tack snälla kan har vill behöver mig dig min din vår av till i med för utan mycket bra dåligt många lite här där nu idag imorgon okej visst förlåt alltså också allt inget något ett två tre bord nota vatten öl",
    vi: "và hoặc là tôi bạn anh chị em chúng họ này đó gì đâu khi nào sao tại sao ai vâng dạ không xin chào cảm ơn làm ơn có thể muốn cần của với cho rất tốt xấu nhiều ít đây kia bây giờ hôm nay ngày mai được rồi xin lỗi vậy cũng tất cả một hai ba bàn nước bia",
  };
  // Words that settle it on their own: hearing one of these is enough.
  const STRONG = {
    en: "the hello thanks please yes okay sorry", es: "hola gracias sí buenos buenas está qué dónde pues claro vale perdón disculpe", pt: "olá obrigado obrigada não está você bom boa tudo beleza", fr: "bonjour merci oui s'il c'est très vous", de: "hallo danke bitte ich nicht guten", it: "ciao grazie sì buongiorno sono allora", nl: "hallo dank bedankt niet", id: "terima kasih selamat tidak", ms: "terima kasih selamat tidak", tr: "merhaba teşekkür evet hayır", sw: "habari asante jambo", tl: "salamat kumusta hindi", pl: "cześć dziękuję proszę nie", sv: "hej tack", vi: "xin chào cảm ơn không",
  };
  const STRONGSET = {}; Object.keys(STRONG).forEach((k) => { STRONGSET[k] = new Set(STRONG[k].split(' ')); });
  function strongHit(words, code) { const s = STRONGSET[base(code)]; if (!s) return false; return words.some((w) => s.has(w)); }
  const LEXSET = {}; Object.keys(LEX).forEach((k) => { LEXSET[k] = new Set(LEX[k].split(' ')); });
  function lexScore(words, code) { const s = LEXSET[base(code)]; if (!s) return 0; let n = 0; for (const w of words) if (s.has(w)) n++; return n; }
  // Returns 'a' | 'b' | null - null means "can't tell offline".
  function guessOffline(text) {
    const sA = langScript(prefs.langA), sB = langScript(prefs.langB), sT = scriptOf(text);
    if (sA !== sB) { if (sT === sA) return 'a'; if (sT === sB) return 'b'; return null; }
    const words = text.toLowerCase().replace(/[^\p{L}\p{M}' ]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 5);
    if (!words.length) return null;
    const sa = strongHit(words, prefs.langA), sb = strongHit(words, prefs.langB);
    if (sa && !sb) return 'a'; if (sb && !sa) return 'b';
    const a = lexScore(words, prefs.langA), b = lexScore(words, prefs.langB);
    if (a > b) return 'a'; if (b > a) return 'b'; return null;
  }
  // The engine is listening in the wrong language: its output is nonsense that matches neither word list.
  // After a few words of that, flip the engine rather than wait for a guess that will never come.
  function looksLikeNonsense(text, engineLang) {
    const words = text.toLowerCase().replace(/[^\p{L}\p{M}' ]/gu, ' ').split(/\s+/).filter(Boolean);
    if (words.length < (live.lines.length ? 4 : 3)) return false;
    return lexScore(words, engineLang) === 0;
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
    const words = interim.trim().split(/\s+/);
    const head = words.slice(0, 4).join(' ');
    let who = guessOffline(head);
    if (!who && words.length >= 2 && !live.detectPending) {
      const probe = words.slice(0, 3).join(' ');
      live.detectPending = probe;
      who = await guessOnline(probe);
      if (live.detectPending !== probe || live.detected) return; // a newer utterance superseded this
      live.detectPending = null;
    }
    if (!who) {
      // Nothing recognizable after several words: the engine is probably in the wrong language. Flip once.
      if (!live.flipped && looksLikeNonsense(interim, langOf(live.expected))) {
        live.flipped = true; live.detectPending = null; const next = other(live.expected); note({ ev: 'nonsense-flip', from: live.expected, text: interim.slice(0, 60) });
        if (live.interimEl) { live.interimEl.remove(); live.interimEl = null; }   // that text was never real words
        live.carry = null; setExpected(next); startRecognizer(langOf(next));
      }
      return;
    }
    live.detected = who; live.detectedBy = 'words'; leaveNeutral(); note({ ev: 'words', who, expected: live.expected, head });
    if (live.interimEl) { live.interimEl.className = 'bubble ' + who + ' interim'; setBubbleWho(live.interimEl, who); }
    if (who !== live.expected) {
      // Wrong speaker guessed: switch recognizer to the right language now, keeping what we already heard.
      live.carry = interim.trim();
      setExpected(who); startRecognizer(langOf(who));
    } else setStatus(T('live.listening'), who);
  }

  function startRecognizer(lang) {
    if (!SR || !live.on) return;
    try { if (live.rec) { live.rec.onend = null; live.rec.abort(); } } catch (e) {}
    const r = new SR(); live.rec = r;
    r.lang = byCode(lang).sr; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (ev) => {
      let interim = '', finals = [];
      const clean = (t) => String(t).replace(/<\/?\s*(s|unk|noise|eps)\s*>/gi, ' ').replace(/\s+/g, ' ');
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const res = ev.results[i]; if (res.isFinal) finals.push(clean(res[0].transcript).trim()); else interim += clean(res[0].transcript); }
      interim = interim.trim();
      if (interim) {
        const shown = live.carry ? (live.carry + ' ' + interim) : interim;
        if (!live.interimEl) { live.interimEl = appendBubble(makeBubble(live.detected || live.expected, '', shown, true)); live.interimEl.dataset.words = shown; live.interimEl.dataset.start = Math.max(0, Date.now() - live.startedAt - 600); }
        else if (live.interimEl.dataset.words !== shown) {
          const n = live.interimEl; n.dataset.words = shown;
          // Big text holds the latest translation once one exists; the raw words live in the small line above it.
          if (n.dataset.tr) n.querySelector('.orig').textContent = shown; else n.querySelector('.trans').textContent = shown;
          $('convo').scrollTop = $('convo').scrollHeight;
        }
        if (!live.detected) earlyDetect(interim);
        else if (live.detectedBy === 'ear' && !live.forced) wordsOverrideEar(shown);
        Wave.setTalking(true); scheduleInterimTranslate(shown);
        // Snappy turns: if the interim text stops changing, force the final now instead of waiting for the engine.
        armEndpoint(r, shown);
      }
      if (finals.length) Wave.setTalking(false);
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
    r.onstart = () => { if (live.rec !== r) return; document.querySelectorAll('#who-a, #who-b, #far-talk').forEach((b) => b.classList.remove('arming')); if (live.cueOnStart) { live.cueOnStart = false; showCue(live.expected); } };
    r.onend = () => { if (live.on && live.rec === r) setTimeout(() => { if (live.on && live.rec === r) startRecognizer(langOf(live.expected)); }, 0); };
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
        const n = live.interimEl;
        if (n && (n.dataset.words || '').startsWith(text.slice(0, 12))) {
          n.dataset.tr = '1'; n.querySelector('.orig').textContent = n.dataset.words;
          const t = n.querySelector('.trans'); t.textContent = r.text; t.classList.add('pending');
          $('convo').scrollTop = $('convo').scrollHeight;
        }
      } catch (e) {}
    }, 180);
  }

  /* ---- Natural endpointing ----
     The speech engine's own pause timeout is slow (1-2 s) and a fixed short timer cuts people off mid-thought.
     Instead: once the words stop changing, watch the mic. End the line only after the room has been quiet
     for a while, and wait longer when the sentence clearly isn't finished (trailing "and", "pero", "que"…). */
  const TRAILING = /\b(and|but|or|so|because|that|which|if|then|y|pero|o|que|porque|si|entonces|e|mas|ou|porque|et|mais|ou|que|und|aber|oder|dass|e|ma|o|che|perché|um|uh|eh|este|pues|like)$/i;
  function armEndpoint(r, text) {
    clearInterval(live.epId); live.epQuiet = 0; live.epText = text;
    const words = wordCount(text);
    const open = TRAILING.test(text.trim()) || /[,;:]$/.test(text.trim()) || words < 3;
    const needQuiet = open ? 1400 : (words > 14 ? 700 : 850);   // ms of real silence required
    let stable = 0;
    live.epId = setInterval(() => {
      if (!live.on || live.rec !== r || !live.interimEl) { clearInterval(live.epId); return; }
      const quiet = Wave.quiet();                                // relative to the room's own noise floor
      live.epQuiet = quiet ? live.epQuiet + 100 : 0; stable += 100;
      // Commit when the room goes quiet, or when the words have stopped changing for a while even if the room never does.
      if (live.epQuiet >= needQuiet || (stable >= (open ? 2600 : 2000) && words >= 3)) { clearInterval(live.epId); softCommit(text); }
    }, 100);
  }

  async function handleFinal(text, opts) {
    opts = opts || {}; leaveNeutral();
    clearInterval(live.epId); clearTimeout(live.interimTid); clearTimeout(live.turnId); 
    // Speaker priority: manual tap > early detection (first two words) > offline guess on full text > turn-taking
    let guess = live.forced || opts.who || live.detected || guessOffline(text) || live.expected;
    // Same person kept talking after a short pause → extend their last bubble instead of starting a new one.
    const last = live.lines[live.lines.length - 1];
    const sinceLast = last ? (Date.now() - live.startedAt - last.t - (last.dur || 0)) : 1e9;
    const cont = last && last.who === guess && sinceLast < 2500 && !/[.!?。！？]$/.test(last.orig.trim()) && !live.forced;
    if (cont && live.interimEl) { live.interimEl.remove(); }
    const node = cont ? last.node : (live.interimEl || appendBubble(makeBubble(guess, '', text, true)));
    if (cont) { text = (last.orig + ' ' + text).trim(); live.lines.pop(); }
    live.interimEl = null; live.carry = null; live.detected = null; live.detectedBy = null; live.detectPending = null; live.flipped = false;
    node.className = 'bubble ' + guess + ' interim';
    node.querySelector('.trans').textContent = text;
    setStatus(T('live.translating'), guess);
    const t0 = Date.now() - live.startedAt;
    const start = node.dataset.start ? Number(node.dataset.start) : t0; // when the person started talking, not when the line was finalized

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
      node.className = 'bubble ' + who; node.querySelector('.orig').textContent = text; node.querySelector('.trans').textContent = '(translation unavailable, check your connection)';
      setExpected(other(who)); return;
    }
    node.className = 'bubble ' + who;
    node.querySelector('.orig').textContent = text;
    node.querySelector('.trans').textContent = result.text; node.querySelector('.trans').classList.remove('pending');
    setBubbleWho(node, who);
    $('convo').scrollTop = $('convo').scrollHeight;
    note({ ev: 'line', who, by: live.forced ? 'tap' : (opts.who ? 'cont' : (live.detectedBy || 'guess')), words: text.split(/\s+/).length, detected: result.detected || null });
    live.lines.push({ who, orig: text, trans: result.text, from: langOf(who), to: langOf(other(who)), t: cont ? last.t : start, dur: (Date.now() - live.startedAt) - (cont ? last.t : start), node });
    if (!cont) speak(result.text, langOf(other(who))); else { Voice.stop(); speak(result.text, langOf(other(who))); }
    live.forced = null;
    // Don't assume the other person is next. Keep listening in the same language for a beat (they may
    // continue); if nobody starts within ~2 s, expect the other person. Early detection corrects either way.
    // The line ended in silence, so this is the cheapest moment to switch the engine to the other language:
    // the ~0.4 s restart happens while nobody is talking. If the same person carries on, early detection flips back.
    const next = other(who); setExpected(next); startRecognizer(langOf(next));
  }
  /* ---- Face-to-face mode: the top half is turned around for the person across the table. They see their side of
     every line (your words translated into their language, their own words as heard), live, right side up. ---- */
  function renderFar() {
    const far = $('far-convo'); if (!far || $('pane-far').hidden) return;
    const frag = document.createDocumentFragment();
    document.querySelectorAll('#convo .bubble').forEach((b) => {
      const who = b.classList.contains('b') ? 'b' : 'a'; const interim = b.classList.contains('interim');
      const orig = b.querySelector('.orig') ? b.querySelector('.orig').textContent : '', trans = b.querySelector('.trans') ? b.querySelector('.trans').textContent : '';
      // For the far person: A's lines matter as the translation (into their language); B's own lines as what was heard.
      const main = who === 'a' ? (trans || orig) : (orig || trans); if (!main) return;
      const d = document.createElement('div'); d.className = 'fb ' + who + (interim ? ' interim' : ''); d.textContent = main;
      if (who === 'b' && trans && trans !== orig && !interim) { const sm = document.createElement('small'); sm.textContent = trans; d.appendChild(sm); }
      frag.appendChild(d);
    });
    far.innerHTML = ''; far.appendChild(frag); far.scrollTop = far.scrollHeight;
  }
  new MutationObserver(() => { if (!$('pane-far').hidden) renderFar(); }).observe($('convo'), { childList: true, subtree: true, characterData: true });
  function setTabletop(on) {
    prefs.tabletop = !!on; savePrefs();
    $('live-stage').classList.toggle('tabletop', prefs.tabletop); $('pane-far').hidden = !prefs.tabletop; $('table-btn').setAttribute('aria-pressed', String(prefs.tabletop));
    if (prefs.tabletop) renderFar();
  }
  $('table-btn').addEventListener('click', () => setTabletop(!prefs.tabletop));
  $('far-talk').addEventListener('click', () => $('who-b').click());

  /* ---- Detection notes (opt-in, on device): how each line got its speaker, for tuning the guessing ---- */
  const NOTES_KEY = 'parley.notes.v1';
  function note(ev) {
    if (!prefs.improve) return;
    try { const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); all.push(Object.assign({ t: Date.now(), convo: live.convoId, langA: prefs.langA, langB: prefs.langB }, ev)); while (all.length > 2000) all.shift(); localStorage.setItem(NOTES_KEY, JSON.stringify(all)); } catch (e) {}
  }
  $('opt-cues').addEventListener('change', (e) => { prefs.cues = e.target.checked; savePrefs(); if (prefs.cues) { playChime('a'); setTimeout(() => playChime('b'), 700); } });
  $('opt-offline').addEventListener('change', async (e) => {
    prefs.offline = e.target.checked; savePrefs(); if (!prefs.offline) return;
    toast(T('setup.offlineprep'));
    if (window.Ear) Ear.load({ full: true });
    // Language packs for the built-in translator download only on a tap, so start them now, both directions.
    if ('Translator' in self) { for (const [f, t] of [[prefs.langA, prefs.langB], [prefs.langB, prefs.langA]]) { try { await viaBuiltin('ok', f, t); } catch (err) {} } }
  });
  $('opt-improve').addEventListener('change', (e) => { prefs.improve = e.target.checked; savePrefs(); $('improve-export').hidden = !prefs.improve; });
  $('improve-export').addEventListener('click', () => {
    const data = localStorage.getItem(NOTES_KEY) || '[]';
    const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'parley-notes.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast('Notes exported');
  });

  /* ---- Offline mode: Whisper on the device does the listening, in bursts; the built-in translator (when the
     browser has one) does the translating. No network needed once the models are on the device. ---- */
  const Off = { ctx: null, src: null, proc: null, on: false, chunks: [], have: 0, speaking: false, silence: 0, busy: false, rate: 48000 };
  async function startOffline() {
    const ok = await Ear.load({ full: true });
    if (!ok || !live.on) { toast('Offline mode needs a device with GPU support. Using live mode.'); if (live.on) startRecognizer(langOf(live.expected)); return; }
    if (!live.stream) { try { live.stream = await navigator.mediaDevices.getUserMedia(MIC); Wave.attach(live.stream); } catch (e) { return; } }
    Off.on = true; Off.ctx = new (window.AudioContext || window.webkitAudioContext)(); Off.rate = Off.ctx.sampleRate;
    Off.src = Off.ctx.createMediaStreamSource(live.stream); Off.proc = Off.ctx.createScriptProcessor(2048, 1, 1);
    Off.chunks = []; Off.have = 0; Off.speaking = false; Off.silence = 0;
    const SIL_FRAMES = Math.round(1.1 * Off.rate / 2048), MAX = 8 * Off.rate, MIN = 0.5 * Off.rate;
    Off.proc.onaudioprocess = (e) => {
      if (!Off.on) return;
      const d = e.inputBuffer.getChannelData(0); let rms = 0; for (let i = 0; i < d.length; i++) rms += d[i] * d[i]; rms = Math.sqrt(rms / d.length);
      const loud = rms > 0.02;
      if (!Off.speaking) { if (!loud) { Off.chunks.push(new Float32Array(d)); Off.have += d.length; while (Off.have > Off.rate * 0.4 && Off.chunks.length > 1) { Off.have -= Off.chunks.shift().length; } return; } Off.speaking = true; Off.silence = 0; Wave.setTalking(true); }
      Off.chunks.push(new Float32Array(d)); Off.have += d.length;
      if (loud) Off.silence = 0; else Off.silence++;
      if ((Off.silence >= SIL_FRAMES && Off.have >= MIN) || Off.have >= MAX) {
        const all = new Float32Array(Off.have); let o = 0; for (const c of Off.chunks) { all.set(c, o); o += c.length; }
        Off.chunks = []; Off.have = 0; Off.speaking = false; Wave.setTalking(false);
        offlineUtterance(all, Date.now() - live.startedAt - Math.round(1000 * all.length / Off.rate));
      }
    };
    Off.src.connect(Off.proc); Off.proc.connect(Off.ctx.destination);
    setStatus(T('live.offline'), live.expected);
  }
  function stopOffline() { Off.on = false; try { Off.proc && Off.proc.disconnect(); Off.src && Off.src.disconnect(); Off.ctx && Off.ctx.close(); } catch (e) {} Off.proc = Off.src = Off.ctx = null; }
  async function to16k(samples, rate) {
    if (rate === 16000) return samples;
    const off = new OfflineAudioContext(1, Math.ceil(samples.length * 16000 / rate), 16000);
    const buf = off.createBuffer(1, samples.length, rate); buf.copyToChannel(samples, 0);
    const srcN = off.createBufferSource(); srcN.buffer = buf; srcN.connect(off.destination); srcN.start();
    return (await off.startRendering()).getChannelData(0);
  }
  const offQueue = []; let offBusy = false;
  async function offlineUtterance(samples, startMs) {
    offQueue.push({ samples, startMs }); if (offBusy) return; offBusy = true;
    while (offQueue.length && live.on) {
      const { samples, startMs } = offQueue.shift();
      setStatus(T('live.transcribing'), live.expected);
      try {
        const audio = await to16k(samples, Off.rate);
        const r = await Ear.hear(audio, base(prefs.langA), base(prefs.langB));
        if (r && r.text && !/^[\[(]/.test(r.text)) {
          const who = live.forced || (r.lang === base(prefs.langA) ? 'a' : 'b'); live.forced = null; leaveNeutral();
          const node = appendBubble(makeBubble(who, r.text, '', false)); node.querySelector('.trans').textContent = r.text; node.querySelector('.trans').classList.add('pending');
          let trans = ''; try { trans = (await translate(r.text, langOf(who), langOf(other(who)))).text; } catch (e) { trans = ''; }
          node.querySelector('.orig').textContent = r.text; node.querySelector('.trans').textContent = trans || r.text; node.querySelector('.trans').classList.toggle('pending', !trans);
          if (!trans) node.querySelector('.ml').textContent += ' · ' + T('live.notrans');
          $('convo').scrollTop = $('convo').scrollHeight;
          live.lines.push({ who, orig: r.text, trans: trans || r.text, from: langOf(who), to: langOf(other(who)), t: Math.max(0, startMs), dur: Math.round(1000 * samples.length / Off.rate), node });
          note({ ev: 'line', who, by: 'offline', words: r.text.split(/\s+/).length, margin: +r.margin.toFixed(2) });
          setExpected(other(who)); if (trans) speak(trans, langOf(other(who)));
        }
      } catch (e) { console.warn('offline utterance:', e.message); }
      setStatus(T('live.offline'), live.expected);
    }
    offBusy = false;
  }

  /* ---- The ear: Whisper on the device identifies the language from the sound itself, so the engine can be
     aimed without a tap. Only confident calls are acted on; when unsure, the word lists and the chips decide. */
  const EAR_MARGIN_AGREE = 4, EAR_MARGIN_FLIP = 6;   // flipping the engine costs a restart, so it needs stronger proof
  async function startEar() {
    if (!window.Ear || !Ear.supported || !live.stream) return;
    const ok = await Ear.load(); if (!ok || !live.on || !live.stream) return;
    Ear.start(live.stream, base(prefs.langA), base(prefs.langB), onEar);
  }
  async function onEar(r) {
    if (!live.on || live.forced || live.detected) return;
    const who = r.lang === base(prefs.langA) ? 'a' : (r.lang === base(prefs.langB) ? 'b' : null); if (!who) return;
    note({ ev: 'ear', lang: r.lang, margin: +r.margin.toFixed(2), ms: r.ms, expected: live.expected, acted: r.margin >= (who === live.expected ? EAR_MARGIN_AGREE : EAR_MARGIN_FLIP) });
    if (r.margin < (who === live.expected ? EAR_MARGIN_AGREE : EAR_MARGIN_FLIP)) return;
    live.detected = who; live.detectedBy = 'ear'; leaveNeutral();
    if (who === live.expected) { setExpected(who); return; }                 // engine already aimed right; just light the chip
    // Engine was listening in the other language: what it heard so far is nonsense. Aim it, and keep the words Whisper heard.
    if (live.interimEl) { live.interimEl.remove(); live.interimEl = null; }
    live.carry = null; setExpected(who); startRecognizer(langOf(who));
  }
  // The ear judges by accent; a telltale word is stronger evidence. "Hola" said with an English accent is still Spanish.
  function wordsOverrideEar(text) {
    const words = text.toLowerCase().replace(/[^\p{L}\p{M}' ]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 5);
    const otherWho = other(live.detected);
    if (!strongHit(words, langOf(otherWho)) || strongHit(words, langOf(live.detected))) return;
    live.detected = otherWho; live.detectedBy = 'words'; note({ ev: 'words-override-ear', who: otherWho, text: text.slice(0, 60) });
    if (live.interimEl) { live.interimEl.className = 'bubble ' + otherWho + ' interim'; setBubbleWho(live.interimEl, otherWho); }
    if (otherWho !== live.expected) { live.carry = text.trim(); setExpected(otherWho); startRecognizer(langOf(otherWho)); } else setExpected(otherWho);
  }
  function softCommit(text) { if (live.interimEl) handleFinal(text, { soft: true }); }

  async function startLive() {
    if (!SR && !prefs.offline) { toast('This browser has no speech recognition. Use Chrome or Safari.'); return; }
    if (prefs.langA === prefs.langB) { toast('Pick two different languages.'); return; }
    live.on = true; live.netErrors = 0; live.lines = []; live.chunks = []; live.startedAt = Date.now(); live.convoId = 'c_' + live.startedAt; live.forced = null; live.detected = null; live.carry = null; live.detectPending = null; live.flipped = false;
    $('live-setup').hidden = true; $('live-stage').hidden = false; document.body.classList.add('live');
    $('convo').innerHTML = '<p class="convo-hint" id="convo-hint"></p>'; $('convo-hint').textContent = T('live.hint');
    $('who-a-label').textContent = byCode(prefs.langA).native; $('who-b-label').textContent = byCode(prefs.langB).native; $('far-talk-label').textContent = byCode(prefs.langB).native;
    pickAvatars(); Wave.start($('ribbon')); renderSpeakBtn(); Voice.warm();
    setExpected('a'); if (!prefs.offline) startRecognizer(prefs.langA);
    // Nobody has spoken yet: show both chips as choices, light one only once we know who is talking.
    setTabletop(prefs.tabletop);
    live.neutral = true; $('live-stage').classList.add('neutral'); $('who-a').classList.remove('is-live'); $('who-b').classList.remove('is-live'); $('convo-hint').textContent = T('live.hintfirst');
    // Open the audio stream after speech has started (Safari dislikes the reverse order).
    try { live.stream = await navigator.mediaDevices.getUserMedia(MIC); Wave.attach(live.stream); }
    catch (e) { live.stream = null; toast('Mic stream unavailable. Transcription still runs, no waveform or recording.'); }
    if (prefs.offline) startOffline(); else startEar();
    live.levelId = setInterval(() => { const lv = Math.min(1, Wave.level() * 2.2); if (BG) BG.setEnergy(lv); document.documentElement.style.setProperty('--lv', lv.toFixed(3)); }, 80);
    // Recording
    if (live.stream && prefs.record && 'MediaRecorder' in window) {
      try { const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'].find((m) => MediaRecorder.isTypeSupported(m)) || ''; live.recorder = new MediaRecorder(live.stream, mime ? { mimeType: mime } : undefined); live.recorder.ondataavailable = (e) => { if (e.data && e.data.size) live.chunks.push(e.data); }; live.recorder.start(1000); $('rec-dot').classList.remove('off'); }
      catch (e) { live.recorder = null; $('rec-dot').classList.add('off'); }
    } else { live.recorder = null; $('rec-dot').classList.add('off'); }
    live.timerId = setInterval(() => { $('stage-timer').textContent = fmtTimer((Date.now() - live.startedAt) / 1000); }, 500);
    requestWake();
  }

  let wake = null;
  async function requestWake() { try { if (navigator.wakeLock && live.on) wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && live.on) requestWake(); });
  async function stopLive() {
    if (!live.on) return;
    try { if (wake) { wake.release(); wake = null; } } catch (e) {}
    if (window.Ear) Ear.stop(); stopOffline(); offQueue.length = 0;
    live.on = false; live.neutral = false; $('live-stage').classList.remove('neutral'); clearInterval(live.timerId); clearInterval(live.levelId); clearInterval(live.epId); clearTimeout(live.turnId);  clearTimeout(live.interimTid); interimCache.clear(); Voice.stop(); $('siri').className = 'siri'; if (BG) { BG.setEnergy(0); BG.setTint(null, 0); }
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
      const ok = await dbPut({ id: live.convoId, startedAt: live.startedAt, duration, langA: prefs.langA, langB: prefs.langB, title, avatarA: live.avatars.a, avatarB: live.avatars.b, lines: live.lines.map((l) => ({ who: l.who, orig: l.orig, trans: l.trans, from: l.from, to: l.to, t: l.t, dur: l.dur, s: 1 })), audio: audioBlob, mime: audioBlob ? audioBlob.type : null });
      if (ok) { await enforceLimit(); toast('Conversation saved'); } else toast('Could not save on this device');
    }
    $('live-stage').hidden = true; $('live-setup').hidden = false; document.body.classList.remove('live'); pickGuest(); renderAvatarsUI();
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
  $('pick-a').addEventListener('click', () => openLangPicker('a', T('sheet.lang1')));
  $('pick-b').addEventListener('click', () => openLangPicker('b', T('sheet.lang2')));

  // Every 2 to 5 visits, a quiet suggestion to support. Never once they have.
  function maybeNudge() {
    const n = $('nudge'); if (!n) return;
    if (prefs.pro) { n.hidden = true; return; }
    prefs.visits = (prefs.visits || 0) + 1;
    if (!prefs.nudgeAt) prefs.nudgeAt = prefs.visits + 1 + Math.floor(Math.random() * 4); // first one after 2 to 5 visits
    const due = prefs.visits >= prefs.nudgeAt;
    if (due) prefs.nudgeAt = prefs.visits + 2 + Math.floor(Math.random() * 4);           // next one 2 to 5 visits later
    savePrefs(); n.hidden = !due;
  }
  $('nudge-no').addEventListener('click', () => { $('nudge').hidden = true; });
  $('nudge-yes').addEventListener('click', () => { $('nudge').hidden = true; startCheckout(); });
  function renderSetup() {
    renderAvatarsUI(); renderRecent();
    const a = byCode(prefs.langA), b = byCode(prefs.langB);
    $('label-a').textContent = a.native; $('native-a').textContent = a.name;
    $('label-b').textContent = b.native; $('native-b').textContent = b.name;
    $('opt-speak').checked = !!prefs.speak; $('opt-record').checked = !!prefs.record; const oc = $('opt-cues'); if (oc) oc.checked = prefs.cues !== false;
    const oi = $('opt-improve'); if (oi) { oi.checked = !!prefs.improve; $('improve-export').hidden = !prefs.improve; }
    const orow = $('offline-row'); if (orow) { orow.hidden = !(window.Ear && Ear.supported); $('opt-offline').checked = !!prefs.offline; }
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
  $('opt-record').addEventListener('change', (e) => { prefs.record = e.target.checked; savePrefs(); });
  $('start-live').addEventListener('click', startLive);
  $('stop-live').addEventListener('click', stopLive);
  $('who-a').addEventListener('click', () => { if (!live.on) return; note({ ev: 'tap', who: 'a', wasDetected: live.detected, by: live.detectedBy }); leaveNeutral('a'); if (prefs.offline) { live.forced = 'a'; setExpected('a', 'a'); showCue('a'); return; } $('who-a').classList.add('arming'); live.cueOnStart = true; live.detected = 'a'; live.carry = null; setExpected('a', 'a'); startRecognizer(prefs.langA); });
  $('who-b').addEventListener('click', () => { if (!live.on) return; note({ ev: 'tap', who: 'b', wasDetected: live.detected, by: live.detectedBy }); leaveNeutral('b'); if (prefs.offline) { live.forced = 'b'; setExpected('b', 'b'); showCue('b'); return; } $('who-b').classList.add('arming'); $('far-talk').classList.add('arming'); live.cueOnStart = true; live.detected = 'b'; live.carry = null; setExpected('b', 'b'); startRecognizer(prefs.langB); });
  window.addEventListener('beforeunload', () => { if (live.on) stopLive(); });

  /* ---------------- History ---------------- */
  function groupLabel(ts) {
    const d = new Date(ts), now = new Date(); const day = 86400000;
    const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), sn = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diff = Math.round((sn - sd) / day);
    if (diff === 0) return T('hist.today'); if (diff === 1) return T('hist.yesterday'); if (diff < 7) return T('hist.week'); if (diff < 31) return T('hist.month'); return T('hist.earlier');
  }
  async function renderHistory() {
    const list = $('history-list'); list.innerHTML = '';
    const all = (await dbAll()).sort((a, b) => b.startedAt - a.startedAt);
    const lim = keepLimit(); $('history-count').textContent = (lim ? all.length + ' / ' + lim : all.length) + ' ' + T('hist.saved'); renderKeep(); $('hist-clear').hidden = !all.length;
    $('pro-card').hidden = !!prefs.pro;
    if (!all.length) { list.appendChild(el('div', 'history-empty', T('hist.empty'))); return; }
    let lastGroup = null;
    all.forEach((c) => {
      const g = groupLabel(c.startedAt); if (g !== lastGroup) { list.appendChild(el('div', 'history-group', g)); lastGroup = g; }
      list.appendChild(historyRow(c));
    });
    renderRecent(all);
  }
  function historyRow(c, withDate) {
    const from = withDate ? 'live' : 'history';
    const item = el('button', 'history-item');
    const pair = el('span', 'hi-pair'); pair.appendChild(el('span', 'pa')); pair.appendChild(el('span', 'pb')); item.appendChild(pair);
    const mid = el('span'); mid.appendChild(el('div', 'hi-title', c.title || 'Conversation'));
    mid.appendChild(el('div', 'hi-sub', byCode(c.langA).short + ' ↔ ' + byCode(c.langB).short + ' · ' + c.lines.length + ' ' + T('hist.lines') + (c.audio ? ' · ' + T('hist.audio') : ''))); item.appendChild(mid);
    const d = new Date(c.startedAt);
    item.appendChild(el('span', 'hi-time', withDate ? groupLabel(c.startedAt) + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })));
    item.addEventListener('click', () => openPlayback(c, from));
    return item;
  }
  // The same conversations, folded under the Start button so replaying never means leaving the main screen.
  async function renderRecent(all) {
    if (!all) all = (await dbAll()).sort((a, b) => b.startedAt - a.startedAt);
    const box = $('recent-list'); box.innerHTML = ''; $('recent-count').textContent = all.length;
    if (!all.length) { box.appendChild(el('div', 'history-empty', T('hist.empty'))); return; }
    all.slice(0, 5).forEach((c) => box.appendChild(historyRow(c, true)));
    if (all.length > 5) { const more = el('button', 'recent-more', '+' + (all.length - 5)); more.addEventListener('click', () => showView('history')); box.appendChild(more); }
  }
  $('recent-toggle').addEventListener('click', () => { const open = $('recent-list').hidden; $('recent-list').hidden = !open; $('recent-toggle').setAttribute('aria-expanded', String(open)); if (open) renderRecent(); });
  async function openPro() {
    $('pro-email').value = prefs.proEmail || ''; $('pro-status').textContent = '';
    const buy = $('pro-buy'); buy.hidden = true; sheetOpen('pro-sheet');
    const ok = await proStatus();
    if (ok) { buy.hidden = false; }
    else $('pro-status').textContent = 'Checkout isn\'t connected yet.';
  }
  // Straight to Stripe: one tap, no sheet in between. The sheet is only for restoring a past purchase.
  let checkoutBusy = false;
  async function startCheckout() {
    if (checkoutBusy) return; checkoutBusy = true; toast(T('pro.opening'));
    try { const j = await proApi('/api/checkout', {}); location.href = j.url; }
    catch (e) { checkoutBusy = false; toast(e.message || 'Checkout is unavailable right now'); }
  }
  $('go-pro').addEventListener('click', startCheckout);
  $('pro-btn').addEventListener('click', () => { if (prefs.pro) confirmSheet('Turn off Pro on this device?', 'You can restore it any time with your email.', () => { setPro(false); toast('Pro turned off'); }); else startCheckout(); });
  $('pro-restore-btn').addEventListener('click', openPro);
  $('nudge-restore').addEventListener('click', () => { $('nudge').hidden = true; openPro(); });
  $('pro-cancel').addEventListener('click', sheetClose);
  $('pro-buy').addEventListener('click', async () => {
    $('pro-status').textContent = 'Opening checkout…'; $('pro-buy').disabled = true;
    try { const j = await proApi('/api/checkout', {}); location.href = j.url; }
    catch (e) { $('pro-status').textContent = e.message; $('pro-buy').disabled = false; }
  });
  $('pro-activate').addEventListener('click', async () => {
    const email = $('pro-email').value.trim(); if (!email) { $('pro-status').textContent = 'Enter the email you paid with.'; return; }
    $('pro-status').textContent = 'Looking up your purchase…';
    try { const j = await proApi('/api/restore', { email }); setPro(true, j.token, j.email); sheetClose(); toast('Supporter perks restored'); }
    catch (e) { $('pro-status').textContent = e.message; }
  });
  // Back from Stripe Checkout: ?session_id=cs_…
  (async () => {
    const sid = new URLSearchParams(location.search).get('session_id'); if (!sid) return;
    history.replaceState(null, '', location.pathname + (location.hash || '#profile'));
    try { const j = await proApi('/api/verify?session_id=' + encodeURIComponent(sid)); setPro(true, j.token, j.email); showView('profile'); toast('Thank you for supporting Parley'); }
    catch (e) { toast('Could not confirm payment: ' + e.message); }
  })();
  // Re-check a stored token once per day; if the server rejects it, fall back to free.
  (async () => {
    if (!prefs.pro || !prefs.license) return; const last = Number(prefs.proChecked || 0); if (Date.now() - last < 86400000) return;
    try { await proApi('/api/validate', { token: prefs.license }); prefs.proChecked = Date.now(); savePrefs(); }
    catch (e) { if (/401|not|invalid/i.test(e.message)) { setPro(false); toast('Pro needs to be restored on this device'); } }
  })();
  // Export transcript (Pro)
  function transcriptText(c) {
    const lines = c.lines.map((l) => byCode(l.from).short + ': ' + l.orig + '\n' + byCode(l.to).short + ': ' + l.trans).join('\n\n');
    return (c.title || 'Conversation') + ' · ' + new Date(c.startedAt).toLocaleString() + '\n' + byCode(c.langA).name + ' ↔ ' + byCode(c.langB).name + '\n\n' + lines + '\n\n' + T('pb.sharefoot') + ' getparley.vercel.app';
  }
  /* Share a conversation as a vertical video, rendered on the device */
  const reelJobs = {}; // per conversation: { blob, p, mode, conv, state: 'working'|'ready'|'error' }
  let reelShown = null;
  function avatarImg(i) { return new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSVG(i)); }); }
  function reelChip() {
    const j = Object.values(reelJobs).find((x) => x.state !== 'gone' && !x.delivered); const chip = $('reel-chip');
    if (!j) { chip.hidden = true; return; }
    chip.hidden = false; chip.dataset.id = j.conv.id; chip.classList.toggle('ready', j.state === 'ready');
    $('reel-chip-fill').style.width = Math.round((j.state === 'ready' ? 1 : j.p) * 100) + '%';
    $('reel-chip-text').textContent = j.state === 'ready' ? T('reel.chipready') : j.state === 'error' ? 'Could not render' : T('reel.chipmaking') + ' ' + Math.round(j.p * 100) + '%';
  }
  async function deliverReel(j) {
    const ext = j.blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([j.blob], 'parley-' + new Date(j.conv.startedAt).toISOString().slice(0, 10) + '.' + ext, { type: j.blob.type });
    try { if (j.mode === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Parley' }); j.delivered = true; reelChip(); return; } } catch (e) { if (e && e.name === 'AbortError') { reelChip(); return; } }
    const url = URL.createObjectURL(j.blob); const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); j.delivered = true; reelChip(); toast(T('reel.saved'));
  }
  async function makeReel(mode) {
    const c = pb.c; if (!c || !window.Reel) return; if (!('MediaRecorder' in window)) { toast('This browser cannot record video'); return; }
    let j = reelJobs[c.id];
    if (j && j.state === 'ready') { j.mode = mode; j.delivered = false; deliverReel(j); return; } // already made: no re-render
    if (j && j.state === 'working') { j.mode = mode; reelShown = c.id; sheetOpen('reel-sheet'); return; }
    closeAudio(); j = reelJobs[c.id] = { conv: c, blob: null, p: 0, mode, state: 'working' };
    $('reel-fill').style.width = '0%'; $('reel-status').textContent = '0%'; reelShown = c.id; sheetOpen('reel-sheet'); reelChip();
    setTimeout(() => { if (openSheet === 'reel-sheet' && reelShown === c.id) sheetClose(); }, 1800); // pops up briefly, then keeps going in the corner
    try {
      j.blob = await Reel.make(c, { lineStart, lineSpan, short: (code) => byCode(code).short, native: (code) => byCode(code).native, avatarImg }, (p) => {
        j.p = p; if (reelShown === c.id && openSheet === 'reel-sheet') { $('reel-fill').style.width = Math.round(p * 100) + '%'; $('reel-status').textContent = Math.round(p * 100) + '%'; } reelChip();
      });
      if (j.state === 'gone') return; j.state = 'ready'; if (openSheet === 'reel-sheet') sheetClose(); reelChip(); toast(T('reel.ready'));
    } catch (e) { j.state = 'error'; reelChip(); setTimeout(() => { delete reelJobs[c.id]; reelChip(); }, 4000); }
  }
  $('reel-cancel').addEventListener('click', () => { const j = reelJobs[reelShown]; if (j) { j.state = 'gone'; delete reelJobs[reelShown]; } sheetClose(); reelChip(); });
  $('reel-chip').addEventListener('click', () => {
    const j = reelJobs[$('reel-chip').dataset.id]; if (!j) return;
    if (j.state === 'ready') deliverReel(j); else if (j.state === 'working') { reelShown = j.conv.id; sheetOpen('reel-sheet'); }
  });
  $('pb-share').addEventListener('click', () => makeReel('share'));
  $('pb-export').addEventListener('click', () => makeReel('download'));

  /* ---------------- Playback ---------------- */
  const pb = { c: null, audio: null, url: null, raf: null, playing: false, start: 0, elapsed: 0 };
  function openPlayback(c, from) {
    pb.c = c; pb.from = from || 'history'; closeAudio();
    $('pb-back').textContent = pb.from === 'live' ? T('pb.home') : T('pb.back');
    $('pb-date').textContent = new Date(c.startedAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    $('pb-title').textContent = c.title || 'Conversation';
    $('pb-noaudio').hidden = !!c.audio;
    $('pb-dur').textContent = fmtTime(c.duration); $('pb-convo').innerHTML = ''; renderPlaybackTrack(c);
    if (c.audio) { pb.url = URL.createObjectURL(c.audio); pb.audio = new Audio(pb.url); pb.audio.addEventListener('ended', () => { pb.playing = false; $('pb-play').classList.remove('playing'); }); }
    renderPlaybackLines(0);
    showView('playback');
  }
  function closeAudio() { if (pb.audio) { try { pb.audio.pause(); } catch (e) {} } if (pb.url) URL.revokeObjectURL(pb.url); pb.audio = null; pb.url = null; pb.playing = false; cancelAnimationFrame(pb.raf); pb.elapsed = 0; $('pb-play').classList.remove('playing'); $('pb-scrub').value = 0; $('pb-cur').textContent = '0:00'; }
  // Lines saved before v31 carry the time the line was finalized, not when speech began; estimate the start from length.
  // [start, end] in ms of when a line is being spoken; words are revealed across it
  function lineSpan(c, i) { const l = c.lines[i]; const st = lineStart(c, i); const nxt = c.lines[i + 1] ? lineStart(c, i + 1) : (c.duration || 0) * 1000; const len = (l.s && l.dur) ? l.dur : 300 + l.orig.split(/\s+/).length * 330; const end = Math.max(st + 400, Math.min(nxt, st + len)); return [st, st + (end - st) * 0.78]; } // reveal runs a bit ahead of the voice so words never trail it
  function wordSpans(parent, text) { const out = []; text.split(' ').forEach((w, k, arr) => { const s = el('span', 'w', w); out.push(s); parent.appendChild(s); if (k < arr.length - 1) parent.appendChild(document.createTextNode(' ')); }); return out; }
  function lineStart(c, i) { const l = c.lines[i]; if (l.s) return l.t; const est = l.t - Math.min(12000, 300 + l.orig.split(/\s+/).length * 330); const prev = i ? lineStart(c, i - 1) + 800 : 0; return Math.max(prev, est, 0); }
  function renderPlaybackLines(timeMs) {
    const box = $('pb-convo'); const liveMode = $('pb-livemode').checked;
    if (!box.childElementCount) {
      pb.c.lines.forEach((l) => {
        const b = el('div', 'bubble ' + l.who); const od = el('div', 'orig'), td = el('div', 'trans'); b._o = wordSpans(od, l.orig); b._t = wordSpans(td, l.trans); b.appendChild(od); b.appendChild(td); const m = el('div', 'meta'); const av = el('span', 'bav'); av.innerHTML = avatarSVG(l.who === 'a' ? (pb.c.avatarA ?? prefs.avatar) : (pb.c.avatarB ?? 5)); m.appendChild(av); m.appendChild(el('span', 'ml', byCode(l.from).short + ' → ' + byCode(l.to).short + ' · ' + fmtTime(l.t / 1000))); b.appendChild(m); b.dataset.t = lineStart(pb.c, pb.c.lines.indexOf(l)); box.appendChild(b);
      });
    }
    // Which line is being said right now? (saved lines carry t and dur; older ones get dur from the next line)
    const lines = pb.c.lines; let nowIdx = -1;
    lines.forEach((l, i) => { const st = lineStart(pb.c, i); const end = lines[i + 1] ? lineStart(pb.c, i + 1) : pb.c.duration * 1000; if (timeMs >= st && timeMs < end) nowIdx = i; });
    const bubbles = box.querySelectorAll('.bubble'); let newest = null;
    bubbles.forEach((b, i) => {
      const hidden = liveMode && Number(b.dataset.t) > timeMs;
      if (b.classList.contains('hidden-replay') && !hidden && liveMode) { b.classList.add('arrive'); newest = b; }
      b.classList.toggle('hidden-replay', hidden);
      b.classList.toggle('now', liveMode && i === nowIdx);
      b.classList.toggle('past', liveMode && !hidden && i !== nowIdx);
      // words appear as they are spoken
      const sp = lineSpan(pb.c, i); const f = !liveMode ? 1 : Math.max(0, Math.min(1, (timeMs - sp[0]) / Math.max(1, sp[1] - sp[0])));
      const no = Math.ceil(f * b._o.length), nt = Math.ceil(f * b._t.length);
      if (b._no !== no || b._nt !== nt) { b._o.forEach((s, k) => s.classList.toggle('on', k < no)); b._t.forEach((s, k) => s.classList.toggle('on', k < nt)); b._no = no; b._nt = nt; }
    });
    if (newest) newest.scrollIntoView({ block: 'end', behavior: 'smooth' });
    const who = nowIdx >= 0 ? lines[nowIdx].who : null;
    $('pbw-a').classList.toggle('is-live', liveMode && who === 'a'); $('pbw-b').classList.toggle('is-live', liveMode && who === 'b');
  }
  function renderPlaybackTrack(c) {
    const tr = $('pb-track'); tr.innerHTML = ''; const total = Math.max(1, c.duration * 1000);
    c.lines.forEach((l, i) => { const st = lineStart(c, i); const end = Math.min(c.lines[i + 1] ? lineStart(c, i + 1) : total, st + (l.s && l.dur ? l.dur : 300 + l.orig.split(/\s+/).length * 330)); const seg = el('i', l.who); seg.style.left = (100 * st / total) + '%'; seg.style.width = Math.max(0.8, 100 * (end - st) / total) + '%'; tr.appendChild(seg); });
    const da = $('pbw-a').querySelector('.who-dot'), db = $('pbw-b').querySelector('.who-dot');
    da.innerHTML = avatarSVG(c.avatarA ?? prefs.avatar); db.innerHTML = avatarSVG(c.avatarB ?? 5);
    $('pbw-a-label').textContent = byCode(c.langA).short; $('pbw-b-label').textContent = byCode(c.langB).short;
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
  $('pb-back').addEventListener('click', () => { closeAudio(); $('pb-convo').innerHTML = ''; showView(pb.from === 'live' ? 'live' : 'history'); });
  $('pb-delete').addEventListener('click', () => confirmSheet(T('pb.deleteq'), T('pb.deletesub'), async () => { await dbDel(pb.c.id); closeAudio(); $('pb-convo').innerHTML = ''; toast(T('pb.deleted')); showView('history'); }));

  /* ---------------- Confirm ---------------- */
  let confirmCb = null;
  function confirmSheet(title, sub, cb) { $('confirm-title').textContent = title; $('confirm-sub').textContent = sub; confirmCb = cb; sheetOpen('confirm-sheet'); }
  $('confirm-no').addEventListener('click', sheetClose);
  $('confirm-yes').addEventListener('click', () => { const cb = confirmCb; confirmCb = null; sheetClose(); if (cb) cb(); });

  /* ---------------- Profile ---------------- */
  function renderProfile() {
    $('profile-avatar').innerHTML = avatarSVG(prefs.avatar);
    $('profile-name-display').textContent = prefs.name || 'Traveler';
    $('profile-plan').textContent = prefs.pro ? T('prof.supporter') : T('prof.free');
    const prb = $('pro-restore-btn'); if (prb) prb.hidden = !!prefs.pro;
    const ps = $('pro-sub'), pbt = $('pro-btn'); if (ps) ps.textContent = prefs.pro ? T('set.proon') : T('set.profree'); if (pbt) pbt.textContent = prefs.pro ? T('set.deactivate') : T('set.support');
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
  $('profile-lang-btn').addEventListener('click', () => openLangPicker('p', T('prof.default')));
  const clearAll = () => confirmSheet(T('hist.clearq'), T('hist.clearsub'), async () => { await dbClear(); toast(T('hist.cleared')); renderHistory(); });
  $('clear-all').addEventListener('click', clearAll);
  $('hist-clear').addEventListener('click', clearAll);
  document.querySelectorAll('.keep-seg .seg-btn').forEach((b) => b.addEventListener('click', async () => {
    const n = Number(b.dataset.keep);
    if (!prefs.pro && (n === 0 || n > FREE_LIMIT)) { openPro(); return; }
    const all = (await dbAll()).sort((x, y) => y.startedAt - x.startedAt);
    const drop = n ? Math.max(0, all.length - n) : 0;
    const apply = async () => { prefs.keep = n; savePrefs(); await enforceLimit(); renderHistory(); };
    if (drop) confirmSheet(T('hist.keepq').replace('{n}', n), T('hist.keepsub').replace('{d}', drop), apply); else apply();
  }));

  // Voice sheet
  function voiceLabel() {
    const parts = [prefs.langA, prefs.langB].map((c) => { const id = Voice.voiceFor(c); const v = KVOICES.find((x) => x[0] === id); return byCode(c).short + ' ' + (v ? v[1] : 'device voice'); });
    return parts.join(' · ');
  }
  let lastPick = null; // { lang, voice } - what Preview plays
  function renderVoiceSheet() {
    prefs.voiceEngine = 'kokoro';
    const note = $('voice-engine-note'), list = $('voice-list'); list.innerHTML = '';
    note.innerHTML = 'Kokoro, open source, runs on your device. One ~90 MB download, then it works offline. Covers EN · ES · PT · FR · IT · HI · JA · ZH; other languages use your phone\'s voice. Tap a voice, then Preview.<div class="dl-bar"><i id="voice-dl" style="width:' + (Voice.ready() ? 100 : 0) + '%"></i></div><span class="voice-status" id="voice-status"></span>';
    Voice.status();
    const langs = [...new Set(KVOICES.map((v) => v[2]))];
    const mine = [base(prefs.langA), base(prefs.langB)];
    langs.sort((a, b) => (mine.includes(b) ? 1 : 0) - (mine.includes(a) ? 1 : 0));
    langs.forEach((lg) => {
      list.appendChild(el('div', 'history-group', byCode(LANGS.find((l) => base(l.code) === lg).code).name + (mine.includes(lg) ? ' · in use' : '')));
      KVOICES.filter((v) => v[2] === lg).forEach((v) => {
        const sel = Voice.voiceFor(lg) === v[0];
        const row = el('button', 'lang-row voice-row' + (sel ? ' is-selected' : ''));
        row.appendChild(el('span', 'lang-code', lg.toUpperCase())); row.appendChild(el('span', 'lang-name', v[1])); row.appendChild(el('span', 'voice-tag', v[3] === 'F' ? 'Female' : 'Male'));
        row.addEventListener('click', () => { prefs.voices = prefs.voices || {}; prefs.voices[lg] = v[0]; lastPick = { lang: lg, voice: v[0] }; savePrefs(); renderVoiceSheet(); });
        list.appendChild(row);
      });
    });
    $('voice-sub').textContent = voiceLabel();
  }
  $('voice-btn').addEventListener('click', () => { renderVoiceSheet(); sheetOpen('voice-sheet'); });
  $('voice-done').addEventListener('click', () => { sheetClose(); renderProfile(); });
  const PLAY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>';
  const SAMPLES = { en: 'Hi, this is how I sound.', es: 'Hola, así es como sueno.', pt: 'Oi, é assim que eu soo.', fr: 'Salut, voilà comment je sonne.', it: 'Ciao, ecco come suono.', hi: 'नमस्ते, मेरी आवाज़ ऐसी है।', ja: 'こんにちは、こんな声です。', zh: '你好，我的声音是这样的。', de: 'Hallo, so klinge ich.', ko: '안녕하세요, 제 목소리예요.', th: 'สวัสดี นี่คือเสียงของฉัน', ar: 'مرحبا، هكذا يبدو صوتي.', ru: 'Привет, вот как я звучу.', nl: 'Hoi, zo klink ik.', tr: 'Merhaba, sesim böyle.', id: 'Halo, begini suaraku.', vi: 'Xin chào, giọng tôi như thế này.' };
  let previewBtn = null;
  async function playPreview(btn, lg, engine, key) {
    if (previewBtn) previewBtn.classList.remove('playing'); previewBtn = btn; if (btn) btn.classList.add('playing');
    try { await Voice.preview(SAMPLES[lg] || SAMPLES.en, lg, engine, key); } finally { if (btn) btn.classList.remove('playing'); }
  }
  $('voice-preview').addEventListener('click', () => {
    const pick = lastPick || { lang: base(prefs.langA), voice: Voice.voiceFor(base(prefs.langA)) };
    const btn = $('voice-preview'); btn.classList.add('playing');
    playPreview(null, pick.lang, 'kokoro', pick.voice).finally(() => btn.classList.remove('playing'));
  });

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
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) { toast(T('hero.installed')); return; }
    openInstallSheet();
  });
  const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const MENU_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  function openInstallSheet() {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /android/i.test(ua);
    const safariDesktop = !ios && /safari/i.test(ua) && !/chrome|chromium|edg/i.test(ua);
    const firefox = /firefox/i.test(ua);
    const steps = ios ? [T('inst.ios1').replace('{icon}', SHARE_ICON), T('inst.ios2'), T('inst.ios3')]
      : android ? [T('inst.and1').replace('{icon}', MENU_ICON), T('inst.and2'), T('inst.and3')]
      : safariDesktop ? [T('inst.saf1').replace('{icon}', SHARE_ICON), T('inst.saf2'), T('inst.saf3')]
      : firefox ? [T('inst.ff1'), T('inst.ff2')]
      : [T('inst.desk1'), T('inst.desk2'), T('inst.desk3')];
    const ol = $('inst-steps'); ol.innerHTML = ''; steps.forEach((h) => { const li = document.createElement('li'); li.innerHTML = '<span>' + h + '</span>'; ol.appendChild(li); });
    sheetOpen('install-sheet');
  }
  $('install-done').addEventListener('click', sheetClose);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').then((reg) => { try { reg.update(); } catch (e) {} }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || live.on) return; reloaded = true; location.reload(); });
  }

  /* ---------------- Boot ---------------- */
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); } catch (e) {} }
  applyPalette(prefs.palette);
  (function uiLang() {
    if (!window.I18N) return;
    document.querySelectorAll('select[data-ui-lang]').forEach((sel) => { if (!sel.options.length) I18N.LANGS.forEach(([c, n]) => { const o = document.createElement('option'); o.value = c; o.textContent = n; sel.appendChild(o); }); sel.addEventListener('change', () => I18N.set(sel.value)); });
    const sel = null;
    const sub = () => { const e = $('uilang-sub'); if (e) e.textContent = (I18N.LANGS.find((l) => l[0] === I18N.lang) || ['', 'English'])[1]; };
    document.addEventListener('i18n:change', () => { sub(); renderProfile(); if (typeof renderHistory === 'function') renderHistory(); });
    I18N.apply(); sub();
  })();
  document.querySelectorAll('.palette-seg .seg-btn').forEach((b) => b.addEventListener('click', () => { applyPalette(b.dataset.pal); savePrefs(); }));
  renderSetup(); renderProfile(); maybeNudge();
  const hash = (location.hash || '').replace('#', '');
  if (['history', 'profile'].includes(hash)) showView(hash);
  // ?demo=1 - preview the live screen with sample lines, no microphone
  if (/[?&]demo=1/.test(location.search)) {
    $('live-setup').hidden = true; $('live-stage').hidden = false; $('rec-dot').classList.add('off'); document.body.classList.add('live');
    $('who-a-label').textContent = byCode(prefs.langA).native; $('who-b-label').textContent = byCode(prefs.langB).native; $('far-talk-label').textContent = byCode(prefs.langB).native;
    pickAvatars(); Wave.start($('ribbon')); setExpected('b');
    [['a', 'Hey, is this table free?', 'Oye, ¿está libre esta mesa?'], ['b', 'Sí, siéntense. ¿Qué les traigo?', 'Yes, sit down. What can I get you?'], ['a', 'Two cold beers and the fish tacos.', 'Dos cervezas frías y los tacos de pescado.']]
      .forEach((l) => appendBubble(makeBubble(l[0], l[1], l[2])));
  }
})();
