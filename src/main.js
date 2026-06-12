const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const fpsEl = document.getElementById('fps');
const statusEl = document.getElementById('status');

// FPS over a rolling one-second window
let frameCount = 0;
let fpsWindowStart = performance.now();

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
  statusEl.textContent = `Camera live at ${video.videoWidth}×${video.videoHeight}.`;
}

function renderLoop() {
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  frameCount++;
  const now = performance.now();
  if (now - fpsWindowStart >= 1000) {
    fpsEl.textContent = `FPS: ${Math.round((frameCount * 1000) / (now - fpsWindowStart))}`;
    frameCount = 0;
    fpsWindowStart = now;
  }

  requestAnimationFrame(renderLoop);
}

startCamera()
  .then(() => requestAnimationFrame(renderLoop))
  .catch((err) => {
    statusEl.textContent = `Camera error: ${err.message}`;
  });
