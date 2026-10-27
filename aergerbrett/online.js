// Ärgerbrett: actions, online play (PeerJS) and boot. Loaded after the inline script in index.html.

// ---------- Actions ----------
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 3600); }

// Local games change the state right here. Online games send an action to the host,
// who checks it, applies it and sends the new state to everyone.
function act(fn) {
  if (!canAct(app.state)) return;
  const s = clone(app.state); fn(s); app.state = s; render();
}
function doRollAction() { if (app.mode === 'local') act(doRoll); else send({ type: 'roll' }); }
function doMoveAction(mv) { if (app.mode === 'local') act(st => doMove(st, mv)); else send({ type: 'move', i: mv.i }); }

$('die').addEventListener('click', () => { if (app.state && !app.state.rolled && canAct(app.state)) doRollAction(); });

// Roll inside the popup, let the die tumble until the result is in, show it, then close.
function popRoll() {
  const s = app.state;
  if (app.popRolling || !s || s.rolled || !canAct(s)) return;
  app.popRolling = true;
  $('rollpop-btn').disabled = true;
  const seqBefore = s.rollSeq, d = $('rollpop-die'), started = Date.now();
  doRollAction();
  $('rollpop-title').textContent = 'Würfelt …';
  d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling');
  let t = 0;
  const timer = setInterval(() => {
    paintDie(1 + Math.floor(Math.random() * 6), d);
    const arrived = app.state && app.state.rollSeq !== seqBefore;
    if (++t <= 7 || (!arrived && Date.now() - started < 6000)) return;
    clearInterval(timer); d.classList.remove('rolling');
    if (arrived) { paintDie(app.state.dice, d); $('rollpop-title').textContent = `Eine ${app.state.dice}!`; }
    else $('rollpop-title').textContent = 'Keine Verbindung zum Gastgeber.';
    setTimeout(() => { app.popRolling = false; $('rollpop').hidden = true; render(); }, 1000);
  }, 65);
}
function popClose() {
  const s = app.state;
  if (s) app.rollPopDismissed = s.turn + ':' + s.rollSeq + ':' + s.tries;
  $('rollpop').hidden = true;
}
$('rollpop-btn').addEventListener('click', popRoll);
$('rollpop-die').addEventListener('click', popRoll);
$('rollpop-close').addEventListener('click', popClose);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('rollpop').hidden) popClose(); });

// Click the destination field instead of the peg
$('board').addEventListener('click', e => {
  const cell = e.target.closest('.cell');
  if (!cell || !app.dest) return;
  const mv = app.dest[cell.dataset.key];
  if (mv) doMoveAction(mv);
});

// Message to the player you just knocked out
function showTaunt(s, t) {
  $('msg').style.setProperty('--c', CVAR(t.from));
  $('msg-from').textContent = app.mode === 'local'
    ? `${nameOf(s, t.from)} an ${nameOf(s, t.to)}`
    : `Nachricht von ${nameOf(s, t.from)} (${COLORS[t.from]})`;
  $('msg-text').textContent = t.text;
  $('msg').hidden = false;
  $('msg-ok').focus();
}
$('msg-ok').addEventListener('click', () => { $('msg').hidden = true; render(); });
function sendTaunt() {
  const s = app.state, lc = s && s.lastCap;
  if (!lc) return;
  const text = $('taunt-text').value.trim();
  if (!text) { toast('Schreib erst etwas.'); return; }
  app.tauntDone = lc.id; $('taunt-text').value = ''; render();
  if (app.mode === 'local') { showTaunt(s, { from: lc.from, to: lc.to, text }); return; }
  send({ type: 'taunt', text });
  toast('Nachricht an ' + nameOf(s, lc.to) + ' geschickt.');
}
$('btn-taunt').addEventListener('click', sendTaunt);
$('taunt-text').addEventListener('keydown', e => { if (e.key === 'Enter') sendTaunt(); });
$('btn-taunt-skip').addEventListener('click', () => {
  if (app.state && app.state.lastCap) app.tauntDone = app.state.lastCap.id;
  $('taunt-text').value = ''; render();
});

