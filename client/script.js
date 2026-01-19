const socket = io();
const roomId = "ROOM1";

let myId = null;
let gameState = null;

const playerName = prompt("Enter your name");

socket.on("connect", () => {
  myId = socket.id;

  socket.emit("join", {
    roomId,
    name: playerName
  });
});

socket.on("state", state => {
  gameState = state;

  document.getElementById("substring").textContent =
    "Substring: " + state.substring;

  document.getElementById("timer").textContent =
    "Time left: " + state.timeLeft + "s";

  const playersDiv = document.getElementById("players");
  playersDiv.innerHTML = "";

  state.players.forEach((p, i) => {
    const el = document.createElement("div");

    let label = p.name;
    if (!p.alive) label += " ❌";

    if (i === state.turnIndex && p.alive) {
      label = "➡ " + label;
      el.style.fontWeight = "bold";
    }

    el.textContent = label;

    if (!p.alive) {
      el.style.opacity = "0.5";
    }

    playersDiv.appendChild(el);
  });

  const me = state.players.find(p => p.id === myId);
  const status = document.getElementById("status");

  if (!me || !me.alive) {
    status.textContent = "You are eliminated (spectating)";
  } else if (state.players[state.turnIndex].id === myId) {
    status.textContent = "Your turn!";
  } else {
    status.textContent = "Waiting...";
  }
});

socket.on("gameOver", data => {
  document.getElementById("status").textContent =
    "Game Over! Winner: " + data.winner;
});

function send() {
  document.getElementById("input").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    send();
  }
});
  if (!gameState) return;

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.alive) {
    alert("You are eliminated!");
    return;
  }

  if (gameState.players[gameState.turnIndex].id !== myId) {
    return;
  }

  const input = document.getElementById("input");
  const guess = input.value.trim();
  if (!guess) return;

  socket.emit("guess", {
    roomId,
    guess
  });

  input.value = "";
}
