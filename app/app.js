/* Chore Wars - staging build. Each player on their own phone, synced through Supabase.
   Every game rule is enforced server-side (cw_* Postgres functions); this file only draws and calls them. */
(function () {
  'use strict';
  var CFG = window.CW_CONFIG;
  var ic = CWIcons.icon, av = CWIcons.avatar;
  var AV_NAMES = Object.keys(CWIcons.AVATARS);
  var CHORE_ICONS = ['dishes', 'trash', 'bed', 'laundry', 'vacuum', 'pet', 'plant', 'toilet', 'broom', 'book', 'car', 'spark'];
  var BADGES = ['bolt', 'star', 'gem', 'rocket', 'flame', 'ghost'];
  var RANKS = [{ n: 'Rookie', at: 0, ic: 'rank1' }, { n: 'Brawler', at: 100, ic: 'rank2' }, { n: 'Hero', at: 300, ic: 'rank3' }, { n: 'Legend', at: 700, ic: 'rank4' }];
  var ERR = {
    not_open: 'Too slow! Already taken', hands_full: 'Max 3 chores at once', no_card: 'No card left', cant_steal: "Can't steal that",
    not_yours: 'Not your chore', already_on: 'Already on', bad_code: 'Code not found', seat_taken: 'Seat taken', bad_pin: 'Wrong PIN',
    house_full: 'Family is full (8)', not_enough: 'Not enough points', trade_stale: 'Trade expired', ads_maxed: 'Back tomorrow',
    bounty_max: 'Bounty maxed', need_name: 'Add a name', photo_too_big: 'Photo too big', not_allowed: 'Signed out', no_trade: 'Trade gone',
    no_chal: 'Challenge gone', bad_target: 'Pick a rival', players_only: 'Players only', parent_only: 'Parent only',
    locked: 'Too many tries. Wait 15 min', busy: 'Too many tries. Wait 5 min', too_many: 'Too many waiting. Try later', no_req: 'Request gone',
    update_app: 'Reload the app', demo: 'Demo only. Start a family!'
  };
  /* rarity by total points: drives tile size, colour and glow */
  function rarity(c) { var v = c.pts + c.bounty; return c.bounty ? 'bounty' : v >= 30 ? 'legend' : v >= 20 ? 'epic' : v >= 10 ? 'rare' : 'common'; }
  var RAR_LBL = { bounty: 'Bounty', legend: 'Legend', epic: 'Epic', rare: 'Rare', common: 'Common' };

  var sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false } });
  var S = { sess: load('cw_session'), pend: load('cw_pending'), d: null, tab: null, busy: false, sound: load('cw_sound') !== false, seenFeed: 0, joinCode: null, draft: {}, demo: false, anim: null };
  /* per-device token: rate limits count against it (and the IP) on the server */
  var DEV = load('cw_dev');
  if (!DEV) { DEV = Array.prototype.map.call((window.crypto || {}).getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : [Date.now()], function (b) { return ('0' + b.toString(16)).slice(-2); }).join('') + 'cwdevice'; save('cw_dev', DEV); }
  var app = document.getElementById('app');
  var chan = null, pollT = null;

  /* ---------- utils ---------- */
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel) { return app.querySelector(sel); }
  function player(id) { return S.d && S.d.players.find(function (p) { return p.id === id; }); }
  function chore(id) { return S.d && S.d.chores.find(function (c) { return c.id === id; }); }
  function me() { return player(S.d.me); }
  function isParent() { return me() && me().role === 'parent'; }
  function rankOf(xp) { var r = RANKS[0]; RANKS.forEach(function (k) { if (xp >= k.at) r = k; }); return r; }
  function nextRank(xp) { return RANKS.find(function (k) { return k.at > xp; }); }
  function ago(t) { var s = (Date.now() - new Date(t).getTime()) / 1000; if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; }
  function pts(n, size) { return '<span class="num" style="display:inline-flex;align-items:center;gap:1px">' + ic('pts', size || 22) + n + '</span>'; }

  /* ---------- sound + haptics ----------
     Original studio score and SFX (audio/, rendered offline). One AudioContext, created only after the first tap.
     Sound only on the moments that matter; music is off until the player turns it on. Haptics only on wins, rank-up and errors. */
  S.music = load('cw_music') === true;
  var AUD = window.S3Audio ? S3Audio.create({
    base: 'audio/', name: 'cr', lead: 0.1, loopLen: 72, musicGain: 0.5, sfxGain: 0.7, sfxDefault: S.sound, musicDefault: S.music,
    sprite: {'click': [0.1, 0.0468], 'reward': [0.3968, 0.4479], 'approve': [1.0947, 0.4165], 'win': [1.7613, 0.7461], 'rankup': [2.7574, 0.9473], 'crown': [3.9547, 2.0959], 'duel_win': [6.3006, 0.4968], 'duel_lose': [7.0474, 0.5461], 'error': [7.8436, 0.2374]},
    haptics: { win: [30, 30, 30, 30, 80], rankup: [40, 40, 90], crown: [30, 30, 30, 30, 80, 40, 120], duel_win: [30, 30, 60], error: [50] }
  }) : null;
  function fx(kind) { if (AUD) AUD.play(kind); }
  function setSound(on) { S.sound = on; save('cw_sound', on); if (AUD) { AUD.setSfx(on); if (on) AUD.play('click'); } }
  function setMusic(on) { S.music = on; save('cw_music', on); if (AUD) AUD.setMusic(on); }

  /* ---------- toasts + effects ---------- */
  var toastsEl = document.createElement('div'); toastsEl.className = 'toasts'; toastsEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastsEl);
  function toast(html, kind) {
    var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.innerHTML = html; toastsEl.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function burst(n) {
    var el = document.createElement('div'); el.className = 'fx';
    var h = '<div class="gain">+' + n + ic('pts', 72) + '</div>';
    var cols = ['#FFD12E', '#22D3EE', '#FF3B7F', '#fff'];
    for (var i = 0; i < 22; i++) {
      var a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 160;
      h += '<i class="confetti" style="background:' + cols[i % 4] + ';--x:' + Math.cos(a) * d + 'px;--y:' + Math.sin(a) * d + 'px;--r:' + (Math.random() * 720) + 'deg"></i>';
    }
    el.innerHTML = h; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1500);
  }
  /* small points burst rising from a chore tile */
  function tileBurst(id, n) {
    var t = app.querySelector('[data-chore="' + id + '"]'); if (!t) return;
    var r = t.getBoundingClientRect(), el = document.createElement('div');
    el.className = 'pburst'; el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top + r.height / 2) + 'px';
    var h = '<b>+' + n + '</b>';
    for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2; h += '<i style="--x:' + Math.cos(a) * 70 + 'px;--y:' + Math.sin(a) * 70 + 'px"></i>'; }
    el.innerHTML = h; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1100);
  }
  /* weekly crown ceremony: full screen, once per new champion */
  function ceremony(p, sub) {
    if (!p || document.querySelector('.crowning')) return;
    var el = document.createElement('div'); el.className = 'crowning'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Champion of the week');
    var h = '<div class="rays"></div><div class="stage"><div class="cr">' + ic('crown', 150) + '</div><div class="who">' + av(p.avatar, 150) + '</div>' +
      '<div class="ttl">Champion!</div><div class="nm">' + esc(p.name) + '</div><div class="sub">' + esc(sub || 'Champion of the week') + '</div>' +
      '<button class="btn big" data-crown="ok">' + ic('crown', 30) + 'All hail</button></div>';
    var cols = ['#FFD12E', '#22D3EE', '#FF3B7F', '#fff'];
    for (var i = 0; i < 36; i++) { var a = Math.random() * Math.PI * 2, d = 160 + Math.random() * 220; h += '<i class="confetti" style="animation-delay:1.1s;background:' + cols[i % 4] + ';--x:' + Math.cos(a) * d + 'px;--y:' + Math.sin(a) * d + 'px;--r:' + (Math.random() * 720) + 'deg"></i>'; }
    el.innerHTML = h; document.body.appendChild(el);
    setTimeout(function () { fx('crown'); }, 900);
    el.querySelector('[data-crown]').addEventListener('click', function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); });
  }
  function checkCrown(d) {
    if (S.demo || !S.sess) return;
    var f = d.feed.find(function (x) { return x.kind === 'champion'; }); if (!f) return;
    var key = 'cw_crown_' + d.house.id; if ((load(key) || 0) >= f.id) return;
    save(key, f.id); var p = d.players.find(function (x) { return x.id === f.actor; });
    if (p) setTimeout(function () { ceremony(p, 'Won last week'); }, 400);
  }
  /* victory screen when the referee approves my chore: confetti, points, and a rank-up if XP crossed a rank */
  function victory(c, gain, xpOld, xpNew) {
    var old = document.querySelector('.victory'); if (old) old.remove();
    var r0 = rankOf(xpOld || 0), r1 = rankOf(xpNew || 0), up = xpOld != null && r1.n !== r0.n;
    var el = document.createElement('div'); el.className = 'victory'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Chore approved');
    var h = '<div class="rays"></div><div class="stage"><div class="vic-art">' + ic((c && c.icon) || 'check', 120) + '</div><div class="ttl">Approved!</div>' +
      '<div class="vic-gain">+' + gain + ic('pts', 56) + '</div>' +
      (up ? '<div class="rankup"><span class="r0">' + ic(r0.ic, 52) + '</span><span class="arr">' + ic('spark', 30) + '</span><span class="r1">' + ic(r1.ic, 72) + '</span><b>Rank up: ' + r1.n + '</b></div>' : '') +
      '<div class="sub">Tap to keep going</div></div>';
    var cols = ['#FFD12E', '#22D3EE', '#FF3B7F', '#fff'];
    for (var i = 0; i < 40; i++) { var a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 230; h += '<i class="confetti" style="animation-delay:.25s;background:' + cols[i % 4] + ';--x:' + Math.cos(a) * d + 'px;--y:' + Math.sin(a) * d + 'px;--r:' + (Math.random() * 720) + 'deg"></i>'; }
    el.innerHTML = h; document.body.appendChild(el); fx('win'); if (up) setTimeout(function () { fx('rankup'); }, 900);
    var close = function () { if (!el.parentNode) return; el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); };
    el.addEventListener('click', close); setTimeout(close, up ? 4200 : 3000);
  }
  function flash() { var el = document.createElement('div'); el.className = 'fx'; el.innerHTML = '<div class="flash"></div>'; document.body.appendChild(el); app.classList.add('shake'); setTimeout(function () { el.remove(); app.classList.remove('shake'); }, 650); }

  /* ---------- server ---------- */
  function rpc(fn, args) {
    return sb.rpc(fn, args).then(function (r) {
      if (r.error) { var code = (r.error.message || '').trim(); throw new Error(code); }
      return r.data;
    });
  }
  /* entry functions return {err} instead of raising, so the server can keep count of failed tries */
  function rpcj(fn, args) { return rpc(fn, args).then(function (d) { if (d && d.err) throw new Error(d.err); return d; }); }
  function fail(e) {
    var m = e && e.message; fx('error'); toast(ic('cross', 28) + esc(ERR[m] || 'Try again'), 'bad');
    if (m === 'not_allowed') { save('cw_session', null); S.sess = null; S.d = null; render(); }
  }
  function act(action, args) {
    if (S.demo) return demoAct(action, args || {});
    if (S.busy) return Promise.resolve();
    S.busy = true;
    return rpc('cw_act', { p_player: S.sess.player, p_secret: S.sess.secret, p_action: action, p_args: args || {} })
      .then(function (d) { S.busy = false; var got = d.got, err = d.err; apply(d); ping(); if (err) fail({ message: err }); return got; })
      .catch(function (e) { S.busy = false; fail(e); throw e; });
  }
  function refresh() {
    if (S.demo) return Promise.resolve();
    if (!S.sess) return S.pend ? pollJoin() : Promise.resolve();
    return rpcj('cw_state', { p_player: S.sess.player, p_secret: S.sess.secret }).then(apply).catch(function (e) { if (e.message === 'not_allowed') { clearInterval(pollT); if (chan) { sb.removeChannel(chan); chan = null; } fail(e); } });
  }
  function ping() { if (chan) chan.send({ type: 'broadcast', event: 'rev', payload: {} }); }
  function connect() {
    var hh = S.sess ? S.sess.household : S.pend ? S.pend.household : null;
    if (chan || !hh || S.demo) return;
    chan = sb.channel('cw-' + hh, { config: { broadcast: { self: false } } });
    chan.on('broadcast', { event: 'rev' }, function () { refresh(); }).subscribe(function (st) { document.documentElement.dataset.sync = st; });
    clearInterval(pollT); pollT = setInterval(function () { if (!document.hidden) refresh(); }, 9000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });

  /* reactions to what other players did, read from the shared feed */
  function react(oldD, d) {
    if (!oldD) { S.seenFeed = d.feed.length ? d.feed[0].id : 0; return; }
    var fresh = d.feed.filter(function (f) { return f.id > S.seenFeed; }).reverse();
    if (d.feed.length) S.seenFeed = Math.max(S.seenFeed, d.feed[0].id);
    fresh.forEach(function (f) {
      if (f.actor === d.me && ['claim', 'done', 'card'].indexOf(f.kind) >= 0) return;
      var a = d.players.find(function (p) { return p.id === f.actor; }) || {};
      var c = f.info && f.info.chore ? (d.chores.find(function (x) { return x.id === f.info.chore; }) || {}) : {};
      if (f.kind === 'steal' && f.target === d.me) { flash(); toast(av(a.avatar, 32) + esc(a.name) + ' stole ' + esc(c.title || 'a chore'), 'bad'); }
      else if (f.kind === 'blocked' && f.actor === d.me) { toast(ic('shield', 28) + 'Shield blocked a steal!', 'good'); }
      else if (f.kind === 'approved' && f.actor === d.me) { victory(c, f.info.gain || 0, (oldD.players.find(function (p) { return p.id === d.me; }) || {}).xp, (d.players.find(function (p) { return p.id === d.me; }) || {}).xp); if (f.info.card) setTimeout(function () { toast(ic(f.info.card, 28) + 'New card!', 'good'); }, 1800); }
      else if (f.kind === 'rejected' && f.actor === d.me) { toast(ic('cross', 28) + esc(c.title || 'Chore') + ': redo it', 'bad'); }
      else if (f.kind === 'offer' && f.target === d.me) { toast(ic('swap', 28) + esc(a.name) + ' wants a swap'); }
      else if (f.kind === 'counter' && f.target === d.me) { toast(ic('swap', 28) + esc(a.name) + ' countered'); }
      else if (f.kind === 'trade_ok' && f.target === d.me) { toast(ic('check', 28) + esc(a.name) + ' took the swap', 'good'); }
      else if (f.kind === 'chal' && f.target === d.me) { toast(ic('vs', 28) + esc(a.name) + ' challenged you!'); }
      else if (f.kind === 'chal_win' && (f.actor === d.me || f.target === d.me)) { fx(f.actor === d.me ? 'duel_win' : 'duel_lose'); }
      else if (f.kind === 'done' && d.players.find(function (p) { return p.id === d.me && p.role === 'parent'; })) { toast(ic('camera', 28) + esc(a.name) + ': check it'); }
      else if (f.kind === 'bounty') { toast(ic('bounty', 28) + 'Bounty on ' + esc(c.title || 'a chore')); }
      else if (f.kind === 'champion') { toast(ic('crown', 28) + esc(a.name) + ' is champion!', 'good'); }
    });
    var oldReq = (oldD.requests || []).map(function (r) { return r.id; });
    (d.requests || []).forEach(function (r) { if (oldReq.indexOf(r.id) < 0) { toast(av(r.avatar, 32) + esc(r.name) + ' wants in'); } });
  }
  function apply(d) {
    var old = S.d; S.d = d;
    if (!S.tab) S.tab = isParent() ? (d.requests && d.requests.length ? 'invite' : 'arena') : 'chores';
    react(old, d); render(); checkCrown(d);
  }

  /* ---------- session ---------- */
  function startSession(r) {
    S.sess = { player: r.player, secret: r.secret, household: r.household, code: r.code };
    save('cw_session', S.sess); save('cw_pending', null); S.pend = null; S.d = null; S.tab = null;
    if (chan) { sb.removeChannel(chan); chan = null; }
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    connect(); return refresh();
  }

  /* ---------- views ---------- */
  function avb(p, size) { return '<span class="avb">' + av(p.avatar, size) + (p.role === 'player' || p.badge ? '<span class="bdg">' + ic(p.badge || 'bolt', Math.round(size * 0.42)) + '</span>' : '') + '</span>'; }
  function sndBtn() { return '<button class="chip snd" data-act="sound" aria-label="' + (S.sound ? 'Sound on' : 'Sound off') + '">' + ic(S.sound ? 'sound' : 'mute', 24) + '</button>'; }
  function topBar() {
    var m = me(), r = rankOf(m.xp), nx = nextRank(m.xp);
    var pct = nx ? Math.round((m.xp - r.at) / (nx.at - r.at) * 100) : 100;
    var right = m.role === 'parent'
      ? '<span class="chip">' + ic('check', 24) + S.d.chores.filter(function (c) { return c.status === 'done'; }).length + '</span>'
      : '<span class="chip streak' + (m.streak > 0 ? ' hot' : '') + '" title="Streak">' + ic('flame', 24) + m.streak + '</span><span class="chip" title="Cards">' + ic('cards', 24) + cardCount(m) + '</span>';
    var flame = m.role === 'player' && m.streak > 0 ? '<span class="avflame" title="' + m.streak + '-day streak">' + ic('flame', 26) + '<b>' + m.streak + '</b></span>' : '';
    return '<header class="top"><button class="me" data-act="profile" aria-label="Profile"><span class="mewrap">' + avb(m, 52) + flame + '</span>' +
      '<div style="min-width:0"><div class="me-name">' + esc(m.name) + '</div>' +
      (m.role === 'parent' ? '<div style="color:#fff;opacity:.8;font-size:13px">Referee</div>' :
        '<div class="tier">' + ic(r.ic, 22) + '<span>' + r.n + '</span><div class="xpbar"><i style="width:' + pct + '%"></i></div></div>') +
      '</div></button>' + right + sndBtn() + '</header>';
  }
  function cardCount(m) { var c = m.cards || {}; return (c.steal || 0) + (c.shield || 0) + (c.double || 0); }

  function arena() {
    var d = S.d, ps = d.players.filter(function (p) { return p.role === 'player'; }).slice().sort(function (a, b) { return b.pts - a.pts || b.xp - a.xp; });
    var champ = d.house.champion || (ps[0] && ps[0].pts > 0 ? ps[0].id : null);
    var h = isParent() ? reqBlock() : '';
    h += '<div class="h">' + ic('trophy', 30) + 'This week</div><div class="panel board">';
    if (!ps.length) h += '<div class="empty">' + ic('qr', 56) + 'Invite your players</div>';
    ps.forEach(function (p, i) {
      var rk = rankOf(p.xp);
      h += '<div class="row ' + (p.id === d.me ? 'mine ' : '') + (i === 0 && p.pts > 0 ? 'first' : '') + '"' + (p.id === champ ? ' data-act="crown_replay" data-id="' + p.id + '" role="button"' : '') + '><span class="pos">' + (i + 1) + '</span>' +
        '<span class="avwrap">' + (p.id === champ ? '<span class="crown drop">' + ic('crown', 34) + '</span>' : '') + avb(p, 50) + '</span>' +
        '<span class="nm">' + esc(p.name) + '<span class="sub">' + ic(rk.ic, 18) + rk.n + (p.streak > 0 ? '<span class="fl">' + ic('flame', 18) + p.streak + '</span>' : '') + '</span></span>' +
        '<span class="score">' + ic('pts', 26) + p.pts + '</span></div>';
    });
    h += '</div>';
    h += vsBlock();
    var feed = d.feed.slice(0, 6);
    if (feed.length) {
      h += '<div class="h">' + ic('spark', 26) + 'Live</div><div class="panel feed">';
      feed.forEach(function (f) { var line = feedLine(f); if (line) h += '<div class="fi">' + line + '<span class="ago">' + ago(f.created_at) + '</span></div>'; });
      h += '</div>';
    }
    return h;
  }
  function feedLine(f) {
    var a = player(f.actor) || {}, t = player(f.target) || {}, c = (f.info && chore(f.info.chore)) || {};
    var n = '<b>' + esc(a.name || '?') + '</b>';
    switch (f.kind) {
      case 'claim': return ic(c.icon || 'spark', 26) + n + ' grabbed ' + esc(c.title || '');
      case 'steal': return ic('steal', 26) + n + ' stole from ' + esc(t.name || '');
      case 'blocked': return ic('shield', 26) + n + ' blocked ' + esc(t.name || '');
      case 'done': return ic('camera', 26) + n + ' finished ' + esc(c.title || '');
      case 'approved': return ic('pts', 26) + n + ' +' + (f.info.gain || 0);
      case 'rejected': return ic('cross', 26) + n + ': redo';
      case 'bounty': return ic('bounty', 26) + 'Bounty: ' + esc(c.title || '');
      case 'offer': case 'counter': return ic('swap', 26) + n + ' offered ' + esc(t.name || '');
      case 'trade_ok': return ic('swap', 26) + n + ' swapped with ' + esc(t.name || '');
      case 'chal': return ic('vs', 26) + n + ' vs ' + esc(t.name || '');
      case 'chal_on': return ic('vs', 26) + 'Duel on: ' + esc(a.name || '') + ' vs ' + esc(t.name || '');
      case 'chal_win': return ic('trophy', 26) + n + ' won the duel';
      case 'champion': return ic('crown', 26) + n + ' is champion';
      case 'join': return av(a.avatar || 'fox', 26) + n + ' joined';
      case 'card': return ic(f.info.card || 'cards', 26) + n + ' got a card';
      default: return '';
    }
  }
  function vsBlock() {
    var d = S.d, m = me(), h = '';
    var mine = d.challenges.filter(function (c) { return c.week === d.house.week && (c.a === d.me || c.b === d.me) && (c.status === 'on' || c.status === 'pending'); });
    var others = isParent() ? d.challenges.filter(function (c) { return c.week === d.house.week && c.status === 'on'; }) : [];
    var list = isParent() ? others : mine;
    h += '<div class="h">' + ic('vs', 28) + 'Duels</div>';
    list.forEach(function (c) {
      var A = player(c.a) || {}, B = player(c.b) || {};
      var sa = c.status === 'on' ? A.pts - c.as : 0, sbb = c.status === 'on' ? B.pts - c.bs : 0;
      h += '<div class="panel vs"><div class="side">' + av(A.avatar, 60) + '<div class="lbl">' + esc(A.name) + '</div><div class="num">' + Math.max(0, sa) + '</div></div>' +
        '<div class="mid">VS</div><div class="side r">' + av(B.avatar, 60) + '<div class="lbl">' + esc(B.name) + '</div><div class="num">' + Math.max(0, sbb) + '</div></div></div>';
      if (c.status === 'pending' && c.b === d.me) h += '<div class="vs-actions"><button class="btn" data-act="chal_yes" data-id="' + c.id + '">' + ic('vs', 24) + 'Fight</button><button class="btn white" data-act="chal_no" data-id="' + c.id + '">Nope</button></div>';
      else if (c.status === 'pending') h += '<div class="wait" style="color:#fff">' + ic('lock', 22) + 'Waiting for ' + esc(B.name) + '</div>';
    });
    if (!isParent() && m.role === 'player') {
      var rivals = d.players.filter(function (p) { return p.role === 'player' && p.id !== d.me; });
      if (rivals.length) h += '<button class="btn pink big" data-act="challenge_pick" style="margin-top:10px">' + ic('vs', 30) + 'Challenge</button>';
      else h += '<div class="panel empty">' + ic('vs', 48) + 'Rivals unlock at 2 players</div>';
    } else if (!list.length) h += '<div class="panel empty">' + ic('vs', 48) + 'No duels yet</div>';
    return h;
  }

  function choreTile(c) {
    var d = S.d, m = me(), o = player(c.owner), mine = c.owner === d.me, rar = rarity(c);
    var cls = c.status === 'approved' ? 'over' : mine ? 'mine' : (o ? 'theirs' : 'open');
    var wide = c.status !== 'approved' && (rar === 'bounty' || rar === 'legend');
    var anim = S.anim && S.anim.id === c.id ? ' ' + S.anim.kind : '';
    var h = '<div class="tile r-' + rar + ' ' + cls + (wide ? ' wide' : '') + anim + '" data-chore="' + c.id + '">';
    if (c.status !== 'approved') h += '<span class="rar">' + RAR_LBL[rar] + '</span>';
    if (o) h += '<span class="owner">' + av(o.avatar, 42) + '</span>';
    if (c.bounty) h += '<span class="bty">' + ic('bounty', 22) + '+' + c.bounty + '</span>';
    h += '<span class="art">' + ic(c.icon, wide ? 84 : 64) + '</span><div class="tt">' + esc(c.title) + '</div><div class="val">' + ic('pts', wide ? 32 : 26) + (c.pts + c.bounty) + '</div><div class="act">';
    if (isParent()) {
      if (c.status === 'done') h += '<button class="btn sm" data-act="tab" data-id="verify">' + ic('check', 22) + 'Check</button>';
      else if (c.status === 'approved') h += '<div class="wait">' + ic('check', 22) + 'Done</div>';
      else h += '<button class="btn pink sm" data-act="bounty" data-id="' + c.id + '"' + (c.bounty >= 30 ? ' disabled' : '') + '>' + ic('bounty', 22) + '+10</button>';
    } else if (c.status === 'open') h += '<button class="btn grab" data-act="claim" data-id="' + c.id + '">Grab</button>';
    else if (c.status === 'approved') h += '<div class="wait">' + ic('check', 22) + 'Done</div>';
    else if (c.status === 'done') h += '<div class="wait">' + ic('lock', 22) + 'Checking</div>';
    else if (mine) h += '<button class="btn cyan" data-act="done_sheet" data-id="' + c.id + '">' + ic('camera', 24) + 'Done</button>';
    else {
      var myClaimed = d.chores.some(function (x) { return x.owner === d.me && x.status === 'claimed'; });
      h += '<div class="two"><button class="btn pink sm" data-act="steal" data-id="' + c.id + '"' + ((m.cards || {}).steal ? '' : ' disabled') + ' aria-label="Steal">' + ic('steal', 24) + '</button>' +
        '<button class="btn white sm" data-act="swap_sheet" data-id="' + c.id + '"' + (myClaimed ? '' : ' disabled') + ' aria-label="Swap">' + ic('swap', 24) + '</button></div>';
    }
    return h + '</div></div>';
  }
  /* who to beat: the player just above me this week, or the one right behind me if I lead */
  function rivalCall() {
    var d = S.d, ps = d.players.filter(function (p) { return p.role === 'player'; }).sort(function (a, b) { return b.pts - a.pts || b.xp - a.xp; });
    var i = ps.findIndex(function (p) { return p.id === d.me; }); if (i < 0 || ps.length < 2) return '';
    var m = ps[i], o, txt, cls;
    if (i > 0) { o = ps[i - 1]; var gap = o.pts - m.pts; txt = gap > 0 ? esc(o.name) + ' is ' + gap + ' pts ahead!' : 'Tied with ' + esc(o.name) + '!'; cls = gap > 0 ? 'behind' : 'tied'; }
    else { o = ps[1]; var lead = m.pts - o.pts; txt = lead > 0 ? 'You lead ' + esc(o.name) + ' by ' + lead + '!' : 'Tied with ' + esc(o.name) + '!'; cls = lead > 0 ? 'ahead' : 'tied'; }
    return '<div class="rival ' + cls + '">' + avb(o, 40) + '<span class="rt">' + txt + '</span>' + ic(cls === 'ahead' ? 'crown' : 'trophy', 30) + '</div>';
  }
  // a normal tile with no partner on its row (last one, or one just before a wide tile) is centred on its own row
  function soloTiles(list) {
    var wide = function (c) { var r = rarity(c); return c.status !== 'approved' && (r === 'bounty' || r === 'legend'); };
    var col = 0;
    return list.map(function (c, i) {
      var t = choreTile(c);
      if (wide(c)) col = 0;
      else if (col === 0 && (i === list.length - 1 || wide(list[i + 1]))) t = t.replace('class="tile ', 'class="tile solo ');
      else col = 1 - col;
      return t;
    }).join('');
  }
  function chores() {
    var d = S.d, order = { open: 1, claimed: 2, done: 3, approved: 4 };
    var list = d.chores.slice().sort(function (a, b) {
      var am = a.status === 'approved' ? 2 : a.owner === d.me ? 0 : 1, bm = b.status === 'approved' ? 2 : b.owner === d.me ? 0 : 1;
      return (am - bm) || (order[a.status] - order[b.status]) || (b.bounty - a.bounty) || ((b.pts + b.bounty) - (a.pts + a.bounty));
    });
    var open = d.chores.filter(function (c) { return c.status === 'open'; }).length;
    var h = (isParent() ? '' : rivalCall()) + '<div class="h">' + ic('broom', 30) + 'Chores' + (!isParent() && open ? '<span class="hint">' + open + ' up for grabs</span>' : '') + '</div><div class="grid">' + soloTiles(list) + '</div>';
    if (isParent()) h += '<button class="btn big" data-act="add_sheet" style="margin-top:20px">' + ic('plus', 30) + 'Add chore</button>';
    return h;
  }

  function trades() {
    var d = S.d, h = '<div class="h">' + ic('swap', 30) + 'Swaps</div>';
    var inc = d.trades.filter(function (t) { return t.status === 'open' && t.to === d.me; });
    var out = d.trades.filter(function (t) { return t.status === 'open' && t.from === d.me; });
    if (!inc.length && !out.length) h += '<div class="panel empty">' + ic('swap', 56) + 'No swaps yet<button class="btn" data-act="tab" data-id="chores">' + ic('broom', 24) + 'Find one</button></div>';
    inc.forEach(function (t) { h += tradeCard(t, true); });
    out.forEach(function (t) { h += tradeCard(t, false); });
    return h;
  }
  function tradeCard(t, incoming) {
    var F = player(t.from) || {}, give = chore(t.give) || {}, take = chore(t.take) || {}, payer = player(t.payer) || {};
    var youGet = incoming ? give : take, youGive = incoming ? take : give;
    var h = '<div class="panel"><div class="who">' + av(F.avatar, 36) + (incoming ? esc(F.name) + ' offers' : 'You offered') +
      (t.sweet ? ' <span class="sweet">' + ic('pts', 20) + '+' + t.sweet + '</span><small>' + (payer.id === S.d.me ? 'you pay' : 'from ' + esc(payer.name)) + '</small>' : '') + '</div>' +
      '<div class="trade"><div class="side">' + ic(youGet.icon, 56) + '<b>' + esc(youGet.title) + '</b><small>You get</small></div>' + ic('swap', 40) +
      '<div class="side">' + ic(youGive.icon, 56) + '<b>' + esc(youGive.title) + '</b><small>You give</small></div></div>';
    if (incoming) h += '<div class="trade-actions"><button class="btn" data-act="accept" data-id="' + t.id + '">' + ic('check', 24) + 'Deal</button>' +
      '<button class="btn cyan" data-act="counter_sheet" data-id="' + t.id + '">Counter</button><button class="btn white" data-act="decline" data-id="' + t.id + '">' + ic('cross', 24) + '</button></div>';
    else h += '<div class="wait">' + ic('lock', 22) + 'Waiting</div>';
    return h + '</div>';
  }

  function cards() {
    var m = me(), c = m.cards || {}, h = '<div class="h">' + ic('cards', 30) + 'Power cards</div><div class="deck">';
    [['steal', 'Steal', ''], ['shield', 'Shield', m.shield], ['double', '2X', m.double]].forEach(function (k) {
      var n = c[k[0]] || 0;
      h += '<button class="pcard ' + k[0] + (n ? '' : ' zero') + (k[2] ? ' on' : '') + '" data-act="card" data-id="' + k[0] + '" aria-label="' + k[1] + '">' +
        '<span class="cnt">' + n + '</span>' + ic(k[0], 64) + '<span class="nm">' + (k[2] ? 'ON' : k[1]) + '</span></button>';
    });
    h += '</div>';
    var used = m.ads || 0;
    h += '<div class="h">' + ic('ad', 28) + 'Free card</div><div class="panel adslot">' + ic('ad', 56) + '<div class="txt">Watch, win a card<div class="dots">' +
      [0, 1, 2].map(function (i) { return '<i class="' + (i < used ? 'used' : '') + '"></i>'; }).join('') + '</div></div>' +
      '<button class="btn" data-act="ad" ' + (used >= 3 ? 'disabled' : '') + '>Watch</button></div>';
    h += '<div class="h">' + ic('gift', 28) + 'Shop</div><div class="shop">' +
      [['crown', 'Skins'], ['trophy', 'Season pass'], ['cards', 'Card pack']].map(function (s) { return '<div class="item soon" aria-label="' + s[1] + ', coming soon"><span class="lk">' + ic('lock', 22) + '</span>' + ic(s[0], 48) + '<b>' + s[1] + '</b><span class="cs">Coming soon</span></div>'; }).join('') + '</div>';
    return h;
  }

  function verify() {
    var d = S.d, list = d.chores.filter(function (c) { return c.status === 'done'; });
    var h = '<div class="h">' + ic('check', 30) + 'Check it</div>';
    if (!list.length) return h + '<div class="panel empty">' + ic('check', 64) + 'All clear</div>';
    list.forEach(function (c) {
      var o = player(c.owner) || {};
      h += '<div class="panel ver"><div class="vhead">' + av(o.avatar, 44) + '<b>' + esc(o.name) + '</b><span class="vch">' + ic(c.icon, 30) + esc(c.title) + '</span>' + pts(c.pts + c.bounty + (o.double ? ' ×2' : ''), 24) + '</div>' +
        (c.proof ? '<img class="ph" alt="Proof photo: ' + esc(c.title) + '" src="' + esc(c.proof) + '">' : '<div class="ph none">' + ic('camera', 56) + '<span>No photo</span></div>') +
        '<div class="btns"><button class="btn big yes" data-act="approve" data-id="' + c.id + '">' + ic('check', 34) + 'Approve</button><button class="btn big pink no" data-act="reject" data-id="' + c.id + '">' + ic('cross', 34) + 'Redo</button></div></div>';
    });
    return h;
  }
  /* join requests waiting for this parent. A new phone sees nothing until approved here. */
  function reqBlock() {
    var d = S.d, rq = d.requests || [], free = d.players.filter(function (p) { return p.seat && p.role === 'player'; });
    if (!rq.length) return '';
    var h = '<div class="h">' + ic('lock', 28) + 'Wants to join</div>';
    rq.forEach(function (r) {
      h += '<div class="panel req"><div class="who">' + avb(r, 56) + '<div><b>' + esc(r.name) + '</b><small>New phone · ' + ago(r.at) + '</small></div></div>' +
        '<div class="trade-actions"><button class="btn" data-act="req_ok" data-id="' + r.id + '">' + ic('check', 24) + 'Let in</button>' +
        '<button class="btn white" data-act="req_no" data-id="' + r.id + '">' + ic('cross', 24) + 'No</button></div>' +
        (free.length ? '<div class="seatq">Or is this…</div><div class="seatrow">' + free.map(function (p) { return '<button class="seat" data-act="req_seat" data-id="' + r.id + '" data-seat="' + p.id + '">' + av(p.avatar, 40) + esc(p.name) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    });
    return h;
  }
  function invite() {
    var d = S.d, url = location.origin + location.pathname + '?join=' + d.house.code;
    var h = reqBlock() + '<div class="h">' + ic('qr', 30) + 'Invite</div><div class="panel"><div class="qr">' + qrSvg(url) + '</div><div class="bigcode" aria-label="' + esc(d.house.code) + '">' + esc(d.house.code.slice(0, 4)) + '<span class="gap"></span>' + esc(d.house.code.slice(4)) + '</div>' +
      '<div style="text-align:center;opacity:.7;font-size:15px">Scan on their phone. You approve.</div>' +
      '<div style="display:flex;justify-content:center;margin-top:12px"><button class="btn cyan" data-act="share">Share link</button></div></div>';
    h += '<div class="h">' + av('fox', 30) + 'Players</div><div class="panel">';
    d.players.forEach(function (p) {
      h += '<div class="mgr">' + av(p.avatar, 40) + '<span class="t">' + esc(p.name) + (p.role === 'parent' ? ' <small>(ref)</small>' : '') + '</span>' +
        (p.seat ? '<small>open seat</small>' : p.id === d.me ? '<small>you</small>' : '<button class="btn white sm" data-act="free_seat" data-id="' + p.id + '">New phone</button>') + '</div>';
    });
    h += '</div><button class="btn white big" data-act="pin_sheet" style="margin-top:14px">' + ic('lock', 28) + 'Parent PIN</button>';
    return h;
  }
  function qrSvg(text) {
    try { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
    catch (e) { return ''; }
  }

  function nav() {
    var tabs = isParent()
      ? [['arena', 'trophy', 'Arena'], ['verify', 'check', 'Check'], ['chores', 'broom', 'Chores'], ['invite', 'qr', 'Invite']]
      : [['arena', 'trophy', 'Arena'], ['chores', 'broom', 'Chores'], ['trades', 'swap', 'Swaps'], ['cards', 'cards', 'Cards']];
    var d = S.d;
    var badge = {
      verify: d.chores.filter(function (c) { return c.status === 'done'; }).length,
      trades: d.trades.filter(function (t) { return t.status === 'open' && t.to === d.me; }).length,
      arena: d.challenges.filter(function (c) { return c.status === 'pending' && c.b === d.me; }).length,
      invite: (d.requests || []).length
    };
    return '<nav class="tabs"><div class="in">' + tabs.map(function (t) {
      return '<button class="' + (S.tab === t[0] ? 'on' : '') + '" data-act="tab" data-id="' + t[0] + '" aria-label="' + t[2] + '">' + ic(t[1], 34) + t[2] +
        (badge[t[0]] ? '<span class="badge">' + badge[t[0]] + '</span>' : '') + '</button>';
    }).join('') + '</div></nav>';
  }

  /* ---------- entry screens ---------- */
  function onboarding() {
    var slides = [['broom', 'Grab chores. Score points.', 'pts'], ['steal', 'Steal. Swap. Outsmart.', 'swap'], ['crown', 'Win the crown.', 'trophy']];
    return '<div class="onb"><div class="slides" id="slides">' + slides.map(function (s) {
      return '<section class="slide"><div class="art"><div class="halo"></div><div class="float">' + ic(s[0], 170) + '</div><div style="position:absolute;right:6px;bottom:14px">' + ic(s[2], 70) + '</div></div><div class="big">' + s[1] + '</div></section>';
    }).join('') + '</div><div class="foot"><div class="pager" id="pager"><i class="on"></i><i></i><i></i></div>' +
      '<button class="btn big" data-act="onb_next" id="onbNext">Next</button></div></div>';
  }
  function start() {
    return '<div class="hero-logo"><img src="brand/lockup-stacked.svg" alt="Chore Wars"></div><div class="stack" style="margin-top:18px">' +
      '<button class="btn big" data-act="go_join">' + ic('qr', 32) + 'Join with code</button>' +
      '<button class="btn white big" data-act="go_create">' + ic('crown', 32) + 'New family (parent)</button>' +
      '<button class="btn ghost" data-act="go_demo">Try the demo</button></div>';
  }
  function avPicker(sel) { return '<div class="avpick">' + AV_NAMES.map(function (n) { return '<button type="button" class="' + (n === sel ? 'on' : '') + '" data-act="pick_av" data-id="' + n + '" aria-label="' + n + '">' + av(n, 56) + '</button>'; }).join('') + '</div>'; }
  function badgePicker(sel) { return '<div class="field"><span>Your badge</span></div><div class="bdpick">' + BADGES.map(function (n) { return '<button type="button" class="' + (n === sel ? 'on' : '') + '" data-act="pick_bd" data-id="' + n + '" aria-label="' + n + '">' + ic(n, 40) + '</button>'; }).join('') + '</div>'; }
  /* PIN: digits are masked as dots; only the digit just typed shows, briefly */
  function pinField(id, label) {
    return '<label class="field">' + (label ? '<span>' + label + '</span>' : '') + '<div class="pinbox"><input id="' + id + '" class="pin-in" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off" spellcheck="false" aria-label="' + (label || 'Parent PIN') + '">' +
      '<div class="pindots" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div></label>';
  }
  var peekT = null;
  document.addEventListener('input', function (e) {
    var el = e.target; if (!el.classList || !el.classList.contains('pin-in')) return;
    var v = el.value.replace(/\D/g, '').slice(0, 4); if (v !== el.value) el.value = v;
    var dots = el.parentNode.querySelectorAll('.pindots i'), peek = e.inputType && e.inputType.indexOf('insert') === 0 ? v.length - 1 : -1;
    clearTimeout(peekT);
    dots.forEach(function (d, k) { d.className = k < v.length ? (k === peek ? 'on peek' : 'on') : ''; d.textContent = k === peek ? v[k] : ''; });
    if (peek >= 0) peekT = setTimeout(function () { dots.forEach(function (d) { if (d.classList.contains('peek')) { d.classList.remove('peek'); d.textContent = ''; } }); }, 700);
  });
  function keepDraft() { var v = function (q) { var el = document.querySelector(q); return el ? el.value : null; }; ['house', 'name'].forEach(function (k) { var x = v('#f_' + k); if (x !== null) S.draft[k] = x; }); }
  function createForm() {
    var dr = S.draft; dr.av = dr.av || 'owl'; dr.bd = dr.bd || 'crown';
    return '<div class="hero-logo" style="padding-top:20px"><img src="brand/mark.svg" alt="" style="width:110px"></div><div class="panel stack">' +
      '<label class="field"><span>Family name</span><input id="f_house" maxlength="24" placeholder="The Thunder House" value="' + esc(dr.house || '') + '"></label>' +
      '<label class="field"><span>Your name</span><input id="f_name" maxlength="14" placeholder="Captain" value="' + esc(dr.name || '') + '"></label>' +
      avPicker(dr.av) +
      pinField('f_pin', 'Parent PIN (4 digits)') +
      '<button class="btn big" data-act="create">' + ic('crown', 30) + 'Create</button></div><button class="btn ghost" data-act="home">Back</button>';
  }
  function joinForm() {
    var dr = S.draft;
    if (dr.parent) {
      return '<div class="hero-logo" style="padding-top:20px"><img src="brand/mark.svg" alt="" style="width:110px"></div><div class="panel stack">' +
        '<label class="field"><span>Family code</span><input id="f_code" class="code-in" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(S.joinCode || '') + '"></label>' +
        pinField('f_pin', 'Parent PIN') +
        '<button class="btn big" data-act="parent_in">' + ic('lock', 28) + 'Referee in</button></div><button class="btn ghost" data-act="home">Back</button>';
    }
    if (!dr.code) {
      return '<div class="hero-logo" style="padding-top:20px"><img src="brand/mark.svg" alt="" style="width:110px"></div><div class="panel stack">' +
        '<label class="field"><span>Family code</span><input id="f_code" class="code-in" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(S.joinCode || '') + '"></label>' +
        '<button class="btn big" data-act="find">Join</button></div><button class="btn ghost" data-act="parent_mode">I\'m the parent</button><button class="btn ghost" data-act="home">Back</button>';
    }
    dr.av = dr.av || 'fox'; dr.bd = dr.bd || 'bolt';
    return '<div class="h" style="justify-content:center">' + ic('pts', 30) + 'Make your player</div><div class="panel stack">' +
      '<label class="field"><span>Your name</span><input id="f_name" maxlength="14" placeholder="Nickname" value="' + esc(dr.name || '') + '"></label>' + avPicker(dr.av) + badgePicker(dr.bd) +
      '<button class="btn big" data-act="join_new">' + ic('lock', 28) + 'Ask to join</button>' +
      '<div class="fine">A parent lets you in</div></div><button class="btn ghost" data-act="parent_mode">I\'m the parent</button><button class="btn ghost" data-act="home">Back</button>';
  }
  function waiting() {
    var p = S.pend;
    return '<div class="waitroom"><div class="pulse">' + avb({ avatar: p.avatar, badge: p.badge, role: 'player' }, 140) + '</div>' +
      '<div class="big">' + esc(p.name) + '</div><div class="msg">' + ic('lock', 28) + 'Waiting for a parent</div>' +
      '<div class="fine">Ask them to tap "Let in"</div><button class="btn ghost" data-act="cancel_pend">Cancel</button></div>';
  }

  /* ---------- render ---------- */
  function render() {
    var y = window.scrollY;
    if (!S.sess && !S.demo) {
      if (S.pend) { app.innerHTML = waiting(); return; }
      if (!load('cw_onb') && !S.joinCode) { app.innerHTML = onboarding(); bindSlides(); return; }
      app.innerHTML = S.view === 'create' ? createForm() : S.view === 'join' ? joinForm() : start();
      return;
    }
    if (!S.d) { app.innerHTML = '<div class="spin" role="status" aria-label="Loading"></div>'; return; }
    var body = { arena: arena, chores: chores, trades: trades, cards: cards, verify: verify, invite: invite }[S.tab];
    var allowed = isParent() ? ['arena', 'verify', 'chores', 'invite'] : ['arena', 'chores', 'trades', 'cards'];
    if (allowed.indexOf(S.tab) < 0) { S.tab = 'arena'; body = arena; }
    app.innerHTML = (S.demo ? demoBar() : '') + topBar() + '<main>' + body() + '</main>' + nav() + '<div class="stagebar">' + (S.demo ? 'demo' : 'staging') + '</div>';
    window.scrollTo(0, y);
    if (S.anim) { var an = S.anim; S.anim = null; if (an.kind === 'flip') { tileBurst(an.id, an.n); } }
    var g = app.querySelector('.grab'); if (g && S.tab === 'chores') g.classList.add('first');
  }
  function bindSlides() {
    var el = document.getElementById('slides'); if (!el) return;
    el.addEventListener('scroll', function () {
      var i = Math.round(el.scrollLeft / el.clientWidth);
      document.querySelectorAll('#pager i').forEach(function (d, k) { d.classList.toggle('on', k === i); });
      document.getElementById('onbNext').textContent = i >= 2 ? "Let's go" : 'Next';
    }, { passive: true });
  }

  /* ---------- sheets ---------- */
  function sheet(html) {
    closeSheet();
    var s = document.createElement('div'); s.className = 'scrim'; s.id = 'sheet';
    s.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    s.addEventListener('click', function (e) { if (e.target === s) closeSheet(); });
    document.body.appendChild(s); return s;
  }
  function closeSheet() { var s = document.getElementById('sheet'); if (s) s.remove(); }

  function doneSheet(id) {
    var c = chore(id);
    var s = sheet('<div class="ttl">' + esc(c.title) + '</div><div class="stack" style="align-items:center">' + ic(c.icon, 90) +
      '<label class="btn big cyan" style="cursor:pointer">' + ic('camera', 32) + 'Snap proof<input type="file" accept="image/*" capture="environment" id="proofIn" hidden></label>' +
      '<button class="btn ghost" style="color:var(--ink)" data-sheet="noproof">No photo</button></div>');
    s.querySelector('#proofIn').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      shrink(file).then(function (url) { closeSheet(); return act('done', { chore: id, proof: url }); }).then(function () { toast(ic('lock', 28) + 'Sent to the referee', 'good'); }).catch(function (er) { if (er && er.local) fail(er); /* server errors already shown */ });
    });
    s.querySelector('[data-sheet="noproof"]').addEventListener('click', function () { closeSheet(); act('done', { chore: id }).then(function () { toast(ic('lock', 28) + 'Sent to the referee', 'good'); }).catch(function () { /* shown */ }); });
  }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        /* max 720 px, JPEG ~0.7; drop quality if still large so the upload stays small */
        var k = Math.min(1, 720 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
        /* the server refuses anything over 250 KB: step quality down, then size, until it fits */
        var out = '', qs = [0.7, 0.55, 0.4];
        for (var tries = 0; tries < 4; tries++) {
          for (var j = 0; j < qs.length; j++) { out = cv.toDataURL('image/jpeg', qs[j]); if (out.length <= 240000) return res(out); }
          var c2 = document.createElement('canvas'); c2.width = Math.round(cv.width * 0.75); c2.height = Math.round(cv.height * 0.75);
          c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height); cv = c2;
        }
        var er = new Error('photo_too_big'); er.local = true; rej(er);
      };
      img.onerror = rej; img.src = u;
    });
  }
  function swapSheet(takeId) {
    var d = S.d, take = chore(takeId), o = player(take.owner);
    var mine = d.chores.filter(function (c) { return c.owner === d.me && c.status === 'claimed'; });
    var sel = { give: mine[0] && mine[0].id, sweet: 0 };
    var s = sheet('<div class="ttl">Swap with ' + esc(o.name) + '</div><div style="display:flex;justify-content:center;margin-bottom:10px">' + ic(take.icon, 72) + '</div>' +
      '<div class="pick" id="gives">' + mine.map(function (c, i) { return '<button class="' + (i ? '' : 'on') + '" data-g="' + c.id + '">' + ic(c.icon, 44) + esc(c.title) + '</button>'; }).join('') + '</div>' +
      '<div style="text-align:center;margin:14px 0 8px;font-size:15px">Add points?</div><div class="seg" id="sweets">' +
      [0, 5, 10].map(function (n, i) { return '<button class="' + (i ? '' : 'on') + '" data-s="' + n + '"' + (n > me().pts ? ' disabled' : '') + '>' + (n ? '+' + n : '0') + '</button>'; }).join('') + '</div>' +
      '<button class="btn big" style="margin-top:18px" data-sheet="send">' + ic('swap', 30) + 'Send offer</button>');
    s.querySelector('#gives').addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (!b) return; sel.give = b.dataset.g; s.querySelectorAll('#gives button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    s.querySelector('#sweets').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; sel.sweet = +b.dataset.s; s.querySelectorAll('#sweets button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    s.querySelector('[data-sheet="send"]').addEventListener('click', function () { closeSheet(); act('offer', { give: sel.give, take: takeId, sweet: sel.sweet }).then(function () { toast(ic('swap', 28) + 'Offer sent', 'good'); }).catch(function () { /* shown */ }); });
  }
  function counterSheet(id) {
    var s = sheet('<div class="ttl">Counter: they add</div><div class="seg" id="cs">' + [5, 10, 20].map(function (n) { return '<button data-s="' + n + '">' + ic('pts', 20) + '+' + n + '</button>'; }).join('') + '</div>');
    s.querySelector('#cs').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; closeSheet(); act('counter', { trade: id, sweet: +b.dataset.s }).then(function () { toast(ic('swap', 28) + 'Counter sent', 'good'); }).catch(function () { /* shown */ }); });
  }
  function challengeSheet() {
    var d = S.d, rivals = d.players.filter(function (p) { return p.role === 'player' && p.id !== d.me; });
    var s = sheet('<div class="ttl">Pick a rival</div><div class="pick">' + rivals.map(function (p) { return '<button data-r="' + p.id + '">' + av(p.avatar, 60) + esc(p.name) + '</button>'; }).join('') + '</div><div style="text-align:center;margin-top:12px;font-size:14px;opacity:.7">Most points this week wins +25 XP</div>');
    s.querySelector('.pick').addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (!b) return; closeSheet(); act('challenge', { target: b.dataset.r }).then(function () { toast(ic('vs', 28) + 'Challenge sent', 'good'); }).catch(function () { /* shown */ }); });
  }
  function addSheet() {
    var sel = { icon: 'spark', pts: 10 };
    var s = sheet('<div class="ttl">New chore</div><div class="avpick" id="ci">' + CHORE_ICONS.map(function (n) { return '<button class="' + (n === 'spark' ? 'on' : '') + '" data-i="' + n + '" aria-label="' + n + '">' + ic(n, 44) + '</button>'; }).join('') + '</div>' +
      '<label class="field" style="margin:12px 0"><input id="c_title" maxlength="24" placeholder="Chore name"></label><div class="seg" id="cp">' +
      [5, 10, 20, 30].map(function (n) { return '<button class="' + (n === 10 ? 'on' : '') + '" data-p="' + n + '">' + ic('pts', 18) + n + '</button>'; }).join('') + '</div>' +
      '<button class="btn big" style="margin-top:16px" data-sheet="add">' + ic('plus', 30) + 'Add</button>');
    s.querySelector('#ci').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; sel.icon = b.dataset.i; s.querySelectorAll('#ci button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    s.querySelector('#cp').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; sel.pts = +b.dataset.p; s.querySelectorAll('#cp button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    s.querySelector('[data-sheet="add"]').addEventListener('click', function () { var t = s.querySelector('#c_title').value.trim(); if (!t) { toast(ic('cross', 28) + 'Add a name', 'bad'); return; } closeSheet(); act('add_chore', { icon: sel.icon, title: t, pts: sel.pts }).catch(function () { /* shown */ }); });
  }
  function pinSheet(cb) {
    var s = sheet('<div class="ttl">Parent PIN</div>' + pinField('p_pin', '') + '<button class="btn big" style="margin-top:14px" data-sheet="ok">OK</button>');
    s.querySelector('[data-sheet="ok"]').addEventListener('click', function () { var v = s.querySelector('#p_pin').value; closeSheet(); cb(v); });
    setTimeout(function () { var i = s.querySelector('#p_pin'); if (i) i.focus(); }, 50);
  }
  function profileSheet() {
    var m = me(), r = rankOf(m.xp), nx = nextRank(m.xp);
    var s = sheet('<div class="ttl">' + esc(m.name) + '</div><div style="display:flex;justify-content:center">' + av(m.avatar, 110) + '</div>' +
      (m.role === 'player' ? '<div style="display:flex;justify-content:center;align-items:center;gap:10px;margin:10px 0">' + ic(r.ic, 44) + '<div><div class="num" style="font-size:22px">' + r.n + '</div><div style="font-size:14px">' + m.xp + ' XP' + (nx ? ' / ' + nx.at : '') + '</div></div></div>' +
        '<div style="display:flex;justify-content:center;gap:8px;margin-bottom:10px">' + RANKS.map(function (k) { return '<span style="opacity:' + (m.xp >= k.at ? 1 : .35) + '">' + ic(k.ic, 40) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="stack"><button class="btn white big" data-sheet="snd">' + ic(S.sound ? 'sound' : 'mute', 30) + (S.sound ? 'Sound on' : 'Sound off') + '</button>' +
      '<button class="btn white big" data-sheet="mus" aria-pressed="' + S.music + '">' + ic(S.music ? 'sound' : 'mute', 30) + (S.music ? 'Music on' : 'Music off') + '</button>' +
      '<button class="btn ghost" style="color:var(--ink)" data-sheet="out">Leave on this phone</button></div>');
    s.querySelector('[data-sheet="snd"]').addEventListener('click', function () { setSound(!S.sound); closeSheet(); });
    s.querySelector('[data-sheet="mus"]').addEventListener('click', function () { setMusic(!S.music); closeSheet(); });
    s.querySelector('[data-sheet="out"]').addEventListener('click', function () { closeSheet(); save('cw_session', null); S.sess = null; S.d = null; if (chan) { sb.removeChannel(chan); chan = null; } S.view = null; S.draft = {}; render(); });
  }
  /* rewarded moment: labelled Ad, 5-second countdown, then a card flips to show the prize.
     The slot is where a non-personalised ad network will render (see model page); none is wired yet. */
  function adSheet() {
    var n = 5;
    var s = sheet('<div class="admoment"><span class="adtag">Ad</span><div class="adbrand"><img src="brand/lockup.svg" alt="Chore Wars"></div>' +
      '<div class="reveal show" id="rev"><div class="flipcard spin"><div class="face back">' + ic('cards', 72) + '</div><div class="face front" id="revf"><span class="q">?</span></div></div></div>' +
      '<div class="adrow"><div class="ring" style="--p:0"><span class="num" id="adn">5</span></div><div class="adtxt"><b id="adname">Free power card</b><span class="fine" id="adsub">Steal, Shield or 2X</span></div></div></div>');
    var ring = s.querySelector('.ring');
    var t = setInterval(function () {
      if (!document.body.contains(s)) { clearInterval(t); return; }
      n -= 1; ring.style.setProperty('--p', (5 - n) / 5);
      if (n > 0) { s.querySelector('#adn').textContent = n; return; }
      clearInterval(t); s.querySelector('#adn').innerHTML = ic('check', 40);
      ring.classList.add('done'); s.querySelector('#adsub').textContent = 'Unlocking…';
      act('ad_reward').then(function (got) {
        var k = got || 'cards', nm = { steal: 'Steal', shield: 'Shield', double: '2X' }[k] || 'Card';
        s.querySelector('#revf').innerHTML = ic(k, 84) + '<b>' + nm + '</b>';
        s.querySelector('#adname').textContent = nm + ' card!'; s.querySelector('#adsub').textContent = 'Added to your deck';
        var fc = s.querySelector('.flipcard'); fc.classList.remove('spin');
        setTimeout(function () { fc.classList.add('flip'); }, 250);
        setTimeout(function () { burst(1); fx('reward'); }, 900);
        setTimeout(closeSheet, 2600);
      }).catch(function () { closeSheet(); });
    }, 1000);
  }

  /* ---------- waiting for approval ---------- */
  var pendT = null;
  function pollJoin() {
    if (!S.pend) return Promise.resolve();
    return rpc('cw_join_status', { p_request: S.pend.request, p_secret: S.pend.secret }).then(function (r) {
      if (!S.pend) return;
      if (r.status === 'ok') { var sec = S.pend.secret; clearInterval(pendT); toast(ic('check', 28) + "You're in!", 'good'); return startSession({ player: r.player, secret: sec, household: r.household, code: r.code }); }
      if (r.status !== 'pending') { clearInterval(pendT); save('cw_pending', null); S.pend = null; S.draft = {}; S.view = null; if (chan) { sb.removeChannel(chan); chan = null; } toast(ic('cross', 28) + 'Not let in', 'bad'); render(); }
    }).catch(function () { /* retry on next tick */ });
  }
  function startWaiting() { connect(); clearInterval(pendT); pendT = setInterval(function () { if (!document.hidden) pollJoin(); }, 4000); render(); }

  /* ---------- demo: invented family, runs only in this browser, resets on reload ---------- */
  function demoBar() {
    return '<div class="demobar"><b>Demo</b><span>The Thunder House</span><button data-act="demo_view">' + (isParent() ? 'Kid view' : 'Parent view') + '</button><button data-act="demo_exit" aria-label="Exit demo">' + ic('cross', 20) + '</button></div>';
  }
  function demoState() {
    var now = Date.now(), t = function (m) { return new Date(now - m * 60000).toISOString(); };
    var P = function (id, name, avatar, badge, role, xp, pts, streak) { return { id: id, name: name, avatar: avatar, badge: badge, role: role, xp: xp, pts: pts, streak: streak, cards: { steal: 1, shield: 1, double: 1 }, double: false, shield: false, seat: false, ads: 0 }; };
    var C = function (id, icon, title, p, status, owner, bounty) { return { id: id, icon: icon, title: title, pts: p, bounty: bounty || 0, status: status, owner: owner || null, proof: null, at: t(30) }; };
    return {
      house: { id: 'demo', code: 'DEMO', name: 'The Thunder House', week: 'demo', champion: 'zap', rev: 1 }, me: 'nova',
      players: [P('cap', 'Captain', 'owl', 'crown', 'parent', 0, 0, 0), P('zap', 'Zap', 'shark', 'bolt', 'player', 340, 45, 4), P('nova', 'Nova', 'cat', 'star', 'player', 160, 30, 2)],
      chores: [C('c1', 'toilet', 'Bathroom', 30, 'open'), C('c2', 'trash', 'Trash out', 10, 'open', null, 10), C('c3', 'laundry', 'Laundry', 20, 'claimed', 'zap'),
        C('c4', 'dishes', 'Dishes', 15, 'open'), C('c5', 'vacuum', 'Vacuum', 20, 'done', 'zap'), C('c6', 'bed', 'Make bed', 5, 'open'), C('c7', 'pet', 'Feed pet', 10, 'claimed', 'nova'), C('c8', 'plant', 'Water plants', 5, 'approved', 'nova')],
      trades: [], challenges: [{ id: 'd1', a: 'zap', b: 'nova', as: 0, bs: 0, status: 'on', winner: null, week: 'demo' }], requests: [],
      feed: [{ id: 3, kind: 'done', actor: 'zap', target: null, info: { chore: 'c5' }, created_at: t(4) }, { id: 2, kind: 'bounty', actor: 'cap', target: null, info: { chore: 'c2' }, created_at: t(12) },
        { id: 1, kind: 'claim', actor: 'nova', target: null, info: { chore: 'c7' }, created_at: t(20) }]
    };
  }
  function startDemo() { S.demo = true; S.d = demoState(); S.tab = 'chores'; S.seenFeed = 3; render(); }
  function demoAct(action, a) {
    var d = S.d, c = a.chore ? chore(a.chore) : null, m = me(), gain;
    var feed = function (kind, info) { d.feed.unshift({ id: d.feed.length + 10, kind: kind, actor: m.id, target: null, info: info || {}, created_at: new Date().toISOString() }); };
    if (action === 'claim' && c && c.status === 'open') { c.status = 'claimed'; c.owner = m.id; feed('claim', { chore: c.id }); }
    else if (action === 'done' && c) { c.status = 'done'; c.proof = a.proof || null; feed('done', { chore: c.id }); }
    else if ((action === 'approve' || action === 'reject') && c) {
      var o = player(c.owner);
      if (action === 'approve') { gain = c.pts + c.bounty; o.pts += gain; o.xp += gain; c.status = 'approved'; c.bounty = 0; c.proof = null; feed('approved', { chore: c.id, gain: gain }); }
      else { c.status = 'claimed'; c.proof = null; }
    } else if (action === 'bounty' && c) { c.bounty = Math.min(30, c.bounty + 10); }
    else if (action === 'ad_reward') { m.cards.steal += 1; render(); return Promise.resolve('steal'); }
    else { fx('error'); toast(ic('lock', 28) + ERR.demo, 'bad'); return Promise.reject(new Error('demo')); }
    render(); return Promise.resolve(null);
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.dataset.act, id = b.dataset.id;
    var v = function (sel) { var el = document.querySelector(sel); return el ? el.value.trim() : ''; };
    switch (a) {
      case 'onb_next': {
        var el = document.getElementById('slides'), i = Math.round(el.scrollLeft / el.clientWidth);
        if (i >= 2) { save('cw_onb', true); render(); } else { el.scrollTo({ left: (i + 1) * el.clientWidth, behavior: 'smooth' }); }
        break;
      }
      case 'home': S.view = null; S.draft = {}; S.joinCode = null; render(); break;
      case 'go_create': S.view = 'create'; render(); break;
      case 'go_join': S.view = 'join'; render(); break;
      case 'go_demo': startDemo(); break;
      case 'demo_view': S.d.me = isParent() ? 'nova' : 'cap'; S.tab = isParent() ? 'verify' : 'chores'; render(); break;
      case 'demo_exit': S.demo = false; S.d = null; S.tab = null; S.view = null; render(); break;
      case 'pick_av':
        S.draft.av = id; keepDraft();
        document.querySelectorAll('.avpick button').forEach(function (x) { x.classList.toggle('on', x.dataset.id === id); }); break;
      case 'pick_bd':
        S.draft.bd = id; keepDraft();
        document.querySelectorAll('.bdpick button').forEach(function (x) { x.classList.toggle('on', x.dataset.id === id); }); break;
      case 'parent_mode': S.draft.parent = true; S.joinCode = v('#f_code').toUpperCase() || S.joinCode; render(); break;
      case 'parent_in': {
        var pc = v('#f_code').toUpperCase().replace(/[^A-Z0-9]/g, ''), pp = v('#f_pin');
        if (!/^\d{4}$/.test(pp)) { toast(ic('lock', 28) + 'PIN: 4 digits', 'bad'); return; }
        rpcj('cw_parent', { p_code: pc, p_pin: pp, p_device: DEV }).then(function (r) { return startSession(r); }).catch(fail);
        break;
      }
      case 'cancel_pend': clearInterval(pendT); save('cw_pending', null); S.pend = null; S.draft = {}; S.view = null; if (chan) { sb.removeChannel(chan); chan = null; } render(); break;
      case 'sound': setSound(!S.sound); render(); break;
      case 'crown_replay': { var cp = player(id); if (cp) ceremony(cp, 'Top of the week'); break; }
      case 'req_ok': act('approve_join', { req: id }).then(function () { toast(ic('check', 28) + 'Let in', 'good'); }).catch(function () { /* shown */ }); break;
      case 'req_seat': act('approve_join', { req: id, seat: b.dataset.seat }).then(function () { toast(ic('check', 28) + 'Seat taken back', 'good'); }).catch(function () { /* shown */ }); break;
      case 'req_no': act('deny_join', { req: id }).catch(function () { /* shown */ }); break;
      case 'create': {
        var house = v('#f_house'), name = v('#f_name'), pin = v('#f_pin');
        if (!house || !name) { toast(ic('cross', 28) + 'Add both names', 'bad'); return; }
        if (!/^\d{4}$/.test(pin)) { toast(ic('lock', 28) + 'PIN: 4 digits', 'bad'); return; }
        rpcj('cw_create', { p_house: house, p_name: name, p_avatar: S.draft.av || 'owl', p_pin: pin, p_badge: 'crown', p_device: DEV }).then(function (r) { return startSession(r).then(function () { S.tab = 'invite'; render(); }); }).catch(fail);
        break;
      }
      case 'find': findHouse(v('#f_code')); break;
      case 'join_new': {
        var nm = v('#f_name'); if (!nm) { toast(ic('cross', 28) + 'Add your name', 'bad'); return; }
        var jav = S.draft.av || 'fox', jbd = S.draft.bd || 'bolt';
        rpcj('cw_join', { p_code: S.draft.code, p_name: nm, p_avatar: jav, p_badge: jbd, p_device: DEV }).then(function (r) {
          S.pend = { request: r.request, secret: r.secret, household: r.household, name: nm, avatar: jav, badge: jbd };
          save('cw_pending', S.pend); startWaiting(); setTimeout(ping, 800);
        }).catch(fail);
        break;
      }
      case 'tab': S.tab = id; window.scrollTo(0, 0); render(); break;
      case 'claim': {
        var cc = chore(id), gn = cc ? cc.pts + cc.bounty : 0;
        S.anim = { id: id, kind: 'flip', n: gn };
        act('claim', { chore: id }).catch(function () { S.anim = null; /* shown */ });
        break;
      }
      case 'steal': act('steal', { chore: id }).then(function (got) { if (got === 'blocked') { toast(ic('shield', 28) + 'Blocked by a shield!', 'bad'); } else { toast(ic('steal', 28) + 'Stolen!', 'good'); } }).catch(function () { /* shown */ }); break;
      case 'done_sheet': doneSheet(id); break;
      case 'swap_sheet': swapSheet(id); break;
      case 'counter_sheet': counterSheet(id); break;
      case 'accept': act('accept', { trade: id }).catch(function () { /* shown */ }); break;
      case 'decline': act('decline', { trade: id }).catch(function () { /* shown */ }); break;
      case 'challenge_pick': challengeSheet(); break;
      case 'chal_yes': act('chal_yes', { chal: id }).catch(function () { /* shown */ }); break;
      case 'chal_no': act('chal_no', { chal: id }).catch(function () { /* shown */ }); break;
      case 'card':
        if (id === 'steal') { toast(ic('steal', 28) + 'Use it on a chore'); S.tab = 'chores'; render(); break; }
        act(id).then(function () { toast(ic(id, 28) + (id === 'shield' ? 'Shield up' : '2X armed'), 'good'); }).catch(function () { /* shown */ });
        break;
      case 'ad': adSheet(); break;
      case 'approve': act('approve', { chore: id }).then(function () { fx('approve'); }).catch(function () { /* shown */ }); break;
      case 'reject': act('reject', { chore: id }).catch(function () { /* shown */ }); break;
      case 'bounty': act('bounty', { chore: id }).catch(function () { /* shown */ }); break;
      case 'add_sheet': addSheet(); break;
      case 'free_seat': act('free_seat', { player: id }).then(function () { toast(ic('qr', 28) + 'Seat open', 'good'); }).catch(function () { /* shown */ }); break;
      case 'pin_sheet': pinSheet(function (p) { act('set_pin', { pin: p }).then(function () { toast(ic('lock', 28) + 'PIN saved', 'good'); }).catch(function () { /* shown */ }); }); break;
      case 'share': {
        var url = location.origin + location.pathname + '?join=' + S.d.house.code;
        if (navigator.share) navigator.share({ title: 'Chore Wars', url: url }).catch(function () { /* cancelled */ });
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast(ic('check', 28) + 'Link copied', 'good'); });
        break;
      }
      case 'profile': profileSheet(); break;
    }
  });
  function findHouse(code) {
    code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) { toast(ic('cross', 28) + 'Code is 8 characters', 'bad'); return; }
    rpcj('cw_seats', { p_code: code, p_device: DEV }).then(function (r) {
      S.draft.code = r.code; S.view = 'join'; render();
    }).catch(fail);
  }

  /* ---------- boot ---------- */
  var q = new URLSearchParams(location.search);
  if (q.get('join')) { S.joinCode = q.get('join').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); S.view = 'join'; save('cw_onb', true); }
  if (q.get('demo') !== null && !S.sess) { S.demo = true; S.d = demoState(); S.tab = 'chores'; S.seenFeed = 3; }
  render();
  if (S.sess) { connect(); refresh(); }
  else if (S.pend) startWaiting();
  else if (S.joinCode) findHouse(S.joinCode);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  window.CW_DEBUG = { state: function () { return S.d; }, victory: function (a, b) { victory({ icon: 'dishes' }, b - a, a, b); }, crown: function () { var ps = S.d.players.filter(function (p) { return p.role === 'player'; }).sort(function (a, b) { return b.pts - a.pts; }); ceremony(ps[0], 'Champion of the week'); } };
})();
