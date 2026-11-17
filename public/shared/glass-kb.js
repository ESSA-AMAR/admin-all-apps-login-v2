/* Glass keyboard — an on-screen keyboard in frosted glass, shared by POS v2 and KDS v2.
 *
 *   GlassKB.mount({ root, scale, lang, onKey, lift, storeKey, fixed })
 *
 *   root      element the keyboard is appended to (POS: the scaled #stage; KDS: document.body)
 *   scale()   CSS scale of root (POS: the stage scale; default 1) — used to measure fields in root pixels
 *   lang()    'en' | 'fr' | 'ar' — the layout the keyboard opens with (the user can still switch it)
 *   onKey()   called on every key press (sound)
 *   lift      selector of the sheets (dialogs, popovers) that slide up when the keyboard would cover their field
 *   storeKey  localStorage key that remembers the On/Off switch ('0' = off)
 *   fixed     true when root is the page itself (position: fixed instead of absolute)
 *
 * It appears when a text field gets focus (a click, a tap, or focus()) and goes away on Done, on the
 * chevron, or when focus leaves the field. A phone / number field gets a number pad instead.
 * Key presses go through execCommand('insertText'), so every page listener sees a normal input event.
 */
(function () {
  if (window.GlassKB) return;

  var CSS = '\
#gkb{--gk-ease:cubic-bezier(.2,.8,.2,1);position:absolute;left:50%;bottom:18px;z-index:95;direction:ltr;box-sizing:border-box;\
  padding:14px 22px 20px;border-radius:30px;color:#fff;font-family:inherit;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;\
  background:linear-gradient(150deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,.07) 42%,rgba(255,255,255,.13) 100%),rgba(18,19,24,.36);\
  -webkit-backdrop-filter:blur(34px) saturate(1.7);backdrop-filter:blur(34px) saturate(1.7);\
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6),inset 0 0 0 1px rgba(255,255,255,.22),inset 0 -22px 40px -26px rgba(255,255,255,.28),0 40px 90px -24px rgba(0,0,0,.7),0 12px 30px -12px rgba(0,0,0,.5);\
  opacity:0;visibility:hidden;pointer-events:none;transform:translate(-50%,44px) scale(.985);\
  transition:opacity .26s var(--gk-ease),transform .42s var(--gk-ease),visibility 0s linear .42s}\
#gkb.fx{position:fixed}\
#gkb.on{opacity:1;visibility:visible;pointer-events:auto;transform:translate(-50%,0) scale(1);transition-delay:0s}\
#gkb *{box-sizing:border-box}\
#gkb .gk-h{display:flex;align-items:center;gap:10px;height:40px;margin:0 2px 10px}\
#gkb .gk-lbl{flex:1;min-width:0;display:flex;align-items:center;gap:10px;font:500 17px/1 inherit;font-family:inherit;color:rgba(255,255,255,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#gkb .gk-lbl svg{flex:none;width:22px;height:22px;opacity:.8}\
#gkb .gk-lbl span{overflow:hidden;text-overflow:ellipsis}\
#gkb .gk-lang{display:flex;gap:4px;padding:3px;border-radius:12px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}\
#gkb .gk-lang button{all:unset;box-sizing:border-box;cursor:pointer;min-width:46px;height:32px;padding:0 8px;border-radius:9px;display:grid;place-items:center;font:600 15px/1 inherit;font-family:inherit;color:rgba(255,255,255,.75);transition:background .2s,color .2s}\
#gkb .gk-lang button.on{background:rgba(255,255,255,.34);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}\
#gkb .gk-x{all:unset;box-sizing:border-box;cursor:pointer;width:50px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);color:#fff}\
#gkb .gk-x svg{width:24px;height:24px}\
#gkb .gk-x:active{background:rgba(255,255,255,.3)}\
#gkb svg{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}\
#gkb .gk-rows{display:grid;gap:10px}\
#gkb .gk-r{display:grid;gap:10px;height:58px}\
#gkb .gk-r.dg{height:50px}\
#gkb .gk-sp{min-width:0}\
#gkb .gk-k{all:unset;box-sizing:border-box;cursor:pointer;position:relative;min-width:0;display:grid;place-items:center;border-radius:15px;\
  font:500 28px/1 inherit;font-family:inherit;color:#fff;\
  background:linear-gradient(150deg,rgba(255,255,255,.30) 0%,rgba(255,255,255,.10) 55%,rgba(255,255,255,.19) 100%);\
  box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 0 0 1px rgba(255,255,255,.17),0 8px 16px -10px rgba(0,0,0,.55);\
  transition:background .12s,transform .12s var(--gk-ease),box-shadow .12s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}\
#gkb .gk-r.dg .gk-k{font-size:24px;border-radius:13px}\
#gkb .gk-k.fn{font-size:19px;font-weight:600;background:linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.05) 60%,rgba(255,255,255,.1))}\
#gkb .gk-k.fn svg{width:28px;height:28px}\
#gkb .gk-k.sp-k{font-size:17px;font-weight:500;color:rgba(255,255,255,.7)}\
#gkb .gk-k.dn,#gkb .gk-k:active{background:linear-gradient(150deg,rgba(255,255,255,.62),rgba(255,255,255,.3) 60%,rgba(255,255,255,.4));transform:scale(.955);\
  box-shadow:inset 0 1px 0 rgba(255,255,255,.85),inset 0 0 0 1.5px rgba(255,255,255,.7),0 0 22px rgba(255,255,255,.28)}\
#gkb .gk-k.on{background:linear-gradient(150deg,rgba(255,255,255,.7),rgba(255,255,255,.4));color:#101114;box-shadow:inset 0 1px 0 #fff,0 0 20px rgba(255,255,255,.3)}\
#gkb .gk-k.on svg{fill:currentColor}\
#gkb .gk-k.lk::after{content:"";position:absolute;bottom:9px;left:50%;width:18px;height:3px;margin-left:-9px;border-radius:2px;background:currentColor}\
#gkb .gk-k.go{font-size:20px;font-weight:700;color:#fff;background:linear-gradient(150deg,#ff6a72 0%,#e02d3c 52%,#b91f2d 100%);\
  box-shadow:inset 0 1px 0 rgba(255,255,255,.65),inset 0 0 0 1px rgba(255,255,255,.28),0 10px 22px -8px rgba(224,45,60,.7)}\
#gkb .gk-k.go.dn,#gkb .gk-k.go:active{background:linear-gradient(150deg,#ff8a90,#f0414f 55%,#c8283a)}\
#gkb[data-shift="1"] .gk-k.cs,#gkb[data-shift="2"] .gk-k.cs{text-transform:uppercase}\
#gkb .gk-alt{position:absolute;z-index:3;display:flex;gap:6px;padding:8px;border-radius:20px;\
  background:linear-gradient(150deg,rgba(255,255,255,.4),rgba(255,255,255,.16)),rgba(22,23,28,.62);\
  -webkit-backdrop-filter:blur(30px) saturate(1.7);backdrop-filter:blur(30px) saturate(1.7);\
  box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 0 0 1px rgba(255,255,255,.3),0 24px 44px -14px rgba(0,0,0,.65);animation:gk-pop .18s var(--gk-ease)}\
#gkb .gk-alt button{all:unset;box-sizing:border-box;cursor:pointer;width:62px;height:64px;border-radius:13px;display:grid;place-items:center;font:500 30px/1 inherit;font-family:inherit;color:#fff;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}\
#gkb .gk-alt button:active{background:rgba(255,255,255,.5)}\
@keyframes gk-pop{from{opacity:0;transform:translateY(10px) scale(.96)}}\
#gkb[lang="ar"] .gk-k.cs{font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;font-size:30px}\
';
  // "font: 500 28px/1 inherit" is not valid CSS (inherit cannot sit inside the shorthand): split it
  CSS = CSS.replace(/font:(\d+) (\d+px)\/1 inherit;/g, 'font-weight:$1;font-size:$2;line-height:1;');

  var IC = {
    bs: '<svg viewBox="0 0 24 24"><path d="M20.5 5.5H9.2L3.5 12l5.7 6.5h11.3a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1z"/><path d="m15.8 9.6-4.4 4.8m0-4.8 4.4 4.8"/></svg>',
    shift: '<svg viewBox="0 0 24 24"><path d="M12 4.5 4.5 12.8h4.3v6h6.4v-6h4.3L12 4.5z"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m6 9.5 6 6 6-6"/></svg>',
    kb: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9"/></svg>'
  };

  // letter rows per language; cols = grid columns (each normal key spans 2)
  var LET = {
    en: { cols: 20, r1: 'qwertyuiop'.split(''), r2: 'asdfghjkl'.split(''), r3: 'zxcvbnm'.split(''), comma: ',', w: 1120 },
    fr: { cols: 20, r1: 'azertyuiop'.split(''), r2: 'qsdfghjklm'.split(''), r3: "wxcvbn'".split(''), comma: ',', w: 1120 },
    ar: { cols: 24, r1: 'ضصثقفغعهخحجد'.split(''), r2: 'شسيبلاتنمكط'.split(''), r3: ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ'], comma: '،', w: 1200 }
  };
  var SYM = {
    s1: '@#$%&*-+()'.split(''),
    s2: '/:;!?"\'=_'.split(''),
    acc: ['é', 'è', 'à', 'ç', 'ù', 'ê', 'ô'],
    arp: ['،', '؛', '؟', '!', '.', ',', '-']
  };
  var ALT = {
    a: 'àâäæ', e: 'éèêë', i: 'îï', o: 'ôœö', u: 'ùûü', c: 'ç', n: 'ñ', y: 'ÿ', "'": '’‘`',
    'ا': 'أإآ', 'ه': 'ة', 'ي': 'ئى', 'و': 'ؤ', ',': ';:', '.': '…?!'
  };
  var TXT = {
    en: { done: 'Done', sym: '123', abc: 'ABC', space: 'English' },
    fr: { done: 'OK', sym: '123', abc: 'ABC', space: 'Français' },
    ar: { done: 'تم', sym: '123', abc: 'أبج', space: 'العربية' }
  };

  function mount(o) {
    o = o || {};
    var root = o.root || document.body;
    var scale = o.scale || function () { return 1; };
    var appLang = o.lang || function () { return 'en'; };
    var store = o.storeKey || 'cm-glass-kb';
    var liftSel = o.lift || '';

    var st = document.createElement('style'); st.id = 'gkb-css'; st.textContent = CSS; document.head.appendChild(st);
    var kb = document.createElement('div');
    kb.id = 'gkb'; kb.setAttribute('role', 'application'); kb.setAttribute('aria-label', 'On-screen keyboard'); kb.setAttribute('aria-hidden', 'true');
    if (o.fixed) kb.className = 'fx';
    root.appendChild(kb);

    var enabled = true;
    try { enabled = localStorage.getItem(store) !== '0'; } catch (e) {}

    var field = null, kind = 'alpha', lang = 'en', lastApp = null, page = 'abc', shift = 0, lastShift = 0;
    var watch = 0, hideT = 0, alt = null, lifted = null, liftDy = 0, liftAnim = null;

    /* ---------- which fields get the keyboard ---------- */
    var NOT = /^(checkbox|radio|button|submit|reset|range|color|file|hidden|image|date|time|datetime-local|month|week)$/i;
    function isField(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.matches('textarea')) return !el.readOnly && !el.disabled;
      return el.matches('input') && !NOT.test(el.type) && !el.readOnly && !el.disabled;
    }
    function isNum(el) {
      var im = (el.dataset.gkIm !== undefined ? el.dataset.gkIm : el.getAttribute('inputmode')) || '';
      return /^(tel|numeric|decimal)$/i.test(im) || /^(tel|number)$/i.test(el.type) || el.dataset.kb === 'num';
    }

    /* ---------- build ---------- */
    function K(ch, span, cls) { return { ch: ch, span: span || 2, cls: cls || '' }; }
    function F(act, label, span, cls) { return { act: act, label: label, span: span, cls: cls || '' }; }
    function S(span) { return { sp: span }; }

    function rowsFor() {
      var T = TXT[lang], L = LET[lang], C = L.cols, i, out = [];
      var digits = '1234567890'.split('').map(function (d) { return K(d, 2, 'dg'); });
      var gap = (C - 20) / 2;
      var dRow = (gap ? [S(gap)] : []).concat(digits, gap ? [S(gap)] : []);
      var bsLet = lang === 'ar' ? 2 : 3, bsSym = C === 24 ? 4 : 3;
      var bs = F('bs', IC.bs, bsLet, 'fn'), bsS = F('bs', IC.bs, bsSym, 'fn');
      var last = [F('page', page === 'abc' ? T.sym : T.abc, C === 24 ? 4 : 3, 'fn'), K(L.comma, 2, 'pn'), F('space', T.space, C === 24 ? 12 : 10, 'sp-k'), K('.', 2, 'pn'), F('done', T.done, C === 24 ? 4 : 3, 'go')];
      var rows = [{ dg: 1, c: dRow }];
      if (page === 'abc') {
        var cs = function (a) { return a.map(function (c) { return K(c, 2, 'cs'); }); };
        rows.push({ c: cs(L.r1) });
        rows.push({ c: (L.r2.length * 2 < C ? [S((C - L.r2.length * 2) / 2)] : []).concat(cs(L.r2), L.r2.length * 2 < C ? [S((C - L.r2.length * 2) / 2)] : []) });
        rows.push({ c: (lang === 'ar' ? [] : [F('shift', IC.shift, 3, 'fn')]).concat(cs(L.r3), [bs]) });
      } else {
        var k = function (a) { return a.map(function (c) { return K(c, 2); }); };
        var pad = function (a) { var n = (C - a.length * 2) / 2; return (n ? [S(n)] : []).concat(k(a), n ? [S(n)] : []); };
        rows.push({ c: pad(SYM.s1) });
        rows.push({ c: pad(SYM.s2) });
        var s3 = lang === 'ar' ? SYM.arp : SYM.acc;
        rows.push({ c: [S(C - s3.length * 2 - bsSym)].concat(k(s3), [bsS]) });
      }
      rows.push({ c: last });
      return { rows: rows, cols: C, w: L.w };
    }
    function numRows() {
      var T = TXT[lang];
      var k = function (d) { return K(d, 2, 'dg'); };
      return { cols: 8, w: 520, rows: [
        { c: [k('1'), k('2'), k('3'), F('bs', IC.bs, 2, 'fn')] },
        { c: [k('4'), k('5'), k('6'), F('space', '␣', 2, 'fn')] },
        { c: [k('7'), k('8'), k('9'), K('+', 2, 'fn')] },
        { c: [K('0', 4, 'dg'), F('done', T.done, 4, 'go')] }
      ] };
    }

    function label(el) {
      var t = el.getAttribute('aria-label') || '';
      if (!t) { var sp = el.closest('label'); sp = sp && sp.querySelector('span'); t = sp ? sp.textContent.trim() : ''; }
      return t || el.getAttribute('placeholder') || '';
    }

    function render() {
      var data = kind === 'num' ? numRows() : rowsFor();
      kb.style.width = data.w + 'px';
      kb.setAttribute('lang', kind === 'num' ? 'en' : lang);
      var html = '<div class="gk-h"><div class="gk-lbl">' + IC.kb + '<span>' + esc(field ? label(field) : '') + '</span></div>';
      if (kind !== 'num') {
        html += '<div class="gk-lang" role="radiogroup" aria-label="Keyboard language">' +
          [['en', 'EN'], ['fr', 'FR'], ['ar', 'ع']].map(function (p) { return '<button type="button" role="radio" data-lang="' + p[0] + '" aria-checked="' + (p[0] === lang) + '" class="' + (p[0] === lang ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div>';
      }
      html += '<button type="button" class="gk-x" data-act="hide" aria-label="Hide keyboard">' + IC.down + '</button></div><div class="gk-rows">';
      data.rows.forEach(function (r) {
        html += '<div class="gk-r' + (r.dg ? ' dg' : '') + '" style="grid-template-columns:repeat(' + data.cols + ',minmax(0,1fr))">';
        r.c.forEach(function (c) {
          if (c.sp !== undefined) { html += '<i class="gk-sp" style="grid-column:span ' + c.sp + '"></i>'; return; }
          if (c.act) html += '<button type="button" class="gk-k ' + c.cls + '" data-act="' + c.act + '" style="grid-column:span ' + c.span + '" tabindex="-1"' + (c.act === 'bs' ? ' aria-label="Backspace"' : c.act === 'shift' ? ' aria-label="Shift"' : '') + '>' + c.label + '</button>';
          else html += '<button type="button" class="gk-k ' + c.cls + '" data-ch="' + esc(c.ch) + '"' + (ALT[c.ch] ? ' data-alt="1"' : '') + ' style="grid-column:span ' + c.span + '" tabindex="-1">' + esc(c.ch) + '</button>';
        });
        html += '</div>';
      });
      kb.innerHTML = html + '</div>';
      paintShift();
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function paintShift() {
      kb.dataset.shift = String(shift);
      var b = kb.querySelector('[data-act="shift"]');
      if (b) { b.classList.toggle('on', shift > 0); b.classList.toggle('lk', shift === 2); b.setAttribute('aria-pressed', shift > 0); }
    }

    /* ---------- typing ---------- */
    function put(s) {
      var f = field; if (!f) return;
      if (document.activeElement !== f) f.focus({ preventScroll: true });
      var done = false;
      try { done = document.execCommand('insertText', false, s); } catch (e) {}
      if (!done) {
        var a = f.selectionStart, b = f.selectionEnd;
        if (a == null) { a = b = f.value.length; }
        if (f.maxLength > 0 && f.value.length - (b - a) + s.length > f.maxLength) return;
        f.setRangeText(s, a, b, 'end');
        f.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: s }));
      }
    }
    function back() {
      var f = field; if (!f) return;
      if (document.activeElement !== f) f.focus({ preventScroll: true });
      var done = false;
      try { done = document.execCommand('delete'); } catch (e) {}
      if (!done) {
        var a = f.selectionStart, b = f.selectionEnd;
        if (a == null) { a = b = f.value.length; }
        if (a === b) { if (!a) return; a -= 1; }
        f.setRangeText('', a, b, 'end');
        f.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      }
    }
    function typeKey(ch, isCs) {
      var up = isCs && shift > 0;
      put(up ? ch.toUpperCase() : ch);
      if (shift === 1 && isCs) { shift = 0; paintShift(); }
    }
    function autoShift() {
      if (!field || kind === 'num') return;
      var id = field.id || '', v = field.value || '';
      if (/code/i.test(id) || field.dataset.kbCaps === 'lock') { shift = 2; }
      else if (field.type === 'search' || /search|^(olQ|clQ|cpQ|oSearch|avq)$/i.test(id)) { shift = 0; }
      else if (field.dataset.kbCaps === 'off') { shift = 0; }
      else if (field.matches('textarea') || /name|note/i.test(id) || field.dataset.kbCaps === 'on') { shift = (!v.trim() || /[.!?]\s*$/.test(v)) ? 1 : 0; }
      else shift = 0;
      paintShift();
    }

    /* ---------- long-press accents ---------- */
    function closeAlt() { if (alt) { alt.remove(); alt = null; } }
    function openAlt(btn) {
      closeAlt();
      var ch = btn.dataset.ch, list = (ALT[ch] || '').split('');
      if (!list.length) return false;
      var cs = btn.classList.contains('cs'), up = cs && shift > 0;
      var sc = scale() || 1, kr = btn.getBoundingClientRect(), pr = kb.getBoundingClientRect();
      alt = document.createElement('div'); alt.className = 'gk-alt';
      alt.innerHTML = list.map(function (c) { var v = up ? c.toUpperCase() : c; return '<button type="button" tabindex="-1" data-alt="' + esc(v) + '">' + esc(v) + '</button>'; }).join('');
      kb.appendChild(alt);
      var w = list.length * 62 + (list.length - 1) * 6 + 16, x = (kr.left - pr.left) / sc + kr.width / sc / 2 - w / 2;
      x = Math.max(8, Math.min(kb.offsetWidth - w - 8, x));
      alt.style.left = x + 'px'; alt.style.top = ((kr.top - pr.top) / sc - 82) + 'px';
      return true;
    }

    /* ---------- show / hide ---------- */
    function show(f) {
      if (!enabled) return;
      clearTimeout(hideT);
      // a page that rebuilds its field on every keystroke (KDS search) hands over a new element with the same id: same field
      var changed = !(f === field || (field && f.id && f.id === field.id && kb.classList.contains('on')));
      field = f;
      var k = isNum(f) ? 'num' : 'alpha';
      var al = appLang();
      if (al !== lastApp) { lastApp = al; lang = LET[al] ? al : 'en'; }
      if (changed && lang === 'ar' && (/code/i.test(f.id) || f.dataset.kbLang === 'en')) lang = 'en';   // order codes are Latin
      if (changed || k !== kind || !kb.firstChild) { kind = k; page = 'abc'; render(); if (changed) autoShift(); }
      else { var l = kb.querySelector('.gk-lbl span'); if (l) l.textContent = label(f); }
      kb.classList.add('on'); kb.setAttribute('aria-hidden', 'false');
      clearInterval(watch); watch = setInterval(check, 250);
      requestAnimationFrame(function () { liftSheet(); });
    }
    function hide() {
      clearTimeout(hideT); clearInterval(watch); watch = 0;
      closeAlt();
      if (!kb.classList.contains('on')) return;
      kb.classList.remove('on'); kb.setAttribute('aria-hidden', 'true');
      unlift(); field = null;
    }
    function check() {
      if (!field) return hide();
      if (!field.isConnected || field.getClientRects().length === 0) return hide();
      if (document.activeElement !== field && !kb.contains(document.activeElement)) hide();
    }

    /* ---------- lift the field's sheet clear of the keyboard ---------- */
    function liftSheet() {
      if (!field || !kb.classList.contains('on')) return;
      var sheet = liftSel ? field.closest(liftSel) : null;
      if (!sheet) { unlift(); return; }
      var sc = scale() || 1, R = root.getBoundingClientRect();
      var cur = (sheet === lifted) ? liftDy : 0;
      var fr = field.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
      var fBottom = (fr.bottom - R.top) / sc + cur, sTop = (sr.top - R.top) / sc + cur, sBottom = (sr.bottom - R.top) / sc + cur;
      var rootH = root === document.body ? innerHeight : root.offsetHeight;
      var kbTop = rootH - kb.offsetHeight - 18;
      // lift the whole sheet clear of the keyboard when it fits (buttons stay reachable), else at least the field
      var need = Math.max(sBottom + 18 - kbTop, fBottom + 26 - kbTop);
      var dy = need > 0 ? Math.min(need, Math.max(0, sTop - 14)) : 0;
      if (lifted && lifted !== sheet) unlift();
      if (Math.abs(dy - cur) < 1) { lifted = dy ? sheet : null; liftDy = dy; return; }
      if (liftAnim) liftAnim.cancel();
      liftAnim = sheet.animate([{ translate: '0 ' + (-cur) + 'px' }, { translate: '0 ' + (-dy) + 'px' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      lifted = sheet; liftDy = dy;
    }
    function unlift() {
      if (!lifted) return;
      var s = lifted, cur = liftDy;
      if (liftAnim) liftAnim.cancel();
      liftAnim = null; lifted = null; liftDy = 0;
      if (cur && s.isConnected) s.animate([{ translate: '0 ' + (-cur) + 'px' }, { translate: '0 0' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }

    /* ---------- events ---------- */
    // keep the native keyboard away (tablets) while ours is on
    function claim(el) {
      if (!enabled || !isField(el) || el.dataset.gkIm !== undefined) return;
      el.dataset.gkIm = el.getAttribute('inputmode') || '';
      el.setAttribute('inputmode', 'none');
    }
    function release() {
      document.querySelectorAll('[data-gk-im]').forEach(function (el) {
        var v = el.dataset.gkIm; delete el.dataset.gkIm;
        if (v) el.setAttribute('inputmode', v); else el.removeAttribute('inputmode');
      });
    }
    document.addEventListener('pointerdown', function (e) { claim(e.target); }, true);
    document.addEventListener('touchstart', function (e) { claim(e.target); }, { capture: true, passive: true });
    document.addEventListener('focusin', function (e) {
      if (kb.contains(e.target)) return;
      if (isField(e.target)) { claim(e.target); show(e.target); }
    }, true);
    document.addEventListener('focusout', function (e) {
      if (!isField(e.target)) return;
      clearTimeout(hideT);
      hideT = setTimeout(function () {
        var a = document.activeElement;
        if (isField(a) || kb.contains(a)) return;
        hide();
      }, 90);
    }, true);
    addEventListener('resize', function () { requestAnimationFrame(liftSheet); });

    // the keys never take focus from the field
    kb.addEventListener('mousedown', function (e) { e.preventDefault(); });
    var rep = 0, repT = 0, longT = 0, longFired = false, downKey = null;
    function stopRep() { clearTimeout(repT); clearInterval(rep); clearTimeout(longT); }
    kb.addEventListener('pointerdown', function (e) {
      var altB = e.target.closest('.gk-alt button');
      if (altB) { e.preventDefault(); if (o.onKey) o.onKey(); typeKey(altB.dataset.alt, false); if (shift === 1) { shift = 0; paintShift(); } closeAlt(); return; }
      var b = e.target.closest('.gk-k'), g = e.target.closest('.gk-lang button'), x = e.target.closest('.gk-x');
      if (alt) closeAlt();
      if (g) { e.preventDefault(); lang = g.dataset.lang; lastApp = appLang(); render(); requestAnimationFrame(liftSheet); return; }
      if (x) { e.preventDefault(); if (o.onKey) o.onKey(); var f = field; hide(); if (f && document.activeElement === f) f.blur(); return; }
      if (!b) return;
      e.preventDefault();
      if (o.onKey) o.onKey();
      b.classList.add('dn'); downKey = b; longFired = false;
      var act = b.dataset.act;
      if (act === 'bs') { back(); repT = setTimeout(function () { rep = setInterval(back, 55); }, 380); return; }
      if (act) return;                                  // other function keys fire on release
      if (b.dataset.alt) { longT = setTimeout(function () { longFired = openAlt(b); }, 420); return; }   // accents: on release
      typeKey(b.dataset.ch, b.classList.contains('cs'));
    });
    function up(e) {
      stopRep();
      if (!downKey) return;
      var b = downKey; downKey = null; b.classList.remove('dn');
      if (e.type === 'pointercancel') return;
      var over = document.elementFromPoint(e.clientX, e.clientY);
      var hit = over && (over === b || b.contains(over));
      var act = b.dataset.act;
      if (act && act !== 'bs' && hit) {
        if (act === 'shift') {
          var now = Date.now();
          if (shift === 2) shift = 0; else if (shift === 1 && now - lastShift < 340) shift = 2; else shift = shift ? 0 : 1;
          lastShift = now; paintShift();
        }
        else if (act === 'space') { put(' '); if (shift === 1) { shift = 0; paintShift(); } }
        else if (act === 'page') { page = page === 'abc' ? 'sym' : 'abc'; render(); requestAnimationFrame(liftSheet); }
        else if (act === 'done') { var f = field; hide(); if (f && document.activeElement === f) f.blur(); }
      } else if (b.dataset.alt && !longFired && hit) typeKey(b.dataset.ch, b.classList.contains('cs'));
    }
    kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up);
    kb.addEventListener('pointerleave', function (e) { if (downKey && !(e.buttons)) up(e); });
    kb.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // lifting a finger anywhere ends a held key
    addEventListener('pointerup', function () { stopRep(); if (downKey) { downKey.classList.remove('dn'); downKey = null; } });

    // Escape closes just the keyboard when it is the only thing open on top
    return {
      show: show, hide: hide,
      isEnabled: function () { return enabled; },
      setEnabled: function (v) {
        enabled = !!v;
        try { localStorage.setItem(store, enabled ? '1' : '0'); } catch (e) {}
        if (!enabled) { hide(); release(); }
        else if (isField(document.activeElement)) { claim(document.activeElement); show(document.activeElement); }
      },
      el: kb
    };
  }

  window.GlassKB = { mount: mount };
})();