// Local game
for (const n of [2,3,4]) $('cnt-' + n).addEventListener('click', () => { app.localCount = n; renderLocalNames(); });
$('btn-local').addEventListener('click', () => {
  const want = app.localCount === 2 ? [0, 2] : app.localCount === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  const seats = [0,1,2,3].map(p => want.includes(p) ? { name: ($('ln-' + p).value.trim() || COLORS[p]), uid: null } : null);
  leaveOnline();
  app.mode = 'local'; app.state = freshGame(seats); app.seenRollSeq = 0; app.tauntDone = null;
  setView('game'); render();
});
function goHome() { leaveOnline(); app.mode = null; app.state = null; setView('home'); render(); }
$('btn-leave').addEventListener('click', goHome);
$('btn-lobby-back').addEventListener('click', goHome);
$('btn-again').addEventListener('click', () => {
  const s = app.state;
  if (app.mode !== 'local') { send({ type: 'again' }); return; }
  const fresh = freshGame(s.seats, {}); fresh.rollSeq = s.rollSeq;
  app.state = fresh; render();
});

// ---------- Online (PeerJS: the host's browser keeps the game, friends connect to it) ----------
const PREFIX = 'aergerbrett-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CID = (() => {
  let id = store.get('aerger-cid');
  if (!id) { id = 'c' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); store.set('aerger-cid', id); }
  return id;
})();
app.uid = CID;
app.onlineReady = !!window.Peer;
const net = { peer: null, isHost: false, conns: [], hostConn: null, status: 'off', connected: false };

const nameInputs = ['my-name', 'lobby-name'];
nameInputs.forEach(id => $(id).addEventListener('input', e => {
  nameInputs.forEach(o => { if (o !== id) $(o).value = e.target.value; });
  store.set('aerger-name', e.target.value.trim());
}));
function myName() { return $('my-name').value.trim().slice(0, 20) || 'Gast'; }
function newCode() { return Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); }
function inviteLink(code) { return location.href.split('#')[0] + '#' + code; }
function onlineNote(msg) { const n = $('online-note'); n.textContent = msg; n.hidden = !msg; }

function setStatus(st) { net.status = st; renderConn(); }
function renderConn() {
  const txt = { connecting: 'Verbinde …', online: 'Verbunden.', reconnecting: 'Verbindung weg, verbinde neu …' }[net.status] || '';
  const extra = net.isHost && net.status === 'online' ? ' Du bist Gastgeber: lass diesen Tab offen, sonst ist das Spiel für alle weg.' : '';
  for (const id of ['conn-lobby', 'conn-game']) { $(id).textContent = txt + extra; $(id).hidden = !txt; }
}

