/* Parley landing — voxel hero, scroll reveal, looping demo */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((n, i) => { n.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(n); });
  // Hero is visible at rest
  document.querySelectorAll('.hero .reveal').forEach((n) => n.classList.add('in'));

  /* ---------- Shader hero ---------- */
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  (function () { const c = document.getElementById('hero-canvas'); if (c && window.Aurora) Aurora.mount(c, { scrollTilt: true, dim: 1, maxDpr: 1, colors: [cssVar('--volt'), cssVar('--mid'), cssVar('--blue')] }); })();

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
      status.textContent = who === 'a' ? 'Listening · English' : 'Listening · Español'; status.className = 'mono right ' + who;
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
    (function pulse(t) { requestAnimationFrame(pulse); if (!rb) return; rb.setColor(cssVar(demoSpeaker === 'b' ? '--blue' : '--volt')); rb.setTalking(demoTalk); rb.setLevel(demoTalk ? 0.35 + 0.45 * Math.abs(Math.sin(t / 170) * Math.sin(t / 430)) : 0); })(0);
  })();

  /* ---------- Language marquee ---------- */
  const LANGS = ['English|EN', 'Español|ES', 'Português|PT', '中文|ZH', 'हिन्दी|HI', 'ไทย|TH', '한국어|KO', '日本語|JA', 'Français|FR', 'Deutsch|DE', 'Italiano|IT', 'العربية|AR', 'Русский|RU', 'Bahasa Indonesia|ID', 'Tiếng Việt|VI', 'Türkçe|TR', 'Nederlands|NL', 'Polski|PL', 'Filipino|FIL', 'Kiswahili|SW', 'বাংলা|BN', 'اردو|UR', 'עברית|HE', 'Ελληνικά|EL', 'Svenska|SV', 'Українська|UK', 'Bahasa Melayu|MS', 'فارسی|FA'];
  function fill(id, list) { const t = document.getElementById(id); if (!t) return; const items = list.concat(list); items.forEach((s) => { const [n, c] = s.split('|'); const d = document.createElement('div'); d.className = 'lang-tile'; d.innerHTML = '<b></b><span></span>'; d.firstChild.textContent = n; d.lastChild.textContent = c; t.appendChild(d); }); }
  fill('marquee-1', LANGS.slice(0, 14)); fill('marquee-2', LANGS.slice(14));

  /* ---------- Install CTA ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
  const cta = document.getElementById('install-cta');
  if (cta) cta.addEventListener('click', (e) => { if (installEvt) { e.preventDefault(); installEvt.prompt(); installEvt = null; } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
