/* Parley "ear": identifies which of the two chosen languages is being spoken from the raw audio,
   so the speech engine can be aimed before the first words arrive. Whisper (open source, OpenAI)
   runs on the device via transformers.js. GPU only: on the CPU it is too slow to help a live conversation.

   window.Ear = { supported, load(), start(stream, langA, langB, onResult), stop(), ready }
   onResult({ lang, margin, ms }) fires once per utterance start, after ~2 s of speech. */
window.Ear = (function () {
  const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/+esm';
  const MOBILE = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  let MODEL = MOBILE ? 'onnx-community/whisper-tiny' : 'onnx-community/whisper-base';
  const CLIP_S = 2.0;           // seconds of speech per decision
  const ONSET = 0.03, QUIET = 0.012;
  let T = null, processor = null, tokenizer = null, model = null, langIds = null, loading = null, failed = false;
  let ctx = null, src = null, proc = null, stream = null, active = false, onResult = null, pair = null, busy = false;

  const supported = !!navigator.gpu;

  // full: the base model everywhere (better words), needed for offline transcription
  async function load(opts) {
    if (opts && opts.full && MODEL !== 'onnx-community/whisper-base') { if (model) { try { await model.dispose(); } catch (e) {} } model = null; loading = null; failed = false; MODEL = 'onnx-community/whisper-base'; }
    if (model) return true; if (failed) return false; if (loading) return loading;
    loading = (async () => {
      try {
        T = await import(CDN); T.env.allowLocalModels = false;
        processor = await T.AutoProcessor.from_pretrained(MODEL);
        tokenizer = await T.AutoTokenizer.from_pretrained(MODEL);
        model = await T.WhisperForConditionalGeneration.from_pretrained(MODEL, { dtype: { encoder_model: 'fp16', decoder_model_merged: 'fp16' }, device: 'webgpu' });
        langIds = model.generation_config.lang_to_id;
        // Warm the GPU so the first real decision is fast.
        await identify(new Float32Array(16000), 'en', 'es');
        return true;
      } catch (e) { failed = true; console.warn('Ear unavailable:', e.message); return false; }
    })();
    return loading;
  }

  // Which of the two languages is this clip? Compares Whisper's language-token logits for just those two.
  async function identify(audio16, a, b) {
    const ia = langIds['<|' + a + '|>'], ib = langIds['<|' + b + '|>'];
    if (ia == null || ib == null) return null;
    const t0 = performance.now();
    const feats = await processor(audio16);
    const dec = new T.Tensor('int64', new BigInt64Array([BigInt(model.generation_config.decoder_start_token_id)]), [1, 1]);
    const out = await model({ input_features: feats.input_features, decoder_input_ids: dec });
    const l = out.logits.data; const sa = l[ia], sb = l[ib];
    return { lang: sa >= sb ? a : b, margin: Math.abs(sa - sb), ms: Math.round(performance.now() - t0), audio: audio16 };
  }
  // Rough words for the clip, used to keep what was said before the engine could be aimed.
  async function transcribe(audio16, lang, maxTokens) {
    try {
      const feats = await processor(audio16);
      const gen = await model.generate({ inputs: feats.input_features, language: lang, task: 'transcribe', max_new_tokens: maxTokens || 24 });
      const text = tokenizer.batch_decode(gen, { skip_special_tokens: true })[0].trim();
      return /^[\[(]/.test(text) ? '' : text; // "[BLANK_AUDIO]", "(coughing)" and friends are not words
    } catch (e) { return ''; }
  }

  // Resample a Float32 buffer to 16 kHz with the browser's own resampler.
  async function to16k(samples, rate) {
    if (rate === 16000) return samples;
    const off = new OfflineAudioContext(1, Math.ceil(samples.length * 16000 / rate), 16000);
    const buf = off.createBuffer(1, samples.length, rate); buf.copyToChannel(samples, 0);
    const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start();
    return (await off.startRendering()).getChannelData(0);
  }

  function start(mediaStream, langA, langB, cb) {
    if (!model || active) return false;
    stream = mediaStream; onResult = cb; pair = [langA, langB]; active = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    src = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(2048, 1, 1);
    const rate = ctx.sampleRate; const need = Math.ceil(CLIP_S * rate);
    let chunks = [], have = 0, started = false, loud = 0, quiet = 0;
    proc.onaudioprocess = async (e) => {
      if (!active) return;
      const d = e.inputBuffer.getChannelData(0); let rms = 0; for (let i = 0; i < d.length; i++) rms += d[i] * d[i]; rms = Math.sqrt(rms / d.length);
      if (busy) { if (rms < QUIET) quiet++; else quiet = 0; if (quiet > 12) { busy = false; started = false; chunks = []; have = 0; loud = 0; } return; }
      if (!started) { if (rms > ONSET) loud++; else loud = 0; if (loud >= 2) started = true; else return; }
      chunks.push(new Float32Array(d)); have += d.length;
      if (have >= need) {
        busy = true; quiet = 0;
        const all = new Float32Array(have); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
        chunks = []; have = 0;
        try { const r = await identify(await to16k(all, rate), pair[0], pair[1]); if (r && active && onResult) onResult(r); } catch (err) { console.warn('Ear:', err.message); }
      }
    };
    src.connect(proc); proc.connect(ctx.destination);
    return true;
  }
  function stop() { active = false; try { proc && proc.disconnect(); src && src.disconnect(); ctx && ctx.close(); } catch (e) {} proc = src = ctx = null; busy = false; }

  // Offline mode: a whole utterance in. Which language, and what was said.
  async function hear(audio16, a, b) {
    const id = await identify(audio16, a, b); if (!id) return null;
    const text = await transcribe(audio16, id.lang, 96);
    return { lang: id.lang, margin: id.margin, text };
  }
  return { supported, load, start, stop, transcribe, hear, identify, get ready() { return !!model; }, get mobile() { return MOBILE; } };
})();
