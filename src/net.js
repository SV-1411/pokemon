// Multiplayer interface stub — the contract a future server implements.
//
// Design intent (see README "Multiplayer roadmap"):
// - Authoritative Node.js + WebSocket server, rooms sharded by map region.
// - Clients send position/heading at ~10 Hz; server broadcasts nearby players.
// - PvP battles: both clients submit actions to the server, which runs the
//   SAME battle math as src/battle.js (the damage/catch functions in data.js
//   are pure and importable server-side) and broadcasts authoritative results,
//   so neither client can cheat.
// - Saves move from localStorage to per-account server storage (same JSON
//   shape as save.js produces).
//
// The game loop already calls net.update() and renders net.remotePlayers, so
// wiring in a real server later means implementing this class only.
export class Net {
  constructor() {
    this.connected = false;
    this.remotePlayers = new Map(); // playerId -> {name, x, z, heading, partyPreview}
    this.onChallenge = null;        // (challenger) => void — PvP request hook
  }
  async connect(/* serverUrl, authToken */) {
    // Future: open WebSocket, authenticate, join region room.
    this.connected = false;
  }
  sendState(/* x, z, heading */) { /* no-op offline */ }
  challengePlayer(/* playerId */) { /* no-op offline */ }
  update(/* dt */) { /* interpolate remote players when online */ }
}
