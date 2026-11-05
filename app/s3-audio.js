/* 3Shamrocks Studio audio engine. One Web Audio context, created only after the user's first tap.
   Original music and SFX, rendered offline by the studio. Nothing plays before a user gesture,
   music is off by default, and everything pauses while the tab is hidden. */
(function (W) {
  'use strict';
  var D = W.document;
  function ls(k, v) { try { if (v === undefined) { var r = W.localStorage.getItem(k); return r === null ? null : r === '1'; } W.localStorage.setItem(k, v ? '1' : '0'); } catch (e) { return null; } }
  var EXT = (function () { try { var a = D.createElement('audio'); return a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a'; } catch (e) { return 'm4a'; } })();

  function create(o) {
    var ctx = null, master = null, mBus = null, sBus = null, gestured = false;
    var sfxOn = o.sfxDefault !== false, musicOn = !!o.musicDefault;
    if (o.store && o.store.sfx) { var s0 = ls(o.store.sfx); if (s0 !== null) sfxOn = s0; }
    var spriteBuf = null, spriteP = null, shift = 0, themeBuf = null, themeP = null, src = null;
    var lastAt = {}, voices = [], queue = [], subs = [];
    var MG = o.musicGain || 0.5, SG = o.sfxGain || 0.7;

    function ensure() {
      if (!gestured) return null;
      try {
        if (!ctx) {
          var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return null;
          ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
          mBus = ctx.createGain(); mBus.gain.value = 0; mBus.connect(master);
          sBus = ctx.createGain(); sBus.gain.value = SG; sBus.connect(master);
          // iOS unlock: a one-sample silent buffer inside the gesture
          var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
        }
        if (ctx.state === 'suspended' && !D.hidden) ctx.resume();
      } catch (e) { return null; }
      return ctx;
    }
    function load(file, fallback) {
      return fetch(o.base + file + '.' + EXT).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); }); })
        .catch(function (e) { if (EXT === 'ogg' && !fallback) { EXT = 'm4a'; return load(file, true); } throw e; });
    }
    function loadSprite() {
      if (spriteP || !ensure() || !o.sprite) return spriteP;
      spriteP = load(o.name + '-sfx').then(function (b) {
        // AAC decoders may keep encoder priming: find the first onset and shift every cue by the difference
        var d = b.getChannelData(0), lim = Math.min(d.length, Math.floor((o.lead + 0.2) * b.sampleRate)), i = 0;
        while (i < lim && Math.abs(d[i]) < 0.002) i++;
        var dt = i / b.sampleRate - o.lead; shift = Math.abs(dt) < 0.1 ? dt : 0;
        spriteBuf = b; var q = queue; queue = []; q.forEach(function (x) { if (performance.now() - x.t < 600) play(x.n); });
        return b;
      }).catch(function () { spriteP = null; });
      return spriteP;
    }
    function gesture() {
      if (gestured) { ensure(); return; }
      gestured = true; ensure();
      if (sfxOn) loadSprite();
      if (musicOn) startMusic();
    }
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(function (ev) { W.addEventListener(ev, gesture, { capture: true, passive: true }); });

    function duck(len) {
      if (!musicOn || !mBus) return;
      var t = ctx.currentTime, g = mBus.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(MG * 0.45, t + 0.04);
      g.setValueAtTime(MG * 0.45, t + len); g.linearRampToValueAtTime(MG, t + len + 0.35);
    }
    function play(n) {
      if (!sfxOn || !o.sprite || !o.sprite[n] || !ensure()) return;
      var now = performance.now();
      if (lastAt[n] && now - lastAt[n] < 150) return;
      if (!spriteBuf) { queue.push({ n: n, t: now }); loadSprite(); return; }
      voices = voices.filter(function (v) { return v.end > ctx.currentTime; });
      if (voices.length >= 2) return;
      lastAt[n] = now;
      var cue = o.sprite[n], s = ctx.createBufferSource(); s.buffer = spriteBuf; s.connect(sBus);
      s.start(0, Math.max(0, cue[0] + shift), cue[1]);
      voices.push({ end: ctx.currentTime + cue[1] }); duck(cue[1]);
      if (o.haptics && o.haptics[n]) vibe(o.haptics[n]);
    }
    function vibe(p) { if (!gestured) return; try { if (W.navigator.vibrate) W.navigator.vibrate(p); } catch (e) { /* unsupported */ } }

    function startMusic() {
      if (!ensure() || !o.loopLen) return;
      if (!themeP) themeP = load(o.name + '-theme').then(function (b) { themeBuf = b; return b; }).catch(function () { themeP = null; });
      themeP && themeP.then(function () {
        if (!musicOn || src || !themeBuf) return;
        src = ctx.createBufferSource(); src.buffer = themeBuf; src.loop = true;
        // file = loop + 1 s repeat; any window of exactly one loop length is seamless, even with codec padding
        src.loopStart = 0.5; src.loopEnd = 0.5 + o.loopLen; src.connect(mBus);
        var t = ctx.currentTime; mBus.gain.cancelScheduledValues(t); mBus.gain.setValueAtTime(0, t); mBus.gain.linearRampToValueAtTime(MG, t + 1.8);
        src.start(t);
      });
    }
    function stopMusic() {
      if (!src || !ctx) return;
      var s = src, t = ctx.currentTime; src = null;
      mBus.gain.cancelScheduledValues(t); mBus.gain.setValueAtTime(mBus.gain.value, t); mBus.gain.linearRampToValueAtTime(0, t + 0.6);
      try { s.stop(t + 0.65); } catch (e) { /* already stopped */ }
    }
    D.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      try { if (D.hidden) ctx.suspend(); else if (sfxOn || musicOn) ctx.resume(); } catch (e) { /* ignore */ }
    });
    function emit() { subs.forEach(function (f) { try { f(api); } catch (e) { /* ignore */ } }); }
    var api = {
      play: play, vibe: vibe,
      sfx: function () { return sfxOn; }, music: function () { return musicOn; },
      setSfx: function (on) { sfxOn = !!on; if (o.store && o.store.sfx) ls(o.store.sfx, sfxOn); if (sfxOn && gestured) loadSprite(); emit(); },
      setMusic: function (on) { musicOn = !!on; if (o.store && o.store.music) ls(o.store.music, musicOn); if (musicOn) startMusic(); else stopMusic(); emit(); },
      on: function (f) { subs.push(f); },
      state: function () { return ctx ? ctx.state : 'none'; }
    };
    return api;
  }

  /* Floating, branded sound control for web pages: SFX on/off and, if the page has a theme, play/pause. */
  var ICON = {
    on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5V6l10-2v11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor"/></svg>'
  };
  function mount(a, opt) {
    opt = opt || {};
    var st = D.createElement('style');
    st.textContent = '.s3snd{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:80;display:flex;gap:6px;padding:5px;border-radius:999px;background:var(--s3a-bg,#14072E);color:var(--s3a-fg,#fff);box-shadow:0 6px 20px rgba(0,0,0,.28);font:700 13px/1 var(--s3a-font,system-ui,sans-serif)}' +
      '.s3snd button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;height:36px;min-width:36px;padding:0 12px;border-radius:999px;box-sizing:border-box;justify-content:center;color:inherit}' +
      '.s3snd button:hover{background:rgba(255,255,255,.1)}.s3snd button:focus-visible{outline:2px solid var(--s3a-accent,#F5B92E);outline-offset:2px}' +
      '.s3snd button[aria-pressed="true"].mu{background:var(--s3a-accent,#F5B92E);color:var(--s3a-bg,#14072E)}' +
      '.s3snd svg{width:20px;height:20px}.s3snd .sf{padding:0;width:36px}.s3snd .eq{display:none;gap:2px;align-items:flex-end;height:12px}' +
      '.s3snd .mu[aria-pressed="true"] .eq{display:inline-flex}.s3snd .eq i{width:3px;background:currentColor;border-radius:1px;animation:s3eq 1s ease-in-out infinite}' +
      '.s3snd .eq i:nth-child(2){animation-delay:-.4s}.s3snd .eq i:nth-child(3){animation-delay:-.7s}' +
      '@keyframes s3eq{0%,100%{height:3px}50%{height:12px}}@media (prefers-reduced-motion:reduce){.s3snd .eq i{animation:none;height:8px}}';
    D.head.appendChild(st);
    var box = D.createElement('div'); box.className = 's3snd'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Sound');
    var mu = null;
    if (opt.music) {
      mu = D.createElement('button'); mu.type = 'button'; mu.className = 'mu';
      mu.addEventListener('click', function () { a.setMusic(!a.music()); });
      box.appendChild(mu);
    }
    var sf = D.createElement('button'); sf.type = 'button'; sf.className = 'sf';
    sf.addEventListener('click', function () { a.setSfx(!a.sfx()); });
    box.appendChild(sf);
    function draw() {
      sf.innerHTML = a.sfx() ? ICON.on : ICON.off;
      sf.setAttribute('aria-pressed', a.sfx() ? 'true' : 'false');
      sf.setAttribute('aria-label', a.sfx() ? 'Sound effects on' : 'Sound effects off'); sf.title = sf.getAttribute('aria-label');
      if (mu) {
        var on = a.music();
        mu.innerHTML = ICON.note + '<span>' + (on ? 'Pause theme' : (opt.label || 'Play theme')) + '</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';
        mu.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
    a.on(draw); draw();
    (D.body || D.documentElement).appendChild(box);
    return box;
  }
  W.S3Audio = { create: create, mount: mount };
})(window);
