"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_BLOCK = 24;
const LINE_POINTS = [0, 100, 300, 500, 800];
const BEST_PREFIX = "fallingBlocksBest:";
const NORMAL_CLEAR_DURATION = 420;
const KIDS_CLEAR_DURATION = 500;

const MODES = {
  normal: {
    id: "normal",
    name: "ノーマルモード",
    hint: "いつものルールでプレイ",
    initialSpeed: 850,
    speedStep: 70,
    minSpeed: 90,
    linesPerLevel: 10,
    lockDelay: 260,
    kidFriendly: false,
    timeLimit: null
  },
  kids: {
    id: "kids",
    name: "キッズモード",
    hint: "プレイボール！ ゆっくり楽しもう",
    initialSpeed: 1150,
    speedStep: 24,
    minSpeed: 420,
    linesPerLevel: 16,
    lockDelay: 420,
    kidFriendly: true,
    timeLimit: null
  },
  kids3min: {
    id: "kids3min",
    name: "3分チャレンジ",
    hint: "180秒でベストスコアをめざそう",
    initialSpeed: 1080,
    speedStep: 18,
    minSpeed: 520,
    linesPerLevel: 18,
    lockDelay: 440,
    kidFriendly: true,
    timeLimit: 180
  }
};

const RANKS = ["ルーキー", "レギュラー", "スター選手", "キャプテン"];
const KID_COLORS = {
  I: "#5bc0eb",
  O: "#ffd166",
  T: "#c59bff",
  S: "#8bd17c",
  Z: "#ff8fab",
  J: "#6aa9ff",
  L: "#ffb86b"
};
const NORMAL_COLORS = {
  I: "#31c7ef",
  O: "#f7d038",
  T: "#ad7bdc",
  S: "#69c779",
  Z: "#ef6f6c",
  J: "#5d8dee",
  L: "#f2a65a"
};
const KID_ICONS = {
  I: "⚾",
  O: "★",
  T: "☻",
  S: "⌂",
  Z: "◆",
  J: "帽",
  L: "棒"
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

const modeScreen = document.getElementById("modeScreen");
const gameScreen = document.getElementById("gameScreen");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("holdCanvas");
const holdCtx = holdCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const timerEl = document.getElementById("timer");
const rankText = document.getElementById("rankText");
const timerMetric = document.getElementById("timerMetric");
const statusStrip = document.querySelector(".status-strip");
const modeName = document.getElementById("modeName");
const modeHint = document.getElementById("modeHint");
const scoreLabel = document.getElementById("scoreLabel");
const levelLabel = document.getElementById("levelLabel");
const linesLabel = document.getElementById("linesLabel");
const holdTitle = document.getElementById("holdTitle");
const nextTitle = document.getElementById("nextTitle");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayStats = document.getElementById("overlayStats");
const overlayRestartButton = document.getElementById("overlayRestartButton");
const cheerMessage = document.getElementById("cheerMessage");
const scorePop = document.getElementById("scorePop");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const holdButton = document.getElementById("holdButton");
const modeBackButton = document.getElementById("modeBackButton");
const soundButton = document.getElementById("soundButton");

let board;
let current;
let next;
let hold;
let canHold;
let score;
let level;
let lines;
let combo;
let dropCounter;
let dropInterval;
let lastTime;
let lockCounter;
let gameOver;
let paused;
let isAnimating;
let clearingLines;
let clearStartedAt;
let clearAnimationToken = 0;
let animationId;
let activeTouchInterval = null;
let activeMode = MODES.normal;
let timeRemaining = null;
let audioCtx = null;
let soundEnabled = loadSoundSetting();

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

function selectMode(modeId) {
  activeMode = MODES[modeId] ?? MODES.normal;
  modeScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  document.body.classList.toggle("kids-theme", activeMode.kidFriendly);
  applyModeUi();
  resetGame();
  if (activeMode.kidFriendly) showCheer("プレイボール！");
}

function applyModeUi() {
  modeName.textContent = activeMode.name;
  modeHint.textContent = activeMode.hint;
  scoreLabel.textContent = activeMode.kidFriendly ? "とくてん" : "Score";
  levelLabel.textContent = activeMode.kidFriendly ? "ランク" : "Level";
  linesLabel.textContent = activeMode.kidFriendly ? "けした数" : "Lines";
  holdTitle.textContent = activeMode.kidFriendly ? "とっておく" : "Hold";
  nextTitle.textContent = activeMode.kidFriendly ? "つぎ" : "Next";
  holdButton.textContent = activeMode.kidFriendly ? "とっておく" : "Hold";
  pauseButton.textContent = activeMode.kidFriendly ? "お休み" : "Pause";
  restartButton.textContent = activeMode.kidFriendly ? "もう一回" : "Restart";
  overlayRestartButton.textContent = activeMode.kidFriendly ? "もう一回" : "Restart";
  document.querySelector('[data-action="rotate"]').textContent = activeMode.kidFriendly ? "回す" : "↻";
  document.querySelector('[data-action="softDrop"]').textContent = activeMode.kidFriendly ? "下へ" : "↓";
  document.querySelector('[data-action="hardDrop"]').textContent = activeMode.kidFriendly ? "一気に落とす" : "Drop";
  document.querySelector('[data-action="hold"]').textContent = activeMode.kidFriendly ? "とっておく" : "Hold";
  document.querySelector('[data-action="left"]').textContent = activeMode.kidFriendly ? "左" : "←";
  document.querySelector('[data-action="right"]').textContent = activeMode.kidFriendly ? "右" : "→";
  timerMetric.classList.toggle("hidden", !activeMode.timeLimit);
  statusStrip.classList.toggle("has-timer", Boolean(activeMode.timeLimit));
  updateSoundButton();
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
  combo = 0;
  dropCounter = 0;
  lockCounter = 0;
  dropInterval = getDropInterval();
  lastTime = performance.now();
  timeRemaining = activeMode.timeLimit;
  gameOver = false;
  paused = false;
  isAnimating = false;
  clearingLines = [];
  clearStartedAt = 0;
  clearAnimationToken += 1;
  pauseButton.textContent = activeMode.kidFriendly ? "お休み" : "Pause";
  updateStats();
  hideOverlay();
  draw();
  if (!animationId) animationId = requestAnimationFrame(update);
}

function getDropInterval() {
  return Math.max(activeMode.minSpeed, activeMode.initialSpeed - (level - 1) * activeMode.speedStep);
}

function update(time = 0) {
  const delta = Math.min(80, time - lastTime);
  lastTime = time;

  if (!paused && !gameOver && current && !isAnimating) {
    updateTimer(delta);
    dropCounter += delta;
    if (dropCounter > dropInterval) gravityDrop();
    handleLockDelay(delta);
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function updateTimer(delta) {
  if (!activeMode.timeLimit || timeRemaining === null) return;
  timeRemaining = Math.max(0, timeRemaining - delta / 1000);
  if (timeRemaining <= 0) {
    finishTimedChallenge();
  } else {
    updateTimerDisplay();
  }
}

function updateTimerDisplay() {
  if (timeRemaining === null) return;
  const total = Math.ceil(timeRemaining);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  timerEl.textContent = `${minutes}:${seconds}`;
}

function handleLockDelay(delta) {
  if (!current) return;
  if (collides(current.matrix, current.x, current.y + 1)) {
    lockCounter += delta;
    if (lockCounter >= activeMode.lockDelay) lockPiece();
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
    playSound("move");
  }
}

function softDrop(shouldScore = true) {
  if (!canAct()) return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
    dropCounter = 0;
    if (shouldScore) addScore(1);
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
  addScore(distance * 2, activeMode.kidFriendly ? "ナイス！" : "");
  if (activeMode.kidFriendly) showCheer("ナイス！");
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
      playSound("rotate");
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
  playSound("move");
  if (collides(current.matrix, current.x, current.y)) handleSpawnBlocked();
}

async function lockPiece() {
  if (!current || gameOver || isAnimating) return;
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

  playSound("land");
  current = null;
  const completedLines = findCompletedLines();
  if (completedLines.length > 0) {
    const completed = await clearCompletedLines(completedLines);
    if (!completed) return;
  } else {
    combo = 0;
  }
  if (!gameOver) spawnNextPiece();
}

function findCompletedLines() {
  const completed = [];
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      completed.push(y);
    }
  }
  return completed;
}

async function clearCompletedLines(completedLines) {
  isAnimating = true;
  clearingLines = completedLines.slice();
  clearStartedAt = performance.now();
  const token = ++clearAnimationToken;
  playLineClearEffect(completedLines.length);
  applyLineScore(completedLines.length);
  await wait(getLineClearDuration());
  if (token !== clearAnimationToken || gameOver) return false;
  removeCompletedLines(completedLines);
  clearingLines = [];
  clearStartedAt = 0;
  isAnimating = false;
  return true;
}

function removeCompletedLines(completedLines) {
  const clearSet = new Set(completedLines);
  board = board.filter((_, index) => !clearSet.has(index));
  while (board.length < ROWS) {
    board.unshift(Array(COLS).fill(null));
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getLineClearDuration() {
  return activeMode.kidFriendly ? KIDS_CLEAR_DURATION : NORMAL_CLEAR_DURATION;
}

function playLineClearEffect(cleared) {
  if (activeMode.kidFriendly) {
    if (cleared >= 4) showCheer("スーパープレー！");
    else if (cleared >= 3) showCheer("ビッグプレー！");
    else if (cleared >= 2) showCheer("ナイスプレー！");
  }
  if (cleared >= 4) playSound("clearMega");
  else if (cleared >= 2) playSound("clearBig");
  else playSound("clear");
}

function applyLineScore(cleared) {
  const previousLevel = level;
  combo += 1;
  lines += cleared;
  level = Math.floor(lines / activeMode.linesPerLevel) + 1;
  dropInterval = getDropInterval();

  let gained = LINE_POINTS[cleared] * level;
  if (activeMode.kidFriendly && combo > 1) gained += combo * 50;
  addScore(gained, activeMode.kidFriendly && combo > 1 ? `+${gained} コンボボーナス` : `+${gained}`);

  if (activeMode.kidFriendly) {
    if (cleared >= 4) showCheer("スーパープレー！");
    else if (cleared >= 3) showCheer("ビッグプレー！");
    else if (cleared >= 2) showCheer("ナイスプレー！");
    else if (combo > 1) showCheer("コンボ！");
    else showCheer("ナイスプレー！");
  }

  if (level > previousLevel) {
    playSound("level");
    if (activeMode.kidFriendly) showCheer(`${getRankName()}！`);
  }
  updateStats();
}

function spawnNextPiece() {
  current = next;
  next = createPiece();
  canHold = true;
  dropCounter = 0;
  lockCounter = 0;
  if (collides(current.matrix, current.x, current.y)) handleSpawnBlocked();
}

function handleSpawnBlocked() {
  if (activeMode.kidFriendly && rescueTopRows()) {
    showCheer("あと少し！");
    playSound("level");
    if (!collides(current.matrix, current.x, current.y)) return;
  }
  endGame();
}

function rescueTopRows() {
  const occupiedNearTop = board.slice(0, 4).some((row) => row.some(Boolean));
  if (!occupiedNearTop) return false;
  board.splice(0, 3);
  board.unshift(Array(COLS).fill(null), Array(COLS).fill(null), Array(COLS).fill(null));
  return true;
}

function addScore(points, label = "") {
  if (!points) return;
  score += points;
  updateStats();
  if (activeMode.kidFriendly && label) showScorePop(label);
}

function togglePause() {
  if (gameOver || isAnimating || modeScreen.classList.contains("hidden") === false) return;
  paused = !paused;
  pauseButton.textContent = paused ? (activeMode.kidFriendly ? "再開" : "Resume") : (activeMode.kidFriendly ? "お休み" : "Pause");
  if (paused) {
    showOverlay(activeMode.kidFriendly ? "ちょっと休けい" : "Paused", activeMode.kidFriendly ? "Pか再開でつづき" : "Press P or Pause to resume");
  } else {
    hideOverlay();
    lastTime = performance.now();
  }
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  current = null;
  isAnimating = false;
  clearingLines = [];
  clearAnimationToken += 1;
  playSound("over");
  saveBestScore();
  if (activeMode.kidFriendly) {
    showOverlay("またチャレンジ！", "もう一回やってみよう", true);
  } else {
    showOverlay("Game Over", "Press R or Restart to play again", true);
  }
}

function finishTimedChallenge() {
  if (gameOver) return;
  gameOver = true;
  current = null;
  isAnimating = false;
  clearingLines = [];
  clearAnimationToken += 1;
  timeRemaining = 0;
  updateTimerDisplay();
  playSound("over");
  saveBestScore();
  showOverlay("しあい終了！", "さいごまでがんばったね", true);
}

function canAct() {
  return current && !paused && !gameOver && !isAnimating && gameScreen.classList.contains("hidden") === false;
}

function updateStats() {
  scoreEl.textContent = score.toString();
  levelEl.textContent = activeMode.kidFriendly ? level.toString() : level.toString();
  linesEl.textContent = lines.toString();
  rankText.textContent = activeMode.kidFriendly ? getRankName() : "";
  if (activeMode.timeLimit) updateTimerDisplay();
}

function getRankName() {
  return RANKS[level - 1] ?? "レジェンド";
}

function showOverlay(title, text, includeStats = false) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayStats.innerHTML = includeStats ? getResultHtml() : "";
  overlayRestartButton.classList.toggle("hidden", !includeStats);
  overlay.classList.remove("hidden");
}

function getResultHtml() {
  const best = getBestScore(activeMode.id);
  if (activeMode.kidFriendly) {
    return `
      <div>今回のとくてん: ${score}</div>
      <div>ベスト: ${best}</div>
      <div>けした数: ${lines}</div>
      <div>ランク: ${getRankName()}</div>
    `;
  }
  return `
    <div>Score: ${score}</div>
    <div>Best: ${best}</div>
    <div>Lines: ${lines}</div>
    <div>Level: ${level}</div>
  `;
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlayRestartButton.classList.add("hidden");
}

function showCheer(message) {
  if (!activeMode.kidFriendly) return;
  cheerMessage.textContent = message;
  cheerMessage.classList.remove("hidden");
  cheerMessage.style.animation = "none";
  cheerMessage.offsetHeight;
  cheerMessage.style.animation = "";
  window.clearTimeout(showCheer.timer);
  showCheer.timer = window.setTimeout(() => cheerMessage.classList.add("hidden"), 900);
}

function showScorePop(message) {
  scorePop.textContent = message;
  scorePop.classList.remove("hidden");
  scorePop.style.animation = "none";
  scorePop.offsetHeight;
  scorePop.style.animation = "";
  window.clearTimeout(showScorePop.timer);
  showScorePop.timer = window.setTimeout(() => scorePop.classList.add("hidden"), 850);
}

function saveBestScore() {
  const best = getBestScore(activeMode.id);
  if (score > best) {
    safeStorageSet(`${BEST_PREFIX}${activeMode.id}`, String(score));
  }
  updateBestDisplays();
}

function getBestScore(modeId) {
  return Number(safeStorageGet(`${BEST_PREFIX}${modeId}`) || 0);
}

function updateBestDisplays() {
  document.querySelectorAll("[data-best]").forEach((element) => {
    element.textContent = getBestScore(element.dataset.best).toString();
  });
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
  ctx.fillStyle = activeMode.kidFriendly ? "#fff9dc" : "#15191d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = activeMode.kidFriendly ? "#f1d98a" : "#2f373d";
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
      if (type) drawCell(ctx, x * BLOCK, y * BLOCK, BLOCK, getColor(type), type, getClearEffect(y, x));
    }
  }
}

