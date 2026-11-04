/* Chore Wars icon set: one style for every icon.
   48px grid, 3px ink outline, flat fills from the brand palette, rounded joins.
   Avatars use a 64px grid. Single source for the app and for brand/icons.svg. */
(function (root) {
  var I = '#1A0E5C', Z = '#FFD12E', S = '#22D3EE', R = '#FF3B7F', G = '#6A3BFF', W = '#FFFFFF', P = '#E9E3FF';
  var st = 'stroke="' + I + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  function f(c) { return 'fill="' + c + '" ' + st; }
  var line = 'fill="none" ' + st;
  var hex = 'M24 3 L42 13 L42 35 L24 45 L6 35 L6 13 Z';
  function chev(y) { return '<path d="M15 ' + y + ' L24 ' + (y - 6) + ' L33 ' + y + '" fill="none" stroke="' + I + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'; }

  var ICONS = {
    /* chores */
    dishes: '<circle cx="24" cy="27" r="16" ' + f(W) + '/><circle cx="24" cy="27" r="9" ' + f(P) + '/><circle cx="36" cy="9" r="4" ' + f(S) + '/><circle cx="42" cy="17" r="2.5" ' + f(S) + '/>',
    trash: '<path d="M13 17 H35 L33 40 Q33 43 30 43 H18 Q15 43 15 40 Z" ' + f(S) + '/><rect x="10" y="11" width="28" height="6" rx="3" ' + f(G) + '/><path d="M20 11 V7 H28 V11" ' + line + '/><path d="M21 23 V36 M27 23 V36" ' + line + '/>',
    bed: '<path d="M9 36 V41 M39 36 V41" ' + line + '/><rect x="6" y="24" width="36" height="12" rx="3" ' + f(G) + '/><rect x="9" y="17" width="12" height="9" rx="3" ' + f(W) + '/><rect x="19" y="19" width="23" height="11" rx="3" ' + f(R) + '/>',
    laundry: '<path d="M17 8 L7 13 L10 22 L15 20 V40 H33 V20 L38 22 L41 13 L31 8 Q24 14 17 8 Z" ' + f(S) + '/><circle cx="24" cy="27" r="3" ' + f(Z) + '/>',
    vacuum: '<path d="M33 5 L23 28" ' + line + '/><rect x="13" y="25" width="20" height="11" rx="4" ' + f(R) + '/><rect x="7" y="35" width="28" height="7" rx="3.5" ' + f(G) + '/><circle cx="37" cy="39" r="4" ' + f(Z) + '/>',
    pet: '<ellipse cx="24" cy="32" rx="10" ry="9" ' + f(Z) + '/><circle cx="12" cy="21" r="4.5" ' + f(Z) + '/><circle cx="19.5" cy="12.5" r="4.5" ' + f(Z) + '/><circle cx="28.5" cy="12.5" r="4.5" ' + f(Z) + '/><circle cx="36" cy="21" r="4.5" ' + f(Z) + '/>',
    plant: '<path d="M24 26 C23 16 17 10 8 10 C8 19 15 25 24 26 Z" ' + f(S) + '/><path d="M24 26 C25 14 31 7 40 7 C40 17 33 25 24 26 Z" ' + f(S) + '/><path d="M15 29 H33 L30 43 H18 Z" ' + f(R) + '/><rect x="12" y="25" width="24" height="6" rx="2" ' + f(R) + '/>',
    toilet: '<rect x="11" y="5" width="18" height="13" rx="3" ' + f(W) + '/><path d="M8 21 H36 Q36 32 26 35 L28 43 H14 L16 35 Q8 31 8 21 Z" ' + f(W) + '/><rect x="6" y="18" width="32" height="5" rx="2.5" ' + f(S) + '/><path d="M40 8 L44 4 M42 13 H46" ' + line + '/>',
    broom: '<path d="M37 5 L24 25" ' + line + '/><path d="M15 23 L30 30 L24 43 Q13 43 8 36 Z" ' + f(Z) + '/><path d="M17 33 L13 40 M22 35 L19 42" ' + line + '/>',
    book: '<path d="M7 12 Q16 8 24 13 V41 Q16 36 7 40 Z" ' + f(S) + '/><path d="M24 13 Q32 8 41 12 V40 Q32 36 24 41 Z" ' + f(W) + '/>',
    car: '<path d="M8 30 L12 19 Q13 16 16 16 H32 Q35 16 36 19 L40 30 Z" ' + f(S) + '/><rect x="5" y="28" width="38" height="10" rx="4" ' + f(R) + '/><circle cx="14" cy="38" r="4" ' + f(G) + '/><circle cx="34" cy="38" r="4" ' + f(G) + '/>',
    spark: '<path d="M24 4 L29 19 L44 24 L29 29 L24 44 L19 29 L4 24 L19 19 Z" ' + f(Z) + '/>',
    /* game */
    pts: '<path d="M28 3 L11 26 H22 L18 45 L37 20 H26 L31 3 Z" ' + f(Z) + '/>',
    crown: '<path d="M7 35 L5 13 L16 23 L24 8 L32 23 L43 13 L41 35 Z" ' + f(Z) + '/><rect x="7" y="34" width="34" height="7" rx="2" ' + f(Z) + '/><circle cx="24" cy="27" r="3.5" ' + f(R) + '/>',
    flame: '<path d="M24 45 C14 45 9 38 9 31 C9 22 17 17 18 7 C24 11 27 16 26 22 C29 20 31 17 31 13 C36 18 39 25 39 31 C39 39 32 45 24 45 Z" ' + f(R) + '/><path d="M24 45 C19 45 17 41 17 38 C17 33 22 31 23 26 C27 30 31 33 31 38 C31 42 28 45 24 45 Z" ' + f(Z) + '/>',
    steal: '<path d="M9 7 H20 V25 A4 4 0 0 0 28 25 V7 H39 V25 A15 15 0 0 1 9 25 Z" ' + f(R) + '/><rect x="9" y="7" width="11" height="7" ' + f(W) + '/><rect x="28" y="7" width="11" height="7" ' + f(W) + '/><path d="M3 30 L6 32 M3 22 H6 M45 30 L42 32 M45 22 H42" ' + line + '/>',
    shield: '<path d="M24 4 L41 10 V22 C41 33 34 40 24 45 C14 40 7 33 7 22 V10 Z" ' + f(S) + '/><path d="M24 9 V40" stroke="' + W + '" stroke-width="3" opacity=".6"/><path d="M16 24 L22 30 L32 18" fill="none" stroke="' + I + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    double: '<circle cx="24" cy="24" r="19" ' + f(Z) + '/><path d="M12 18 Q12 13 17.5 13 Q23 13 23 18 Q23 22 17.5 27 L12 33 H24" fill="none" stroke="' + I + '" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 21 L36 31 M36 21 L28 31" fill="none" stroke="' + I + '" stroke-width="4.5" stroke-linecap="round"/>',
    bounty: '<circle cx="24" cy="24" r="19" ' + f(R) + '/><circle cx="24" cy="24" r="12" ' + f(W) + '/><circle cx="24" cy="24" r="5" ' + f(R) + '/><path d="M24 1 V9 M24 39 V47 M1 24 H9 M39 24 H47" ' + line + '/>',
    swap: '<path d="M5 13 H27 V6 L41 16 L27 26 V19 H5 Z" ' + f(S) + '/><path d="M43 29 H21 V22 L7 32 L21 42 V35 H43 Z" ' + f(R) + '/>',
    camera: '<path d="M16 14 L19 8 H29 L32 14 Z" ' + f(G) + '/><rect x="5" y="13" width="38" height="28" rx="6" ' + f(G) + '/><circle cx="24" cy="27" r="9" ' + f(S) + '/><circle cx="21" cy="24" r="3" fill="' + W + '"/><circle cx="37" cy="19" r="2" fill="' + Z + '"/>',
    check: '<circle cx="24" cy="24" r="19" ' + f(S) + '/><path d="M15 24 L21 31 L33 17" fill="none" stroke="' + I + '" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>',
    cross: '<circle cx="24" cy="24" r="19" ' + f(R) + '/><path d="M17 17 L31 31 M31 17 L17 31" fill="none" stroke="' + I + '" stroke-width="4.5" stroke-linecap="round"/>',
    ad: '<rect x="4" y="9" width="40" height="30" rx="8" ' + f(Z) + '/><path d="M20 17 L32 24 L20 31 Z" ' + f(W) + '/>',
    gift: '<rect x="8" y="21" width="32" height="21" rx="3" ' + f(R) + '/><rect x="6" y="14" width="36" height="8" rx="2" ' + f(R) + '/><rect x="21" y="14" width="6" height="28" ' + f(Z) + '/><path d="M24 14 C17 3 8 8 15 14 M24 14 C31 3 40 8 33 14" ' + line + '/>',
    trophy: '<path d="M14 10 H7 C7 19 11 21 15 21 M34 10 H41 C41 19 37 21 33 21" ' + line + '/><path d="M14 6 H34 V16 C34 24 30 28 24 28 C18 28 14 24 14 16 Z" ' + f(Z) + '/><rect x="21" y="28" width="6" height="6" ' + f(Z) + '/><rect x="13" y="34" width="22" height="8" rx="2" ' + f(G) + '/>',
    cards: '<rect x="6" y="11" width="20" height="28" rx="4" transform="rotate(-12 16 25)" ' + f(S) + '/><rect x="21" y="8" width="20" height="28" rx="4" transform="rotate(10 31 22)" ' + f(R) + '/><path d="M31 15 L33 20 L38 21 L34 24 L35 29 L31 26 L27 29 L28 24 L24 21 L29 20 Z" fill="' + Z + '" stroke="' + I + '" stroke-width="2" stroke-linejoin="round"/>',
    qr: '<rect x="5" y="5" width="15" height="15" rx="3" ' + f(W) + '/><rect x="28" y="5" width="15" height="15" rx="3" ' + f(W) + '/><rect x="5" y="28" width="15" height="15" rx="3" ' + f(W) + '/><rect x="10" y="10" width="5" height="5" fill="' + I + '"/><rect x="33" y="10" width="5" height="5" fill="' + I + '"/><rect x="10" y="33" width="5" height="5" fill="' + I + '"/><path d="M28 28 H34 V34 M40 28 V43 H28 V38" ' + line + '/>',
    plus: '<circle cx="24" cy="24" r="19" ' + f(Z) + '/><path d="M24 15 V33 M15 24 H33" fill="none" stroke="' + I + '" stroke-width="4.5" stroke-linecap="round"/>',
    sound: '<path d="M7 18 H15 L25 9 V39 L15 30 H7 Z" ' + f(S) + '/><path d="M31 17 Q36 24 31 31 M36 12 Q44 24 36 36" ' + line + '/>',
    mute: '<path d="M7 18 H15 L25 9 V39 L15 30 H7 Z" ' + f(P) + '/><path d="M32 18 L42 30 M42 18 L32 30" ' + line + '/>',
    vs: '<path d="M6 8 L42 40" stroke="' + I + '" stroke-width="9" stroke-linecap="round"/><path d="M42 8 L6 40" stroke="' + I + '" stroke-width="9" stroke-linecap="round"/><path d="M6 8 L42 40" stroke="' + S + '" stroke-width="4" stroke-linecap="round"/><path d="M42 8 L6 40" stroke="' + R + '" stroke-width="4" stroke-linecap="round"/>',
    lock: '<path d="M15 21 V15 A9 9 0 0 1 33 15 V21" ' + line + '/><rect x="9" y="20" width="30" height="23" rx="5" ' + f(G) + '/><circle cx="24" cy="31" r="3.5" fill="' + Z + '"/>',
    /* ranks */
    rank1: '<path d="' + hex + '" ' + f(S) + '/>' + chev(29),
    rank2: '<path d="' + hex + '" ' + f(R) + '/>' + chev(24) + chev(33),
    rank3: '<path d="' + hex + '" ' + f(Z) + '/>' + chev(21) + chev(29) + chev(37),
    rank4: '<path d="' + hex + '" ' + f(G) + '/><path d="M12 32 L11 17 L18 23 L24 13 L30 23 L37 17 L36 32 Z" ' + f(Z) + '/>'
  };

  function ears(c, d) { return '<path d="' + d + '" fill="' + c + '" ' + st + '/>'; }
  function face(c) { return '<ellipse cx="32" cy="37" rx="23" ry="21" fill="' + c + '" ' + st + '/>'; }
  function eyes(y, r) { r = r || 4.5; return '<circle cx="23" cy="' + y + '" r="' + r + '" fill="#fff" ' + st + '/><circle cx="41" cy="' + y + '" r="' + r + '" fill="#fff" ' + st + '/><circle cx="24" cy="' + (y + .5) + '" r="' + (r * .45) + '" fill="' + I + '"/><circle cx="42" cy="' + (y + .5) + '" r="' + (r * .45) + '" fill="' + I + '"/>'; }
  var grin = '<path d="M26 47 Q32 52 38 47" fill="none" ' + st + '/>';

  var AVATARS = {
    fox: { c: '#FF8A3D', svg: ears('#FF8A3D', 'M11 28 L13 5 L29 18 Z M53 28 L51 5 L35 18 Z') + face('#FF8A3D') + '<ellipse cx="32" cy="46" rx="12" ry="8" fill="#fff" ' + st + '/>' + eyes(34) + '<ellipse cx="32" cy="41" rx="3.5" ry="2.5" fill="' + I + '"/>' },
    wolf: { c: '#A3ACD9', svg: ears('#A3ACD9', 'M12 26 L11 2 L28 17 Z M52 26 L53 2 L36 17 Z') + face('#A3ACD9') + '<ellipse cx="32" cy="46" rx="11" ry="8" fill="#fff" ' + st + '/>' + eyes(35) + '<path d="M17 28 L28 31 M47 28 L36 31" fill="none" ' + st + '/><ellipse cx="32" cy="42" rx="3.5" ry="2.5" fill="' + I + '"/>' },
    owl: { c: '#8B5CF6', svg: ears('#8B5CF6', 'M13 24 L10 6 L25 16 Z M51 24 L54 6 L39 16 Z') + face('#8B5CF6') + eyes(34, 8) + '<path d="M28.5 42 H35.5 L32 49 Z" fill="' + Z + '" ' + st + '/>' },
    bear: { c: '#C07C4E', svg: '<circle cx="14" cy="19" r="8" fill="#C07C4E" ' + st + '/><circle cx="50" cy="19" r="8" fill="#C07C4E" ' + st + '/>' + face('#C07C4E') + '<ellipse cx="32" cy="46" rx="10" ry="8" fill="#F3D2B5" ' + st + '/>' + eyes(34) + '<ellipse cx="32" cy="42" rx="3.5" ry="2.5" fill="' + I + '"/>' },
    cat: { c: '#FF7BAC', svg: ears('#FF7BAC', 'M12 27 L14 9 L27 19 Z M52 27 L50 9 L37 19 Z') + face('#FF7BAC') + eyes(35) + '<path d="M30 42 H34 L32 44 Z" fill="' + I + '" ' + st + '/><path d="M8 40 L20 42 M8 46 L20 45 M56 40 L44 42 M56 46 L44 45" fill="none" ' + st + '/>' + grin },
    shark: { c: '#22D3EE', svg: ears('#22D3EE', 'M25 19 L35 2 L41 19 Z') + face('#22D3EE') + '<path d="M12 44 Q32 62 52 44 Q32 52 12 44 Z" fill="#fff" ' + st + '/>' + eyes(33) + '<path d="M21 46 L24 50 L27 47 L30 51 L33 47 L36 51 L39 47 L42 50 L44 46" fill="none" ' + st + '/>' },
    robot: { c: '#FFD12E', svg: '<path d="M32 15 V6" ' + line + '/><circle cx="32" cy="6" r="3.5" fill="' + R + '" ' + st + '/><rect x="9" y="15" width="46" height="40" rx="10" fill="' + Z + '" ' + st + '/><rect x="15" y="25" width="34" height="13" rx="6.5" fill="' + I + '"/><circle cx="24" cy="31.5" r="3" fill="' + S + '"/><circle cx="40" cy="31.5" r="3" fill="' + S + '"/><path d="M24 46 H40" ' + line + '/>' },
    dino: { c: '#FF9F1C', svg: ears('#FFD12E', 'M18 18 L22 8 L28 16 M30 15 L34 4 L38 15 M40 16 L46 8 L48 19') + face('#FF9F1C') + eyes(34) + '<path d="M22 46 Q32 54 42 46" fill="none" ' + st + '/><circle cx="27" cy="42" r="1.5" fill="' + I + '"/><circle cx="37" cy="42" r="1.5" fill="' + I + '"/>' }
  };

  function icon(name, size, cls) {
    var b = ICONS[name] || ICONS.spark;
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 48 48" width="' + (size || 32) + '" height="' + (size || 32) + '" aria-hidden="true">' + b + '</svg>';
  }
  function avatar(name, size) {
    var a = AVATARS[name] || AVATARS.fox;
    return '<svg class="av" viewBox="0 0 64 64" width="' + (size || 48) + '" height="' + (size || 48) + '" aria-hidden="true">' + a.svg + '</svg>';
  }
  var api = { ICONS: ICONS, AVATARS: AVATARS, icon: icon, avatar: avatar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CWIcons = api;
})(this);
