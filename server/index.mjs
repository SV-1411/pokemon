// POKeMON INDIA multiplayer server: serves the game over HTTP and runs the
// authoritative WebSocket world — presence (see other trainers walking
// around) and server-resolved PvP battles.
//
//   cd server && npm install && node index.mjs
//   → open http://<host>:8128 in any number of browsers
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { WebSocketServer } from 'ws';
import { PvpBattle, sanitizeMon, publicMon } from './battlecore.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT ?? 8128;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.css': 'text/css',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};
const http = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

// ---------- lobby ----------
let nextId = 1;
const players = new Map(); // id -> {id, ws, name, x, z, h, lead, match, pendingFrom}
const send = (p, msg) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); };
const broadcast = (msg, except) => {
  for (const p of players.values()) if (p !== except) send(p, msg);
};
const roster = () => [...players.values()].map((p) => ({
  id: p.id, name: p.name, x: p.x, z: p.z, h: p.h, lead: p.lead,
}));

const wss = new WebSocketServer({ server: http });
wss.on('connection', (ws) => {
  const p = { id: nextId++, ws, name: 'TRAINER', x: 0, z: 0, h: 0, lead: null, match: null, pendingFrom: new Map() };

  ws.on('message', (buf) => {
    let m;
    try { m = JSON.parse(buf); } catch { return; }
    switch (m.t) {
      case 'hello': {
        p.name = String(m.name ?? 'TRAINER').slice(0, 12).toUpperCase() || 'TRAINER';
        p.lead = m.lead ?? null;
        if (typeof m.x === 'number') { p.x = m.x; p.z = m.z; }
        players.set(p.id, p);
        send(p, { t: 'welcome', id: p.id, players: roster().filter((r) => r.id !== p.id) });
        broadcast({ t: 'join', p: { id: p.id, name: p.name, x: p.x, z: p.z, h: p.h, lead: p.lead } }, p);
        console.log(`+ ${p.name}#${p.id} (${players.size} online)`);
        break;
      }
      case 'pos': {
        if (typeof m.x !== 'number' || typeof m.z !== 'number') return;
        p.x = m.x; p.z = m.z; p.h = m.h ?? 0;
        p.lead = m.lead ?? p.lead;
        broadcast({ t: 'pos', id: p.id, x: p.x, z: p.z, h: p.h, lead: p.lead }, p);
        break;
      }
      case 'challenge': {
        const target = players.get(m.to);
        if (!target || target.match || p.match) return send(p, { t: 'challenge_fail', reason: 'unavailable' });
        const team = (m.team ?? []).map(sanitizeMon).filter(Boolean).slice(0, 6);
        if (!team.length) return send(p, { t: 'challenge_fail', reason: 'no team' });
        target.pendingFrom.set(p.id, team);
        send(target, { t: 'challenged', from: p.id, name: p.name });
        send(p, { t: 'challenge_sent', name: target.name });
        break;
      }
      case 'accept': {
        const challenger = players.get(m.from);
        const teamA = p.pendingFrom.get(m.from);
        if (!challenger || !teamA || challenger.match || p.match) return;
        p.pendingFrom.delete(m.from);
        const teamB = (m.team ?? []).map(sanitizeMon).filter(Boolean).slice(0, 6);
        if (!teamB.length) return;
        startMatch(challenger, teamA, p, teamB);
        break;
      }
      case 'action': p.match?.battle.submit(p.side, m.action ?? {}); break;
      case 'replace': p.match?.battle.replace(p.side, m.idx); break;
      case 'forfeit': p.match?.battle.submit(p.side, { forfeit: true }); break;
    }
  });

  ws.on('close', () => {
    if (p.match) p.match.battle.finish(1 - p.side, 'disconnect');
    players.delete(p.id);
    broadcast({ t: 'leave', id: p.id });
    console.log(`- ${p.name}#${p.id} (${players.size} online)`);
  });
});

function startMatch(a, teamA, b, teamB) {
  const battle = new PvpBattle(teamA, teamB, (events) => {
    send(a, { t: 'events', events });
    send(b, { t: 'events', events });
  });
  const match = { battle };
  a.match = match; b.match = match;
  a.side = 0; b.side = 1;
  battle.onFinish = (winner, reason) => {
    for (const [pl, side] of [[a, 0], [b, 1]]) {
      send(pl, { t: 'battle_end', youWon: winner === side, reason });
      pl.match = null;
    }
    console.log(`battle: ${winner === 0 ? a.name : b.name} beat ${winner === 0 ? b.name : a.name} (${reason})`);
  };
  for (const [pl, side, opp, own] of [[a, 0, b, teamA], [b, 1, a, teamB]]) {
    send(pl, {
      t: 'battle_start',
      side,
      oppName: opp.name,
      yourTeam: own,                       // server-sanitized — this is canon
      oppLead: publicMon(side === 0 ? teamB[0] : teamA[0]),
      oppCount: (side === 0 ? teamB : teamA).length,
    });
  }
  console.log(`battle: ${a.name} vs ${b.name}`);
}

http.listen(PORT, () => console.log(`POKeMON INDIA server → http://localhost:${PORT}`));
