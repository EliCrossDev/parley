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
float blob(vec2 uv, vec2 c, float r){ float d = length(uv - c); return exp(-(d*d) / (r*r)); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float t = uTime * 0.22;
  float e = uEnergy;
  vec2 m = uMouse * 0.08; uv.y += uScroll * 0.3;
  // --- layer 1: aurora curtains. Vertical bands warped by flowing noise, like light through water.
  vec2 p = uv * vec2(1.4, 2.2) + m;
  float w1 = fbm(p * 1.3 + vec2(t * 0.6, -t * 0.35));
  float w2 = fbm(p * 2.1 - vec2(t * 0.4, t * 0.5) + 7.0);
  vec2 q = p + (vec2(w1, w2) - 0.5) * (1.4 + e * 0.8);
  float bands = sin(q.x * 3.0 + t * 1.5) * 0.5 + 0.5;
  bands = pow(bands, 2.2);
  float curtain = bands * smoothstep(-1.2, 0.9, -uv.y + fbm(q * 0.8 + t) * 1.2) ;
  // color drift across the curtain
  float hue = fbm(q * 0.6 + t * 0.3);
  vec3 cc = mix(uC1, uC2, smoothstep(0.2, 0.7, hue));
  cc = mix(cc, uC3, smoothstep(0.55, 0.95, w2));
  vec3 col = cc * curtain * 1.5;
  // --- layer 2: slow deep masses for body
  vec2 p1 = vec2(sin(t*0.9)*0.5, cos(t*0.6)*0.3 - 0.15);
  vec2 p2 = vec2(cos(t*0.7 + 2.0)*0.55, sin(t*0.5 + 1.0)*0.32 + 0.1);
  float r = 0.55 + e*0.25;
  col += uC2 * blob(uv + m, p1, r) * 0.5 + uC3 * blob(uv + m, p2, r) * 0.45;
  // --- layer 3: sparse drifting sparks
  vec2 g = (uv + vec2(0.0, t * 0.08)) * 9.0; vec2 gi = floor(g), gf = fract(g);
  vec3 h = hash3(gi); vec2 sp = 0.2 + 0.6 * h.xy; float sd = length(gf - sp);
  float spark = smoothstep(0.05, 0.0, sd) * step(0.93, h.z) * (0.5 + 0.5 * sin(uTime * 2.0 + h.z * 40.0));
  col += vec3(0.9) * spark * 0.6;
  // speaker tint + voice
  float lum = max(curtain, 0.0001);
  col = mix(col, uTintCol * (lum * 0.9 + 0.08), uTint * 0.8);
  float breathe = 0.9 + 0.1 * sin(uTime * 0.8);
  col *= (0.85 + e * 0.9) * breathe;
  col += (fbm(uv * 7.0 + t * 2.0) - 0.5) * 0.025;
  col *= 1.0 - smoothstep(0.6, 1.3, length(uv * vec2(0.8, 1.2)));
  col = col / (1.0 + col * 0.8);
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
    let C = (opts.colors || ['#ff6fb5', '#7b61ff', '#4ed8e8']).map((c) => Array.isArray(c) ? c : hexToRgb(c));
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
