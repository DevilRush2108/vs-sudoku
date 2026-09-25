
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}
function broadcast(room, data, except = null) {
  for (const p of room.players) if (p !== except) send(p.ws, data);
}

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makePuzzle() {
  const base = (r, c) => (r * 3 + Math.floor(r / 3) + c) % 9;
  const rows = shuffle([0,1,2]).flatMap(g => shuffle([0,1,2]).map(r => g*3+r));
  const cols = shuffle([0,1,2]).flatMap(g => shuffle([0,1,2]).map(c => g*3+c));
  const nums = shuffle([1,2,3,4,5,6,7,8,9]);
  const solution = rows.map(r => cols.map(c => nums[base(r,c)]));
  const puzzle = solution.map(row => row.slice());
  const holes = 48; // medium-ish
  const cells = shuffle([...Array(81).keys()]);
  for (let i=0; i<holes; i++) puzzle[Math.floor(cells[i]/9)][cells[i]%9] = 0;
  return { puzzle, solution };
}

function roomState(room) {
  return {
    type: "room",
    room: room.code,
    puzzle: room.puzzle,
    players: room.players.map(p => ({id:p.id, name:p.name, progress:p.progress, done:p.done}))
  };
}

wss.on("connection", ws => {
  let player = null, room = null;

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "create") {
      let code;
      do code = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(code));
      const game = makePuzzle();
      room = { code, ...game, players: [], started: false };
      rooms.set(code, room);
      player = { ws, id: Math.random().toString(36).slice(2), name: (msg.name || "Player 1").slice(0,18), progress:0, done:false };
      room.players.push(player);
      send(ws, {type:"joined", playerId:player.id, slot:0, code});
      send(ws, roomState(room));
      return;
    }

    if (msg.type === "join") {
      const code = String(msg.code || "").toUpperCase();
      room = rooms.get(code);
      if (!room || room.players.length >= 2) {
        send(ws, {type:"error", message: !room ? "Room not found." : "Room is full."});
        return;
      }
      player = { ws, id: Math.random().toString(36).slice(2), name: (msg.name || "Player 2").slice(0,18), progress:0, done:false };
      room.players.push(player);
      send(ws, {type:"joined", playerId:player.id, slot:1, code});
      room.started = room.players.length === 2;
      for (const p of room.players) send(p.ws, {...roomState(room), started: room.started});
      return;
    }

    if (!room || !player) return;

    if (msg.type === "progress") {
      player.progress = Math.max(0, Math.min(100, Number(msg.progress) || 0));
      player.done = !!msg.done;
      broadcast(room, {
        type:"opponent",
        playerId: player.id,
        progress: player.progress,
        done: player.done
      }, ws);
      if (player.done) {
        room.winner = player.id;
        broadcast(room, {type:"winner", playerId:player.id, name:player.name}, null);
        send(ws, {type:"winner", playerId:player.id, name:player.name});
      }
    }

    if (msg.type === "rematch") {
      const game = makePuzzle();
      room.puzzle = game.puzzle;
      room.solution = game.solution;
      room.players.forEach(p => {p.progress=0; p.done=false;});
      room.winner = null;
      for (const p of room.players) send(p.ws, {...roomState(room), started:room.players.length===2, rematch:true});
    }
  });

  ws.on("close", () => {
    if (!room || !player) return;
    room.players = room.players.filter(p => p !== player);
    broadcast(room, {type:"left", playerId:player.id});
    if (room.players.length === 0) rooms.delete(room.code);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`VS Sudoku running on http://localhost:${PORT}`));
