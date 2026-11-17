// Caisse Manager · POS ⇄ KDS link.
// Kitchen tickets live in localStorage and every change is announced on a BroadcastChannel (the storage event is the
// fallback), so two tabs of one browser redraw as soon as the other one writes.
//
// When the app is served by the dev server (kds-relay.ts) the tickets are also kept on the server and pushed live
// (Server-Sent Events) to every other browser, tablet or screen that has the app open, so a ticket sent from the POS
// shows on the KDS at once, wherever each one runs. If the server has no relay (a static deploy) nothing changes: the
// link stays inside one browser.
//
// The same relay carries the two other things the screens share: the sold-out dishes (localStorage `cm-kds2-out`, a list of
// dish names, merged as additions and removals so two screens never overwrite each other) and the POS menu (`cm-pos-catalog`).
// The apps keep reading and writing those keys as before; this file passes the changes on and applies the ones that come in.
//
// A kitchen ticket is one send from the POS for one order and one course:
//   { id, kind: 'dine' | 'take' | 'glovo', no, ref, where, name, covers, course, by, at,
//     status: 'new' | 'cooking' | 'ready' | 'served', startedAt, readyAt, servedAt, rush,
//     items: [{ key, name, qty, mods: [[text, 'm-red' | 'm-green' | '']], station, done }] }
// `ref` names the POS order it belongs to (dT2, t3, g120…), `key` the POS ticket line, so statuses map back to lines.
// `_u` (set by this file) is the time of the last change: when two screens change the same ticket, the newest wins.
(() => {
  const KEY = 'cm-kds-v1', KEEP = 12 * 3600e3, API = '/api/kds';
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('cm-kds') : null;
  const subs = new Set(), statusSubs = new Set();
  const me = Math.random().toString(36).slice(2) + Date.now().toString(36);

  const rawLoad = () => {
    try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  };
  const load = () => rawLoad().filter(t => Date.now() - t.at < KEEP);
  const write = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
  const tell = (why, mine) => { const l = load(); subs.forEach(f => f(l, why, mine)); };
  const save = (list, why) => { write(list); chan?.postMessage(why); tell(why, true); };
  chan?.addEventListener('message', e => tell(e.data, false));
  if (!chan) addEventListener('storage', e => { if (e.key === KEY) tell('sync', false); });

  /* ---- the live relay ---- */
  let net = false, online = false, lastU = 0, curEpoch = '', seenRev = -1;
  const stamp = () => (lastU = Math.max(Date.now(), lastU + 1));
  const pending = new Map();   // id -> a ticket changed here that the server has not confirmed yet
  // every message from the server carries a revision: one we have already seen (a snapshot that was on its way while we changed things) is ignored
  const fresh = m => { if (m.epoch !== curEpoch) { curEpoch = m.epoch; seenRev = -1; } if (m.rev <= seenRev) return false; seenRev = m.rev; return true; };
  const setOnline = v => { if (v !== online) { online = v; statusSubs.forEach(f => f(online)); } };

  const send = (body, done) => {
    if (!net) return;
    const up = body.op === 'merge' ? body.list : [];
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: me, ...body }) })
      .then(r => { if (r.ok) { up.forEach(t => { if (pending.get(t.id) === t) pending.delete(t.id); }); if (done) done(); } })
      .catch(() => {});
  };

  /* ---- the sold-out dishes and the POS menu ---- */
  const OUT_KEY = 'cm-kds2-out', CAT_KEY = 'cm-pos-catalog';
  const nativeSet = Storage.prototype.setItem;
  let applying = false;
  const names = v => { try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : null; } catch (e) { return null; } };
  const outPend = { add: new Set(), rem: new Set() };   // sold-out changes made here that the server has not confirmed yet
  // a write to one of the shared keys on this screen goes to the others
  const shared = (k, old, v) => {
    if (!net) return;
    if (k === OUT_KEY) {
      const a = new Set(names(old) || []), b = new Set(names(v) || []);
      const add = [...b].filter(x => !a.has(x)), remove = [...a].filter(x => !b.has(x));
      if (!add.length && !remove.length) return;
      add.forEach(n => { outPend.add.add(n); outPend.rem.delete(n); }); remove.forEach(n => { outPend.rem.add(n); outPend.add.delete(n); });
      send({ op: 'out', why: 'out', add, remove }, () => { add.forEach(n => outPend.add.delete(n)); remove.forEach(n => outPend.rem.delete(n)); });
    } else if (old !== v) send({ op: 'catalog', why: 'catalog', value: v });
  };
  Storage.prototype.setItem = function (k, v) {
    let watch = false, old = null;
    try { watch = this === localStorage && (k === OUT_KEY || k === CAT_KEY); if (watch) old = this.getItem(k); } catch (e) {}
    nativeSet.call(this, k, v);
    if (watch && !applying) shared(k, old, String(v));
  };
  // a change from another screen: write it, and tell this page the way the browser would (the page listens for `storage`)
  const putLocal = (k, v) => {
    applying = true; try { nativeSet.call(localStorage, k, v); } catch (e) {} applying = false;
    try { dispatchEvent(new StorageEvent('storage', { key: k, newValue: v, storageArea: localStorage })); } catch (e) {}
  };
  const applyShared = m => {
    if (Array.isArray(m.out)) {
      const next = new Set(m.out); outPend.add.forEach(n => next.add(n)); outPend.rem.forEach(n => next.delete(n));
      const raw = localStorage.getItem(OUT_KEY), cur = new Set(names(raw) || []);
      if (raw === null || next.size !== cur.size || [...next].some(n => !cur.has(n))) putLocal(OUT_KEY, JSON.stringify([...next]));
    }
    if (typeof m.catalog === 'string' && localStorage.getItem(CAT_KEY) !== m.catalog) putLocal(CAT_KEY, m.catalog);
  };
  // the server's list becomes ours, except the changes of ours that are still on their way
  const adopt = (list, why) => {
    const next = list.map(t => { const p = pending.get(t.id); return p && (p._u || 0) > (t._u || 0) ? p : t; });
    pending.forEach((t, id) => { if (!next.some(x => x.id === id)) next.push(t); });
    if (JSON.stringify(next) === JSON.stringify(rawLoad())) return false;
    write(next); tell(why, false); return true;
  };
  // on connect (and on every reconnect): take the server's list, hand back what is newer here
  const resync = m => {
    const local = load(), onServer = new Map(m.list.map(t => [t.id, t]));
    const up = m.list.length ? local.filter(t => pending.has(t.id) || (onServer.has(t.id) && (t._u || 0) > (onServer.get(t.id)._u || 0))) : local;
    up.forEach(t => pending.set(t.id, t));
    if (m.list.length) adopt(m.list, 'sync');
    if (up.length) send({ op: 'merge', why: 'sync', list: up });
    // the shared settings: take the server's, or give it ours when it has none yet (a server that has just started)
    if (Array.isArray(m.out)) applyShared(m); else { const lo = names(localStorage.getItem(OUT_KEY)); if (lo && lo.length) send({ op: 'out', why: 'out', add: lo, remove: [] }); }
    if (typeof m.catalog === 'string') applyShared({ catalog: m.catalog }); else { const c = localStorage.getItem(CAT_KEY); if (c) send({ op: 'catalog', why: 'catalog', value: c }); }
  };
  const listen = () => {
    const es = new EventSource(API + '/events');
    es.addEventListener('open', () => setOnline(true));
    es.addEventListener('error', () => setOnline(false));
    es.addEventListener('snapshot', e => { setOnline(true); const m = JSON.parse(e.data); if (fresh(m)) resync(m); });
    es.addEventListener('state', e => { const m = JSON.parse(e.data); if (fresh(m)) { adopt(m.list, m.why); applyShared(m); } });   // our own changes come back too: that is how a screen ends up exactly like the server
  };
  // read the server's list before the app starts, so a screen that opens late already shows what the kitchen has
  try {
    const x = new XMLHttpRequest(); x.open('GET', API, false); x.send();
    const m = x.status === 200 ? JSON.parse(x.responseText) : null;
    if (m && Array.isArray(m.list)) { net = true; fresh(m); resync(m); }
  } catch (e) {}
  if (net && 'EventSource' in window) listen();
  setOnline(net ? false : 'BroadcastChannel' in window || false);

  // which kitchen station cooks a dish, from its menu category
  const STATION_OF = { burgers: 'grill', offers: 'grill', pizza: 'pizza', pasta: 'hot', salads: 'cold', dessert: 'cold', sides: 'fry', sauce: 'fry', drinks: 'bar' };
  const STATIONS = [['grill', 'Grill'], ['fry', 'Fry'], ['pizza', 'Pizza'], ['hot', 'Hot'], ['cold', 'Cold'], ['bar', 'Bar']];

  window.KDS = {
    STATIONS,
    stationOf: cat => STATION_OF[cat] || 'hot',
    load,
    // read, change, write back and announce, in one step
    edit(fn, why = 'sync') {
      const l = load(), before = new Map(l.map(t => [t.id, JSON.stringify(t)]));
      fn(l);
      const ids = new Set(l.map(t => t.id)), up = [], drop = [];
      l.forEach(t => { if (before.get(t.id) !== JSON.stringify(t)) { t._u = stamp(); up.push(t); } });
      before.forEach((_, id) => { if (!ids.has(id)) { drop.push(id); pending.delete(id); } });
      up.forEach(t => pending.set(t.id, t));
      save(l, why);
      if (up.length || drop.length) send({ op: 'merge', why, list: up, drop });
      return l;
    },
    replace(list, why = 'sync') {
      list.forEach(t => { t._u = stamp(); });
      pending.clear(); save(list, why); send({ op: 'replace', why, list });
    },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    send(t) { this.edit(l => l.push({ status: 'new', rush: false, ...t, at: t.at || Date.now() }), 'new'); },
    // is the live link up? (true when this screen is connected to the other screens through the server)
    online: () => online,
    onStatus(fn) { statusSubs.add(fn); return () => statusSubs.delete(fn); },
    // the kitchen's view of one POS line: null (never sent), 'new', 'cooking', 'ready' or 'served'
    lineState(list, key) {
      for (let i = list.length - 1; i >= 0; i--) {
        const t = list[i], it = t.items.find(x => x.key === key);
        if (!it) continue;
        if (t.status === 'served') return 'served';
        if (t.status === 'ready' || it.done) return 'ready';
        return t.status;
      }
      return null;
    },
    // the tickets of one POS order still in the kitchen
    ofOrder: (list, kind, no) => list.filter(t => t.kind === kind && t.no === no && t.status !== 'served'),
  };
})();