function getClearEffect(row, col) {
  if (!clearingLines.includes(row) || !clearStartedAt) return null;
  const elapsed = performance.now() - clearStartedAt;
  const progress = Math.min(1, elapsed / getLineClearDuration());
  const wave = activeMode.kidFriendly ? Math.sin(progress * Math.PI * 3 + col * 0.28) : 0;
  if (activeMode.kidFriendly) {
    return {
      progress,
      opacity: interpolateClear(progress, [1, 1, 0.95, 0.62, 0]),
      scale: interpolateClear(progress, [1, 1.13, 1.05 + wave * 0.025, 0.84, 0.15]),
      brightness: interpolateClear(progress, [1, 1.95, 1.65, 1.35, 2.05]),
      rotation: interpolateClear(progress, [0, -0.05, 0.05, 0, 0])
    };
  }
  return {
    progress,
    opacity: interpolateClear(progress, [1, 1, 0.75, 0.35, 0]),
    scale: interpolateClear(progress, [1, 1.08, 0.92, 0.58, 0.2]),
    brightness: interpolateClear(progress, [1, 1.8, 1.4, 1.75, 2])
  };
}

function interpolateClear(progress, values) {
  const stops = [0, 0.25, 0.6, 0.8, 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (progress <= stops[i + 1]) {
      const local = (progress - stops[i]) / (stops[i + 1] - stops[i]);
      return values[i] + (values[i + 1] - values[i]) * local;
    }
  }
  return values[values.length - 1];
}

