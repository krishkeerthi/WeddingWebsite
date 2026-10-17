/* ==========================================================================
   Keerthi & Sandhya — Wedding Memories
   Vanilla JS, no dependencies. Sections:
     helpers · sound · petals · intro · nav · decor (thoranam, banana trees,
     palms, lamps, arch) · kolam engine · hero · films · rituals · traditions ·
     feast · nalangu · mehandi · kolam studio · gallery · nandri · boot
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAMIL_DIGITS = ['௧', '௨', '௩', '௪', '௫', '௬', '௭', '௮', '௯'];

  function svgEl(tag, attrs = {}, parent) {
    const node = document.createElementNS(SVGNS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // SMIL sway, skipped when the visitor prefers less motion.
  function sway(range, dur, extra = '') {
    if (reduceMotion) return '';
    const d = dur.toFixed(2);
    const b = (-Math.random() * dur).toFixed(2);
    return `<animateTransform attributeName="transform" type="rotate" values="${-range}${extra};${range}${extra};${-range}${extra}" dur="${d}s" begin="${b}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/>`;
  }

  function svgPoint(svg, clientX, clientY) {
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }

  function restartClass(node, cls) {
    node.classList.remove(cls);
    void node.getBoundingClientRect();
    node.classList.add(cls);
  }

  function centerOf(node) {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* ------------------------------------------------------------------ */
  /* Sound — everything is synthesised with Web Audio, no files needed   */
  /* ------------------------------------------------------------------ */
  const Sound = (() => {
    let ctx = null, master = null, noiseBuf = null;

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.7;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function env(g, t, attack, peak, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    function bell(t, f = 880, vol = 0.22) {
      [1, 2.76, 5.4, 8.93].forEach((r, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * r;
        const g = ctx.createGain();
        env(g, t, 0.004, vol / (i + 1), 2.6 / (i * 0.7 + 1));
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 3);
      });
    }

    function noise(t, dur, type, freq, q, vol) {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      env(g, t, 0.002, vol, dur);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.05);
    }

    function thavilLow(t, vol = 0.8) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      const g = ctx.createGain();
      env(g, t, 0.003, vol, 0.32);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.4);
      noise(t, 0.04, 'lowpass', 900, 1, vol * 0.4);
    }

    function thavilHigh(t, vol = 0.45) {
      noise(t, 0.07, 'bandpass', 2600, 1.2, vol);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(540, t);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.06);
      const g = ctx.createGain();
      env(g, t, 0.002, vol * 0.35, 0.08);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.12);
    }

    // A reedy, nadaswaram-like voice: saw + square through a formant filter, with vibrato and gamaka glides.
    function reed(t, freq, dur, vol = 0.11, glideFrom = null) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'square';
      [[o1, 1], [o2, 1.003]].forEach(([o, m]) => {
        if (glideFrom) {
          o.frequency.setValueAtTime(glideFrom * m, t);
          o.frequency.exponentialRampToValueAtTime(freq * m, t + 0.07);
        } else {
          o.frequency.setValueAtTime(freq * m, t);
        }
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.3;
      const lg = ctx.createGain();
      lg.gain.value = freq * 0.007;
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      const mix = ctx.createGain(); mix.gain.value = 0.5;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 0.8;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
      g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.06));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
      o1.connect(mix); o2.connect(mix);
      mix.connect(bp).connect(lp).connect(g).connect(master);
      [o1, o2, lfo].forEach((o) => { o.start(t); o.stop(t + dur + 0.1); });
    }

    // Raga Mohanam (S R2 G3 P D2), Sa = E4.
    const SA = 329.63;
    const RATIO = { S: 1, R: 9 / 8, G: 5 / 4, P: 3 / 2, D: 5 / 3, "S'": 2, "R'": 9 / 4, "G'": 5 / 2 };
    const PHRASE = [
      ['P', 1], ['D', 1], ["S'", 2], ['D', 1], ['P', 1], ['G', 2],
      ['R', 1], ['G', 1], ['P', 2], ['G', 1], ['R', 1], ['S', 2],
      ['G', 1], ['P', 1], ['D', 2], ["S'", 1], ["R'", 1], ["S'", 2],
      ['D', 1], ['P', 1], ['G', 1], ['R', 1], ['S', 4]
    ];
    const TICKS = 32;
    const NOTE_AT = new Array(TICKS).fill(null);
    let cursor = 0;
    PHRASE.forEach(([n, b]) => { NOTE_AT[cursor] = { f: SA * RATIO[n], b }; cursor += b; });
    const DRUM = ['L', 'h', 'h', 'L', 'h', 'L', 'h', 'h'];
    const EIGHTH = 0.21;
    let lastF = null;

    function tick(t, i) {
      const d = DRUM[i % 8];
      if (d === 'L') thavilLow(t, i % 16 === 0 ? 0.85 : 0.6);
      else thavilHigh(t, 0.3 + Math.random() * 0.15);
      const n = NOTE_AT[i % TICKS];
      if (n) {
        reed(t, n.f, n.b * EIGHTH - 0.02, 0.1, lastF && Math.random() < 0.5 ? lastF : null);
        lastF = n.f;
      }
    }

    let playing = false, timer = null, nextT = 0, idx = 0, droneNodes = null;

    function startDrone() {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 1.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const oscs = [SA / 2, SA * 0.75, SA].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(lp);
        o.start();
        return o;
      });
      lp.connect(g).connect(master);
      droneNodes = { g, oscs };
    }

    function stopDrone() {
      if (!droneNodes) return;
      const { g, oscs } = droneNodes;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      oscs.forEach((o) => o.stop(ctx.currentTime + 0.7));
      droneNodes = null;
    }

    function schedule() {
      while (nextT < ctx.currentTime + 0.3) {
        tick(nextT, idx);
        nextT += EIGHTH;
        idx = (idx + 1) % TICKS;
      }
    }

    return {
      unlock: ensure,
      get playing() { return playing; },
      startMusic() {
        if (playing || !ensure()) return false;
        playing = true;
        nextT = ctx.currentTime + 0.15;
        idx = 0;
        startDrone();
        timer = setInterval(schedule, 60);
        schedule();
        return true;
      },
      stopMusic() {
        if (!playing) return;
        playing = false;
        clearInterval(timer);
        stopDrone();
      },
      chime() {
        if (!ensure()) return;
        const t = ctx.currentTime + 0.02;
        bell(t, 1046); bell(t + 0.32, 1318, 0.16); bell(t + 0.64, 1568, 0.12);
      },
      bell(f = 1318) {
        if (!ensure()) return;
        bell(ctx.currentTime + 0.01, f, 0.18);
      },
      // Getti Melam: a thundering thavil roll with nadaswaram trills over it.
      gettiMelam(seconds = 3) {
        if (!ensure()) return;
        const t0 = ctx.currentTime + 0.03;
        for (let t = 0, i = 0; t < seconds; t += 0.055, i++) {
          if (i % 2 === 0) thavilLow(t0 + t, 0.55 + Math.random() * 0.35);
          else thavilHigh(t0 + t, 0.35 + Math.random() * 0.2);
        }
        const hi = [SA * 2, SA * 9 / 4];
        for (let t = 0, i = 0; t < seconds; t += 0.11, i++) reed(t0 + t, hi[i % 2], 0.1, 0.07);
        bell(t0, 1318, 0.16);
        bell(t0 + seconds - 0.2, 1568, 0.14);
      },
      melam() {
        if (!ensure()) return 0;
        const t0 = ctx.currentTime + 0.05;
        lastF = null;
        for (let i = 0; i < 24; i++) tick(t0 + i * EIGHTH, i);
        return 24 * EIGHTH;
      },
      crunch() {
        if (!ensure()) return;
        const t = ctx.currentTime;
        for (let i = 0; i < 5; i++) noise(t + i * 0.025, 0.06, 'highpass', 1800 + Math.random() * 1500, 0.8, 0.5);
      },
      crack() {
        if (!ensure()) return;
        noise(ctx.currentTime, 0.05, 'highpass', 2500, 1, 0.35);
      },
      splash() {
        if (!ensure()) return;
        noise(ctx.currentTime, 0.35, 'lowpass', 900, 0.7, 0.35);
      },
      roll(dur) {
        if (!ensure()) return;
        noise(ctx.currentTime, dur, 'lowpass', 220, 0.8, 0.5);
      },
      pop(f = 660) {
        if (!ensure()) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.08);
        const g = ctx.createGain();
        env(g, t, 0.004, 0.18, 0.14);
        o.connect(g).connect(master);
        o.start(t); o.stop(t + 0.2);
      }
    };
  })();

  /* ------------------------------------------------------------------ */
  /* Petals — falling jasmine & marigold, plus akshathai bursts          */
  /* ------------------------------------------------------------------ */
  const Petals = (() => {
    const canvas = $('.petal-canvas');
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, running = false, ambient = false;
    const flakes = [];
    const bits = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const KINDS = ['jasmine', 'jasmine', 'marigold', 'rose'];
    function flake(initial) {
      return {
        x: rand(0, W), y: initial ? rand(-H, H) : rand(-60, -20),
        s: rand(0.75, 1.25), kind: pick(KINDS),
        vx: rand(-0.15, 0.35), vy: rand(0.35, 0.85),
        rot: rand(0, Math.PI * 2), vr: rand(-0.02, 0.02), ph: rand(0, Math.PI * 2)
      };
    }

    function drawShape(kind, s) {
      if (kind === 'jasmine') {
        ctx.fillStyle = '#FFFDF4';
        for (let i = 0; i < 5; i++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.beginPath();
          ctx.ellipse(0, -3.4 * s, 1.9 * s, 3.4 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#EBD58A';
        ctx.beginPath(); ctx.arc(0, 0, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'marigold') {
        ctx.fillStyle = '#F28C0F';
        ctx.beginPath();
        ctx.moveTo(0, -5 * s);
        ctx.quadraticCurveTo(4 * s, 0, 0, 5 * s);
        ctx.quadraticCurveTo(-4 * s, 0, 0, -5 * s);
        ctx.fill();
      } else if (kind === 'rose') {
        ctx.fillStyle = '#B3123E';
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.2 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'rice') {
        ctx.fillStyle = '#F6C945';
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.3 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = kind;
        ctx.beginPath();
        ctx.arc(0, 0, 2.6 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame() {
      if (!running) return;
      if (document.hidden) { requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, W, H);
      const t = performance.now() / 1000;

      if (ambient) {
        const target = W < 700 ? 9 : 16;
        while (flakes.length < target) flakes.push(flake(false));
      }
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i];
        f.x += f.vx + Math.sin(t * 0.8 + f.ph) * 0.35;
        f.y += f.vy;
        f.rot += f.vr;
        if (f.y > H + 30) { if (ambient) flakes[i] = flake(false); else flakes.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        drawShape(f.kind, f.s);
        ctx.restore();
      }

      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy += 0.16; b.vx *= 0.99;
        b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life -= 1;
        if (b.life <= 0 || b.y > H + 20) { bits.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.min(1, b.life / 30);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        drawShape(b.kind, b.s);
        ctx.restore();
      }

      if (!ambient && !flakes.length && !bits.length) {
        running = false;
        ctx.clearRect(0, 0, W, H);
        return;
      }
      requestAnimationFrame(frame);
    }

    function run() {
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);

    return {
      start() {
        if (reduceMotion) return;
        ambient = true;
        for (let i = 0; i < (W < 700 ? 6 : 10); i++) flakes.push(flake(true));
        run();
      },
      burst(x, y, n = 26, palette) {
        if (reduceMotion) n = Math.min(n, 8);
        const kinds = palette || ['rice', 'rice', 'rice', 'jasmine', 'marigold', 'rose'];
        for (let i = 0; i < n; i++) {
          const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
          const sp = rand(2.5, 7.5);
          bits.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            rot: rand(0, 6.28), vr: rand(-0.25, 0.25), s: rand(0.8, 1.3),
            kind: pick(kinds), life: rand(60, 110)
          });
        }
        run();
      },
      shower(n = 70) {
        for (let i = 0; i < n; i++) {
          bits.push({
            x: rand(0, W), y: rand(-H * 0.4, -10), vx: rand(-0.6, 0.6), vy: rand(0.5, 2),
            rot: rand(0, 6.28), vr: rand(-0.1, 0.1), s: rand(0.9, 1.4),
            kind: pick(['rice', 'jasmine', 'marigold', 'rose', 'rice']), life: 400
          });
        }
        run();
      }
    };
  })();

  /* ------------------------------------------------------------------ */
  /* Intro — the temple doors                                            */
  /* ------------------------------------------------------------------ */
  function initIntro() {
    const intro = $('#intro');
    let seen = false;
    try { seen = sessionStorage.getItem('ks-doors') === '1'; } catch (e) { /* storage blocked */ }
    if (!intro || seen || location.hash.length > 1) {
      if (intro) intro.remove();
      Petals.start();
      return;
    }
    document.body.classList.add('locked');
    const enter = $('.intro-enter', intro);
    const skip = $('.intro-skip', intro);
    let opened = false;

    function open(withSound) {
      if (opened) return;
      opened = true;
      if (withSound) Sound.chime();
      intro.classList.add('open');
      document.body.classList.remove('locked');
      try { sessionStorage.setItem('ks-doors', '1'); } catch (e) { /* ignore */ }
      if (withSound) Petals.shower(90);
      Petals.start();
      setTimeout(() => intro.remove(), 1900);
    }

    enter.addEventListener('click', () => open(true));
    skip.addEventListener('click', () => open(false));
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { open(false); document.removeEventListener('keydown', onKey); }
    });
    setTimeout(() => enter.focus({ preventScroll: true }), 60);
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */
  function initNav() {
    const toggle = $('.nav-toggle');
    const links = $('#nav-links');
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    const anchors = $$('a', links);
    const map = new Map(anchors.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        anchors.forEach((a) => a.classList.remove('active'));
        const a = map.get(en.target.id);
        if (a) a.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => io.observe(s));

    const music = $('.music-btn');
    music.addEventListener('click', () => {
      if (Sound.playing) {
        Sound.stopMusic();
        music.setAttribute('aria-pressed', 'false');
      } else if (Sound.startMusic()) {
        music.setAttribute('aria-pressed', 'true');
      }
    });
  }

  function stopMusic() {
    Sound.stopMusic();
    const music = $('.music-btn');
    if (music) music.setAttribute('aria-pressed', 'false');
  }

  /* ------------------------------------------------------------------ */
  /* Decor — thoranam, banana trees, palms, lamps, arch                  */
  /* ------------------------------------------------------------------ */
  const LEAF_FILLS = ['#2F7A22', '#3F8F2A', '#4C9A2A', '#2A6E1E'];

  function buildThoranam(svg) {
    const w = Math.round(svg.getBoundingClientRect().width) || window.innerWidth;
    const h = 90;
    if (svg.dataset.w === String(w)) return;
    svg.dataset.w = String(w);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const n = Math.max(2, Math.round(w / 230));
    const sw = w / n;
    const top = 4, sag = 26;
    let rope = `M0 ${top}`;
    let html = '';
    const items = [];
    for (let s = 0; s < n; s++) {
      const x0 = s * sw, x1 = x0 + sw, cx = x0 + sw / 2;
      rope += ` Q${cx.toFixed(1)} ${top + sag * 2} ${x1.toFixed(1)} ${top}`;
      const count = Math.max(6, Math.round(sw / 21));
      for (let k = 1; k < count; k++) {
        const t = k / count;
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
        const y = (1 - t) * (1 - t) * top + 2 * (1 - t) * t * (top + sag * 2) + t * t * top;
        items.push({ x, y, k, tilt: (t - 0.5) * -24 });
      }
    }
    items.forEach((it, i) => {
      if (it.k % 3 === 0) {
        html += `<g transform="translate(${it.x.toFixed(1)} ${(it.y + 7).toFixed(1)})"><use href="#marigold" transform="scale(.82)"/></g>`;
      } else {
        const fill = LEAF_FILLS[i % LEAF_FILLS.length];
        html += `<g transform="translate(${it.x.toFixed(1)} ${it.y.toFixed(1)})"><g>${sway(5, rand(2.6, 4.2))}<use href="#leaf" fill="${fill}" transform="rotate(${(180 + it.tilt).toFixed(1)}) scale(.78)"/></g></g>`;
      }
    });
    // Hanging strands of marigold & jasmine at each join
    for (let s = 0; s <= n; s++) {
      const x = s * sw;
      let strand = `<g transform="translate(${x.toFixed(1)} ${top})"><g>${sway(3, rand(3, 4.5))}`;
      strand += '<path d="M0 0V52" stroke="#8A6212" stroke-width="1.2"/>';
      for (let j = 0; j < 4; j++) strand += `<use href="#jasmine" transform="translate(0 ${10 + j * 9})"/>`;
      strand += '<use href="#marigold" transform="translate(0 52)"/><use href="#rose" transform="translate(0 64) scale(.8)"/></g></g>';
      html += strand;
    }
    svg.innerHTML =
      `<path d="${rope}" fill="none" stroke="#6E4A0E" stroke-width="3.2"/>` +
      `<path d="${rope}" fill="none" stroke="#E9C46A" stroke-width="1.4" stroke-dasharray="4 3"/>` + html;
  }

  function bananaTree() {
    // A broad banana leaf that arches up from the stem and droops at the tip, with the
    // characteristic tears running out from the midrib.
    const leaf = (a, s, light) => {
      let veins = '';
      for (let i = 1; i < 12; i++) {
        const t = i / 12;
        const x = 246 * t;
        const my = -120 * t * (1 - t) + 8 * t * t;
        veins += `M${x.toFixed(1)} ${my.toFixed(1)}L${(x + 16).toFixed(1)} ${(my - 30 + t * 18).toFixed(1)}M${x.toFixed(1)} ${my.toFixed(1)}L${(x + 12).toFixed(1)} ${(my + 18 - t * 4).toFixed(1)}`;
      }
      return `<g transform="translate(113 300) rotate(${a}) scale(${s})"><g>${sway(2.4, rand(4, 6.5))}
        <path d="M0 0C40-70 170-100 246 8C190 12 90 20 0 0Z" fill="url(#g-bleaf)"/>
        <path d="M0 0C50-40 170-55 246 8C190 12 90 20 0 0Z" fill="#2A6E1E" opacity=".28"/>
        <path d="${veins}" stroke="${light ? '#A5D07A' : '#8CC35A'}" stroke-width="1" opacity=".5" fill="none"/>
        <path d="M120-52l8 18M168-46l9 16M78-46l6 16M206-24l10 14" stroke="#FBF4E4" stroke-width="2" opacity=".75" stroke-linecap="round"/>
        <path d="M0 0C50-40 170-55 246 8" fill="none" stroke="#D8E99A" stroke-width="3.2"/>
      </g></g>`;
    };
    let fingers = '';
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 5; k++) {
        const x = 192 + (k - 2) * 8.5;
        const y = 380 + r * 20;
        fingers += `<path d="M${x} ${y}c-3-8-2-16 4-22" stroke="${r > 1 ? '#C9C24A' : '#9CC44A'}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
      }
    }
    return `<svg viewBox="0 0 300 700" preserveAspectRatio="xMidYMax meet">
      ${leaf(-175, 0.92)}${leaf(-142, 1.02, 1)}${leaf(-112, 0.95)}
      <path d="M88 700C92 560 96 420 100 296H126C128 420 132 560 138 700Z" fill="url(#g-stem)"/>
      <path d="M100 690C102 560 104 430 106 310M118 690C118 560 118 430 116 310M128 690C126 560 124 430 122 310" stroke="#4F6E21" stroke-width="1.6" opacity=".45" fill="none"/>
      <g fill="#8A6A2E" opacity=".45"><ellipse cx="104" cy="650" rx="5" ry="12"/><ellipse cx="128" cy="610" rx="4" ry="9"/><ellipse cx="110" cy="560" rx="3" ry="8"/></g>
      <g>${sway(2, 5, ' 122 318')}
        <path d="M122 318C160 320 186 336 192 372V470" fill="none" stroke="#6F8F2F" stroke-width="6"/>
        ${fingers}
        <path d="M192 466C204 476 206 500 192 524C178 500 180 476 192 466Z" fill="#6B1E3A"/>
        <path d="M192 474C198 482 199 498 192 512" fill="none" stroke="#9A3D5C" stroke-width="2"/>
      </g>
      ${leaf(-80, 1)}${leaf(-48, 0.95, 1)}${leaf(-14, 0.9)}
      <path d="M110 300C108 250 112 210 117 186C120 210 121 250 119 300Z" fill="#A9CC62"/>
      <g transform="translate(0 600)">
        <path d="M84 0Q113 14 142 0" fill="none" stroke="#8A6212" stroke-width="1.5"/>
        <use href="#marigold" transform="translate(92 4) scale(.9)"/><use href="#jasmine" transform="translate(104 9)"/><use href="#marigold" transform="translate(116 10) scale(.9)"/><use href="#jasmine" transform="translate(128 8)"/><use href="#marigold" transform="translate(138 3) scale(.9)"/>
      </g>
    </svg>`;
  }

  function buildPalms(svg) {
    const rng = mulberry32(7);
    const palms = [
      { x: 150, h: 300, lean: -40 }, { x: 290, h: 360, lean: 30 }, { x: 420, h: 250, lean: -16 },
      { x: 1030, h: 260, lean: 20 }, { x: 1160, h: 370, lean: -34 }, { x: 1300, h: 300, lean: 40 }
    ];
    let html = '<path d="M0 470C200 440 380 456 560 448C760 440 920 460 1100 446C1260 436 1360 452 1440 446V520H0Z" fill="#C8894A" opacity=".18"/>';
    palms.forEach((p, i) => {
      const base = 520, topX = p.x + p.lean, topY = base - p.h;
      const col = i % 2 ? 'rgba(122,70,30,.22)' : 'rgba(95,60,25,.28)';
      html += `<path d="M${p.x - 7} ${base}Q${p.x + p.lean * 0.2} ${base - p.h * 0.5} ${topX - 3} ${topY}L${topX + 3} ${topY}Q${p.x + p.lean * 0.2 + 8} ${base - p.h * 0.5} ${p.x + 7} ${base}Z" fill="${col}"/>`;
      let crown = `<g transform="translate(${topX} ${topY})"><g>${sway(3, 5 + rng() * 2)}`;
      for (let k = 0; k < 9; k++) {
        const a = (-170 + k * 20 + rng() * 10) * Math.PI / 180;
        const L = 70 + rng() * 40;
        const ex = Math.cos(a) * L, ey = Math.sin(a) * L + L * 0.38;
        const cx = Math.cos(a) * L * 0.55, cy = Math.sin(a) * L * 0.55 - L * 0.18;
        crown += `<path d="M0 0Q${cx.toFixed(1)} ${(cy - 9).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}Q${cx.toFixed(1)} ${(cy + 4).toFixed(1)} 0 0Z" fill="${col}"/>`;
      }
      crown += `<circle r="6" fill="${col}"/></g></g>`;
      html += crown;
    });
    svg.innerHTML = html;
  }

  function lampSVG() {
    const flame = (x, y, s, d) =>
      `<g transform="translate(${x} ${y}) scale(${s})"><use href="#flame">${reduceMotion ? '' : `<animateTransform attributeName="transform" type="scale" values="1 1;.9 1.1;1.06 .94;1 1" dur="${d}s" repeatCount="indefinite"/>`}</use></g>`;
    return `
      <ellipse cx="70" cy="86" rx="78" ry="50" fill="url(#g-glow)" opacity=".7">${reduceMotion ? '' : '<animate attributeName="opacity" values=".55;.8;.55" dur="2.4s" repeatCount="indefinite"/>'}</ellipse>
      <ellipse cx="70" cy="308" rx="56" ry="8" fill="#000" opacity=".15"/>
      <path d="M22 302C22 282 50 272 70 272C90 272 118 282 118 302Z" fill="url(#g-brass)"/>
      <rect x="14" y="298" width="112" height="10" rx="5" fill="url(#g-brass)"/>
      <path d="M60 274L63 118H77L80 274Z" fill="url(#g-brass)"/>
      <g fill="url(#g-brass)"><ellipse cx="70" cy="252" rx="16" ry="6"/><ellipse cx="70" cy="204" rx="12" ry="5"/><ellipse cx="70" cy="164" rx="14" ry="5"/><ellipse cx="70" cy="128" rx="10" ry="4"/></g>
      <rect x="67" y="40" width="6" height="64" fill="url(#g-brass)"/>
      <ellipse cx="70" cy="56" rx="11" ry="4" fill="url(#g-brass)"/>
      <path d="M70 6C82 18 82 32 70 42C58 32 58 18 70 6Z" fill="url(#g-brass)"/>
      <circle cx="70" cy="24" r="3" fill="#C1121F"/>
      ${flame(42, 97, 0.8, 0.9)}${flame(98, 97, 0.8, 1.05)}
      <path d="M12 104C18 124 46 134 70 134C94 134 122 124 128 104Z" fill="url(#g-brass)"/>
      <ellipse cx="70" cy="104" rx="58" ry="8" fill="#F3D27A"/>
      <ellipse cx="70" cy="104" rx="51" ry="5.5" fill="#7A5410"/>
      ${flame(14, 104, 1, 0.8)}${flame(126, 104, 1, 0.95)}`;
  }

  function buildArch() {
    const svg = $('.arch-svg');
    if (!svg) return;
    const prabha = $('[data-prabha]', svg);
    const temp = svgEl('path', { d: 'M30 540V230C30 120 120 48 210 14C300 48 390 120 390 230V540', fill: 'none' }, svg);
    const L = temp.getTotalLength();
    let html = '';
    for (let s = 6, i = 0; s < L; s += 17, i++) {
      const p = temp.getPointAtLength(s);
      if (p.y > 250) continue;
      const q = temp.getPointAtLength(Math.min(L, s + 0.5));
      const tx = q.x - p.x, ty = q.y - p.y, len = Math.hypot(tx, ty) || 1;
      const nx = ty / len, ny = -tx / len;
      const ang = Math.atan2(ny, nx) * 180 / Math.PI + 90;
      const sc = i % 2 ? 0.7 : 1;
      html += `<path d="M0 0C-5-4-5-12 0-21C5-12 5-4 0 0Z" fill="url(#g-gold)" stroke="#8A6212" stroke-width=".6" transform="translate(${(p.x + nx * 3).toFixed(1)} ${(p.y + ny * 3).toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${sc})"/>`;
      if (i % 2 === 0) html += `<circle cx="${(p.x + nx * 1).toFixed(1)}" cy="${(p.y + ny * 1).toFixed(1)}" r="2.4" fill="#C1121F"/>`;
    }
    temp.remove();
    prabha.innerHTML = html;

    let strands = '';
    [10, 410].forEach((x) => {
      strands += `<g transform="translate(${x} 236)"><g>${sway(1.2, 4.5)}<path d="M0 0V290" stroke="#6E4A0E" stroke-width="1"/>`;
      for (let y = 6, k = 0; y < 290; y += 10, k++) {
        strands += k % 6 === 5
          ? `<use href="#marigold" transform="translate(0 ${y}) scale(.62)"/>`
          : `<use href="#jasmine" transform="translate(0 ${y}) scale(.95)"/>`;
      }
      strands += '<use href="#rose" transform="translate(0 296)"/></g></g>';
    });
    $('[data-jasmine-strands]', svg).innerHTML = strands;
  }

  function initDecor() {
    $$('[data-banana]').forEach((d) => { d.innerHTML = bananaTree(); });
    $$('[data-palms]').forEach(buildPalms);
    $$('[data-lamp]').forEach((s) => { s.innerHTML = lampSVG(); });
    buildArch();
    const thoranams = $$('[data-thoranam]');
    thoranams.forEach(buildThoranam);
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => thoranams.forEach(buildThoranam), 150);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Kolam engine — sikku kolam via the mirror-curve method              */
  /* A loop bounces diagonally between edge midpoints of a dot grid,     */
  /* reflecting off the border and off randomly placed (symmetric)       */
  /* internal mirrors, so it winds around every dot.                     */
  /* ------------------------------------------------------------------ */
  function kolamLoops(n, rng) {
    const N = 2 * n;
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const p = 0.12 + rng() * 0.4;
      const mirrors = new Set();
      const decided = new Set();
      for (let x = 1; x < N; x++) {
        for (let y = 1; y < N; y++) {
          if ((x + y) % 2 === 0) continue;
          const key = x + ',' + y;
          if (decided.has(key)) continue;
          const on = rng() < p;
          [[x, y], [N - x, y], [x, N - y], [N - x, N - y], [y, x], [N - y, x], [y, N - x], [N - y, N - x]].forEach(([a, b]) => {
            const k = a + ',' + b;
            decided.add(k);
            if (on) mirrors.add(k);
          });
        }
      }
      const loops = traceLoops(N, mirrors);
      if (!best || loops.length < best.length) best = loops;
      if (loops.length === 1) break;
    }
    return { n, N, loops: best };
  }

  function traceLoops(N, mirrors) {
    const isMirror = (x, y) =>
      (x % 2 === 0 && (x === 0 || x === N)) || (y % 2 === 0 && (y === 0 || y === N)) || mirrors.has(x + ',' + y);
    const seg = (a, b, c, d) => (a < c || (a === c && b < d)) ? `${a},${b},${c},${d}` : `${c},${d},${a},${b}`;
    const visited = new Set();
    const loops = [];
    const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let sx = 0; sx <= N; sx++) {
      for (let sy = 0; sy <= N; sy++) {
        if ((sx + sy) % 2 === 0) continue;
        for (const [ddx, ddy] of dirs) {
          const qx = sx + ddx, qy = sy + ddy;
          if (qx < 0 || qy < 0 || qx > N || qy > N) continue;
          if (visited.has(seg(sx, sy, qx, qy))) continue;
          let x = sx, y = sy, dx = ddx, dy = ddy, guard = 0;
          const pts = [];
          do {
            pts.push([x, y]);
            const nx = x + dx, ny = y + dy;
            visited.add(seg(x, y, nx, ny));
            x = nx; y = ny;
            if (x % 2 === 0 && isMirror(x, y)) dx = -dx;
            if (y % 2 === 0 && isMirror(x, y)) dy = -dy;
          } while (!(x === sx && y === sy && dx === ddx && dy === ddy) && ++guard < 20000);
          loops.push(pts);
        }
      }
    }
    return loops;
  }

  // Smooth a closed loop with a Catmull-Rom spline through the edge midpoints, so every
  // turn around a dot becomes a near-circular arc, as when drawn by hand.
  const TENSION = 1 / 5;
  function cubicSegments(pts, map) {
    const m = pts.length;
    const P = (i) => map(pts[(i + m) % m][0], pts[(i + m) % m][1]);
    const segs = [];
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      segs.push([p1,
        [p1[0] + (p2[0] - p0[0]) * TENSION, p1[1] + (p2[1] - p0[1]) * TENSION],
        [p2[0] - (p3[0] - p1[0]) * TENSION, p2[1] - (p3[1] - p1[1]) * TENSION],
        p2]);
    }
    return segs;
  }

  function loopPolyline(pts, map, steps = 8) {
    const out = [];
    cubicSegments(pts, map).forEach(([a, b, c, d]) => {
      for (let s = 0; s < steps; s++) {
        const t = s / steps, u = 1 - t;
        out.push([
          u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
          u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]
        ]);
      }
    });
    out.push(out[0]);
    return out;
  }

  function loopPathD(pts, map) {
    const segs = cubicSegments(pts, map);
    const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    return `M${f(segs[0][0])}` + segs.map(([, b, c, d]) => `C${f(b)} ${f(c)} ${f(d)}`).join('') + 'Z';
  }

  function kolamSVGMarkup(kolam, size, pad, stroke, width, dotR) {
    const unit = (size - pad * 2) / kolam.N;
    const map = (x, y) => [pad + x * unit, pad + y * unit];
    let dots = '';
    for (let i = 0; i < kolam.n; i++) {
      for (let j = 0; j < kolam.n; j++) {
        const [x, y] = map(2 * i + 1, 2 * j + 1);
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotR}"/>`;
      }
    }
    const paths = kolam.loops.map((l) => `<path d="${loopPathD(l, map)}" pathLength="1"/>`).join('');
    return `<g fill="${stroke}">${dots}</g><g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" class="kolam-lines">${paths}</g>`;
  }

  function drawInKolam(svg, duration = 5000) {
    const paths = $$('.kolam-lines path', svg);
    paths.forEach((p) => {
      p.style.strokeDasharray = '1';
      if (reduceMotion || !p.animate) { p.style.strokeDashoffset = '0'; return; }
      p.style.strokeDashoffset = '1';
      const a = p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration, easing: 'ease-in-out', fill: 'forwards' });
      a.onfinish = () => { p.style.strokeDashoffset = '0'; p.style.strokeDasharray = 'none'; };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Hero — counter & floor kolam                                        */
  /* ------------------------------------------------------------------ */
  const WEDDING = new Date('2025-11-27T07:30:00+05:30');

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function initCounter() {
    const out = {};
    $$('[data-t]').forEach((b) => { out[b.dataset.t] = b; });
    const anniv = $('[data-anniv]');
    const pad = (n) => String(n).padStart(2, '0');

    function update() {
      const now = new Date();
      let diff = Math.max(0, now - WEDDING);
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      out.d.textContent = d.toLocaleString('en-IN');
      out.h.textContent = pad(h);
      out.m.textContent = pad(m);
      out.s.textContent = pad(s);

      // Anniversary, measured on Indian calendar days.
      const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 6e4);
      let y = ist.getFullYear();
      const isToday = ist.getMonth() === 10 && ist.getDate() === 27 && y > 2025;
      if (isToday) {
        anniv.textContent = `Happy ${ordinal(y - 2025)} anniversary to us! Thank you for your blessings.`;
        return;
      }
      const todayUTC = Date.UTC(y, ist.getMonth(), ist.getDate());
      let next = Date.UTC(y, 10, 27);
      if (next < todayUTC) { y += 1; next = Date.UTC(y, 10, 27); }
      const days = Math.round((next - todayUTC) / 864e5);
      anniv.textContent = `Our ${ordinal(y - 2025)} wedding anniversary is in ${days} day${days === 1 ? '' : 's'} · 27 November ${y}`;
    }
    update();
    setInterval(update, 1000);
  }

  function initHeroKolam() {
    const svg = $('[data-hero-kolam]');
    if (!svg) return;
    const k = kolamLoops(6, mulberry32(2711));
    svg.innerHTML = kolamSVGMarkup(k, 600, 40, '#FFF6E6', 4.5, 4.2);
    drawInKolam(svg, 7000);
  }

  /* ------------------------------------------------------------------ */
  /* Films — lazy YouTube embeds                                         */
  /* ------------------------------------------------------------------ */
  function youTubeId(url) {
    if (!url) return null;
    const s = url.trim();
    const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(s) ? s : null;
  }

  function initFilms() {
    const smallKolam = kolamSVGMarkup(kolamLoops(3, mulberry32(33)), 120, 12, '#E9C46A', 2.4, 2.2);
    $$('.film').forEach((film) => {
      const player = $('[data-player]', film);
      const label = player.dataset.label;
      const id = youTubeId(film.dataset.youtube);
      if (!id) {
        player.innerHTML = `<div class="film-soon"><svg viewBox="0 0 120 120" aria-hidden="true">${smallKolam}</svg><p>The film of ${label} is on its way</p><small>Coming soon</small></div>`;
        const svg = $('svg', player);
        const io = new IntersectionObserver((es) => {
          if (es[0].isIntersecting) { drawInKolam(svg, 3500); io.disconnect(); }
        });
        io.observe(svg);
        return;
      }
      const link = $('[data-yt-link]', film);
      link.href = `https://www.youtube.com/watch?v=${id}`;
      link.hidden = false;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'film-thumb';
      btn.setAttribute('aria-label', `Play the film of ${label}`);
      btn.innerHTML = `<img alt="" loading="lazy" src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg"><span class="film-play"><svg aria-hidden="true"><use href="#i-play"/></svg></span><span class="film-thumb-label">Play film</span>`;
      const img = $('img', btn);
      img.addEventListener('load', () => {
        if (img.naturalWidth <= 120) img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      });
      img.addEventListener('error', () => { img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }, { once: true });
      btn.addEventListener('click', () => {
        stopMusic();
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
        iframe.title = `Film of ${label}`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        player.innerHTML = '';
        player.appendChild(iframe);
      });
      player.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Rituals                                                             */
  /* ------------------------------------------------------------------ */
  function garlandMarkup(rx, ry, scale = 1) {
    let html = '';
    const rows = [[rx, ry, 0], [rx - 7, ry - 7, 1]];
    rows.forEach(([a, b, row]) => {
      const count = Math.round(26 * scale);
      for (let i = 0; i <= count; i++) {
        const t = Math.PI * (i / count);
        const x = Math.cos(t) * a, y = Math.sin(t) * b;
        const k = (i + row) % 3;
        const sym = k === 0 ? 'rose' : k === 1 ? 'jasmine' : 'marigold';
        const s = sym === 'marigold' ? 0.55 * scale : sym === 'rose' ? 0.85 * scale : 1 * scale;
        html += `<use href="#${sym}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"/>`;
      }
    });
    const by = ry + 4;
    html += `<g transform="translate(0 ${by})"><path d="M-6 0V22M-2 0V26M2 0V26M6 0V22" stroke="#FFFDF4" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 4"/><use href="#marigold" transform="scale(${scale})"/><use href="#rose" transform="translate(0 30) scale(${0.7 * scale})"/></g>`;
    return html;
  }

  function initRituals() {
    let flip = false;
    $$('.ritual').forEach((r) => {
      if (flip) r.classList.add('flip');
      flip = !flip;
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('play'); io.unobserve(en.target); }
      });
    }, { threshold: 0.35 });
    $$('.ritual').forEach((r) => io.observe(r));

    const status = (k, text) => { const s = $(`[data-status="${k}"]`); if (s) s.textContent = text; };
    const action = (name) => $(`[data-action="${name}"]`);

    // Panda Kaal
    action('pandal').addEventListener('click', (e) => {
      const r = e.currentTarget.closest('.ritual');
      restartClass(r, 'play');
      Sound.bell(1046);
    });

    // Kasi Yatra
    const kasiBtn = action('kasi');
    const kasiRitual = kasiBtn.closest('.ritual');
    $('[data-mini-garland]').innerHTML = garlandMarkup(16, 26, 0.55);
    kasiBtn.addEventListener('click', () => {
      const back = kasiRitual.classList.toggle('returned');
      if (back) {
        status('kasi', 'He turned back. Family life it is!');
        kasiBtn.textContent = 'Let him set off again';
        const c = centerOf($('.illus', kasiRitual));
        Petals.burst(c.x, c.y, 30);
        Sound.chime();
      } else {
        status('kasi', '');
        kasiBtn.textContent = '“Come back, marry my daughter!”';
      }
    });

    // Maalai Maatral
    const ga = $('[data-garland="a"]'), gb = $('[data-garland="b"]');
    ga.innerHTML = garlandMarkup(34, 88);
    gb.innerHTML = garlandMarkup(34, 88);
    const mBtn = action('maalai');
    const mCount = $('[data-count="maalai"]');
    let swaps = 0, swapped = false, animating = false;
    mBtn.addEventListener('click', () => {
      if (animating) return;
      if (swaps >= 3) {
        swaps = 0;
        mCount.textContent = '0 / 3';
        status('maalai', '');
        mBtn.textContent = 'Exchange garlands';
        return;
      }
      animating = true;
      const from = swapped ? 1 : 0;
      const dur = reduceMotion ? 1 : 1100;
      const t0 = performance.now();
      Sound.pop(520 + swaps * 120);
      (function step(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const k = from ? 1 - e : e;
        const ax = 96 + 128 * k, bx = 224 - 128 * k;
        const lift = Math.sin(Math.PI * e);
        ga.setAttribute('transform', `translate(${ax.toFixed(1)} ${(54 - 34 * lift).toFixed(1)})`);
        gb.setAttribute('transform', `translate(${bx.toFixed(1)} ${(54 + 16 * lift).toFixed(1)})`);
        if (t < 1) { requestAnimationFrame(step); return; }
        swapped = !swapped;
        swaps++;
        animating = false;
        mCount.textContent = `${swaps} / 3`;
        const lines = ['Once…', 'Twice! The cousins lift them higher…', 'Three times! The garlands have changed hands, and so have their hearts.'];
        status('maalai', lines[swaps - 1]);
        if (swaps === 3) {
          const c = centerOf($('.illus', mBtn.closest('.ritual')));
          Petals.burst(c.x, c.y, 50);
          Sound.chime();
          mBtn.textContent = 'Exchange again';
        }
      })(t0);
    });

    // Oonjal — a damped pendulum that never quite stops.
    const swing = $('[data-swing]');
    const oonjalArt = swing.closest('.illus');
    let ang = 0.06, vel = 0, visible = false, last = 0;
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) { last = performance.now(); requestAnimationFrame(swingFrame); }
    }).observe(oonjalArt);
    function swingFrame(now) {
      if (!visible) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!reduceMotion) {
        const acc = -9 * Math.sin(ang) - 0.35 * vel;
        vel += acc * dt;
        ang = clamp(ang + vel * dt, -0.55, 0.55);
        const energy = Math.abs(ang) + Math.abs(vel) * 0.3;
        if (energy < 0.05) vel += (vel >= 0 ? 1 : -1) * 0.02;
        swing.setAttribute('transform', `rotate(${(ang * 180 / Math.PI).toFixed(2)} 160 28)`);
      }
      requestAnimationFrame(swingFrame);
    }
    action('oonjal-push').addEventListener('click', () => {
      vel += vel >= 0 ? 0.9 : -0.9;
      status('oonjal', pick(['“Aadeer oonjal…” the aunties sing.', 'Higher! The swing creaks happily.', 'Back and forth, in time with the song.']));
    });

    const drishti = $('[data-drishti]');
    action('oonjal-drishti').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      drishti.innerHTML = '';
      const balls = ['#E63946', '#F6BD16', '#FFFDF4'].map((c) => svgEl('circle', { r: 7, fill: c, stroke: 'rgba(0,0,0,.15)' }, drishti));
      const t0 = performance.now();
      const dur = reduceMotion ? 400 : 2600;
      (function step(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        balls.forEach((b, i) => {
          let x, y;
          if (t < 0.78) {
            const a = (t / 0.78) * Math.PI * 6 + (i * Math.PI * 2) / 3;
            x = 160 + Math.cos(a) * 78; y = 128 + Math.sin(a) * 46;
          } else {
            const u = (t - 0.78) / 0.22;
            x = 160 + 78 + u * 140 + i * 10; y = 128 - u * 120 + i * 14;
            b.setAttribute('opacity', String(1 - u));
          }
          b.setAttribute('cx', x.toFixed(1));
          b.setAttribute('cy', y.toFixed(1));
        });
        if (t < 1) requestAnimationFrame(step);
        else { drishti.innerHTML = ''; btn.disabled = false; }
      })(t0);
      status('oonjal', 'Red, yellow and white rice balls circle three times, then they are tossed away, and the evil eye with them.');
      Sound.bell(988);
    });

    // Mangalya Dharanam
    const thBtn = action('thaali');
    const thArt = $('.illus', thBtn.closest('.ritual'));
    const thCount = $('[data-count="thaali"]');
    const mantra = $('.mantra');
    const knots = $$('.knot', thArt);
    let tied = 0, melamTimer;
    thBtn.addEventListener('click', () => {
      if (tied >= 3) {
        tied = 0;
        knots.forEach((k) => k.classList.remove('tied'));
        thArt.classList.remove('thaali-done');
        mantra.hidden = true;
        thCount.textContent = '0 / 3';
        status('thaali', '');
        thBtn.textContent = 'Tie the first knot';
        return;
      }
      knots[tied].classList.add('tied');
      tied++;
      thCount.textContent = `${tied} / 3`;
      const secs = tied === 3 ? 3.6 : 1.4;
      Sound.gettiMelam(secs);
      thArt.classList.add('melam-on');
      clearTimeout(melamTimer);
      melamTimer = setTimeout(() => thArt.classList.remove('melam-on'), secs * 1000);
      const c = centerOf(thArt);
      Petals.burst(c.x, c.y - 40, tied === 3 ? 40 : 22);
      if (tied === 1) {
        status('thaali', 'The first knot, tied by the groom.');
        thBtn.textContent = 'Second knot · groom\'s sister';
      } else if (tied === 2) {
        status('thaali', 'The second knot, tied by the groom\'s sister.');
        thBtn.textContent = 'Third knot · groom\'s sister';
      } else {
        status('thaali', 'Three knots! Getti melam! Akshathai rains down from every hand.');
        thArt.classList.add('thaali-done');
        mantra.hidden = false;
        Petals.shower(110);
        thBtn.textContent = 'Watch it again';
      }
    });

    // Saptapadi
    const stepsG = $('[data-steps]');
    const vowBox = $('[data-vow]');
    const VOWS = [
      ['Ishe ekapadī bhava', 'Step one: for nourishment. May we never want for food.'],
      ['Ūrje dvipadī bhava', 'Step two: for strength of body, mind and spirit.'],
      ['Rāyas poshāya tripadī bhava', 'Step three: for prosperity, earned and shared together.'],
      ['Mayo bhavyāya chatushpadī bhava', 'Step four: for happiness, love and harmony at home.'],
      ['Prajābhyah panchapadī bhava', 'Step five: for the family we will raise.'],
      ['Ritubhyah shatpadī bhava', 'Step six: to walk together through every season of life.'],
      ['Sakhā saptapadī bhava', 'Step seven: for friendship, forever.']
    ];
    const steps = [];
    for (let i = 0; i < 7; i++) {
      const t = (200 - i * 36.67) * Math.PI / 180;
      const cx = 160 + Math.cos(t) * 128, cy = 150 + Math.sin(t) * 62;
      const dx = 128 * Math.sin(t), dy = -62 * Math.cos(t);
      const ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      const side = i % 2 ? -1 : 1;
      const g = svgEl('g', { class: 'step', transform: `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${ang.toFixed(1)})` }, stepsG);
      svgEl('use', { href: '#foot', fill: '#C1121F', opacity: '.85', transform: `translate(${side * 5} 0) scale(${side * 0.85} .85)` }, g);
      const label = svgEl('text', { class: 'step-num', 'text-anchor': 'middle', 'font-size': '10', fill: '#6E0F1F', transform: `rotate(${(-ang).toFixed(1)}) translate(0 ${cy > 150 ? 26 : -20})` }, g);
      label.textContent = TAMIL_DIGITS[i];
      steps.push(g);
    }
    const sBtn = action('saptapadi');
    const sCount = $('[data-count="saptapadi"]');
    let taken = 0;
    sBtn.addEventListener('click', () => {
      if (taken >= 7) {
        taken = 0;
        steps.forEach((s) => s.classList.remove('on'));
        sCount.textContent = '0 / 7';
        sBtn.textContent = 'Take the first step';
        vowBox.querySelector('.vow-sa').textContent = 'Sakhā saptapadī bhava';
        vowBox.querySelector('.vow-en').textContent = '“With seven steps, become my friend.”';
        return;
      }
      steps[taken].classList.add('on');
      const [sa, en] = VOWS[taken];
      vowBox.querySelector('.vow-sa').textContent = sa;
      vowBox.querySelector('.vow-en').textContent = en;
      restartClass(vowBox, 'changed');
      taken++;
      sCount.textContent = `${taken} / 7`;
      Sound.pop(440 + taken * 60);
      if (taken === 7) {
        sBtn.textContent = 'Walk again';
        const c = centerOf($('.illus', sBtn.closest('.ritual')));
        Petals.burst(c.x, c.y, 44);
        Sound.chime();
      } else {
        sBtn.textContent = `Take step ${taken + 1}`;
      }
    });

    // Ammi Midhithal
    const aBtn = action('ammi');
    const aRitual = aBtn.closest('.ritual');
    aBtn.addEventListener('click', () => {
      const placed = aRitual.classList.toggle('placed');
      if (placed) {
        status('ammi', 'Steady as stone. The silver metti are on, and Arundhati shines above.');
        aBtn.textContent = 'Again';
        setTimeout(() => Sound.bell(1568), 900);
      } else {
        status('ammi', '');
        aBtn.textContent = 'Place the foot on the ammi';
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Traditions                                                          */
  /* ------------------------------------------------------------------ */
  function initTraditions() {
    $$('[data-pleats]').forEach((g) => {
      const koorai = g.dataset.pleats === 'koorai';
      const fills = koorai ? ['#7A0F22', '#8E1B2C'] : ['#FFFBF0', '#F1E6CC'];
      const topY = 40, botY = 182, tx0 = 96, tx1 = 146, bx0 = 34, bx1 = 206, n = 7;
      const xAt = (i, y) => {
        const t = (y - topY) / (botY - topY);
        const top = tx0 + ((tx1 - tx0) * i) / n;
        const bot = bx0 + ((bx1 - bx0) * i) / n;
        return top + (bot - top) * t;
      };
      let html = '';
      for (let i = 0; i < n; i++) {
        const pts = `${xAt(i, topY)},${topY} ${xAt(i + 1, topY)},${topY} ${xAt(i + 1, botY)},${botY} ${xAt(i, botY)},${botY}`;
        html += `<polygon points="${pts}" fill="${fills[i % 2]}"/>`;
        if (koorai) html += `<polygon points="${pts}" fill="url(#p-checks)"/>`;
        const b0 = botY - 18;
        const band = `${xAt(i, b0)},${b0} ${xAt(i + 1, b0)},${b0} ${xAt(i + 1, botY)},${botY} ${xAt(i, botY)},${botY}`;
        html += `<polygon points="${band}" fill="${koorai ? 'url(#g-zari)' : '#E9C46A'}"/>`;
        if (!koorai) html += `<line x1="${xAt(i, b0 - 5)}" y1="${b0 - 5}" x2="${xAt(i + 1, b0 - 5)}" y2="${b0 - 5}" stroke="#8E1B2C" stroke-width="1.6"/>`;
        html += `<line x1="${xAt(i, topY)}" y1="${topY}" x2="${xAt(i, botY)}" y2="${botY}" stroke="rgba(0,0,0,.12)" stroke-width="1"/>`;
      }
      if (koorai) {
        for (let x = 40; x < 202; x += 14) html += `<path d="M${x} 180l4-8 4 8z" fill="#8E1B2C" opacity=".75"/>`;
      }
      g.innerHTML = `<g>${sway(1.2, 5, ' 120 40')}${html}</g>`;
    });

    const btn = $('[data-action="melam"]');
    const card = btn.closest('.trad');
    let t;
    btn.addEventListener('click', () => {
      const secs = Sound.melam();
      if (!secs) return;
      card.classList.add('playing');
      clearTimeout(t);
      t = setTimeout(() => card.classList.remove('playing'), secs * 1000);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Elai Sappadu                                                        */
  /* ------------------------------------------------------------------ */
  function initFeast() {
    const svg = $('.leaf-svg');
    const veins = $('[data-veins]', svg);
    let v = '';
    for (let x = 40; x < 840; x += 13) v += `M${x} 50Q${x - 16} 214 ${x - 44} 380`;
    veins.innerHTML = `<path d="${v}" fill="none"/>`;

    const rng = mulberry32(11);
    const blob = (rx, ry, fill, op = 1) => {
      const pts = [];
      const k = 9;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2;
        const j = 0.82 + rng() * 0.3;
        pts.push([Math.cos(a) * rx * j, Math.sin(a) * ry * j]);
      }
      let d = '';
      for (let i = 0; i < k; i++) {
        const p = pts[i], q = pts[(i + 1) % k];
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        d += i === 0 ? `M${((pts[k - 1][0] + p[0]) / 2).toFixed(1)} ${((pts[k - 1][1] + p[1]) / 2).toFixed(1)}` : '';
        d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
      }
      return `<path d="${d}Z" fill="${fill}" opacity="${op}"/>`;
    };
    const sprinkle = (n, colors, rx, ry, r = 1.6) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 0.8;
        s += `<circle cx="${(Math.cos(a) * rx * d).toFixed(1)}" cy="${(Math.sin(a) * ry * d).toFixed(1)}" r="${(r * (0.7 + rng() * 0.6)).toFixed(1)}" fill="${colors[i % colors.length]}"/>`;
      }
      return s;
    };
    const sticks = (n, colors, rx, ry) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const x = (rng() - 0.5) * rx * 1.4, y = (rng() - 0.5) * ry * 1.4, a = rng() * 180;
        s += `<rect x="-5" y="-1.4" width="10" height="2.8" rx="1.2" fill="${colors[i % colors.length]}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(0)})"/>`;
      }
      return s;
    };
    let grains = '';
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 0.85;
      grains += `<ellipse cx="${(Math.cos(a) * 86 * d).toFixed(1)}" cy="${(Math.sin(a) * 44 * d).toFixed(1)}" rx="3" ry="1.2" fill="#EDE6D6" transform="rotate(${(rng() * 180).toFixed(0)} ${(Math.cos(a) * 86 * d).toFixed(1)} ${(Math.sin(a) * 44 * d).toFixed(1)})"/>`;
    }

    const DISHES = [
      { x: 232, y: 132, en: 'Salt', ta: 'உப்பு', note: 'Always first, a pinch in the top-left corner.', art: '<path d="M-11 5Q0-11 11 5Z" fill="#FFFFFF"/><circle cx="-3" cy="2" r="1" fill="#DDE3E8"/><circle cx="3" cy="1" r="1" fill="#DDE3E8"/>' },
      { x: 298, y: 118, en: 'Pickle', ta: 'ஊறுகாய்', note: 'Tangy mango or lime pickle sits beside the salt.', art: () => blob(14, 9, '#C2410C') + sprinkle(5, ['#7C2D12', '#FDE68A'], 12, 7, 2) },
      { x: 370, y: 110, en: 'Kosumalli', ta: 'கோசுமல்லி', note: 'A cool salad of soaked moong dal, cucumber and coconut.', art: () => blob(17, 10, '#F3E3A0') + sprinkle(12, ['#F2C94C', '#7CB342', '#E9A23B'], 15, 8, 1.8) },
      { x: 444, y: 106, en: 'Pachadi', ta: 'பச்சடி', note: 'Creamy curd pachadi, sometimes a sweet one too.', art: () => blob(17, 10, '#F7EAE0') + sprinkle(8, ['#E63946', '#4C9A2A'], 14, 8, 1.6) },
      { x: 520, y: 104, en: 'Poriyal', ta: 'பொரியல்', note: 'Beans or cabbage, stir-fried with fresh coconut.', art: () => blob(19, 11, '#C9CF6A') + sprinkle(16, ['#4C9A2A', '#F57C00', '#FFFDF4'], 17, 9, 1.7) },
      { x: 598, y: 104, en: 'Kootu', ta: 'கூட்டு', note: 'Vegetables simmered with lentils and coconut.', art: () => blob(19, 11, '#E1C25A') + sprinkle(9, ['#6A9A2E', '#FFF3C4'], 16, 9, 2) },
      { x: 676, y: 106, en: 'Avial', ta: 'அவியல்', note: 'Mixed vegetables in coconut and curd.', art: () => blob(20, 12, '#F0E6C8') + sticks(10, ['#F57C00', '#4C9A2A', '#9A3D5C', '#E9C46A'], 16, 9) },
      { x: 150, y: 212, en: 'Sweet', ta: 'இனிப்பு', note: 'A laddu to begin. Every good thing starts sweet.', art: '<circle r="14" fill="#F6A623"/><circle r="14" fill="none" stroke="#E08A10" stroke-width="2" stroke-dasharray="1.5 3"/><circle cx="-4" cy="-4" r="2" fill="#FFF3C4"/><circle cx="5" cy="2" r="1.6" fill="#B33F00"/>' },
      { x: 232, y: 252, en: 'Banana', ta: 'வாழைப்பழம்', note: 'A ripe banana sits at the bottom of the leaf.', art: '<path d="M-32 6C-14 20 18 20 34-2C32-7 28-7 25-4C10 10-12 10-29 0Z" fill="#F6C945" stroke="#C99A1E"/><path d="M34-2l5-4" stroke="#5A3214" stroke-width="3" stroke-linecap="round"/>' },
      { x: 302, y: 196, en: 'Banana chips', ta: 'சிப்ஸ்', note: 'Crisp chips fried in coconut oil.', art: '<g fill="#F4C430" stroke="#D9A21B"><circle cx="-10" cy="2" r="7"/><circle cx="0" cy="-3" r="7"/><circle cx="10" cy="2" r="7"/><circle cx="2" cy="7" r="6"/></g>' },
      { x: 334, y: 278, en: 'Vadai', ta: 'வடை', note: 'A golden medhu vadai with a hole in the middle.', art: '<circle r="17" fill="#A0522D"/><circle r="14" fill="#B8692E"/><circle r="4.5" fill="#4F9C30"/><circle cx="-8" cy="-6" r="1.2" fill="#7A3A12"/><circle cx="7" cy="7" r="1.2" fill="#7A3A12"/>' },
      { x: 424, y: 228, en: 'Appalam', ta: 'அப்பளம்', note: 'One big crunchy appalam (keep it safe from the nalangu games!).', art: () => `<circle r="44" fill="#F5E6B8" stroke="#E2CC8E" stroke-width="2"/>${sprinkle(16, ['#EAD49A', '#FBF1D3'], 40, 40, 4)}` },
      { x: 590, y: 266, en: 'Rice, paruppu & ghee', ta: 'சாதம், பருப்பு, நெய்', note: 'Steaming rice with yellow dal and a spoon of ghee: the heart of the meal.', art: `<ellipse rx="92" ry="50" fill="#FFFDF8"/><ellipse rx="92" ry="50" fill="none" stroke="#EDE6D6" stroke-width="2"/>${grains}<ellipse cx="-6" cy="-6" rx="28" ry="14" fill="#F2C94C"/><ellipse cx="-2" cy="-9" rx="10" ry="4.5" fill="#FFE58A" opacity=".95"/><ellipse cx="-4" cy="-10" rx="4" ry="1.6" fill="#FFFBE6"/>` },
      { x: 588, y: 262, pour: true, en: 'Sambar', ta: 'சாம்பார்', note: 'Sambar is poured over the rice first.', art: () => blob(62, 32, '#C46A1E', 0.94) + sticks(6, ['#5E8C28', '#F3D9C9'], 44, 22) + sprinkle(6, ['#E9A0A0'], 40, 20, 3) },
      { x: 588, y: 262, pour: true, en: 'Rasam', ta: 'ரசம்', note: 'Next, peppery rasam that warms the soul.', art: () => blob(62, 32, '#B7412E', 0.78) + sprinkle(14, ['#2E7D32', '#2B1B12'], 44, 22, 1.4) },
      { x: 724, y: 236, en: 'Payasam', ta: 'பாயசம்', note: 'Sweet payasam served in a leaf cup, with cashews and raisins.', art: '<ellipse rx="32" ry="19" fill="#356F21"/><ellipse rx="26" ry="14" fill="#EBD3A2"/><path d="M-10-3a4 4 0 1 0 6 0" fill="none" stroke="#F8E9C7" stroke-width="3"/><path d="M6 2a4 4 0 1 0 6 0" fill="none" stroke="#F8E9C7" stroke-width="3"/><circle cx="-2" cy="5" r="2" fill="#5A2A1A"/><circle cx="12" cy="-5" r="2" fill="#5A2A1A"/>' },
      { x: 588, y: 262, pour: true, en: 'Thayir sadam', ta: 'தயிர் சாதம்', note: 'And to finish, cool curd with rice. The meal is complete.', art: () => blob(62, 32, '#FFFFFF', 0.96) + sprinkle(8, ['#2B1B12', '#2E7D32'], 40, 20, 1.3) }
    ];

    const holder = $('[data-dishes]', svg);
    const nodes = DISHES.map((d) => {
      const big = d.pour || d.en.startsWith('Rice') || d.en === 'Appalam' || d.en === 'Payasam';
      const outer = svgEl('g', { transform: `translate(${d.x} ${d.y}) scale(${big ? 1.08 : 1.5})` }, holder);
      const inner = svgEl('g', { class: 'dish' + (d.pour ? ' pour' : '') }, outer);
      const art = typeof d.art === 'function' ? d.art() : d.art;
      const top = d.en === 'Appalam' ? -52 : d.pour || d.en.startsWith('Rice') ? -58 : -22;
      inner.innerHTML = `<title>${d.en} · ${d.ta}</title>${art}<text class="dish-label" y="${top}" text-anchor="middle">${d.en}</text>`;
      return inner;
    });

    const stepEl = $('[data-leaf-step]'), taEl = $('[data-leaf-ta]'), enEl = $('[data-leaf-en]'), noteEl = $('[data-leaf-note]');
    const nextBtn = $('[data-leaf="next"]'), allBtn = $('[data-leaf="all"]'), foldBtn = $('[data-leaf="fold"]');
    const body = $('.leaf-body', svg);
    let served = 0, autoTimer = null;

    function serveOne() {
      if (served >= DISHES.length) return false;
      const d = DISHES[served];
      if (d.pour) nodes.forEach((n, i) => { if (i < served && DISHES[i].pour) n.classList.remove('served'); });
      nodes[served].classList.add('served');
      stepEl.textContent = `Dish ${served + 1} of ${DISHES.length}`;
      taEl.textContent = d.ta;
      enEl.textContent = d.en;
      noteEl.textContent = d.note;
      Sound.pop(380 + served * 25);
      served++;
      if (served === DISHES.length) {
        nextBtn.disabled = true;
        allBtn.disabled = true;
        foldBtn.disabled = false;
      }
      return true;
    }

    function reset() {
      clearInterval(autoTimer);
      served = 0;
      nodes.forEach((n) => n.classList.remove('served'));
      body.classList.remove('folded');
      nextBtn.disabled = false;
      allBtn.disabled = false;
      foldBtn.disabled = true;
      nextBtn.textContent = 'Serve the next dish';
      stepEl.textContent = 'Ready to be served';
      taEl.textContent = 'வாங்க, சாப்பிடலாம்!';
      enEl.textContent = "Come, let's eat!";
      noteEl.textContent = "The leaf's tip points to the left of the guest. Salt comes first, in the top-left corner.";
    }

    nextBtn.addEventListener('click', () => {
      if (body.classList.contains('folded')) { reset(); return; }
      clearInterval(autoTimer);
      serveOne();
    });
    allBtn.addEventListener('click', () => {
      clearInterval(autoTimer);
      allBtn.disabled = true;
      autoTimer = setInterval(() => { if (!serveOne()) clearInterval(autoTimer); }, reduceMotion ? 60 : 650);
    });
    foldBtn.addEventListener('click', () => {
      body.classList.add('folded');
      foldBtn.disabled = true;
      nextBtn.disabled = false;
      nextBtn.textContent = 'Lay a fresh leaf';
      stepEl.textContent = 'Meal complete';
      taEl.textContent = 'வயிறும் மனமும் நிறைந்தது';
      enEl.textContent = 'Full stomach, full heart';
      noteEl.textContent = 'Folding the leaf towards yourself is how a guest says “that was a wonderful meal!”';
      const c = centerOf(svg);
      Petals.burst(c.x, c.y, 30);
      Sound.chime();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Nalangu games                                                       */
  /* ------------------------------------------------------------------ */
  function initNalangu() {
    const score = { k: 0, s: 0 };
    const NAMES = { k: 'Keerthi', s: 'Sandhya' };
    const scoreEls = { k: $('[data-score="k"]'), s: $('[data-score="s"]') };
    function award(team, pts = 1) {
      score[team] += pts;
      scoreEls[team].textContent = score[team];
      restartClass(scoreEls[team], 'bump');
    }

    // Ring in the pot
    const ringSvg = $('.ring-svg');
    const ripples = $('[data-ripples]', ringSvg);
    const ring = $('[data-ring]', ringSvg);
    const turnEl = $('[data-ring-turn]');
    const hintEl = $('[data-ring-hint]');
    let turn = 'k', ringPos = null, locked = false;
    function hideRing() {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.72;
      ringPos = { u: Math.cos(a) * d, v: Math.sin(a) * d };
      ring.hidden = true;
    }
    hideRing();
    $('.ring-hit', ringSvg).addEventListener('click', (e) => {
      if (locked) return;
      const p = svgPoint(ringSvg, e.clientX, e.clientY);
      const u = (p.x - 160) / 112, v = (p.y - 84) / 38;
      const rip = svgEl('ellipse', { cx: p.x, cy: p.y, rx: 18, ry: 6, fill: 'none', stroke: '#FFFDF4', 'stroke-width': 2, class: 'ripple' }, ripples);
      setTimeout(() => rip.remove(), 1100);
      Sound.splash();
      const dist = Math.hypot(u - ringPos.u, (v - ringPos.v) * 0.9);
      if (dist < 0.2) {
        locked = true;
        ring.setAttribute('transform', `translate(${(160 + ringPos.u * 112).toFixed(1)} ${(84 + ringPos.v * 38).toFixed(1)})`);
        ring.hidden = false;
        restartClass($('.ring-in', ring), 'up');
        award(turn);
        hintEl.textContent = `${NAMES[turn]} found the ring! Tradition says they'll rule the house.`;
        const c = centerOf(ringSvg);
        Petals.burst(c.x, c.y - 30, 34);
        Sound.chime();
        setTimeout(() => {
          hideRing();
          locked = false;
          turn = turn === 'k' ? 's' : 'k';
          turnEl.textContent = `New round · ${NAMES[turn]}'s turn: tap the water to search`;
          hintEl.textContent = 'The ring is hidden again…';
        }, 2200);
        return;
      }
      hintEl.textContent = dist < 0.38 ? 'Hot! Your fingers brush something…' : dist < 0.7 ? 'Warm… keep feeling around.' : 'Cold. Nothing but petals here.';
      turn = turn === 'k' ? 's' : 'k';
      turnEl.textContent = `${NAMES[turn]}'s turn: tap the water to search`;
    });

    // Appalam
    const papadSvg = $('.papad-svg');
    const papadG = $('[data-papad]', papadSvg);
    const papadHint = $('[data-papad-hint]');
    let cracks = 0, broken = 0, papadTeam = 'k', busy = false;
    const prng = mulberry32(5);
    function bubbles(r) {
      let s = '';
      for (let i = 0; i < 26; i++) {
        const a = prng() * Math.PI * 2, d = Math.sqrt(prng()) * r * 0.9;
        s += `<circle cx="${(Math.cos(a) * d).toFixed(1)}" cy="${(Math.sin(a) * d).toFixed(1)}" r="${(2 + prng() * 5).toFixed(1)}" fill="${prng() < 0.5 ? '#EAD49A' : '#FBF1D3'}" opacity=".8"/>`;
      }
      return s;
    }
    function buildPapad() {
      cracks = 0;
      papadG.innerHTML = `<g data-whole><circle r="86" fill="#F5E6B8" stroke="#E2CC8E" stroke-width="3"/>${bubbles(86)}<g data-cracks fill="none" stroke="#B39552" stroke-width="2" stroke-linecap="round"></g></g>`;
    }
    buildPapad();
    const CRACKS = [
      'M0 0L22-18L40-22L60-48M22-18L30 6',
      'M0 0L-26 10L-44 34L-70 40M-26 10L-30-18L-52-40',
      'M0 0L8 30L30 52L34 80M8 30L-14 56'
    ];
    function hitPapad() {
      if (busy) return;
      const c = centerOf(papadSvg);
      if (cracks < 2) {
        const cg = $('[data-cracks]', papadG);
        svgEl('path', { d: CRACKS[cracks] }, cg);
        cracks++;
        Sound.crack();
        papadHint.textContent = cracks === 1 ? 'Crack! One more…' : 'Almost…';
        return;
      }
      busy = true;
      Sound.crunch();
      $('[data-whole]', papadG).remove();
      const pieces = svgEl('g', {}, papadG);
      for (let i = 0; i < 9; i++) {
        const a0 = (i / 9) * Math.PI * 2, a1 = ((i + 1) / 9) * Math.PI * 2;
        const r = 86;
        const mid = (a0 + a1) / 2;
        const d = `M0 0L${(Math.cos(a0) * r).toFixed(1)} ${(Math.sin(a0) * r).toFixed(1)}A${r} ${r} 0 0 1 ${(Math.cos(a1) * r).toFixed(1)} ${(Math.sin(a1) * r).toFixed(1)}Z`;
        const piece = svgEl('path', { d, fill: '#F5E6B8', stroke: '#E2CC8E', 'stroke-width': 2, class: 'papad-piece' }, pieces);
        const dx = Math.cos(mid) * rand(60, 110), dy = Math.sin(mid) * rand(60, 110) + 30;
        piece.style.transition = 'transform .9s cubic-bezier(.2,.7,.3,1), opacity .9s ease .3s';
        piece.style.transformOrigin = 'center';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          piece.style.transform = `translate(${dx}px, ${dy}px) rotate(${rand(-90, 90)}deg)`;
          piece.style.opacity = '0';
        }));
      }
      Petals.burst(c.x, c.y, 26, ['#F5E6B8', '#EAD49A', '#FBF1D3']);
      broken++;
      award(papadTeam);
      papadHint.textContent = `Crunch! Point to Team ${NAMES[papadTeam]}. Appalams broken: ${broken}`;
      papadTeam = papadTeam === 'k' ? 's' : 'k';
      setTimeout(() => { buildPapad(); busy = false; }, 1300);
    }
    papadSvg.addEventListener('click', hitPapad);
    papadSvg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hitPapad(); }
    });

    // Coconut roll
    const coco = $('[data-coconut]');
    const meter = $('[data-meter]');
    const cocoBtn = $('[data-action="coconut"]');
    const cocoTurn = $('[data-coco-turn]');
    const cocoHint = $('[data-coco-hint]');
    let cocoTeam = 's', power = 0, meterOn = true, meterVisible = false, rolling = false;
    new IntersectionObserver((es) => {
      meterVisible = es[0].isIntersecting;
      if (meterVisible) requestAnimationFrame(meterFrame);
    }).observe(meter);
    function meterFrame(now) {
      if (!meterVisible) return;
      if (meterOn) {
        const ph = (now / 1000) * 0.9 % 2;
        power = ph < 1 ? ph : 2 - ph;
        meter.style.left = `${(power * 100).toFixed(1)}%`;
      }
      requestAnimationFrame(meterFrame);
    }
    cocoBtn.addEventListener('click', () => {
      if (rolling) return;
      rolling = true;
      meterOn = false;
      cocoBtn.disabled = true;
      const dist = 20 + power * 300;
      const finalX = 36 + dist;
      const dur = 900 + power * 900;
      Sound.roll(dur / 1000);
      const t0 = performance.now();
      (function step(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - t, 3);
        const x = dist * e;
        coco.setAttribute('transform', `translate(${x.toFixed(1)} 0) rotate(${(x / 16 * 180 / Math.PI).toFixed(1)})`);
        if (t < 1) { requestAnimationFrame(step); return; }
        const off = Math.abs(finalX - 262);
        let msg;
        if (finalX > 330) msg = 'Too strong! It rolled right off the mat.';
        else if (off < 9) { msg = `Perfect! Bang in the centre. Two points to Team ${NAMES[cocoTeam]}!`; award(cocoTeam, 2); }
        else if (off < 34) { msg = `Inside the kolam! One point to Team ${NAMES[cocoTeam]}.`; award(cocoTeam, 1); }
        else msg = finalX < 262 ? 'A little short. So close!' : 'Just past the kolam!';
        cocoHint.textContent = msg;
        if (off < 34) { const c = centerOf(coco); Petals.burst(c.x, c.y, 20); }
        setTimeout(() => {
          coco.setAttribute('transform', 'translate(0 0)');
          cocoTeam = cocoTeam === 'k' ? 's' : 'k';
          cocoTurn.textContent = `${NAMES[cocoTeam]}'s turn: stop the meter, then roll!`;
          rolling = false;
          meterOn = true;
          cocoBtn.disabled = false;
        }, 1800);
      })(t0);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Mehandi — the hidden name                                           */
  /* ------------------------------------------------------------------ */
  function mandala(cx, cy) {
    const H = '#7A2E12';
    const pt = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const f = (n) => n.toFixed(1);
    let s = `<circle class="fill-in" cx="${cx}" cy="${cy}" r="8" fill="${H}"/>`;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s += `<path class="draw" pathLength="1" d="M0-11C6-15 6-23 0-28C-6-23-6-15 0-11Z" transform="translate(${cx} ${cy}) rotate(${(a * 180 / Math.PI).toFixed(0)})"/>`;
    }
    s += `<circle class="fill-in" cx="${cx}" cy="${cy}" r="31" fill="none"/>`;
    for (let i = 0; i < 24; i++) { const [x, y] = pt(35, (i / 24) * Math.PI * 2); s += `<circle class="fill-in" cx="${f(x)}" cy="${f(y)}" r="1.5" fill="${H}" stroke="none"/>`; }
    let sc = '';
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
      const [x0, y0] = pt(39, a0), [xc, yc] = pt(52, (a0 + a1) / 2), [x1, y1] = pt(39, a1);
      sc += `${i ? '' : `M${f(x0)} ${f(y0)}`}Q${f(xc)} ${f(yc)} ${f(x1)} ${f(y1)}`;
    }
    s += `<path class="draw" pathLength="1" d="${sc}"/><circle class="fill-in" cx="${cx}" cy="${cy}" r="39" fill="none"/>`;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      s += `<path class="draw" pathLength="1" d="M0-53C4-56 4-62 0-66C-4-62-4-56 0-53Z" transform="translate(${cx} ${cy}) rotate(${(a * 180 / Math.PI).toFixed(1)})"/>`;
    }
    s += `<circle class="fill-in" cx="${cx}" cy="${cy}" r="69" fill="none"/><circle class="fill-in" cx="${cx}" cy="${cy}" r="72" fill="none" stroke-width="1"/>`;
    for (let i = 0; i < 40; i++) { const [x, y] = pt(77, (i / 40) * Math.PI * 2); s += `<circle class="fill-in" cx="${f(x)}" cy="${f(y)}" r="1.7" fill="${H}" stroke="none"/>`; }
    return s;
  }

  function fingerDecor(x, y, w, h, full = true) {
    const H = '#7A2E12';
    const r = w / 2;
    let s = `<path class="fill-in" d="M${x} ${y + 50}V${y + r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + 50}Z" fill="${H}" stroke="none"/>`;
    s += `<path class="draw" pathLength="1" d="M${x + 3} ${y + 58}H${x + w - 3}M${x + 3} ${y + 64}H${x + w - 3}"/>`;
    for (let i = 0; i < 5; i++) s += `<circle class="fill-in" cx="${(x + 6 + (i * (w - 12)) / 4).toFixed(1)}" cy="${y + 72}" r="1.6" fill="${H}" stroke="none"/>`;
    if (!full) return s;
    const zy = y + 96;
    let z = `M${x + 3} ${zy}`;
    for (let i = 1; i <= 6; i++) z += `L${(x + 3 + (i * (w - 6)) / 6).toFixed(1)} ${zy + (i % 2 ? 7 : 0)}`;
    s += `<path class="draw" pathLength="1" d="M${x + 3} ${zy - 6}H${x + w - 3}${z}M${x + 3} ${zy + 13}H${x + w - 3}"/>`;
    const my = y + h - 56, mx = x + w / 2;
    s += `<path class="draw" pathLength="1" d="M${mx} ${my - 12}C${mx + 8} ${my - 4} ${mx + 8} ${my + 6} ${mx} ${my + 12}C${mx - 8} ${my + 6} ${mx - 8} ${my - 4} ${mx} ${my - 12}Z"/>`;
    s += `<circle class="fill-in" cx="${mx}" cy="${my}" r="2.5" fill="${H}" stroke="none"/>`;
    s += `<path class="draw" pathLength="1" d="M${mx - 10} ${my + 22}Q${mx} ${my + 30} ${mx + 10} ${my + 22}"/>`;
    return s;
  }

  function initMehandi() {
    const svg = $('[data-hand]');
    const stage = $('[data-hand-stage]');
    const lens = $('[data-lens]');
    const status = $('[data-mehandi-status]');
    const SKIN = '#E8B18A';
    const fingers = [
      { x: 106, y: 120, w: 46, h: 200, rot: 'rotate(-5 129 320)' },
      { x: 160, y: 88, w: 48, h: 226, rot: '' },
      { x: 216, y: 106, w: 46, h: 208, rot: 'rotate(4 239 314)' },
      { x: 268, y: 166, w: 38, h: 160, rot: 'rotate(10 287 326)' }
    ];
    const thumb = { x: 88, y: 290, w: 52, h: 170, rot: 'rotate(-28 114 456)' };
    const palm = 'M104 300C100 360 112 430 146 488L150 560H262V486C292 440 306 372 300 300C298 268 270 250 200 250C130 250 106 268 104 300Z';
    const skinShapes =
      `<path d="${palm}"/><ellipse cx="138" cy="440" rx="32" ry="50" transform="rotate(-18 138 440)"/>` +
      [...fingers, thumb].map((f) => `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.w / 2}" transform="${f.rot}"/>`).join('');

    let deco = '';
    fingers.forEach((f) => { deco += `<g transform="${f.rot}">${fingerDecor(f.x, f.y, f.w, f.h)}</g>`; });

    // Thumb: cap, bands and the paisley that hides the name.
    const t = thumb;
    let thumbDeco = fingerDecor(t.x, t.y, t.w, t.h, false);
    thumbDeco += `<g transform="translate(${t.x + t.w / 2} ${t.y + 116}) scale(.85)">
        <path class="draw" pathLength="1" d="M0 30C-22 30-25 4-14-12C-5-25 12-28 9-40C24-26 24 12 0 30Z"/>
        <path class="draw" pathLength="1" d="M0 24C-16 24-18 4-10-8C-3-18 8-22 8-30"/>
        <clipPath id="paisley-clip"><path d="M0 30C-22 30-25 4-14-12C-5-25 12-28 9-40C24-26 24 12 0 30Z"/></clipPath>
        <g clip-path="url(#paisley-clip)" stroke-width=".8" opacity=".75"><path d="M-30-40L30 20M-30-30L30 30M-30-20L30 40M-30-50L30 10M-30-60L30 0"/></g>
        <text class="hidden-name" x="0" y="0" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-weight="700" font-size="9.5" fill="#7A2E12" stroke="none" transform="translate(1 0) rotate(-68)">Keerthi</text>
      </g>
      <g fill="#7A2E12" stroke="none" class="fill-in">${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${(t.x + t.w / 2 + (i % 2 ? 16 : -16)).toFixed(1)}" cy="${t.y + 92 + i * 9}" r="1.5"/>`).join('')}</g>`;
    deco += `<g transform="${t.rot}" data-thumb>${thumbDeco}</g>`;

    deco += mandala(204, 384);
    let scallops = 'M118 300';
    for (let x = 118; x < 292; x += 14.5) scallops += `Q${(x + 7.25).toFixed(1)} 314 ${(x + 14.5).toFixed(1)} 300`;
    deco += `<path class="draw" pathLength="1" d="M116 292H294${scallops}"/>`;
    for (let x = 125; x < 290; x += 14.5) deco += `<circle class="fill-in" cx="${x.toFixed(1)}" cy="318" r="1.6" fill="#7A2E12" stroke="none"/>`;
    // Vines down the sides of the palm
    [[128, 1], [282, -1]].forEach(([x, dir]) => {
      deco += `<path class="draw" pathLength="1" d="M${x} 330C${x - dir * 6} 380 ${x + dir * 4} 430 ${x + dir * 20} 476"/>`;
      for (let i = 0; i < 5; i++) {
        const y = 345 + i * 26, xx = x + dir * (i * 3.5 - 2);
        deco += `<path class="draw" pathLength="1" d="M${xx} ${y}q${dir * 10} -6 ${dir * 14} -16q${-dir * 12} 2 ${-dir * 14} 16z"/>`;
      }
    });
    // Wrist bracelet bands
    deco += '<path class="draw" pathLength="1" d="M140 500H272M140 507H272"/>';
    let wz = 'M146 514';
    for (let x = 146; x < 266; x += 10) wz += `Q${x + 5} 528 ${x + 10} 514`;
    deco += `<path class="draw" pathLength="1" d="${wz}"/>`;
    for (let x = 151; x < 266; x += 10) deco += `<circle class="fill-in" cx="${x}" cy="534" r="1.7" fill="#7A2E12" stroke="none"/>`;
    deco += '<path class="draw" pathLength="1" d="M140 542H272M140 549H272"/>';

    svg.innerHTML = `
      <defs><clipPath id="hand-clip">${skinShapes}</clipPath></defs>
      <g fill="${SKIN}">${skinShapes}</g>
      <g clip-path="url(#hand-clip)">
        <g fill="none" stroke="#7A2E12" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${deco}</g>
      </g>
      <circle class="name-ring" data-name-ring r="34" fill="none" stroke="#C1121F" stroke-width="2.5" stroke-dasharray="4 4"/>`;

    const nameEl = $('.hidden-name', svg);
    const ring = $('[data-name-ring]', svg);
    function nameCenter() {
      const b = nameEl.getBBox();
      const p = svg.createSVGPoint();
      p.x = b.x + b.width / 2; p.y = b.y + b.height / 2;
      return p.matrixTransform(nameEl.getScreenCTM()).matrixTransform(svg.getScreenCTM().inverse());
    }
    const nc = nameCenter();
    ring.setAttribute('cx', nc.x.toFixed(1));
    ring.setAttribute('cy', nc.y.toFixed(1));

    // Apply the mehandi when the hand scrolls into view.
    let applied = false;
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting || applied) return;
      applied = true;
      svg.classList.add('applied');
      setTimeout(() => {
        $$('.draw', svg).forEach((n) => n.classList.remove('draw'));
        $$('.fill-in', svg).forEach((n) => n.classList.remove('fill-in'));
        const c = nameCenter();
        ring.setAttribute('cx', c.x.toFixed(1));
        ring.setAttribute('cy', c.y.toFixed(1));
        refreshLens();
      }, reduceMotion ? 50 : 2600);
    }, { threshold: 0.3 });
    io.observe(svg);

    // Magnifying lens
    const ZOOM = 2.6;
    let lensSvg = null;
    function refreshLens() {
      lens.innerHTML = '';
      lensSvg = svg.cloneNode(true);
      lensSvg.removeAttribute('data-hand');
      lensSvg.setAttribute('aria-hidden', 'true');
      $$('[id]', lensSvg).forEach((n) => { n.id = 'lens-' + n.id; });
      $$('[clip-path]', lensSvg).forEach((n) => n.setAttribute('clip-path', n.getAttribute('clip-path').replace('url(#', 'url(#lens-')));
      lens.appendChild(lensSvg);
    }
    function moveLens(clientX, clientY) {
      if (!lensSvg) refreshLens();
      const r = stage.getBoundingClientRect();
      const x = clientX - r.left, y = clientY - r.top;
      const R = lens.offsetWidth / 2;
      lens.style.left = `${x}px`;
      lens.style.top = `${y}px`;
      const sr = svg.getBoundingClientRect();
      lensSvg.style.width = `${sr.width * ZOOM}px`;
      lensSvg.style.height = `${sr.height * ZOOM}px`;
      const ox = (clientX - sr.left) * ZOOM, oy = (clientY - sr.top) * ZOOM;
      lensSvg.style.transform = `translate(${R - ox}px, ${R - oy}px)`;
      lens.classList.add('on');
    }

    let misses = 0, found = false;
    function check(clientX, clientY) {
      if (found) return;
      const p = svgPoint(svg, clientX, clientY);
      const c = nameCenter();
      if (Math.hypot(p.x - c.x, p.y - c.y) < 24) {
        found = true;
        nameEl.classList.add('found');
        ring.classList.add('on');
        status.classList.add('found');
        status.textContent = 'You found it! “Keerthi”, hidden in the paisley on the thumb.';
        refreshLens();
        Petals.burst(clientX, clientY, 44);
        Sound.chime();
        return;
      }
      misses++;
      status.textContent = misses < 3 ? pick(['Not there…', 'Only petals and dots here.', 'Keep looking…']) : 'Hard, isn\'t it? Try the hint below.';
    }

    stage.addEventListener('pointermove', (e) => moveLens(e.clientX, e.clientY));
    stage.addEventListener('pointerdown', (e) => {
      moveLens(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') check(e.clientX, e.clientY);
    });
    stage.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') {
        check(e.clientX, e.clientY);
        setTimeout(() => lens.classList.remove('on'), 900);
      }
    });
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') lens.classList.remove('on'); });

    $('[data-action="mehandi-hint"]').addEventListener('click', () => {
      if (found) return;
      status.textContent = 'Hint: look closely at the thumb, inside the mango-shaped paisley.';
      ring.classList.add('on');
      setTimeout(() => { if (!found) ring.classList.remove('on'); }, 2600);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Kolam studio                                                        */
  /* ------------------------------------------------------------------ */
  function initStudio() {
    const canvas = $('[data-kolam-canvas]');
    const ctx = canvas.getContext('2d');
    const tabs = $$('.studio-tabs [data-mode]');
    const panels = { pulli: $('[data-controls="pulli"]'), draw: $('[data-controls="draw"]') };
    let mode = 'pulli', size = 0, dpr = 1, dots = 5, anim = null, current = null;
    let color = '#FFF8EC';
    const strokes = [];

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = r.width;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.width * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw(true);
    }

    function chalk(c, w) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = c === '#FFF8EC' ? 'rgba(255,255,255,.55)' : c;
      ctx.shadowBlur = 3;
    }

    function drawDots(n, pad) {
      const unit = (size - pad * 2) / (2 * n);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFF8EC';
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          ctx.beginPath();
          ctx.arc(pad + (2 * i + 1) * unit, pad + (2 * j + 1) * unit, Math.max(2.4, unit * 0.13), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function newPulli(instant) {
      cancelAnimationFrame(anim);
      current = kolamLoops(dots, mulberry32((Math.random() * 1e9) | 0));
      playPulli(instant);
    }

    function playPulli(instant) {
      cancelAnimationFrame(anim);
      const pad = size * 0.07;
      const unit = (size - pad * 2) / current.N;
      const map = (x, y) => [pad + x * unit, pad + y * unit];
      const lines = current.loops.map((l) => loopPolyline(l, map, 10));
      const total = lines.reduce((s, l) => s + l.length, 0);
      const w = Math.max(2.6, unit * 0.16);
      let drawn = instant || reduceMotion ? total : 0;
      const perFrame = Math.max(3, Math.round(total / (60 * (2.5 + dots * 0.5))));
      function render() {
        ctx.clearRect(0, 0, size, size);
        drawDots(current.n, pad);
        chalk('#FFF8EC', w);
        let left = drawn;
        for (const l of lines) {
          if (left <= 1) break;
          const upto = Math.min(l.length, left);
          ctx.beginPath();
          ctx.moveTo(l[0][0], l[0][1]);
          for (let i = 1; i < upto; i++) ctx.lineTo(l[i][0], l[i][1]);
          ctx.stroke();
          left -= upto;
        }
        if (drawn < total) {
          drawn = Math.min(total, drawn + perFrame);
          anim = requestAnimationFrame(render);
        }
      }
      render();
    }

    function guideDots() {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,248,236,.35)';
      const n = 9, step = size / (n + 1);
      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= n; j++) {
          ctx.beginPath();
          ctx.arc(i * step, j * step, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const mirror8 = (x, y) => [[x, y], [-x, y], [x, -y], [-x, -y], [y, x], [-y, x], [y, -x], [-y, -x]];
    function segment(a, b, c) {
      const h = size / 2;
      chalk(c, Math.max(3, size * 0.008));
      const A = mirror8(a[0] * h, a[1] * h), B = mirror8(b[0] * h, b[1] * h);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        ctx.moveTo(h + A[i][0], h + A[i][1]);
        ctx.lineTo(h + B[i][0], h + B[i][1]);
      }
      ctx.stroke();
    }

    function redraw(instant) {
      ctx.clearRect(0, 0, size, size);
      if (mode === 'pulli') {
        if (current) playPulli(instant);
      } else {
        guideDots();
        strokes.forEach((s) => { for (let i = 1; i < s.pts.length; i++) segment(s.pts[i - 1], s.pts[i], s.c); });
      }
    }

    function setMode(m) {
      mode = m;
      cancelAnimationFrame(anim);
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === m)));
      panels.pulli.hidden = m !== 'pulli';
      panels.draw.hidden = m !== 'draw';
      redraw(true);
    }

    tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $$('[data-dots]').forEach((b) => b.addEventListener('click', () => {
      dots = Number(b.dataset.dots);
      $$('[data-dots]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      newPulli();
    }));
    $('[data-kolam="new"]').addEventListener('click', () => newPulli());
    $$('.swatches button').forEach((b) => b.addEventListener('click', () => {
      color = getComputedStyle(b).getPropertyValue('--c').trim();
      $$('.swatches button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    $('[data-kolam="clear"]').addEventListener('click', () => { strokes.length = 0; redraw(); });
    $('[data-kolam="save"]').addEventListener('click', () => {
      if (mode === 'pulli' && current) playPulli(true);
      const out = document.createElement('canvas');
      out.width = canvas.width; out.height = canvas.height;
      const o = out.getContext('2d');
      o.fillStyle = '#A4442A';
      o.fillRect(0, 0, out.width, out.height);
      o.drawImage(canvas, 0, 0);
      const a = document.createElement('a');
      a.download = 'kolam-for-keerthi-and-sandhya.png';
      a.href = out.toDataURL('image/png');
      a.click();
    });

    // Drawing: normalised coordinates in [-1, 1], mirrored eight ways.
    let drawing = null;
    const norm = (e) => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (mode !== 'draw') return;
      canvas.setPointerCapture(e.pointerId);
      drawing = { c: color, pts: [norm(e)] };
      strokes.push(drawing);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = norm(e);
      const last = drawing.pts[drawing.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.008) return;
      drawing.pts.push(p);
      segment(last, p, drawing.c);
    });
    const end = () => { drawing = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    let started = false;
    new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !started) { started = true; newPulli(); }
    }, { threshold: 0.4 }).observe(canvas);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    resize();
  }

  /* ------------------------------------------------------------------ */
  /* Gallery & lightbox                                                  */
  /* ------------------------------------------------------------------ */
  function initGallery() {
    const items = $$('[data-gallery] .polaroid');
    const lb = $('[data-lightbox]');
    const img = $('img', lb);
    const count = $('.lb-count', lb);
    let index = 0, lastFocus = null;

    items.forEach((fig, i) => {
      fig.style.setProperty('--rot', `${(i % 2 ? 1 : -1) * rand(0.8, 2.6)}deg`);
      const im = $('img', fig);
      im.addEventListener('error', () => fig.classList.add('broken'), { once: true });
      $('button', fig).addEventListener('click', () => open(i));
    });

    function show(i) {
      index = (i + items.length) % items.length;
      const btn = $('button', items[index]);
      img.src = btn.dataset.full;
      img.alt = $('img', btn).alt;
      count.textContent = `${TAMIL_DIGITS[index] || index + 1} · ${index + 1} / ${items.length}`;
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      lb.hidden = false;
      document.body.classList.add('locked');
      $('.lb-close', lb).focus();
    }
    function close() {
      lb.hidden = true;
      document.body.classList.remove('locked');
      img.src = '';
      if (lastFocus) lastFocus.focus();
    }
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', () => show(index - 1));
    $('.lb-next', lb).addEventListener('click', () => show(index + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'Tab') {
        const f = $$('button', lb);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    let sx = null;
    lb.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    lb.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Nandri — thamboolam, share, anniversary reminder                    */
  /* ------------------------------------------------------------------ */
  function initNandri() {
    const tbBtn = $('[data-action="thamboolam"]');
    const tbSvg = $('.tb-svg');
    tbBtn.addEventListener('click', () => {
      const open = tbSvg.classList.toggle('tb-open');
      tbBtn.textContent = open ? 'Nandri for coming! (pack it up)' : 'Take your thamboolam';
      if (open) {
        const c = centerOf(tbSvg);
        Petals.burst(c.x, c.y - 40, 36);
        Sound.chime();
      }
    });

    const shareStatus = $('[data-share-status]');
    $('[data-action="share"]').addEventListener('click', async () => {
      const data = { title: 'Keerthi & Sandhya · Wedding Memories', text: 'Relive Keerthi & Sandhya\'s wedding and reception!', url: location.href.split('#')[0] };
      try {
        if (navigator.share) { await navigator.share(data); return; }
        await navigator.clipboard.writeText(data.url);
        shareStatus.textContent = 'Link copied. Paste it anywhere to share.';
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        shareStatus.textContent = `Share this link: ${data.url}`;
      }
    });

    $('[data-action="ics"]').addEventListener('click', () => {
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Keerthi and Sandhya//Wedding Memories//EN', 'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT', 'UID:keerthi-sandhya-anniversary-20251127', 'DTSTAMP:20251127T020000Z',
        'DTSTART;VALUE=DATE:20261127', 'DTEND;VALUE=DATE:20261128', 'RRULE:FREQ=YEARLY',
        "SUMMARY:Keerthi & Sandhya's Wedding Anniversary",
        'DESCRIPTION:Married on 27 November 2025 at Cantonment Board Marriage Hall\\, Pallavaram\\, Chennai.',
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'keerthi-sandhya-anniversary.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      shareStatus.textContent = 'Calendar reminder downloaded. It repeats every 27 November.';
    });

    $$('[data-optional-link]').forEach((a) => {
      if (a.dataset.href) { a.href = a.dataset.href; a.hidden = false; }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Reveal on scroll & blessings on tap                                 */
  /* ------------------------------------------------------------------ */
  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach((n) => io.observe(n));
  }

  function initBlessingTaps() {
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('a, button, input, canvas, iframe, svg.illus, [role="button"], .hand-stage, .lightbox, .leaf-svg, .nav, .intro')) return;
      Petals.burst(e.clientX, e.clientY, 12);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  function safe(fn) {
    try { fn(); } catch (err) { console.error(err); }
  }

  if (reduceMotion) document.querySelectorAll('svg').forEach((s) => s.pauseAnimations && s.pauseAnimations());
  [initDecor, initIntro, initNav, initReveal, initCounter, initHeroKolam, initFilms, initRituals,
    initTraditions, initFeast, initNalangu, initMehandi, initStudio, initGallery, initNandri, initBlessingTaps].forEach(safe);
})();
