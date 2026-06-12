import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Recognizer } from './recognizer.js';
import { loadTemplates, saveTemplates, exportTemplates, importTemplates } from './templates.js';

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const fpsEl = document.getElementById('fps');
const inferEl = document.getElementById('infer');
const statusEl = document.getElementById('status');

const pinchRatioEl = document.getElementById('pinch-ratio');
const penIndicatorEl = document.getElementById('pen-indicator');
const thresholdInput = document.getElementById('pinch-threshold');
const thresholdValueEl = document.getElementById('pinch-threshold-value');

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;

// Release threshold sits above the pinch threshold so the pen state
// doesn't flicker when the ratio hovers at the boundary.
const HYSTERESIS = 1.25;

// Landmark connections for drawing the hand skeleton
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// FPS over a rolling one-second window
let frameCount = 0;
let fpsWindowStart = performance.now();
let lastVideoTime = -1;
let landmarker = null;
let lastLandmarks = null;
let penDown = false;

// Current stroke: index fingertip positions in overlay pixel coordinates
let strokePoints = [];
const pointCountEl = document.getElementById('point-count');
const matchEl = document.getElementById('match');

const recognizer = new Recognizer();

// --- Train mode ---
const runeNameInput = document.getElementById('rune-name');
const trainToggleBtn = document.getElementById('train-toggle');
const trainStatusEl = document.getElementById('train-status');
const runeListEl = document.getElementById('rune-list');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');

let templates = loadTemplates();
let training = false;
let trainingRune = '';

function rebuildRecognizer() {
  recognizer.templates = [];
  for (const [name, samples] of Object.entries(templates)) {
    for (const sample of samples) recognizer.addTemplate(name, sample);
  }
}

