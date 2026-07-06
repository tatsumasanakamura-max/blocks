"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_BLOCK = 24;
const LOCK_DELAY = 260;
const LINE_POINTS = [0, 100, 300, 500, 800];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("holdCanvas");
const holdCtx = holdCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const holdButton = document.getElementById("holdButton");

const COLORS = {
  I: "#31c7ef",
  O: "#f7d038",
  T: "#ad7bdc",
  S: "#69c779",
  Z: "#ef6f6c",
  J: "#5d8dee",
  L: "#f2a65a"
};

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
};

let board;
let current;
let next;
let hold;
let canHold;
let score;
let level;
let lines;
let dropCounter;
let dropInterval;
let lastTime;
let lockCounter;
let gameOver;
let paused;
let animationId;
let activeTouchInterval = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createPiece(type = randomType()) {
  return {
    type,
    matrix: SHAPES[type].map((row) => row.slice()),
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: -1
  };
}

function randomType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function resetGame() {
  board = createBoard();
  current = createPiece();
  next = createPiece();
  hold = null;
  canHold = true;
  score = 0;
  level = 1;
  lines = 0;
  dropCounter = 0;
  lockCounter = 0;
  dropInterval = getDropInterval();
  lastTime = 0;
  gameOver = false;
  paused = false;
  pauseButton.textContent = "Pause";
  updateStats();
  hideOverlay();
  draw();
  if (!animationId) animationId = requestAnimationFrame(update);
}

function getDropInterval() {
  return Math.max(90, 850 - (level - 1) * 70);
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      gravityDrop();
    }
    handleLockDelay(delta);
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function handleLockDelay(delta) {
  if (!current) return;
  if (collides(current.matrix, current.x, current.y + 1)) {
    lockCounter += delta;
    if (lockCounter >= LOCK_DELAY) lockPiece();
  } else {
    lockCounter = 0;
  }
}

function collides(matrix, offsetX, offsetY) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const boardX = offsetX + x;
      const boardY = offsetY + y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function move(dir) {
  if (!canAct()) return;
  const nextX = current.x + dir;
  if (!collides(current.matrix, nextX, current.y)) {
    current.x = nextX;
    lockCounter = 0;
  }
}

function softDrop(addScore = true) {
  if (!canAct()) return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
    dropCounter = 0;
    if (addScore) {
      score += 1;
      updateStats();
    }
  } else {
    lockPiece();
  }
}

function gravityDrop() {
  if (!canAct()) return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
    dropCounter = 0;
  }
}

function hardDrop() {
  if (!canAct()) return;
  let distance = 0;
  while (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
    distance += 1;
  }
  score += distance * 2;
  updateStats();
  lockPiece();
}

function rotate() {
  if (!canAct() || current.type === "O") return;
  const rotated = rotateMatrix(current.matrix);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collides(rotated, current.x + kick, current.y)) {
      current.matrix = rotated;
      current.x += kick;
      lockCounter = 0;
      return;
    }
  }
}

function rotateMatrix(matrix) {
  const size = matrix.length;
  return matrix.map((row, y) => row.map((_, x) => matrix[size - 1 - x][y]));
}

function holdPiece() {
  if (!canAct() || !canHold) return;
  const heldType = hold;
  hold = current.type;
  current = heldType ? createPiece(heldType) : next;
  if (!heldType) next = createPiece();
  canHold = false;
  lockCounter = 0;
  if (collides(current.matrix, current.x, current.y)) endGame();
}

function lockPiece() {
  if (!current || gameOver) return;
  for (let y = 0; y < current.matrix.length; y += 1) {
    for (let x = 0; x < current.matrix[y].length; x += 1) {
      if (!current.matrix[y][x]) continue;
      const boardY = current.y + y;
      const boardX = current.x + x;
      if (boardY < 0) {
        endGame();
        return;
      }
      board[boardY][boardX] = current.type;
    }
  }

  const cleared = clearLines();
  if (cleared > 0) applyLineScore(cleared);
  spawnNextPiece();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }
  return cleared;
}

function applyLineScore(cleared) {
  lines += cleared;
  score += LINE_POINTS[cleared] * level;
  level = Math.floor(lines / 10) + 1;
  dropInterval = getDropInterval();
  updateStats();
}

