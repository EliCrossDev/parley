/* Parley — shared glyph-field shader background.
   GlyphBG.mount(canvas, opts) → { setTint(rgb[0..1], amount), setEnergy(0..1), setDim(x), destroy() }
   Perspective floor of procedural glyphs lit by two interfering waves (volt from the left, blue from the right). */
window.GlyphBG = (function () {
  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uScroll;
uniform float uTint; uniform vec3 uTintCol; uniform float uEnergy; uniform float uDim;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float glyph(float id, vec2 p){
  if (id < 1.0) return sdBox(p, vec2(0.55, 0.11));
  if (id < 2.0) return sdBox(p, vec2(0.11, 0.55));
  if (id < 3.0) return abs(length(p) - 0.40) - 0.10;
  if (id < 4.0) return length(p) - 0.28;
  if (id < 5.0) return min(sdBox(p, vec2(0.55, 0.11)), sdBox(p, vec2(0.11, 0.55)));
  if (id < 6.0) return min(sdBox(p - vec2(0.0, 0.3), vec2(0.5, 0.1)), sdBox(p + vec2(0.0, 0.3), vec2(0.5, 0.1)));
  if (id < 7.0) return abs(sdBox(p, vec2(0.42))) - 0.09;
  return min(length(p - vec2(0.3)) - 0.16, length(p + vec2(0.3)) - 0.16);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  vec3 bg = vec3(0.02, 0.02, 0.023);
  float horizon = 0.22 - uScroll*0.35 - uMouse.y*0.04;
  float yy = horizon - uv.y;
  vec3 c = bg;
  if (yy > 0.003) {
    float depth = 1.0 / yy;
    vec2 plane = vec2(uv.x*depth*2.6 + uMouse.x*1.5, depth*2.6 + uTime*1.1);
    float cs = 0.62;
    vec2 cid = floor(plane / cs);
    vec2 cp = (fract(plane / cs) - 0.5) * 2.0;
    float h = hash(cid);
    float w1 = sin(cid.x*0.30 + uTime*1.5 - cid.y*0.22)*0.5 + 0.5;
    float w2 = sin(-cid.x*0.26 + uTime*1.15 + cid.y*0.35 + 1.3)*0.5 + 0.5;
    float energy = fbm(cid*0.12 + vec2(0.0, uTime*0.12))*0.7 + w1*w2*1.1;
    float id = mod(floor(h*8.0 + uTime*0.5 + h*7.0), 8.0);
    float d = glyph(id, cp);
    float aa = fwidth(d)*1.4 + 0.004;
    float g = 1.0 - smoothstep(0.0, aa, d);
    float fog = exp(-depth*0.075);
    float on = smoothstep(0.52 - uEnergy*0.25, 0.78 - uEnergy*0.2, energy);
    float bright = g * (0.06 + on*1.1) * fog;
    vec3 volt = vec3(0.85, 1.0, 0.23), blue = vec3(0.18, 0.42, 1.0);
    vec3 col = mix(mix(volt, blue, smoothstep(-7.0, 7.0, plane.x)), uTintCol, uTint);
    float dot_ = (1.0 - smoothstep(0.0, 0.1, length(cp) - 0.05)) * 0.18 * fog;
    c += col*bright + vec3(0.6)*dot_*(1.0-g);
    c += col * exp(-yy*26.0) * 0.08;
  } else {
    c += mix(vec3(0.85,1.0,0.23), vec3(0.18,0.42,1.0), smoothstep(-0.5,0.5,uv.x)) * exp(-abs(yy)*40.0) * 0.07;
  }
  c *= 1.0 - smoothstep(0.55, 1.15, length(uv*vec2(0.85, 1.45)));
  gl_FragColor = vec4(c * uDim, 1.0);
}`;
  function mount(canvas, opts) {
    opts = opts || {};
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives');
    function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uRes', 'uTime', 'uMouse', 'uScroll', 'uTint', 'uTintCol', 'uEnergy', 'uDim'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    let mx = 0, my = 0, tx = 0, ty = 0, scroll = 0, visible = true, alive = true, drew = false;
    let tint = 0, tintT = 0, tintCol = [0.85, 1.0, 0.23], tintColT = tintCol.slice(), energy = 0, energyT = 0, dim = opts.dim == null ? 1 : opts.dim;
    const onMove = (e) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; };
    const onScroll = () => { scroll = window.scrollY; };
    const onVis = () => { visible = !document.hidden; };
    window.addEventListener('pointermove', onMove, { passive: true });
    if (opts.scrollTilt) window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    function resize() { const dpr = Math.min(opts.maxDpr || 1.5, window.devicePixelRatio || 1); const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height); }
    window.addEventListener('resize', resize); resize();
    function frame(t) {
      if (!alive) return; requestAnimationFrame(frame);
      if (!visible) return; if (reduce && drew && !opts.alwaysAnimate) return; drew = true;
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
      tint += (tintT - tint) * 0.06; energy += (energyT - energy) * 0.2;
      for (let i = 0; i < 3; i++) tintCol[i] += (tintColT[i] - tintCol[i]) * 0.06;
      const p = opts.scrollTilt ? Math.min(1, scroll / (window.innerHeight * 1.3)) : (opts.tilt || 0);
      gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform1f(U.uTime, t / 1000); gl.uniform2f(U.uMouse, mx, my); gl.uniform1f(U.uScroll, p);
      gl.uniform1f(U.uTint, tint); gl.uniform3f(U.uTintCol, tintCol[0], tintCol[1], tintCol[2]); gl.uniform1f(U.uEnergy, energy); gl.uniform1f(U.uDim, dim);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
    return {
      setTint(rgb, amount) { if (rgb) tintColT = rgb.slice(); tintT = amount == null ? 1 : amount; },
      setEnergy(x) { energyT = Math.max(0, Math.min(1, x)); },
      setDim(x) { dim = x; },
      destroy() { alive = false; window.removeEventListener('pointermove', onMove); window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', resize); },
    };
  }
  return { mount };
})();
