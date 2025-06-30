const infoDisplay = document.getElementById('info-display');

// address of the WebSocket server
const webRoomsWebSocketServerAddr = 'https://nosch.uber.space/web-rooms/';

// variables
let clientId = null; // client ID sent by web-rooms server when calling 'enter-room'
let clientCount = 0; // number of clients connected to the same room

const playerCountDisplay = document.getElementById('playerCountDisplay');


const tileColors = [
  "#ff6666", "#ffcc66", "#66ff66", "#66ffff",
  "#6666ff", "#cc66ff", "#ff66cc", "#ff9966",
  "#99ff66", "#66ffcc", "#6699ff", "#cc66ff",
  "#ff9999", "#99ccff", "#cccc99", "#66cc99"
];

const freqs = [
  261.63, 293.66, 329.63, 349.23,
  392.00, 440.00, 493.88, 523.25,
  587.33, 659.25, 698.46, 783.99,
  830.61, 880.00, 987.77, 1046.50
];

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const scene = document.querySelector("a-scene");
const status = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const scoreDisplay = document.getElementById("scoreDisplayFixed");

const melodies = {
  easy: [[0, 2, 4, 2], [4, 2, 0, 2], [0, 4, 0, 4]],
  medium: [[0, 2, 4, 6, 4], [3, 5, 7, 5, 3], [2, 4, 6, 8, 6, 4]],
  hard: [
    [0, 3, 5, 8, 10, 12, 14],
    [1, 4, 6, 9, 11, 13, 15],
    [2, 4, 7, 9, 11, 14, 12]
  ],
};

const levels = ["easy", "medium", "hard"];
let currentLevel = 0;
let currentMelody = [];
let userInput = [];
let acceptingInput = false;
let score = 0;

function playTone(freq, duration = 600) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

  osc.start(now);
  osc.stop(now + duration / 1000);
}

function highlightTile(entity, color = "#ffffff", duration = 400) {
  const original = entity.getAttribute("color");
  entity.setAttribute("color", color);
  setTimeout(() => {
    entity.setAttribute("color", original);
  }, duration);
}

function playMelody(sequence) {
  let delay = 0;
  acceptingInput = false;
  userInput = [];
  sequence.forEach((index) => {
    setTimeout(() => {
      playTone(freqs[index]);
      const tile = document.querySelector(`[data-index='${index}']`);
      highlightTile(tile, "#ffffff");
    }, delay);
    delay += 600;
  });
  setTimeout(() => {
    acceptingInput = true;
    status.textContent = "Jetzt bist du dran!";
  }, delay);
}

function checkUserInput() {
  for (let i = 0; i < userInput.length; i++) {
    if (userInput[i] !== currentMelody[i]) {
      status.textContent = "Falsch! Versuche es nochmal.";
      acceptingInput = false;
      return;
    }
  }

  if (userInput.length === currentMelody.length) {
    status.textContent = "Richtig! 🎉";
    acceptingInput = false;

    score += 10;
    scoreDisplay.textContent = `Punkte: ${score}`;

    setTimeout(() => {
      currentLevel++;
      if (currentLevel >= levels.length) {
        currentLevel = 0;
        status.textContent = "Du hast alle Level geschafft! 🎊";
        return;
      }
      startNextLevel();
    }, 1500);
  }
}

function startNextLevel() {
  const levelName = levels[currentLevel];
  const pool = melodies[levelName];
  currentMelody = pool[Math.floor(Math.random() * pool.length)];
  status.textContent = `Level: ${levelName.toUpperCase()} `;
  playMelody(currentMelody);
}

function createTiles() {
  for (let i = 0; i < 16; i++) {
    const x = (i % 4) * 1.2 - 1.8;
    const z = Math.floor(i / 4) * 1.2 - 1.8;
    const tile = document.createElement("a-box");
    tile.setAttribute("position", `${x} 0.1 ${z}`);
    tile.setAttribute("width", "1");
    tile.setAttribute("height", "0.2");
    tile.setAttribute("depth", "1");
    tile.setAttribute("color", tileColors[i]);
    tile.setAttribute("data-index", i);
    tile.setAttribute("class", "tile");
    tile.addEventListener("click", () => {
      if (!acceptingInput) return;
      playTone(freqs[i]);
      highlightTile(tile, "#ffffff");
      userInput.push(i);
      checkUserInput();
    });
    scene.appendChild(tile);
  }
}