function leaveOnline() {
  if (net.peer) { try { net.peer.destroy(); } catch {} }
  net.peer = null; net.conns = []; net.hostConn = null; net.isHost = false; net.connected = false;
  app.code = null; setStatus('off');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
function enterGameView() { setView(app.state.phase === 'lobby' ? 'lobby' : 'game'); render(); }

function send(action) {
  const msg = Object.assign({}, action, { cid: CID, name: myName() });
  if (net.isHost) { hostHandle(CID, msg, null); return; }
  if (net.hostConn && net.hostConn.open) net.hostConn.send(msg);
  else toast('Keine Verbindung zum Gastgeber. Warte kurz.');
}

// --- Host ---
function hostSave() { if (app.code) store.set('aerger-host-' + app.code, JSON.stringify(app.state)); }
function broadcast() {
  hostSave();
  net.conns.forEach(c => { if (c.open) c.send({ type: 'state', state: app.state }); });
  enterGameView();
}
function hostGame(code, saved) {
  leaveOnline();
  if (!window.Peer) { toast('Online-Spiel konnte nicht laden. Prüf deine Internetverbindung.'); return; }
  net.isHost = true; app.mode = 'online'; app.code = code; app.seenRollSeq = null; app.tauntDone = null;
  app.state = saved || { phase: 'lobby', code, seats: [{ name: myName(), uid: CID }, null, null, null] };
  history.replaceState(null, '', '#' + code);
  store.set('aerger-code', code);
  setStatus('connecting'); enterGameView();
  const peer = new Peer(PREFIX + code);
  net.peer = peer;
  peer.on('open', () => { if (net.peer === peer) { setStatus('online'); hostSave(); } });
  peer.on('connection', conn => {
    conn.on('open', () => { net.conns.push(conn); conn.send({ type: 'state', state: app.state }); });
    conn.on('data', d => hostHandle(d && d.cid, d, conn));
    conn.on('close', () => { net.conns = net.conns.filter(c => c !== conn); });
    conn.on('error', () => {});
  });
  peer.on('disconnected', () => {
    if (net.peer !== peer || peer.destroyed) return;
    setStatus('reconnecting');
    setTimeout(() => { if (net.peer === peer && peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch {} }, 2000);
  });
  peer.on('error', e => {
    if (net.peer !== peer) return;
    if (e.type === 'unavailable-id') {
      if (!saved) { hostGame(newCode(), null); return; } // code already used by someone else: pick another
      // Our own previous tab is still registered for a moment after a reload: try again shortly.
      setStatus('reconnecting');
      setTimeout(() => { if (net.peer === peer) hostGame(code, app.state); }, 3000);
      return;
    }
    if (e.type === 'peer-unavailable') return;
    setStatus('reconnecting');
  });
}

function hostHandle(cid, d, conn) {
  if (!cid || !d || !app.state) return;
  if (conn) conn.cid = cid;
  let s = clone(app.state);
  const seatOf = s.seats.findIndex(x => x && x.uid === cid);
  const name = String(d.name || '').slice(0, 20) || 'Gast';
  switch (d.type) {
    case 'hello':
      if (conn && conn.open) conn.send({ type: 'state', state: app.state });
      return;
    case 'claim':
      if (s.phase !== 'lobby' || !(d.seat >= 0 && d.seat <= 3)) return;
      if (s.seats[d.seat] && s.seats[d.seat].uid !== cid) return;
      s.seats = s.seats.map(x => x && x.uid === cid ? null : x);
      s.seats[d.seat] = { name, uid: cid };
      break;
    case 'leave':
      if (s.phase !== 'lobby') return;
      s.seats = s.seats.map(x => x && x.uid === cid ? null : x);
      break;
    case 'start':
      if (s.phase !== 'lobby' || seatOf < 0 || s.seats.filter(Boolean).length < 2) return;
      s = freshGame(s.seats, { code: s.code });
      break;
    case 'roll':
      if (s.phase !== 'play' || s.rolled || seatOf !== s.turn) return;
      doRoll(s);
      break;
    case 'move': {
      if (s.phase !== 'play' || !s.rolled || seatOf !== s.turn) return;
      const mv = legalMoves(s, s.turn, s.dice).find(m => m.i === d.i);
      if (!mv) return;
      doMove(s, mv);
      break;
    }
    case 'again': {
      if (s.phase !== 'done' || seatOf < 0) return;
      const seq = s.rollSeq;
      s = freshGame(s.seats, { code: s.code }); s.rollSeq = seq;
      break;
    }
    case 'taunt': {
      const lc = s.lastCap;
      if (!lc || seatOf !== lc.from) return;
      const t = { from: lc.from, to: lc.to, text: String(d.text || '').slice(0, 120) };
      const victim = s.seats[lc.to] && s.seats[lc.to].uid;
      if (victim === CID) showTaunt(s, t);
      net.conns.forEach(c => { if (c.cid === victim && c.open) c.send({ type: 'taunt', t }); });
      return;
    }
    default: return;
  }
  app.state = s;
  broadcast();
}

// --- Friend joining a host ---
function joinGame(code) {
  leaveOnline();
  if (!window.Peer) { toast('Online-Spiel konnte nicht laden. Prüf deine Internetverbindung.'); return; }
  app.mode = 'online'; app.code = code; app.state = null; app.seenRollSeq = null; app.tauntDone = null;
  history.replaceState(null, '', '#' + code);
  $('lobby-code').textContent = code;
  $('invite-link').value = inviteLink(code);
  $('seats').innerHTML = '';
  setStatus('connecting'); setView('lobby'); renderBoard();
  const peer = new Peer();
  net.peer = peer;
  let fails = 0, timer = null;
  const retry = ms => { clearTimeout(timer); timer = setTimeout(connect, ms); };
  function connect() {
    if (net.peer !== peer || peer.destroyed || peer.disconnected) return;
    if (net.hostConn && net.hostConn.open) return;
    const c = peer.connect(PREFIX + code, { reliable: true });
    c.on('open', () => {
      net.hostConn = c; net.connected = true; fails = 0; setStatus('online');
      c.send({ type: 'hello', cid: CID, name: myName() });
      store.set('aerger-code', code);
    });
    c.on('data', d => {
      if (!d || net.peer !== peer) return;
      if (d.type === 'state') { app.state = d.state; enterGameView(); }
      if (d.type === 'taunt' && app.state) showTaunt(app.state, d.t);
    });
    c.on('close', () => {
      if (net.peer !== peer || net.hostConn !== c) return;
      net.hostConn = null; setStatus('reconnecting'); retry(2000);
    });
    c.on('error', () => {});
  }
  peer.on('open', connect);
  peer.on('disconnected', () => { if (net.peer === peer && !peer.destroyed) { try { peer.reconnect(); } catch {} retry(2500); } });
  peer.on('error', e => {
    if (net.peer !== peer) return;
    if (e.type === 'peer-unavailable') {
      fails++;
      if (!net.connected && fails >= 4) {
        toast(`Kein Spiel ${code} gefunden. Ist der Gastgeber noch online?`);
        goHome(); return;
      }
      setStatus('reconnecting'); retry(2500); return;
    }
    setStatus('reconnecting'); retry(3000);
  });
}

function openGame(code) {
  const saved = store.get('aerger-host-' + code);
  if (saved) { try { hostGame(code, JSON.parse(saved)); return; } catch {} }
  joinGame(code);
}

$('btn-create').addEventListener('click', () => hostGame(newCode(), null));
$('btn-join').addEventListener('click', () => {
  const code = $('join-code').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { toast('Der Code hat 4 Buchstaben, z. B. ABCD.'); return; }
  openGame(code);
});
$('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
$('btn-resume').addEventListener('click', () => { const c = store.get('aerger-code'); if (c) openGame(c); });
$('btn-start').addEventListener('click', () => send({ type: 'start' }));
function claimSeat(p) { send({ type: 'claim', seat: p }); }
function leaveSeat() { send({ type: 'leave' }); }
$('btn-copy').addEventListener('click', async () => {
  const link = inviteLink(app.code);
  try { await navigator.clipboard.writeText(link); toast('Link kopiert. Jetzt an deine Freunde schicken!'); }
  catch { $('invite-link').select(); toast('Link markiert. Jetzt kopieren (Strg+C).'); }
});
if (navigator.share) {
  $('btn-share').hidden = false;
  $('btn-share').addEventListener('click', () => {
    navigator.share({ title: 'Ärgerbrett', text: 'Spiel mit mir Mensch ärgere dich nicht!', url: inviteLink(app.code) }).catch(() => {});
  });
}
window.addEventListener('hashchange', () => {
  const h = (location.hash || '').slice(1).toUpperCase();
  if (/^[A-Z]{4}$/.test(h) && h !== app.code) openGame(h);
});

// ---------- Boot ----------
(function start() {
  const n = store.get('aerger-name') || '';
  nameInputs.forEach(id => $(id).value = n);
  renderLocalNames();
  setView('home');
  if (!window.Peer) onlineNote('Online-Spiel konnte nicht geladen werden. Prüf deine Internetverbindung. An einem Gerät könnt ihr trotzdem spielen.');
  render();
  const h = (location.hash || '').slice(1).toUpperCase();
  if (/^[A-Z]{4}$/.test(h)) openGame(h);
})();
