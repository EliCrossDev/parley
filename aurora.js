/* Parley — Aurora: Siri-style fluid light field (raw WebGL fragment shader).
   Aurora.mount(canvas, opts) → { setTint(rgb, amount), setEnergy(0..1), setColors([r,g,b],[r,g,b],[r,g,b]), setDim(x), destroy() }
   Three soft light masses drift through warped noise. Energy (voice level) makes them swell and brighten.
   Tint pulls the whole field toward one speaker's color. */
window.Aurora = (function () {
  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uScroll;
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
uniform float uTint; uniform vec3 uTintCol; uniform float uEnergy; uniform float uDim;
vec3 hash3(vec2 p){ vec3 q = vec3(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9))); return fract(sin(q) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash3(i).x, b = hash3(i+vec2(1,0)).x, c = hash3(i+vec2(0,1)).x, d = hash3(i+vec2(1,1)).x;
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { v += a*noise(p); p = m*p; a *= 0.5; } return v; }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float t = uTime * 0.05;
  float e = uEnergy;
  vec2 m = uMouse * vec2(0.05, 0.03);
  float horizon = -0.08 - uScroll * 0.25 + m.y;
  float y = uv.y - horizon;                 // 0 at horizon, + up, - down
  // ---- sky: stacked warm gradient
  vec3 cTop = uC1;                           // sky top (palette)
  vec3 cMid = uC2;                           // mid band (palette)
  vec3 cHor = uC3;                           // horizon (palette)
  vec3 cHi  = mix(cTop, cMid, 0.45);
  vec3 cLow = mix(cMid, cHor, 0.55);
  float sy = clamp(y / 0.9, 0.0, 1.0);
  vec3 sky = mix(cHor, cLow, smoothstep(0.0, 0.14, sy));
  sky = mix(sky, cMid, smoothstep(0.10, 0.36, sy));
  sky = mix(sky, cHi, smoothstep(0.32, 0.62, sy));
  sky = mix(sky, cTop, smoothstep(0.58, 1.0, sy));
  // ---- sun
  vec2 sunP = vec2(0.12 + m.x * 0.5, horizon + 0.05);
  float sd = length((uv - sunP) * vec2(1.0, 1.08));
  float sunR = 0.11 + e * 0.02;
  float disc = 1.0 - smoothstep(sunR - 0.004, sunR + 0.004, sd);
  float glow = exp(-sd * (6.0 - e * 2.5)) * (1.2 + e * 0.8);
  float halo = exp(-sd * 2.2) * 0.35;
  vec3 sunCol = vec3(1.0, 0.93, 0.78);
  // ---- clouds: long streaks, warm lit undersides near the sun
  vec2 cp = vec2(uv.x * 1.2 + t * 1.6, y * 5.5);
  float cl = fbm(cp * 1.4 + vec2(0.0, 3.0)) * fbm(cp * 0.6 - t);
  float cmask = smoothstep(0.22, 0.42, cl) * smoothstep(0.0, 0.08, y) * smoothstep(0.95, 0.25, y);
  vec3 cloudCol = mix(vec3(0.55, 0.18, 0.45), vec3(1.0, 0.72, 0.45), exp(-sd * 3.0) * 0.9 + 0.15);
  vec3 col = sky;
  col = mix(col, cloudCol, cmask * 0.75);
  col += sunCol * glow * (1.0 - cmask * 0.5);
  col += sunCol * halo;
  col += sunCol * disc * (1.6 - cmask * 0.8);
  // ---- water below the horizon: mirrored sky, darker, with a shimmering sun path
  if (y < 0.0) {
    float depth = -y;
    float ripple = fbm(vec2(uv.x * 14.0 + t * 8.0, depth * 60.0 - uTime * 0.6)) - 0.5;
    vec3 wsky = mix(cHor, cLow, smoothstep(0.0, 0.2, depth));
    wsky = mix(wsky, vec3(0.16, 0.06, 0.26), smoothstep(0.05, 0.7, depth));
    float path = exp(-abs(uv.x - sunP.x + ripple * 0.09) * (9.0 + depth * 30.0)) * exp(-depth * 3.5);
    float glint = smoothstep(0.35, 0.6, fbm(vec2(uv.x * 40.0 + uTime * 1.5, depth * 90.0)) + ripple) * path;
    col = wsky * 0.75 + sunCol * (path * (0.9 + e * 0.6) + glint * 0.8) + ripple * 0.03;
    col = mix(col, col * 0.5, smoothstep(0.0, 0.8, depth));
  }
  // horizon haze
  col += cHor * exp(-abs(y) * 40.0) * 0.25;
  // speaker tint (subtle) and voice warmth
  col = mix(col, uTintCol * dot(col, vec3(0.33)) * 1.1, uTint * 0.22);
  col *= 1.0 + e * 0.25;
  // grain + vignette
  col += (fbm(uv * 9.0 + uTime) - 0.5) * 0.025;
  col *= 1.0 - smoothstep(0.75, 1.5, length(uv * vec2(0.75, 1.1)));
  col = pow(col / (1.0 + col * 0.45), vec3(0.95)); col = mix(vec3(dot(col, vec3(0.33))), col, 1.25);
  gl_FragColor = vec4(col * uDim, 1.0);
}`;
  function hexToRgb(h) { h = String(h).trim().replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  function mount(canvas, opts) {
    opts = opts || {};
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uRes', 'uTime', 'uMouse', 'uScroll', 'uC1', 'uC2', 'uC3', 'uTint', 'uTintCol', 'uEnergy', 'uDim'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    let mx = 0, my = 0, tx = 0, ty = 0, scroll = 0, visible = true, alive = true, drew = false;
    let tint = 0, tintT = 0, tintCol = [1, 1, 1], tintColT = [1, 1, 1], energy = 0, energyT = 0, dim = opts.dim == null ? 1 : opts.dim;
    let C = (opts.colors || ['#1b1040', '#d8457a', '#ffb060']).map((c) => Array.isArray(c) ? c : hexToRgb(c));
    const onMove = (e) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; };
    const onScroll = () => { scroll = window.scrollY; };
    const onVis = () => { visible = !document.hidden; };
    window.addEventListener('pointermove', onMove, { passive: true });
    if (opts.scrollTilt) window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    function resize() { const dpr = Math.min(opts.maxDpr || 1, window.devicePixelRatio || 1); const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height); }
    window.addEventListener('resize', resize); resize();
    function frame(t) {
      if (!alive) return; requestAnimationFrame(frame);
      if (!visible) return; if (reduce && drew && !opts.alwaysAnimate) return; drew = true;
      mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
      tint += (tintT - tint) * 0.05; energy += (energyT - energy) * 0.18;
      for (let i = 0; i < 3; i++) tintCol[i] += (tintColT[i] - tintCol[i]) * 0.05;
      const p = opts.scrollTilt ? Math.min(1, scroll / (window.innerHeight * 1.3)) : 0;
      gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform1f(U.uTime, t / 1000); gl.uniform2f(U.uMouse, mx, -my); gl.uniform1f(U.uScroll, p);
      gl.uniform3f(U.uC1, C[0][0], C[0][1], C[0][2]); gl.uniform3f(U.uC2, C[1][0], C[1][1], C[1][2]); gl.uniform3f(U.uC3, C[2][0], C[2][1], C[2][2]);
      gl.uniform1f(U.uTint, tint); gl.uniform3f(U.uTintCol, tintCol[0], tintCol[1], tintCol[2]); gl.uniform1f(U.uEnergy, energy); gl.uniform1f(U.uDim, dim);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
    return {
      setTint(rgb, amount) { if (rgb) tintColT = (Array.isArray(rgb) ? rgb : hexToRgb(rgb)).slice(); tintT = amount == null ? 1 : amount; },
      setEnergy(x) { energyT = Math.max(0, Math.min(1, x)); },
      setColors(a, b, c) { C = [a, b, c].map((v) => Array.isArray(v) ? v : hexToRgb(v)); },
      setDim(x) { dim = x; },
      destroy() { alive = false; window.removeEventListener('pointermove', onMove); window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', resize); },
    };
  }
  return { mount, hexToRgb };
})();

/* Ribbon — Siri-style voice line. Ribbon.mount(canvas) → { setLevel(0..1), setColor(css), setTalking(bool), destroy() } */
window.Ribbon = (function () {
  function mount(canvas) {
    const ctx = canvas.getContext('2d'); let level = 0, target = 0, color = '#ff6fb5', talking = false, alive = true, t0 = performance.now();
    const waves = [ { f: 1.0, a: 1.0, s: 1.0, w: 2.2 }, { f: 1.6, a: 0.7, s: -1.3, w: 1.6 }, { f: 0.7, a: 0.5, s: 0.8, w: 1.2 } ];
    function frame(now) {
      if (!alive) return; requestAnimationFrame(frame);
      const dpr = Math.min(2, window.devicePixelRatio || 1); const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return; if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      level += (target - level) * 0.25;
      const t = (now - t0) / 1000; const idle = talking ? 0 : 0.13 + 0.05 * Math.sin(t * 1.4);
      const amp = h * 0.42 * Math.max(idle, level); const mid = h / 2;
      ctx.globalCompositeOperation = 'lighter';
      waves.forEach((wv, i) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const n = x / w; const env = Math.pow(Math.sin(Math.PI * n), 1.4);
          const y = mid + Math.sin(n * Math.PI * 2 * wv.f * 1.8 + t * 3.2 * wv.s) * amp * wv.a * env;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color; ctx.globalAlpha = 0.9 - i * 0.25; ctx.lineWidth = wv.w; ctx.shadowColor = color; ctx.shadowBlur = 14 + level * 22; ctx.lineCap = 'round'; ctx.stroke();
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    }
    requestAnimationFrame(frame);
    return { setLevel(x) { target = Math.max(0, Math.min(1, x)); }, setColor(c) { color = c; }, setTalking(b) { talking = !!b; }, destroy() { alive = false; } };
  }
  return { mount };
})();