function drawMatrix(targetCtx, matrix, offsetX, offsetY, size, type) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = offsetY + y;
      if (boardY < 0) return;
      drawCell(targetCtx, (offsetX + x) * size, boardY * size, size, getColor(type), type);
    });
  });
}

function drawPreview(targetCtx, matrix, type) {
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  targetCtx.fillStyle = activeMode.kidFriendly ? "#fff2bb" : "#252b31";
  targetCtx.fillRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  if (!matrix || !type) return;

  const width = matrix[0].length * PREVIEW_BLOCK;
  const height = matrix.length * PREVIEW_BLOCK;
  const startX = Math.floor((targetCtx.canvas.width - width) / 2);
  const startY = Math.floor((targetCtx.canvas.height - height) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawCell(targetCtx, startX + x * PREVIEW_BLOCK, startY + y * PREVIEW_BLOCK, PREVIEW_BLOCK, getColor(type), type);
    });
  });
}

function drawCell(targetCtx, x, y, size, color, type, effect = null) {
  if (effect) {
    targetCtx.save();
    targetCtx.globalAlpha = effect.opacity;
    targetCtx.filter = `brightness(${effect.brightness})`;
    targetCtx.translate(x + size / 2, y + size / 2);
    if (effect.rotation) targetCtx.rotate(effect.rotation);
    targetCtx.scale(effect.scale, effect.scale);
    x = -size / 2;
    y = -size / 2;
  }
  if (activeMode.kidFriendly) {
    drawKidCell(targetCtx, x, y, size, color, type);
    if (effect) {
      drawKidClearSparkles(targetCtx, x, y, size, effect.progress);
      targetCtx.restore();
    }
    return;
  }
  const gap = Math.max(1, size * 0.06);
  targetCtx.fillStyle = color;
  targetCtx.fillRect(x + gap, y + gap, size - gap * 2, size - gap * 2);
  targetCtx.fillStyle = "rgba(255, 255, 255, 0.22)";
  targetCtx.fillRect(x + gap, y + gap, size - gap * 2, Math.max(2, size * 0.18));
  targetCtx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  targetCtx.lineWidth = 2;
  targetCtx.strokeRect(x + gap, y + gap, size - gap * 2, size - gap * 2);
  if (effect) targetCtx.restore();
}