startBtn.addEventListener("click", () => {
  currentLevel = 0;
  score = 0;
  scoreDisplay.textContent = `Punkte: ${score}`;
  startNextLevel();
});

createTiles();

/****************************************************************
 * websocket communication
 */
const socket = new WebSocket(webRoomsWebSocketServerAddr);

// helper function to send requests over websocket to web-room server
function sendRequest(...message) {
  const str = JSON.stringify(message);
  socket.send(str);
  console.log("Hi ich funktionier")
}


// listen to opening websocket connections
socket.addEventListener('open', (event) => {
  sendRequest('*enter-room*', 'disco-groove');
  sendRequest('*subscribe-client-count*');
  sendRequest('*subscribe-client-enter-exit*');

  // ping the server regularly with an empty message to prevent the socket from closing
  setInterval(() => socket.send(''), 30000);
});

socket.addEventListener("close", (event) => {
  clientId = null;
  document.body.classList.add('disconnected');
});

// listen to messages from server
socket.addEventListener('message', (event) => {
  const data = event.data;

  if (data.length > 0) {
    const incoming = JSON.parse(data);
    const selector = incoming[0];

    // dispatch incomming messages

switch (selector) {
  // responds to '*client-count*'
  case '*client-count*':
    clientCount = incoming[1];
    infoDisplay.innerHTML = `#${clientId}/${clientCount}`;
    
    // Spieleranzahl-Anzeige aktualisieren
    const playerCountDisplay = document.getElementById('playerCountDisplay');
    if (playerCountDisplay) {
      playerCountDisplay.textContent = `Spieler online: ${clientCount}`;
    }
    break;

      case '*client-enter*':
        const enterId = incoming[1];
        console.log(`client #${enterId} has entered the room`);
        break;

      case '*client-exit*':
        const exitId = incoming[1];
        console.log(`client #${exitId} has left the room`);
        break;

      // 'hello there' messages sent from other clients
      case 'hello-there':
        const otherId = incoming[1];
        console.log(`client #${otherId} says 'Hello there!'`);

        highlightText(titleDisplay); // highlight screen by others (function defined above)
        break;

      case '*error*': {
        const message = incoming[1];
        console.warn('server error:', ...message);
        break;
      }

      default:
        console.log(`unknown incoming messsage: [${incoming}]`);
        break;
    
    }
        console.log(data)
  }
});

function createDiscoLights(count = 20) {
  for (let i = 0; i < count; i++) {
    const light = document.createElement("a-sphere");
    const x = (Math.random() - 0.5) * 10;
    const y = Math.random() * 4 + 1;
    const z = (Math.random() - 0.5) * 10;
    

    light.setAttribute("position", `${x} ${y} ${z}`);
    light.setAttribute("radius", "0.1");
    light.setAttribute("color", getRandomColor());
    light.setAttribute("opacity", "0.8");
    light.setAttribute("animation__move", {
      property: "position",
      to: `${x + (Math.random() - 0.5)} ${y + Math.random() * 1.5} ${z + (Math.random() - 0.5)}`,
      dur: 2000 + Math.random() * 3000,
      dir: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });
    light.setAttribute("animation__color", {
      property: "color",
      to: getRandomColor(),
      dur: 1000 + Math.random() * 2000,
      dir: "alternate",
      loop: true,
    });
    

    scene.appendChild(light);
  }
}

function getRandomColor() {
  const colors = ["#ff66cc", "#66ccff", "#ffff66", "#ff9966", "#cc66ff", "#00ffcc"];
  return colors[Math.floor(Math.random() * colors.length)];
}

createDiscoLights();

let isDarkMode = true;

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "t") {
    toggleSceneMode();
  }
});

function toggleSceneMode() {
  const scene = document.querySelector("a-scene");
  const ground = scene.querySelector("a-plane");
  const overlay = document.getElementById("overlay");
  const infoDisplay = document.getElementById("info-display");

  if (isDarkMode) {
    // Wechsel zu Light Mode
    scene.setAttribute("background", "color: #eef");
    if (ground) ground.setAttribute("color", "#ccc");

    overlay.style.color = "#000";
    infoDisplay.style.color = "#000";

  } else {
    // Zurück zu Dark Mode
    scene.setAttribute("background", "color: #111");
    if (ground) ground.setAttribute("color", "#222");

    overlay.style.color = "#fff";
    infoDisplay.style.color = "#fff";
  }

  isDarkMode = !isDarkMode;
}
