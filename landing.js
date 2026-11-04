/* Parley landing - voxel hero, scroll reveal, looping demo */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  // Honor the palette chosen in the app (same origin, same localStorage).
  try { const p = JSON.parse(localStorage.getItem('parley.prefs.v1') || '{}').palette; document.documentElement.setAttribute('data-palette', p || 'night'); } catch (e) {}
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (k) => (window.I18N ? I18N.t(k) : k);

  /* ---------- UI language (chips in the hero) ---------- */
  (function uiLang() {
    if (!window.I18N) return;
    const box = document.getElementById('hero-langs');
    if (box) {
      I18N.LANGS.forEach(([c, n]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.lang = c; b.textContent = n; b.addEventListener('click', () => I18N.set(c)); box.appendChild(b); });
      const mark = () => box.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === I18N.lang));
      document.addEventListener('i18n:change', mark); mark();
    }
    I18N.apply();
  })();

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((n, i) => { n.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(n); });
  // Hero is visible at rest
  document.querySelectorAll('.hero .reveal').forEach((n) => n.classList.add('in'));

  /* ---------- Language flip on the headline: eases in, blurs through, eases out ---------- */
  (function flip() {
    const el = document.getElementById('flip-word'); if (!el || reduce) return;
    const home = T('hero.word');
    const pool = ['Translation', 'Traducción', 'Tradução', '翻訳', '번역', 'Übersetzung', 'Traduction', 'अनुवाद', 'การแปล', 'Traduzione', '翻译', 'Перевод', 'ترجمة', 'Vertaling', 'Çeviri', 'Terjemahan', 'Dịch', 'Μετάφραση', 'Tłumaczenie'].filter((w) => w !== home);
    const N = 22; // frames before settling
    const words = []; for (let k = 0; k < N; k++) words.push(pool[k % pool.length]);
    words.push(home);
    document.addEventListener('i18n:change', () => { if (el.classList.contains('settled') || reduce) el.textContent = T('hero.word'); });
    // delay per frame: slow at both ends, fast in the middle (cosine ease)
    const delay = (k) => { const t = k / (N - 1); const ease = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); return (320 - 270 * ease) / 3; };
    let i = 0; el.textContent = words[0]; el.classList.add('flipping');
    const step = () => {
      i++; const last = i === words.length - 1;
      el.classList.remove('in'); void el.offsetWidth; el.textContent = last ? T('hero.word') : words[i]; el.classList.add('in');
      if (last) { el.classList.remove('flipping'); el.classList.add('settled'); return; }
      setTimeout(step, delay(i));
    };
    setTimeout(step, 140);
  })();

  /* ---------- Header scrim once scrolled ---------- */
  (function headScrim() {
    const head = document.querySelector('.site-head'); if (!head) return;
    const on = () => head.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', on, { passive: true }); on();
  })();

  /* ---------- Shader hero ---------- */
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  (function () { const c = document.getElementById('hero-canvas'); if (c && window.Aurora) Aurora.mount(c, { scrollTilt: true, dim: 1, maxDpr: 1, colors: [cssVar('--bg-c1'), cssVar('--bg-c2'), cssVar('--bg-c3')] }); })();

  /* ---------- Demo phone ---------- */
  let demoSpeaker = 'a', demoTalk = false;
  (function demo() {
    const convo = document.getElementById('demo-convo'); if (!convo) return;
    const status = document.getElementById('demo-status'), pillA = document.getElementById('demo-pill-a'), pillB = document.getElementById('demo-pill-b');
    const script = [
      { who: 'a', orig: 'Hey, is this table free?', trans: 'Oye, ¿está libre esta mesa?' },
      { who: 'b', orig: 'Sí, siéntense. ¿Qué les traigo?', trans: 'Yes, sit down. What can I get you?' },
      { who: 'a', orig: 'Two cold beers and the fish tacos.', trans: 'Dos cervezas frías y los tacos de pescado.' },
      { who: 'b', orig: 'Perfecto. ¿Con todo?', trans: 'Perfect. With everything?' },
      { who: 'a', orig: 'With everything. Thank you!', trans: 'Con todo. ¡Gracias!' },
    ];
    let i = 0, timer;
    function setWho(who) {
      status.textContent = T('demo.listening'); status.className = 'mono right ' + who;
      pillA.classList.toggle('live', who === 'a'); pillB.classList.toggle('live', who === 'b'); demoSpeaker = who;
    }
    function push(line) {
      const b = document.createElement('div'); b.className = 'bubble ' + line.who;
      const o = document.createElement('div'); o.className = 'orig'; o.textContent = line.orig;
      const t = document.createElement('div'); t.className = 'trans'; t.textContent = '';
      b.appendChild(o); b.appendChild(t); convo.appendChild(b);
      while (convo.childElementCount > 4) convo.removeChild(convo.firstElementChild);
      let k = 0; const words = line.trans.split(' ');
      const type = () => { if (k < words.length) { t.textContent = words.slice(0, ++k).join(' '); setTimeout(type, 110); } };
      type();
    }
    function step() {
      const line = script[i % script.length]; setWho(line.who); demoTalk = true;
      timer = setTimeout(() => { push(line); demoTalk = false; i++; timer = setTimeout(step, 2600); }, 1400);
    }
    const phone = document.getElementById('phone');
    const pio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !timer) step(); }), { threshold: 0.3 });
    pio.observe(phone);

    // Siri ribbon for the demo
    const rb = window.Ribbon ? Ribbon.mount(document.getElementById('demo-ribbon')) : null;
    (function pulse(t) { requestAnimationFrame(pulse); if (!rb) return; rb.setColor(demoSpeaker === 'b' ? 'rgba(255,255,255,0.75)' : '#ffffff'); rb.setTalking(demoTalk); rb.setLevel(demoTalk ? 0.35 + 0.45 * Math.abs(Math.sin(t / 170) * Math.sin(t / 430)) : 0); })(0);
  })();

  /* ---------- Language marquee ---------- */
  const LANGS = ['English|EN', 'Español|ES', 'Português|PT', '中文|ZH', 'हिन्दी|HI', 'ไทย|TH', '한국어|KO', '日本語|JA', 'Français|FR', 'Deutsch|DE', 'Italiano|IT', 'العربية|AR', 'Русский|RU', 'Bahasa Indonesia|ID', 'Tiếng Việt|VI', 'Türkçe|TR', 'Nederlands|NL', 'Polski|PL', 'Filipino|FIL', 'Kiswahili|SW', 'বাংলা|BN', 'اردو|UR', 'עברית|HE', 'Ελληνικά|EL', 'Svenska|SV', 'Українська|UK', 'Bahasa Melayu|MS', 'فارسی|FA'];
  function fill(id, list) { const t = document.getElementById(id); if (!t) return; const items = list.concat(list); items.forEach((s) => { const [n, c] = s.split('|'); const d = document.createElement('div'); d.className = 'lang-tile'; d.innerHTML = '<b></b><span></span>'; d.firstChild.textContent = n; d.lastChild.textContent = c; t.appendChild(d); }); }
  fill('marquee-1', LANGS.slice(0, 14)); fill('marquee-2', LANGS.slice(14));

  /* ---------- Install CTA ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
  const cta = document.getElementById('install-cta'), tip = document.getElementById('install-tip');
  if (cta) cta.addEventListener('click', (e) => {
    if (installEvt) { e.preventDefault(); installEvt.prompt(); installEvt = null; return; }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /android/i.test(navigator.userAgent);
    if (standalone || ios || tip) { e.preventDefault(); tip.textContent = standalone ? T('hero.installed') : ios ? T('hero.iostip') : android ? T('hero.androidtip') : T('hero.desktoptip'); tip.hidden = false; }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