function drawKidClearSparkles(targetCtx, x, y, size, progress) {
  if (progress < 0.18 || progress > 0.82) return;
  const alpha = Math.sin((progress - 0.18) / 0.64 * Math.PI) * 0.85;
  targetCtx.save();
  targetCtx.globalAlpha = alpha;
  targetCtx.fillStyle = "#ffffff";
  targetCtx.font = `900 ${Math.floor(size * 0.28)}px system-ui, sans-serif`;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "middle";
  targetCtx.fillText("★", x + size * 0.78, y + size * 0.24);
  targetCtx.fillText("✦", x + size * 0.26, y + size * 0.72);
  targetCtx.restore();
}

function drawKidCell(targetCtx, x, y, size, color, type) {
  const gap = Math.max(2, size * 0.08);
  const rx = x + gap;
  const ry = y + gap;
  const cellSize = size - gap * 2;
  const radius = Math.max(7, size * 0.22);
  roundedRect(targetCtx, rx, ry, cellSize, cellSize, radius);
  targetCtx.fillStyle = color;
  targetCtx.fill();
  targetCtx.fillStyle = "rgba(255, 255, 255, 0.34)";
  roundedRect(targetCtx, rx + 3, ry + 3, cellSize - 6, Math.max(4, cellSize * 0.28), radius * 0.7);
  targetCtx.fill();
  targetCtx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  targetCtx.lineWidth = 2;
  roundedRect(targetCtx, rx, ry, cellSize, cellSize, radius);
  targetCtx.stroke();

  if (size >= 24) {
    targetCtx.fillStyle = "rgba(44, 58, 73, 0.56)";
    targetCtx.font = `900 ${Math.floor(size * 0.34)}px system-ui, sans-serif`;
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";
    targetCtx.fillText(KID_ICONS[type] ?? "★", x + size / 2, y + size / 2 + 1);
  }
}

