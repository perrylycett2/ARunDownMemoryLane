import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, createInitialState, jump, startGame, togglePause, updateGame } from './gameCore.js';

const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const score = document.querySelector('#score');
const memories = document.querySelector('#memories');
const best = document.querySelector('#best');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const startButton = document.querySelector('#start-button');

let state = createInitialState();
let lastTime = performance.now();

function reset() {
  state = startGame(createInitialState());
  overlay.classList.add('hidden');
}

function handlePrimaryAction() {
  if (state.status === 'gameover') {
    reset();
    return;
  }

  state = jump(state);
  overlay.classList.toggle('hidden', state.status === 'playing');
}

startButton.addEventListener('click', handlePrimaryAction);
canvas.addEventListener('pointerdown', handlePrimaryAction);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    handlePrimaryAction();
  }

  if (event.code === 'KeyP') {
    state = togglePause(state);
  }

  if (event.code === 'KeyR') {
    reset();
  }
});

function tick(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  state = updateGame(state, delta);
  syncHud();
  draw();
  requestAnimationFrame(tick);
}

function syncHud() {
  score.textContent = Math.floor(state.score).toLocaleString();
  memories.textContent = state.memories.toLocaleString();
  best.textContent = Math.floor(state.best).toLocaleString();

  overlay.classList.toggle('hidden', state.status === 'playing');
  if (state.status === 'ready') {
    overlayTitle.textContent = 'Ready?';
    overlayCopy.textContent = 'Press Space or tap Start to begin your run.';
    startButton.textContent = 'Start run';
  }
  if (state.status === 'paused') {
    overlayTitle.textContent = 'Paused';
    overlayCopy.textContent = 'Press P to keep running down memory lane.';
    startButton.textContent = 'Resume';
  }
  if (state.status === 'gameover') {
    overlayTitle.textContent = 'Memory lane got bumpy';
    overlayCopy.textContent = `Final score: ${Math.floor(state.score).toLocaleString()} · Memories saved: ${state.memories.toLocaleString()}`;
    startButton.textContent = 'Run again';
  }
}

function draw() {
  drawSky();
  drawScenery();
  drawRoad();
  drawPickups();
  drawObstacles();
  drawPlayer();
}

function drawSky() {
  const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, '#261b48');
  gradient.addColorStop(0.55, '#5a315d');
  gradient.addColorStop(1, '#f5a15d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  context.fillStyle = 'rgba(255, 238, 177, 0.9)';
  context.beginPath();
  context.arc(790, 90, 44, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(255, 255, 255, 0.6)';
  for (let index = 0; index < 24; index += 1) {
    const x = (index * 83 + Math.sin(state.elapsed + index) * 18) % GAME_WIDTH;
    const y = 34 + ((index * 37) % 160);
    context.fillRect(x, y, 2, 2);
  }
}

function drawScenery() {
  state.scenery.forEach((building) => {
    context.fillStyle = building.lit ? 'rgba(42, 36, 72, 0.86)' : 'rgba(31, 30, 56, 0.9)';
    context.fillRect(building.x, GROUND_Y - building.height - 34, building.width, building.height);
    context.fillStyle = building.lit ? 'rgba(255, 210, 118, 0.8)' : 'rgba(103, 100, 139, 0.45)';
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        context.fillRect(building.x + 16 + col * 34, GROUND_Y - building.height + row * 30 - 14, 14, 12);
      }
    }
  });
}

function drawRoad() {
  context.fillStyle = '#2f2e3f';
  context.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
  context.fillStyle = '#f4c66a';
  for (let x = -120 + ((state.elapsed * state.speed) % 160); x < GAME_WIDTH; x += 160) {
    context.fillRect(x, GROUND_Y + 46, 80, 8);
  }
  context.fillStyle = 'rgba(255, 255, 255, 0.14)';
  context.fillRect(0, GROUND_Y, GAME_WIDTH, 4);
}

function drawPickups() {
  state.pickups.forEach((pickup) => {
    context.save();
    context.translate(pickup.x + pickup.width / 2, pickup.y + pickup.height / 2);
    context.rotate(state.elapsed * 2.5);
    context.fillStyle = `hsl(${pickup.hue}, 95%, 64%)`;
    context.shadowColor = '#ffe08a';
    context.shadowBlur = 18;
    context.fillRect(-pickup.width / 2, -pickup.height / 2, pickup.width, pickup.height);
    context.fillStyle = 'rgba(255, 255, 255, 0.72)';
    context.fillRect(-7, -7, 14, 14);
    context.restore();
  });
}

function drawObstacles() {
  state.obstacles.forEach((obstacle) => {
    if (obstacle.type === 'pothole') {
      context.fillStyle = '#171620';
      context.beginPath();
      context.ellipse(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, obstacle.width / 2, obstacle.height / 2, 0, 0, Math.PI * 2);
      context.fill();
      return;
    }

    context.fillStyle = '#ff744f';
    context.beginPath();
    context.moveTo(obstacle.x + obstacle.width / 2, obstacle.y);
    context.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
    context.lineTo(obstacle.x, obstacle.y + obstacle.height);
    context.closePath();
    context.fill();
    context.fillStyle = '#ffe4b5';
    context.fillRect(obstacle.x + 11, obstacle.y + obstacle.height * 0.58, obstacle.width - 22, 8);
  });
}

function drawPlayer() {
  const player = state.player;
  context.fillStyle = '#253044';
  context.fillRect(player.x + 6, player.y + 16, player.width - 12, player.height - 16);
  context.fillStyle = '#f7c7a4';
  context.beginPath();
  context.arc(player.x + player.width / 2, player.y + 15, 17, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#79dbff';
  context.fillRect(player.x + 13, player.y + 34, player.width - 26, 28);
  context.strokeStyle = '#ffe08a';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(player.x + 16, player.y + player.height);
  context.lineTo(player.x + 6, player.y + player.height + Math.sin(state.elapsed * 16) * 8);
  context.moveTo(player.x + player.width - 16, player.y + player.height);
  context.lineTo(player.x + player.width - 6, player.y + player.height - Math.sin(state.elapsed * 16) * 8);
  context.stroke();
}

syncHud();
draw();
requestAnimationFrame(tick);
