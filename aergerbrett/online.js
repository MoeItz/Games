// Ärgerbrett: actions, online play (../shared/net.js) and boot. Loaded after the inline script in index.html.

// GIF search for the knock-out message. Get a free key at developers.giphy.com (an API key for a
// web SDK/API app) and paste it here. Without a key the message is text only.
const GIPHY_KEY = '';
const GIF_URL_OK = u => typeof u === 'string' && u.length < 500 && /^https:\/\/media[0-9]*\.giphy\.com\/[A-Za-z0-9_\/.?=&-]+$/.test(u);

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

$('die').addEventListener('click', () => { if (app.state && !app.state.rolled && canAct(app.state) && !rollLocked() && !paused(app.state)) doRollAction(); });

// Roll inside the popup, let the die tumble until the result is in, show it, then close.
function popRoll() {
  const s = app.state;
  if (app.popRolling || !s || s.rolled || !canAct(s) || rollLocked() || paused(s)) return;
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
  $('msg-text').textContent = t.text || '';
  $('msg-text').hidden = !t.text;
  const g = $('msg-gif');
  if (GIF_URL_OK(t.gif)) { g.src = t.gif; g.hidden = false; } else { g.removeAttribute('src'); g.hidden = true; }
  $('msg').hidden = false;
  $('msg-ok').focus();
}
$('msg-ok').addEventListener('click', () => { $('msg').hidden = true; render(); });
function resetTauntForm() { $('taunt-text').value = ''; pickGif(null); $('gif-q').value = ''; app.gifQuery = null; }
// Local game: end the pause right here. Online: the host ends it for everyone.
function finishTauntLocal() { const s = clone(app.state); endTaunt(s); app.state = s; render(); }
function sendTaunt() {
  const s = app.state, lc = s && s.lastCap;
  if (!lc || !paused(s)) return;
  const text = $('taunt-text').value.trim(), gif = app.gif || null;
  if (!text && !gif) { toast('Schreib erst etwas oder such ein GIF aus.'); return; }
  app.tauntDone = lc.id; resetTauntForm();
  if (app.mode === 'local') { showTaunt(s, { from: lc.from, to: lc.to, text, gif }); finishTauntLocal(); return; }
  render();
  send({ type: 'taunt', text, gif });
  toast('Nachricht an ' + nameOf(s, lc.to) + ' geschickt.');
}
function skipTaunt() {
  const s = app.state;
  if (!s || !s.lastCap) return;
  app.tauntDone = s.lastCap.id; resetTauntForm();
  if (app.mode === 'local') { finishTauntLocal(); return; }
  render();
  if (paused(s) && s.seats[s.lastCap.from] && s.seats[s.lastCap.from].uid === CID) send({ type: 'tauntSkip' });
}
// Called every second by the countdown once the 30 seconds are up.
window.tauntTimeUp = function () {
  const s = app.state;
  if (!paused(s)) return;
  if (app.tauntDone !== s.lastCap.id) { app.tauntDone = s.lastCap.id; resetTauntForm(); }
  if (app.mode === 'local') finishTauntLocal();
  else if (net.isHost && hostTauntOverdue()) { const n = clone(s); endTaunt(n); app.state = n; broadcast(); }
};
$('btn-taunt').addEventListener('click', sendTaunt);
$('taunt-text').addEventListener('keydown', e => { if (e.key === 'Enter') sendTaunt(); });
$('btn-taunt-skip').addEventListener('click', skipTaunt);

