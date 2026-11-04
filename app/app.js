/* Chore Wars - staging build. Each player on their own phone, synced through Supabase.
   Every game rule is enforced server-side (cw_* Postgres functions); this file only draws and calls them. */
(function () {
  'use strict';
  var CFG = window.CW_CONFIG;
  var ic = CWIcons.icon, av = CWIcons.avatar;
  var AV_NAMES = Object.keys(CWIcons.AVATARS);
  var CHORE_ICONS = ['dishes', 'trash', 'bed', 'laundry', 'vacuum', 'pet', 'plant', 'toilet', 'broom', 'book', 'car', 'spark'];
  var RANKS = [{ n: 'Rookie', at: 0, ic: 'rank1' }, { n: 'Brawler', at: 100, ic: 'rank2' }, { n: 'Hero', at: 300, ic: 'rank3' }, { n: 'Legend', at: 700, ic: 'rank4' }];
  var ERR = {
    not_open: 'Too slow! Already taken', hands_full: 'Max 3 chores at once', no_card: 'No card left', cant_steal: "Can't steal that",
    not_yours: 'Not your chore', already_on: 'Already on', bad_code: 'Code not found', seat_taken: 'Seat taken', bad_pin: 'Wrong PIN',
    house_full: 'Family is full (8)', not_enough: 'Not enough points', trade_stale: 'Trade expired', ads_maxed: 'Back tomorrow',
    bounty_max: 'Bounty maxed', need_name: 'Add a name', photo_too_big: 'Photo too big', not_allowed: 'Signed out', no_trade: 'Trade gone',
    no_chal: 'Challenge gone', bad_target: 'Pick a rival', players_only: 'Players only', parent_only: 'Parent only'
  };

  var sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false } });
  var S = { sess: load('cw_session'), d: null, tab: 'arena', busy: false, sound: load('cw_sound') !== false, seenFeed: 0, joinCode: null, draft: {} };
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

  /* ---------- sound + haptics ---------- */
  var ctx = null;
  function tone(seq) {
    if (!S.sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      var t = ctx.currentTime;
      seq.forEach(function (n, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = n[2] || 'square'; o.frequency.setValueAtTime(n[0], t + i * 0.09);
        g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + (n[1] || 0.12));
        o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + (n[1] || 0.12) + 0.02);
      });
    } catch (e) { /* no audio */ }
  }
  var SFX = {
    tap: [[660, .05]], grab: [[520, .08], [780, .1]], win: [[523, .1], [659, .1], [784, .1], [1046, .25]],
    steal: [[300, .12, 'sawtooth'], [200, .2, 'sawtooth']], card: [[880, .06], [1320, .12]], bad: [[180, .2, 'sawtooth']]
  };
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* none */ } }
  function fx(kind) { tone(SFX[kind] || SFX.tap); buzz(kind === 'steal' ? [60, 40, 120] : kind === 'win' ? [30, 30, 30, 30, 80] : 15); }

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
  function flash() { var el = document.createElement('div'); el.className = 'fx'; el.innerHTML = '<div class="flash"></div>'; document.body.appendChild(el); app.classList.add('shake'); setTimeout(function () { el.remove(); app.classList.remove('shake'); }, 650); }

  /* ---------- server ---------- */
  function rpc(fn, args) {
    return sb.rpc(fn, args).then(function (r) {
      if (r.error) { var code = (r.error.message || '').trim(); throw new Error(code); }
      return r.data;
    });
  }
  function fail(e) {
    var m = e && e.message; fx('bad'); toast(ic('cross', 28) + esc(ERR[m] || 'Try again'), 'bad');
    if (m === 'not_allowed') { save('cw_session', null); S.sess = null; S.d = null; render(); }
  }
  function act(action, args) {
    if (S.busy) return Promise.resolve();
    S.busy = true;
    return rpc('cw_act', { p_player: S.sess.player, p_secret: S.sess.secret, p_action: action, p_args: args || {} })
      .then(function (d) { S.busy = false; var got = d.got, err = d.err; apply(d); ping(); if (err) fail({ message: err }); return got; })
      .catch(function (e) { S.busy = false; fail(e); throw e; });
  }
  function refresh() {
    if (!S.sess) return Promise.resolve();
    return rpc('cw_state', { p_player: S.sess.player, p_secret: S.sess.secret }).then(apply).catch(function (e) { if (e.message === 'not_allowed') fail(e); });
  }
  function ping() { if (chan) chan.send({ type: 'broadcast', event: 'rev', payload: { by: S.sess.player } }); }
  function connect() {
    if (chan || !S.sess) return;
    chan = sb.channel('cw-' + S.sess.household, { config: { broadcast: { self: false } } });
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
      if (f.kind === 'steal' && f.target === d.me) { flash(); fx('steal'); toast(av(a.avatar, 32) + esc(a.name) + ' stole ' + esc(c.title || 'a chore'), 'bad'); }
      else if (f.kind === 'blocked' && f.actor === d.me) { fx('card'); toast(ic('shield', 28) + 'Shield blocked a steal!', 'good'); }
      else if (f.kind === 'approved' && f.actor === d.me) { fx('win'); burst(f.info.gain || 0); if (f.info.card) setTimeout(function () { toast(ic(f.info.card, 28) + 'New card!', 'good'); }, 900); }
      else if (f.kind === 'rejected' && f.actor === d.me) { fx('bad'); toast(ic('cross', 28) + esc(c.title || 'Chore') + ': redo it', 'bad'); }
      else if (f.kind === 'offer' && f.target === d.me) { fx('card'); toast(ic('swap', 28) + esc(a.name) + ' wants a swap'); }
      else if (f.kind === 'counter' && f.target === d.me) { fx('card'); toast(ic('swap', 28) + esc(a.name) + ' countered'); }
      else if (f.kind === 'trade_ok' && f.target === d.me) { fx('grab'); toast(ic('check', 28) + esc(a.name) + ' took the swap', 'good'); }
      else if (f.kind === 'chal' && f.target === d.me) { fx('card'); toast(ic('vs', 28) + esc(a.name) + ' challenged you!'); }
      else if (f.kind === 'claim' && f.actor !== d.me) { fx('tap'); }
      else if (f.kind === 'done' && d.players.find(function (p) { return p.id === d.me && p.role === 'parent'; })) { fx('card'); toast(ic('camera', 28) + esc(a.name) + ': check it'); }
      else if (f.kind === 'bounty') { fx('card'); toast(ic('bounty', 28) + 'Bounty on ' + esc(c.title || 'a chore')); }
      else if (f.kind === 'champion') { fx('win'); toast(ic('crown', 28) + esc(a.name) + ' is champion!', 'good'); }
    });
  }
  function apply(d) { var old = S.d; S.d = d; react(old, d); render(); }

  /* ---------- session ---------- */
  function startSession(r) {
    S.sess = { player: r.player, secret: r.secret, household: r.household, code: r.code };
    save('cw_session', S.sess); S.d = null;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    connect(); return refresh();
  }

  /* ---------- views ---------- */
  function topBar() {
    var m = me(), r = rankOf(m.xp), nx = nextRank(m.xp);
    var pct = nx ? Math.round((m.xp - r.at) / (nx.at - r.at) * 100) : 100;
    var right = m.role === 'parent'
      ? '<span class="chip">' + ic('check', 24) + S.d.chores.filter(function (c) { return c.status === 'done'; }).length + '</span>'
      : '<span class="chip" title="Streak">' + ic('flame', 24) + m.streak + '</span><span class="chip" title="Cards">' + ic('cards', 24) + cardCount(m) + '</span>';
    return '<header class="top"><button class="me" data-act="profile" aria-label="Profile">' + av(m.avatar, 52) +
      '<div style="min-width:0"><div class="me-name">' + esc(m.name) + '</div>' +
      (m.role === 'parent' ? '<div style="color:#fff;opacity:.8;font-size:13px">Referee</div>' :
        '<div style="display:flex;align-items:center;gap:6px">' + ic(r.ic, 22) + '<div class="xpbar"><i style="width:' + pct + '%"></i></div></div>') +
      '</div></button>' + right + '</header>';
  }
  function cardCount(m) { var c = m.cards || {}; return (c.steal || 0) + (c.shield || 0) + (c.double || 0); }

  function arena() {
    var d = S.d, ps = d.players.filter(function (p) { return p.role === 'player'; }).slice().sort(function (a, b) { return b.pts - a.pts || b.xp - a.xp; });
    var champ = d.house.champion || (ps[0] && ps[0].pts > 0 ? ps[0].id : null);
    var h = '<div class="h">' + ic('trophy', 30) + 'This week</div><div class="panel board">';
    if (!ps.length) h += '<div class="empty">' + ic('qr', 56) + 'Invite your players</div>';
    ps.forEach(function (p, i) {
      h += '<div class="row ' + (p.id === d.me ? 'mine ' : '') + (i === 0 && p.pts > 0 ? 'first' : '') + '"><span class="pos">' + (i + 1) + '</span>' +
        '<span class="avwrap">' + (p.id === champ ? '<span class="crown drop">' + ic('crown', 34) + '</span>' : '') + av(p.avatar, 50) + '</span>' +
        '<span class="nm">' + esc(p.name) + (p.streak > 1 ? ' <span style="display:inline-flex;vertical-align:middle">' + ic('flame', 18) + '</span><small>' + p.streak + '</small>' : '') + '</span>' +
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
      else h += '<div class="panel empty">' + ic('vs', 48) + 'Need a rival</div>';
    } else if (!list.length) h += '<div class="panel empty">' + ic('vs', 48) + 'No duels yet</div>';
    return h;
  }

  function choreTile(c) {
    var d = S.d, m = me(), o = player(c.owner), mine = c.owner === d.me;
    var cls = c.status === 'approved' ? 'over' : mine ? 'mine' : (o ? 'theirs' : '');
    var h = '<div class="tile ' + cls + '" data-chore="' + c.id + '">';
    if (o) h += '<span class="owner">' + av(o.avatar, 42) + '</span>';
    if (c.bounty) h += '<span class="bty">' + ic('bounty', 22) + '+' + c.bounty + '</span>';
    h += ic(c.icon, 64) + '<div class="tt">' + esc(c.title) + '</div><div class="val">' + ic('pts', 26) + (c.pts + c.bounty) + '</div><div class="act">';
    if (isParent()) {
      if (c.status === 'done') h += '<button class="btn sm" data-act="tab" data-id="verify">' + ic('check', 22) + 'Check</button>';
      else if (c.status === 'approved') h += '<div class="wait">' + ic('check', 22) + 'Done</div>';
      else h += '<button class="btn pink sm" data-act="bounty" data-id="' + c.id + '"' + (c.bounty >= 30 ? ' disabled' : '') + '>' + ic('bounty', 22) + '+10</button>';
    } else if (c.status === 'open') h += '<button class="btn" data-act="claim" data-id="' + c.id + '">Grab</button>';
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
  function chores() {
    var d = S.d, order = { open: 1, claimed: 2, done: 3, approved: 4 };
    var list = d.chores.slice().sort(function (a, b) {
      var am = a.owner === d.me ? 0 : 1, bm = b.owner === d.me ? 0 : 1;
      return (am - bm) || (order[a.status] - order[b.status]) || (b.bounty - a.bounty) || (b.pts - a.pts);
    });
    var h = '<div class="h">' + ic('broom', 30) + 'Chores</div><div class="grid">' + list.map(choreTile).join('') + '</div>';
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
    h += '<div class="h">' + ic('gift', 28) + 'Shop <span class="eyes">NEEDS YOUR EYES</span></div><div class="shop">' +
      [['crown', 'Skins'], ['trophy', 'Season pass'], ['cards', 'Card pack']].map(function (s) { return '<div class="item">' + ic(s[0], 48) + '<b>' + s[1] + '</b><span class="tbd">price TBD</span></div>'; }).join('') + '</div>';
    return h;
  }

  function verify() {
    var d = S.d, list = d.chores.filter(function (c) { return c.status === 'done'; });
    var h = '<div class="h">' + ic('check', 30) + 'Check it</div>';
    if (!list.length) return h + '<div class="panel empty">' + ic('check', 64) + 'All clear</div>';
    list.forEach(function (c) {
      var o = player(c.owner) || {};
      h += '<div class="panel ver">' + (c.proof ? '<img class="ph" alt="Proof photo" src="' + esc(c.proof) + '">' : '<div class="ph">' + ic('camera', 48) + '</div>') +
        '<div class="info"><div style="display:flex;align-items:center;gap:6px">' + av(o.avatar, 34) + esc(o.name) + '</div><div style="display:flex;align-items:center;gap:6px">' + ic(c.icon, 30) + esc(c.title) + '</div>' + pts(c.pts + c.bounty + (o.double ? ' ×2' : ''), 22) + '</div>' +
        '<div class="btns"><button class="yes" data-act="approve" data-id="' + c.id + '" aria-label="Approve">' + ic('check', 60) + '</button><button class="no" data-act="reject" data-id="' + c.id + '" aria-label="Redo">' + ic('cross', 60) + '</button></div></div>';
    });
    return h;
  }

  function invite() {
    var d = S.d, url = location.origin + location.pathname + '?join=' + d.house.code;
    var h = '<div class="h">' + ic('qr', 30) + 'Invite</div><div class="panel"><div class="qr">' + qrSvg(url) + '</div><div class="bigcode">' + esc(d.house.code) + '</div>' +
      '<div style="text-align:center;opacity:.7;font-size:15px">Scan on their phone</div>' +
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
      arena: d.challenges.filter(function (c) { return c.status === 'pending' && c.b === d.me; }).length
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
      '<button class="btn ghost" data-act="go_demo">Open the M Clan demo</button></div>';
  }
  function avPicker(sel) { return '<div class="avpick">' + AV_NAMES.map(function (n) { return '<button type="button" class="' + (n === sel ? 'on' : '') + '" data-act="pick_av" data-id="' + n + '" aria-label="' + n + '">' + av(n, 56) + '</button>'; }).join('') + '</div>'; }
  function createForm() {
    var dr = S.draft; dr.av = dr.av || 'owl';
    return '<div class="hero-logo" style="padding-top:20px"><img src="brand/mark.svg" alt="" style="width:110px"></div><div class="panel stack">' +
      '<label class="field"><span>Family name</span><input id="f_house" maxlength="24" placeholder="The M Clan" value="' + esc(dr.house || '') + '"></label>' +
      '<label class="field"><span>Your name</span><input id="f_name" maxlength="14" placeholder="Mom" value="' + esc(dr.name || '') + '"></label>' +
      avPicker(dr.av) +
      '<label class="field"><span>Parent PIN (4 digits)</span><input id="f_pin" inputmode="numeric" maxlength="4" pattern="[0-9]*" placeholder="••••"></label>' +
      '<button class="btn big" data-act="create">' + ic('crown', 30) + 'Create</button></div><button class="btn ghost" data-act="home">Back</button>';
  }
  function joinForm() {
    var dr = S.draft;
    if (!dr.seats) {
      return '<div class="hero-logo" style="padding-top:20px"><img src="brand/mark.svg" alt="" style="width:110px"></div><div class="panel stack">' +
        '<label class="field"><span>Family code</span><input id="f_code" class="code-in" maxlength="6" autocomplete="off" autocapitalize="characters" value="' + esc(S.joinCode || '') + '"></label>' +
        '<button class="btn big" data-act="find">Join</button></div><button class="btn ghost" data-act="home">Back</button>';
    }
    dr.av = dr.av || 'fox';
    var h = '<div class="h" style="justify-content:center">' + esc(dr.seats.name) + '</div><div class="panel stack"><div class="seats">' +
      dr.seats.seats.map(function (s) { return '<button class="seat" data-act="seat" data-id="' + s.id + '" data-role="' + s.role + '"' + (s.free ? '' : ' disabled') + '>' + av(s.avatar, 56) + esc(s.name) + (s.role === 'parent' ? ic('lock', 18) : '') + '</button>'; }).join('') +
      '</div><div style="text-align:center;font-size:15px;opacity:.7">That\'s me! Or new player:</div>' +
      '<label class="field"><input id="f_name" maxlength="14" placeholder="Your name" value="' + esc(dr.name || '') + '"></label>' + avPicker(dr.av) +
      '<button class="btn big" data-act="join_new">' + ic('pts', 30) + 'Play</button></div><button class="btn ghost" data-act="home">Back</button>';
    return h;
  }

  /* ---------- render ---------- */
  function render() {
    var y = window.scrollY;
    if (!S.sess) {
      if (!load('cw_onb') && !S.joinCode) { app.innerHTML = onboarding(); bindSlides(); return; }
      app.innerHTML = S.view === 'create' ? createForm() : S.view === 'join' ? joinForm() : start();
      return;
    }
    if (!S.d) { app.innerHTML = '<div class="spin" role="status" aria-label="Loading"></div>'; return; }
    var body = { arena: arena, chores: chores, trades: trades, cards: cards, verify: verify, invite: invite }[S.tab];
    var allowed = isParent() ? ['arena', 'verify', 'chores', 'invite'] : ['arena', 'chores', 'trades', 'cards'];
    if (allowed.indexOf(S.tab) < 0) { S.tab = 'arena'; body = arena; }
    app.innerHTML = topBar() + '<main>' + body() + '</main>' + nav() + '<div class="stagebar">staging</div>';
    window.scrollTo(0, y);
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
      shrink(file).then(function (url) { closeSheet(); return act('done', { chore: id, proof: url }); }).then(function () { fx('grab'); toast(ic('lock', 28) + 'Sent to the referee', 'good'); }).catch(function () { /* toast shown */ });
    });
    s.querySelector('[data-sheet="noproof"]').addEventListener('click', function () { closeSheet(); act('done', { chore: id }).then(function () { fx('grab'); toast(ic('lock', 28) + 'Sent to the referee', 'good'); }).catch(function () { /* shown */ }); });
  }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 480 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
        res(cv.toDataURL('image/jpeg', 0.62));
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
    s.querySelector('[data-sheet="send"]').addEventListener('click', function () { closeSheet(); act('offer', { give: sel.give, take: takeId, sweet: sel.sweet }).then(function () { fx('card'); toast(ic('swap', 28) + 'Offer sent', 'good'); }).catch(function () { /* shown */ }); });
  }
  function counterSheet(id) {
    var s = sheet('<div class="ttl">Counter: they add</div><div class="seg" id="cs">' + [5, 10, 20].map(function (n) { return '<button data-s="' + n + '">' + ic('pts', 20) + '+' + n + '</button>'; }).join('') + '</div>');
    s.querySelector('#cs').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; closeSheet(); act('counter', { trade: id, sweet: +b.dataset.s }).then(function () { fx('card'); toast(ic('swap', 28) + 'Counter sent', 'good'); }).catch(function () { /* shown */ }); });
  }
  function challengeSheet() {
    var d = S.d, rivals = d.players.filter(function (p) { return p.role === 'player' && p.id !== d.me; });
    var s = sheet('<div class="ttl">Pick a rival</div><div class="pick">' + rivals.map(function (p) { return '<button data-r="' + p.id + '">' + av(p.avatar, 60) + esc(p.name) + '</button>'; }).join('') + '</div><div style="text-align:center;margin-top:12px;font-size:14px;opacity:.7">Most points this week wins +25 XP</div>');
    s.querySelector('.pick').addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (!b) return; closeSheet(); act('challenge', { target: b.dataset.r }).then(function () { fx('card'); toast(ic('vs', 28) + 'Challenge sent', 'good'); }).catch(function () { /* shown */ }); });
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
    var s = sheet('<div class="ttl">Parent PIN</div><label class="field"><input id="p_pin" class="code-in" inputmode="numeric" maxlength="4" pattern="[0-9]*"></label><button class="btn big" style="margin-top:14px" data-sheet="ok">OK</button>');
    s.querySelector('[data-sheet="ok"]').addEventListener('click', function () { var v = s.querySelector('#p_pin').value; closeSheet(); cb(v); });
    setTimeout(function () { var i = s.querySelector('#p_pin'); if (i) i.focus(); }, 50);
  }
  function profileSheet() {
    var m = me(), r = rankOf(m.xp), nx = nextRank(m.xp);
    var s = sheet('<div class="ttl">' + esc(m.name) + '</div><div style="display:flex;justify-content:center">' + av(m.avatar, 110) + '</div>' +
      (m.role === 'player' ? '<div style="display:flex;justify-content:center;align-items:center;gap:10px;margin:10px 0">' + ic(r.ic, 44) + '<div><div class="num" style="font-size:22px">' + r.n + '</div><div style="font-size:14px">' + m.xp + ' XP' + (nx ? ' / ' + nx.at : '') + '</div></div></div>' +
        '<div style="display:flex;justify-content:center;gap:8px;margin-bottom:10px">' + RANKS.map(function (k) { return '<span style="opacity:' + (m.xp >= k.at ? 1 : .35) + '">' + ic(k.ic, 40) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="stack"><button class="btn white big" data-sheet="snd">' + ic(S.sound ? 'sound' : 'mute', 30) + (S.sound ? 'Sound on' : 'Sound off') + '</button>' +
      '<button class="btn ghost" style="color:var(--ink)" data-sheet="out">Leave on this phone</button></div>');
    s.querySelector('[data-sheet="snd"]').addEventListener('click', function () { S.sound = !S.sound; save('cw_sound', S.sound); closeSheet(); fx('tap'); });
    s.querySelector('[data-sheet="out"]').addEventListener('click', function () { closeSheet(); save('cw_session', null); S.sess = null; S.d = null; if (chan) { sb.removeChannel(chan); chan = null; } S.view = null; S.draft = {}; render(); });
  }
  function adSheet() {
    var n = 5;
    var s = sheet('<div class="ttl">Ad slot</div><div style="aspect-ratio:16/9;border:3px dashed var(--ink);border-radius:18px;display:grid;place-items:center;background:#fff;text-align:center;font-size:15px">' +
      '<div>' + ic('ad', 64) + '<div>Rewarded ad placeholder</div><small>No ad SDK yet</small></div></div><div style="text-align:center;margin-top:12px" class="num" id="adn">5</div>');
    var t = setInterval(function () {
      n -= 1; var el = s.querySelector('#adn'); if (!document.body.contains(s)) { clearInterval(t); return; }
      if (n > 0) { el.textContent = n; return; }
      clearInterval(t); closeSheet();
      act('ad_reward').then(function (got) { fx('card'); toast(ic(got || 'cards', 30) + 'Card won!', 'good'); }).catch(function () { /* shown */ });
    }, 1000);
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.dataset.act, id = b.dataset.id;
    var v = function (sel) { var el = document.querySelector(sel); return el ? el.value.trim() : ''; };
    switch (a) {
      case 'onb_next': {
        var el = document.getElementById('slides'), i = Math.round(el.scrollLeft / el.clientWidth);
        if (i >= 2) { save('cw_onb', true); fx('grab'); render(); } else { fx('tap'); el.scrollTo({ left: (i + 1) * el.clientWidth, behavior: 'smooth' }); }
        break;
      }
      case 'home': S.view = null; S.draft = {}; render(); break;
      case 'go_create': S.view = 'create'; render(); break;
      case 'go_join': S.view = 'join'; render(); break;
      case 'go_demo': S.view = 'join'; S.joinCode = 'MCLAN7'; findHouse('MCLAN7'); break;
      case 'pick_av':
        S.draft.av = id; S.draft.name = v('#f_name') || S.draft.name; S.draft.house = v('#f_house') || S.draft.house;
        document.querySelectorAll('.avpick button').forEach(function (x) { x.classList.toggle('on', x.dataset.id === id); }); fx('tap'); break;
      case 'create': {
        var house = v('#f_house'), name = v('#f_name'), pin = v('#f_pin');
        if (!house || !name) { toast(ic('cross', 28) + 'Add both names', 'bad'); return; }
        if (!/^\d{4}$/.test(pin)) { toast(ic('lock', 28) + 'PIN: 4 digits', 'bad'); return; }
        rpc('cw_create', { p_house: house, p_name: name, p_avatar: S.draft.av || 'owl', p_pin: pin }).then(function (r) { S.tab = 'invite'; fx('win'); return startSession(r); }).catch(fail);
        break;
      }
      case 'find': findHouse(v('#f_code')); break;
      case 'seat': {
        var join = function (pin) { rpc('cw_join', { p_code: S.draft.seats.code, p_name: '', p_avatar: '', p_seat: id, p_pin: pin || null }).then(function (r) { fx('win'); return startSession(r); }).catch(fail); };
        if (b.dataset.role === 'parent') pinSheet(join); else join(null);
        break;
      }
      case 'join_new': {
        var nm = v('#f_name'); if (!nm) { toast(ic('cross', 28) + 'Add your name', 'bad'); return; }
        rpc('cw_join', { p_code: S.draft.seats.code, p_name: nm, p_avatar: S.draft.av || 'fox', p_seat: null, p_pin: null }).then(function (r) { fx('win'); return startSession(r); }).catch(fail);
        break;
      }
      case 'tab': S.tab = id; fx('tap'); window.scrollTo(0, 0); render(); break;
      case 'claim': act('claim', { chore: id }).then(function () { fx('grab'); }).catch(function () { /* shown */ }); break;
      case 'steal': act('steal', { chore: id }).then(function (got) { if (got === 'blocked') { fx('bad'); toast(ic('shield', 28) + 'Blocked by a shield!', 'bad'); } else { fx('steal'); toast(ic('steal', 28) + 'Stolen!', 'good'); } }).catch(function () { /* shown */ }); break;
      case 'done_sheet': doneSheet(id); break;
      case 'swap_sheet': swapSheet(id); break;
      case 'counter_sheet': counterSheet(id); break;
      case 'accept': act('accept', { trade: id }).then(function () { fx('grab'); }).catch(function () { /* shown */ }); break;
      case 'decline': act('decline', { trade: id }).catch(function () { /* shown */ }); break;
      case 'challenge_pick': challengeSheet(); break;
      case 'chal_yes': act('chal_yes', { chal: id }).then(function () { fx('win'); }).catch(function () { /* shown */ }); break;
      case 'chal_no': act('chal_no', { chal: id }).catch(function () { /* shown */ }); break;
      case 'card':
        if (id === 'steal') { toast(ic('steal', 28) + 'Use it on a chore'); S.tab = 'chores'; render(); break; }
        act(id).then(function () { fx('card'); toast(ic(id, 28) + (id === 'shield' ? 'Shield up' : '2X armed'), 'good'); }).catch(function () { /* shown */ });
        break;
      case 'ad': adSheet(); break;
      case 'approve': act('approve', { chore: id }).then(function () { fx('win'); }).catch(function () { /* shown */ }); break;
      case 'reject': act('reject', { chore: id }).catch(function () { /* shown */ }); break;
      case 'bounty': act('bounty', { chore: id }).then(function () { fx('card'); }).catch(function () { /* shown */ }); break;
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
    code = (code || '').toUpperCase();
    if (code.length < 5) { toast(ic('cross', 28) + 'Code is 6 letters', 'bad'); return; }
    rpc('cw_seats', { p_code: code }).then(function (r) {
      if (!r) throw new Error('bad_code');
      S.draft.seats = r; S.view = 'join'; fx('grab'); render();
    }).catch(fail);
  }

  /* ---------- boot ---------- */
  var q = new URLSearchParams(location.search);
  if (q.get('join')) { S.joinCode = q.get('join').toUpperCase().slice(0, 6); S.view = 'join'; save('cw_onb', true); }
  render();
  if (S.sess) { connect(); refresh(); }
  else if (S.joinCode) findHouse(S.joinCode);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  window.CW_DEBUG = { state: function () { return S.d; } };
})();