function spawnNextPiece() {
  current = next;
  next = createPiece();
  canHold = true;
  dropCounter = 0;
  lockCounter = 0;
  if (collides(current.matrix, current.x, current.y)) endGame();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  if (paused) {
    showOverlay("Paused", "Press P or Pause to resume");
  } else {
    hideOverlay();
    lastTime = performance.now();
  }
}

function endGame() {
  gameOver = true;
  current = null;
  showOverlay("Game Over", "Press R or Restart to play again");
}

function canAct() {
  return current && !paused && !gameOver;
}

function updateStats() {
  scoreEl.textContent = score.toString();
  levelEl.textContent = level.toString();
  linesEl.textContent = lines.toString();
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoardGrid();
  drawBoardBlocks();
  if (current) drawMatrix(ctx, current.matrix, current.x, current.y, BLOCK, current.type);
  drawPreview(nextCtx, next?.matrix, next?.type);
  drawPreview(holdCtx, hold ? SHAPES[hold] : null, hold);
}

function drawBoardGrid() {
  ctx.fillStyle = "#15191d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#2f373d";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(COLS * BLOCK, y * BLOCK);
    ctx.stroke();
  }
}

function drawBoardBlocks() {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const type = board[y][x];
      if (type) drawCell(ctx, x * BLOCK, y * BLOCK, BLOCK, COLORS[type]);
    }
  }
}

function drawMatrix(targetCtx, matrix, offsetX, offsetY, size, type) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = offsetY + y;
      if (boardY < 0) return;
      drawCell(targetCtx, (offsetX + x) * size, boardY * size, size, COLORS[type]);
    });
  });
}

function drawPreview(targetCtx, matrix, type) {
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  targetCtx.fillStyle = "#252b31";
  targetCtx.fillRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  if (!matrix || !type) return;

  const width = matrix[0].length * PREVIEW_BLOCK;
  const height = matrix.length * PREVIEW_BLOCK;
  const startX = Math.floor((targetCtx.canvas.width - width) / 2);
  const startY = Math.floor((targetCtx.canvas.height - height) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawCell(targetCtx, startX + x * PREVIEW_BLOCK, startY + y * PREVIEW_BLOCK, PREVIEW_BLOCK, COLORS[type]);
    });
  });
}

function drawCell(targetCtx, x, y, size, color) {
  const gap = Math.max(1, size * 0.06);
  targetCtx.fillStyle = color;
  targetCtx.fillRect(x + gap, y + gap, size - gap * 2, size - gap * 2);
  targetCtx.fillStyle = "rgba(255, 255, 255, 0.22)";
  targetCtx.fillRect(x + gap, y + gap, size - gap * 2, Math.max(2, size * 0.18));
  targetCtx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(x + gap, y + gap, size - gap * 2, size - gap * 2);
}

function handleAction(action) {
  const actions = {
    left: () => move(-1),
    right: () => move(1),
    rotate,
    softDrop: () => softDrop(true),
    hardDrop,
    hold: holdPiece,
    pause: togglePause,
    restart: resetGame
  };
  actions[action]?.();
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const keyMap = {
      arrowleft: "left",
      arrowright: "right",
      arrowdown: "softDrop",
      arrowup: "rotate",
      x: "rotate",
      " ": "hardDrop",
      c: "hold",
      p: "pause",
      r: "restart"
    };
    const action = keyMap[key];
    if (!action) return;
    event.preventDefault();
    handleAction(action);
  });
}

function bindButtons() {
  pauseButton.addEventListener("click", () => handleAction("pause"));
  restartButton.addEventListener("click", () => handleAction("restart"));
  holdButton.addEventListener("click", () => handleAction("hold"));

  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    const repeatable = action === "left" || action === "right" || action === "softDrop";

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-pressed");
      handleAction(action);
      if (repeatable) {
        activeTouchInterval = window.setInterval(() => handleAction(action), action === "softDrop" ? 70 : 115);
      }
    });

    const stopPress = () => {
      button.classList.remove("is-pressed");
      if (activeTouchInterval) {
        window.clearInterval(activeTouchInterval);
        activeTouchInterval = null;
      }
    };
    button.addEventListener("pointerup", stopPress);
    button.addEventListener("pointercancel", stopPress);
    button.addEventListener("pointerleave", stopPress);
  });

  document.addEventListener("touchmove", (event) => {
    if (event.target.closest(".touch-controls")) event.preventDefault();
  }, { passive: false });
}

bindKeyboard();
bindButtons();
resetGame();