function renderRuneList() {
  runeListEl.innerHTML = '';
  for (const [name, samples] of Object.entries(templates)) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${name} — ${samples.length} sample${samples.length === 1 ? '' : 's'}`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      delete templates[name];
      saveTemplates(templates);
      rebuildRecognizer();
      renderRuneList();
    });
    li.append(label, del);
    runeListEl.appendChild(li);
  }
}

trainToggleBtn.addEventListener('click', () => {
  if (training) {
    training = false;
    trainToggleBtn.textContent = 'Start training';
    trainStatusEl.textContent = '';
    return;
  }
  const name = runeNameInput.value.trim();
  if (!name) {
    trainStatusEl.textContent = 'Type a rune name first.';
    return;
  }
  training = true;
  trainingRune = name;
  trainToggleBtn.textContent = 'Stop training';
  trainStatusEl.textContent = `Recording samples for "${name}" — draw with pinch.`;
});

exportBtn.addEventListener('click', () => {
  const blob = new Blob([exportTemplates(templates)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spell-spiff-templates.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  if (!file) return;
  try {
    templates = importTemplates(templates, await file.text());
    saveTemplates(templates);
    rebuildRecognizer();
    renderRuneList();
    trainStatusEl.textContent = 'Import complete.';
  } catch (err) {
    trainStatusEl.textContent = `Import failed: ${err.message}`;
  }
  importInput.value = '';
});

rebuildRecognizer();
renderRuneList();

thresholdInput.addEventListener('input', () => {
  thresholdValueEl.textContent = Number(thresholdInput.value).toFixed(2);
});

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Pinch ratio: thumb-tip-to-index-tip distance normalized by hand size
// (wrist to middle MCP), so it holds across distances from the camera.
function pinchRatio(landmarks) {
  const handSize = dist(landmarks[WRIST], landmarks[MIDDLE_MCP]);
  if (handSize === 0) return Infinity;
  return dist(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / handSize;
}

function updatePenState(landmarks) {
  const wasDown = penDown;
  const ratio = pinchRatio(landmarks);
  const threshold = Number(thresholdInput.value);
  if (penDown) {
    if (ratio > threshold * HYSTERESIS) penDown = false;
  } else if (ratio < threshold) {
    penDown = true;
  }
  pinchRatioEl.textContent = `Pinch: ${ratio.toFixed(2)}`;
  penIndicatorEl.textContent = penDown ? 'PEN DOWN' : 'PEN UP';
  penIndicatorEl.className = penDown ? 'pen-down' : 'pen-up';

  if (penDown && !wasDown) onStrokeStart();
  if (penDown) {
    strokePoints.push({
      x: landmarks[INDEX_TIP].x * overlay.width,
      y: landmarks[INDEX_TIP].y * overlay.height,
    });
    pointCountEl.textContent = `Points: ${strokePoints.length}`;
  }
  if (!penDown && wasDown) onStrokeEnd();
}

function onStrokeStart() {
  strokePoints = [];
  pointCountEl.textContent = 'Points: 0';
}

function onStrokeEnd() {
  // The finished stroke stays visible until the next stroke starts.
  if (strokePoints.length < 5) return; // ignore accidental taps

  if (training) {
    templates[trainingRune] = templates[trainingRune] || [];
    templates[trainingRune].push(strokePoints.map((p) => ({ x: p.x, y: p.y })));
    saveTemplates(templates);
    recognizer.addTemplate(trainingRune, strokePoints);
    renderRuneList();
    trainStatusEl.textContent =
      `Recorded sample ${templates[trainingRune].length} for "${trainingRune}".`;
    return;
  }

  const result = recognizer.recognize(strokePoints);
  if (result) {
    matchEl.textContent =
      `Match: ${result.name} (${result.score.toFixed(2)}, ${result.timeMs.toFixed(1)} ms)`;
  } else {
    matchEl.textContent = 'Match: no templates';
  }
}

function drawStroke() {
  if (strokePoints.length < 2) return;
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
  for (let i = 1; i < strokePoints.length; i++) {
    ctx.lineTo(strokePoints[i].x, strokePoints[i].y);
  }
  ctx.stroke();
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((resolve) => {
    video.onloadedmetadata = resolve;
  });
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

async function loadLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(
    new URL('../node_modules/@mediapipe/tasks-vision/wasm', import.meta.url).href
  );
  landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/hand_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });
}

function drawHand(landmarks) {
  ctx.strokeStyle = 'rgba(0, 255, 160, 0.7)';
  ctx.lineWidth = 2;
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * overlay.width, landmarks[a].y * overlay.height);
    ctx.lineTo(landmarks[b].x * overlay.width, landmarks[b].y * overlay.height);
    ctx.stroke();
  }
  landmarks.forEach((lm, i) => {
    ctx.beginPath();
    ctx.arc(lm.x * overlay.width, lm.y * overlay.height, i === INDEX_TIP ? 8 : 4, 0, Math.PI * 2);
    ctx.fillStyle = i === INDEX_TIP ? '#ff3b6b' : '#00ffa0';
    ctx.fill();
  });
}

function renderLoop() {
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (landmarker && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, performance.now());
    inferEl.textContent = `Infer: ${(performance.now() - t0).toFixed(1)} ms`;
    if (result.landmarks.length > 0) {
      lastLandmarks = result.landmarks[0];
      updatePenState(lastLandmarks);
    } else {
      lastLandmarks = null;
      if (penDown) onStrokeEnd();
      penDown = false;
      penIndicatorEl.textContent = 'PEN UP';
      penIndicatorEl.className = 'pen-up';
      pinchRatioEl.textContent = 'Pinch: --';
    }
  }

  if (lastLandmarks) drawHand(lastLandmarks);

  drawStroke();

  frameCount++;
  const now = performance.now();
  if (now - fpsWindowStart >= 1000) {
    fpsEl.textContent = `FPS: ${Math.round((frameCount * 1000) / (now - fpsWindowStart))}`;
    frameCount = 0;
    fpsWindowStart = now;
  }

  requestAnimationFrame(renderLoop);
}

(async () => {
  try {
    statusEl.textContent = 'Starting camera…';
    await startCamera();
    statusEl.textContent = 'Loading hand landmarker…';
    await loadLandmarker();
    statusEl.textContent = `Tracking one hand at ${video.videoWidth}×${video.videoHeight}.`;
    requestAnimationFrame(renderLoop);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
})();