// --- GIF search (GIPHY) ---
function pickGif(url) {
  app.gif = url || null;
  $('gif-pick').hidden = !app.gif;
  if (app.gif) $('gif-pick-img').src = app.gif; else $('gif-pick-img').removeAttribute('src');
  document.querySelectorAll('#gif-grid button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.url === app.gif)));
}
$('gif-pick-x').addEventListener('click', () => pickGif(null));
let gifTimer = null, gifReq = 0;
async function loadGifs(q) {
  if (!GIPHY_KEY) return;
  const id = ++gifReq, grid = $('gif-grid');
  const url = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=18&rating=pg-13&lang=de&bundle=messaging_non_clips` + (q ? '&q=' + encodeURIComponent(q) : '');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = (await res.json()).data || [];
    if (id !== gifReq) return;
    grid.innerHTML = '';
    if (!data.length) { grid.innerHTML = '<p class="muted small" style="grid-column:1/-1;margin:0">Nichts gefunden. Probier ein anderes Wort.</p>'; return; }
    for (const g of data) {
      const big = g.images && g.images.fixed_height && g.images.fixed_height.url;
      const small = (g.images && (g.images.fixed_width_small || g.images.fixed_height_small) || {}).url || big;
      if (!GIF_URL_OK(big)) continue;
      const b = document.createElement('button'); b.type = 'button'; b.dataset.url = big;
      b.setAttribute('aria-pressed', String(big === app.gif)); b.setAttribute('aria-label', g.title || 'GIF');
      const img = document.createElement('img'); img.src = small; img.alt = ''; img.loading = 'lazy';
      b.appendChild(img);
      b.addEventListener('click', () => pickGif(app.gif === big ? null : big));
      grid.appendChild(b);
    }
  } catch {
    if (id === gifReq) grid.innerHTML = '<p class="muted small" style="grid-column:1/-1;margin:0">GIFs konnten nicht geladen werden.</p>';
  }
}
window.openGifSearch = function () {
  $('gif-box').hidden = !GIPHY_KEY;
  if (GIPHY_KEY && app.gifQuery == null) { app.gifQuery = ''; loadGifs(''); }
};
$('gif-q').addEventListener('input', e => {
  clearTimeout(gifTimer);
  const q = e.target.value.trim();
  gifTimer = setTimeout(() => { app.gifQuery = q; loadGifs(q); }, 350);
});
$('gif-q').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });

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

// ---------- Online (the host's browser keeps the game; ../shared/net.js carries the messages) ----------
const GAME = 'aergerbrett';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CID = (() => {
  let id = store.get('aerger-cid');
  if (!id) { id = 'c' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); store.set('aerger-cid', id); }
  return id;
})();
app.uid = CID;
app.onlineReady = GameNet.available();
const net = { link: null, isHost: false, status: 'off' };

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
  const txt = { connecting: 'Verbinde …', online: 'Verbunden.', reconnecting: 'Verbindung weg, verbinde neu …', nohost: 'Der Gastgeber antwortet nicht. Ist sein Tab noch offen?' }[net.status] || '';
  const extra = net.isHost && net.status === 'online' ? ' Du bist Gastgeber: lass diesen Tab offen, sonst ist das Spiel für alle weg.' : '';
  for (const id of ['conn-lobby', 'conn-game']) { $(id).textContent = txt + extra; $(id).hidden = !txt; }
}

function leaveOnline() {
  if (net.link) net.link.close();
  net.link = null; net.isHost = false;
  app.code = null; setStatus('off');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
function enterGameView() { setView(app.state.phase === 'lobby' ? 'lobby' : 'game'); render(); }

function send(action) {
  const msg = Object.assign({}, action, { cid: CID, name: myName() });
  if (net.isHost) { hostHandle(CID, msg); return; }
  if (!net.link || !net.link.send(msg)) toast('Keine Verbindung. Warte kurz.');
}

// --- Host ---
// The host ends the pause 30 s after it saw the knock-out (plus a second, so the capturer's
// own countdown runs out first).
function hostTauntOverdue() {
  const c = app.tauntClock;
  return !!(c && (performance.now() - c.at) / 1000 >= TAUNT_SECONDS + 1);
}
function hostSave() { if (app.code) store.set('aerger-host-' + app.code, JSON.stringify(app.state)); }
function sendState(cid) { if (net.link && cid !== CID) net.link.sendTo(cid, { type: 'state', state: app.state }); }
function broadcast() {
  hostSave();
  if (net.link) net.link.members.forEach(sendState);
  enterGameView();
}
function hostGame(code, saved) {
  leaveOnline();
  if (!GameNet.available()) { toast('Online-Spiel konnte nicht laden. Prüf deine Internetverbindung.'); return; }
  net.isHost = true; app.mode = 'online'; app.code = code; app.seenRollSeq = null; app.tauntDone = null;
  app.state = saved || { phase: 'lobby', code, seats: [{ name: myName(), uid: CID }, null, null, null] };
  history.replaceState(null, '', '#' + code);
  store.set('aerger-code', code);
  setStatus('connecting');
  net.link = GameNet.host({ game: GAME, code, onAction: hostHandle, onStatus: setStatus });
  hostSave(); enterGameView();
}

function hostHandle(cid, d) {
  if (!cid || !d || !app.state) return;
  let s = clone(app.state);
  const seatOf = s.seats.findIndex(x => x && x.uid === cid);
  const name = String(d.name || '').slice(0, 20) || 'Gast';
  switch (d.type) {
    case 'hello':
      sendState(cid);
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
      if (s.phase !== 'play' || s.rolled || seatOf !== s.turn || paused(s)) return;
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
      if (!lc || seatOf !== lc.from || !paused(s)) return;
      const t = { from: lc.from, to: lc.to, text: String(d.text || '').slice(0, 120), gif: GIF_URL_OK(d.gif) ? d.gif : null };
      if (!t.text && !t.gif) return;
      const victim = s.seats[lc.to] && s.seats[lc.to].uid;
      if (victim === CID) showTaunt(s, t);
      else if (victim && net.link) net.link.sendTo(victim, { type: 'taunt', t });
      endTaunt(s);
      break;
    }
    case 'tauntSkip':
      if (!s.lastCap || seatOf !== s.lastCap.from || !paused(s)) return;
      endTaunt(s);
      break;
    default: return;
  }
  app.state = s;
  broadcast();
}

// --- Friend joining a host ---
function joinGame(code) {
  leaveOnline();
  if (!GameNet.available()) { toast('Online-Spiel konnte nicht laden. Prüf deine Internetverbindung.'); return; }
  app.mode = 'online'; app.code = code; app.state = null; app.seenRollSeq = null; app.tauntDone = null;
  history.replaceState(null, '', '#' + code);
  $('lobby-code').textContent = code;
  $('invite-link').value = inviteLink(code);
  $('seats').innerHTML = '';
  setStatus('connecting'); setView('lobby'); renderBoard();
  net.link = GameNet.join({
    game: GAME, code, cid: CID,
    hello: () => ({ type: 'hello', cid: CID, name: myName() }),
    onMessage: d => {
      if (!d) return;
      // The host repeats the state as a keep-alive; only redraw when something changed.
      if (d.type === 'state' && JSON.stringify(d.state) !== JSON.stringify(app.state)) { store.set('aerger-code', code); app.state = d.state; enterGameView(); }
      if (d.type === 'taunt' && app.state) showTaunt(app.state, d.t);
    },
    onStatus: setStatus,
    onNotFound: () => { toast(`Kein Spiel ${code} gefunden. Stimmt der Code, und ist der Tab des Gastgebers offen?`); goHome(); },
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
  if (!GameNet.available()) onlineNote('Online-Spiel konnte nicht geladen werden. Prüf deine Internetverbindung. An einem Gerät könnt ihr trotzdem spielen.');
  render();
  const h = (location.hash || '').slice(1).toUpperCase();
  if (/^[A-Z]{4}$/.test(h)) openGame(h);
})();
