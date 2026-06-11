// Multiplayer client. Connects to the game server (server/index.mjs) over
// WebSocket on the same host the page was served from. If the page is served
// statically (python -m http.server) there is no WS endpoint — the game then
// runs in offline mode, silently.
//
// The server is authoritative: PvP teams are re-validated server-side and all
// battle turns are resolved there; this class only ships actions and renders
// what comes back (see src/pvp.js).
export class Net {
  constructor() {
    this.connected = false;
    this.id = null;
    this.remotePlayers = new Map(); // id -> {id, name, x, z, h, lead}
    // hooks assigned by main.js / pvp.js
    this.onChallenged = null;   // (fromId, name)
    this.onBattleStart = null;  // (msg)
    this.onEvents = null;       // (events[])
    this.onBattleEnd = null;    // (msg)
    this.onToast = null;        // (text)
    this._sendTimer = 0;
  }

  connect(name, lead, x, z) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      try {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        this.ws = new WebSocket(`${proto}://${location.host}`);
      } catch { return done(false); }
      this.ws.onopen = () => {
        this.connected = true;
        this.send({ t: 'hello', name, lead, x, z });
        done(true);
      };
      this.ws.onerror = () => done(false);
      this.ws.onclose = () => {
        this.connected = false;
        this.remotePlayers.clear();
        done(false);
      };
      this.ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        this.handle(m);
      };
      setTimeout(() => done(false), 4000);
    });
  }

  handle(m) {
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        for (const p of m.players) this.remotePlayers.set(p.id, p);
        break;
      case 'join':
        this.remotePlayers.set(m.p.id, m.p);
        this.onToast?.(`${m.p.name} joined the world`);
        break;
      case 'leave':
        this.remotePlayers.delete(m.id);
        break;
      case 'pos': {
        const p = this.remotePlayers.get(m.id);
        if (p) { p.x = m.x; p.z = m.z; p.h = m.h; p.lead = m.lead ?? p.lead; }
        break;
      }
      case 'challenged': this.onChallenged?.(m.from, m.name); break;
      case 'challenge_sent': this.onToast?.(`Challenge sent to ${m.name} — waiting…`); break;
      case 'challenge_fail': this.onToast?.(`Challenge failed: ${m.reason}`); break;
      case 'battle_start': this.onBattleStart?.(m); break;
      case 'events': this.onEvents?.(m.events); break;
      case 'battle_end': this.onBattleEnd?.(m); break;
    }
  }

  send(obj) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  // ~10 Hz position stream, driven from the main loop
  sendState(dt, x, z, h, lead) {
    if (!this.connected) return;
    this._sendTimer -= dt;
    if (this._sendTimer > 0) return;
    this._sendTimer = 0.1;
    this.send({ t: 'pos', x: +x.toFixed(1), z: +z.toFixed(1), h: +h.toFixed(2), lead });
  }

  challenge(id, team) { this.send({ t: 'challenge', to: id, team }); }
  accept(fromId, team) { this.send({ t: 'accept', from: fromId, team }); }
  action(a) { this.send({ t: 'action', action: a }); }
  replace(idx) { this.send({ t: 'replace', idx }); }
  forfeit() { this.send({ t: 'forfeit' }); }

  update() { /* interpolation happens in main.js mesh reconciliation */ }
}

// Minimal team serialization — server recomputes everything else.
export const serializeTeam = (party) => party.map((p) => ({
  id: p.id, lvl: p.lvl, ivs: p.ivs, nature: p.nature,
  moves: p.moves, gender: p.gender, shiny: p.shiny,
}));
