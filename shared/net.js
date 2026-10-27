// Online play for the games. The host's browser keeps the game; public MQTT brokers pass the
// messages between the host and the friends over secure WebSockets, so it works across networks
// (no direct device-to-device connection needed). Needs mqtt.js loaded first (global `mqtt`).
const GameNet = (() => {
  const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
  const available = () => !!window.mqtt;
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const baseOf = (game, code) => `moeitz-games/v1/${game}/${code}/`;

  // Talks to every broker at once: a message goes out through all of them and is deduplicated on arrival,
  // so one broker being down or blocked does not matter.
  function bus(base, onChange) {
    const subs = {}, seen = new Set(), order = [];
    const clients = BROKERS.map(url => {
      const c = mqtt.connect(url, { clientId: 'mg_' + rid(), clean: true, reconnectPeriod: 3000, connectTimeout: 10000, keepalive: 30 });
      c.on('connect', () => { Object.keys(subs).forEach(s => c.subscribe(base + s)); onChange(); });
      c.on('close', () => onChange());
      c.on('error', () => {});
      c.on('message', (topic, payload) => {
        let m;
        try { m = JSON.parse(payload.toString()); } catch { return; }
        if (!m || !m.mid || seen.has(m.mid)) return;
        seen.add(m.mid); order.push(m.mid);
        if (order.length > 400) seen.delete(order.shift());
        const fn = subs[topic.slice(base.length)];
        if (fn) fn(m.data);
      });
      return c;
    });
    return {
      sub(s, fn) { subs[s] = fn; clients.forEach(c => { if (c.connected) c.subscribe(base + s); }); },
      pub(s, data) {
        const msg = JSON.stringify({ mid: rid(), data });
        let ok = false;
        clients.forEach(c => { if (c.connected) { c.publish(base + s, msg); ok = true; } });
        return ok;
      },
      up: () => clients.some(c => c.connected),
      close() { clients.forEach(c => { try { c.end(true); } catch {} }); },
    };
  }

  // Host: hears every friend's actions on one topic and answers each friend on their own topic.
  function host({ game, code, onAction, onStatus }) {
    const members = new Set();
    let closed = false;
    const b = bus(baseOf(game, code), () => { if (!closed) onStatus(b.up() ? 'online' : 'reconnecting'); });
    b.sub('host', msg => {
      if (closed || !msg || typeof msg.cid !== 'string') return;
      members.add(msg.cid);
      onAction(msg.cid, msg);
    });
    return {
      members,
      sendTo(cid, data) { b.pub('c/' + cid, data); },
      close() { closed = true; b.close(); },
    };
  }

  // Friend: says hello every few seconds. The host answers with the current game, which also
  // shows that the host is still there. No answer at all after ~15 s means there is no such game.
  function join({ game, code, cid, hello, onMessage, onStatus, onNotFound }) {
    let closed = false, heard = false, lastHeard = 0, unanswered = 0;
    const update = () => {
      if (closed) return;
      if (!b.up()) onStatus('reconnecting');
      else if (!heard) onStatus('connecting');
      else onStatus(Date.now() - lastHeard < 20000 ? 'online' : 'nohost');
    };
    const b = bus(baseOf(game, code), () => { if (closed) return; if (b.up()) b.pub('host', hello()); update(); });
    b.sub('c/' + cid, data => { if (closed) return; heard = true; lastHeard = Date.now(); update(); onMessage(data); });
    const timer = setInterval(() => {
      if (closed || !b.up()) { update(); return; }
      b.pub('host', hello());
      if (!heard && ++unanswered >= 4) { onNotFound(); return; }
      update();
    }, 4000);
    return {
      send(data) { return b.pub('host', data); },
      close() { closed = true; clearInterval(timer); b.close(); },
    };
  }

  return { available, host, join };
})();