function roundedRect(targetCtx, x, y, width, height, radius) {
  if (targetCtx.roundRect) {
    targetCtx.beginPath();
    targetCtx.roundRect(x, y, width, height, radius);
    return;
  }
  targetCtx.beginPath();
  targetCtx.moveTo(x + radius, y);
  targetCtx.lineTo(x + width - radius, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + radius);
  targetCtx.lineTo(x + width, y + height - radius);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  targetCtx.lineTo(x + radius, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - radius);
  targetCtx.lineTo(x, y + radius);
  targetCtx.quadraticCurveTo(x, y, x + radius, y);
}

function getColor(type) {
  return activeMode.kidFriendly ? KID_COLORS[type] : NORMAL_COLORS[type];
}

function handleAction(action) {
  if (gameScreen.classList.contains("hidden")) return;
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
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => selectMode(button.dataset.mode));
  });
  pauseButton.addEventListener("click", () => handleAction("pause"));
  restartButton.addEventListener("click", () => handleAction("restart"));
  overlayRestartButton.addEventListener("click", () => handleAction("restart"));
  holdButton.addEventListener("click", () => handleAction("hold"));
  modeBackButton.addEventListener("click", showModeScreen);
  soundButton.addEventListener("click", toggleSound);

  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    const repeatable = action === "left" || action === "right" || action === "softDrop";

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-pressed");
      handleAction(action);
      if (repeatable) {
        activeTouchInterval = window.setInterval(() => handleAction(action), action === "softDrop" ? 75 : 120);
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

function showModeScreen() {
  gameOver = true;
  current = null;
  isAnimating = false;
  clearingLines = [];
  clearAnimationToken += 1;
  hideOverlay();
  gameScreen.classList.add("hidden");
  modeScreen.classList.remove("hidden");
  document.body.classList.remove("kids-theme");
  updateBestDisplays();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  safeStorageSet("fallingBlocksSound", soundEnabled ? "on" : "off");
  updateSoundButton();
  if (soundEnabled) playSound("level");
}

function loadSoundSetting() {
  return safeStorageGet("fallingBlocksSound") !== "off";
}

function updateSoundButton() {
  soundButton.textContent = activeMode.kidFriendly ? (soundEnabled ? "音 ON" : "音 OFF") : (soundEnabled ? "Sound ON" : "Sound OFF");
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const table = {
      move: [280, 0.035, "square", 0.025],
      rotate: [420, 0.045, "triangle", 0.035],
      land: [150, 0.055, "sine", 0.04],
      clear: [620, 0.11, "triangle", 0.06],
      clearBig: [720, 0.14, "triangle", 0.075],
      clearMega: [860, 0.18, "sine", 0.085],
      level: [760, 0.15, "sine", 0.07],
      over: [120, 0.24, "sawtooth", 0.05]
    };
    const [frequency, duration, wave, volume] = table[type] ?? table.move;
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, now);
    if (type === "clear" || type === "clearBig" || type === "clearMega" || type === "level") {
      osc.frequency.exponentialRampToValueAtTime(frequency * (type === "clearMega" ? 1.65 : 1.35), now + duration);
    }
    if (type === "over") osc.frequency.exponentialRampToValueAtTime(70, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    soundEnabled = false;
    updateSoundButton();
  }
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

bindKeyboard();
bindButtons();
updateBestDisplays();
updateSoundButton();
