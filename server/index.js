const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const pokemonList = require("./pokemon.json");

console.log("INDEX.JS IS RUNNING");

const app = express();
app.use(express.static(path.join(__dirname, "../client")));

const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const pokemonSet = new Set(pokemonList.map(p => p.toLowerCase()));

const rooms = {};
const TURN_TIME = 10; // seconds

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-']/g, "");
}

function randomSubstring() {
  while (true) {
    const p = pokemonList[Math.floor(Math.random() * pokemonList.length)];
    const i = Math.floor(Math.random() * (p.length - 2));
    const sub = p.slice(i, i + 2);
    if (!sub.includes("-")) return sub;
  }
}

function nextAliveIndex(players, current) {
  let i = current;
  do {
    i = (i + 1) % players.length;
  } while (!players[i].alive);
  return i;
}

io.on("connection", socket => {
  console.log("Client connected:", socket.id);

  socket.on("join", ({ roomId, name }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        turnIndex: 0,
        substring: randomSubstring(),
        timeLeft: TURN_TIME,
        timer: null,
        used: new Set()
      };
    }

    const room = rooms[roomId];

    room.players.push({
      id: socket.id,
      name,
      alive: true
    });

    socket.join(roomId);
    emitState(roomId);

    if (room.players.filter(p => p.alive).length === 1) {
      startTurn(roomId);
    }
  });

  socket.on("guess", ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room) return;

    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) return;
    if (!currentPlayer.alive) return;

    const g = normalize(guess);

    if (
      pokemonSet.has(g) &&
      g.includes(room.substring) &&
      !room.used.has(g)
    ) {
      room.used.add(g);
      clearInterval(room.timer);

      room.turnIndex = nextAliveIndex(room.players, room.turnIndex);
      room.substring = randomSubstring();
      room.timeLeft = TURN_TIME;

      startTurn(roomId);
    } else {
      eliminate(roomId);
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.alive = false;
        emitState(roomId);
      }
    }
  });
});

function startTurn(roomId) {
  const room = rooms[roomId];
  clearInterval(room.timer);

  room.timer = setInterval(() => {
    room.timeLeft--;

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      eliminate(roomId);
      return;
    }

    emitState(roomId);
  }, 1000);

  emitState(roomId);
}

function eliminate(roomId) {
  const room = rooms[roomId];
  const player = room.players[room.turnIndex];
  if (!player) return;

  player.alive = false;

  const alivePlayers = room.players.filter(p => p.alive);

  if (alivePlayers.length <= 1) {
    io.to(roomId).emit("gameOver", {
      winner: alivePlayers[0]?.name || "Nobody"
    });
    delete rooms[roomId];
    return;
  }

  room.turnIndex = nextAliveIndex(room.players, room.turnIndex);
  room.substring = randomSubstring();
  room.timeLeft = TURN_TIME;

  startTurn(roomId);
}

function emitState(roomId) {
  const room = rooms[roomId];
  io.to(roomId).emit("state", {
    players: room.players,
    turnIndex: room.turnIndex,
    substring: room.substring,
    timeLeft: room.timeLeft
  });
}

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
