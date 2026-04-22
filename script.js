/**
 * ============================================================
 * Gesture Controlled Video Player
 * script.js — Main application logic
 * ============================================================
 */

'use strict';

// ============================================================
// DOM REFERENCES
// ============================================================
const videoPlayer    = document.getElementById('videoPlayer');
const webcamEl       = document.getElementById('webcam');
const handCanvas     = document.getElementById('handCanvas');
const ctx            = handCanvas.getContext('2d');

// Header status
const statusPill     = document.getElementById('statusPill');
const statusDot      = document.getElementById('statusDot');
const statusText     = document.getElementById('statusText');

// Gesture overlay (on video)
const gestureBadge   = document.getElementById('gestureBadge');
const gestureIcon    = document.getElementById('gestureIcon');
const gestureLabel   = document.getElementById('gestureLabel');

// Seek notification
const seekNotify     = document.getElementById('seekNotify');

// Readout panel
const readoutGesture = document.getElementById('readoutGesture');
const readoutHand    = document.getElementById('readoutHand');
const readoutFingers = document.getElementById('readoutFingers');
const readoutAction  = document.getElementById('readoutAction');

// Confidence
const confidenceFill  = document.getElementById('confidenceFill');
const confidenceLabel = document.getElementById('confidenceLabel');

// FPS
const fpsDisplay     = document.getElementById('fpsDisplay');

// Controls
const playPauseBtn   = document.getElementById('playPauseBtn');
const playIcon       = document.getElementById('playIcon');
const pauseIcon      = document.getElementById('pauseIcon');
const seekBackBtn    = document.getElementById('seekBackBtn');
const seekFwdBtn     = document.getElementById('seekFwdBtn');
const muteBtn        = document.getElementById('muteBtn');
const volumeSlider   = document.getElementById('volumeSlider');
const progressWrap   = document.getElementById('progressWrap');
const progressFill   = document.getElementById('progressFill');
const progressThumb  = document.getElementById('progressThumb');
const timeDisplay    = document.getElementById('timeDisplay');
const fullscreenBtn  = document.getElementById('fullscreenBtn');

// ============================================================
// STATE
// ============================================================
const state = {
  // Gesture tracking
  currentGesture:    'none',
  lastGesture:       'none',
  gestureConfidence: 0,

  // Debounce / timing
  lastActionTime:    0,
  DEBOUNCE_MS:       800,       // Minimum ms between actions
  GESTURE_HOLD_MS:   400,       // How long gesture must be held
  gestureStartTime:  0,
  gestureHoldName:   '',

  // Swipe detection
  swipeHistory:      [],
  SWIPE_WINDOW_MS:   600,
  SWIPE_THRESHOLD:   0.18,      // Normalised distance across frame

  // FPS tracking
  frameTimestamps:   [],

  // Video
  isPlaying:         false,
  isMuted:           false,

  // ── NEW ── track whether 2x speed is active
  is2xSpeed:         false,
};

// Gesture metadata: icon + label + action description
const GESTURE_META = {
  'open_palm':    { icon: '🖐️', label: 'Open Palm',    action: '▶ Play'          },
  'closed_fist':  { icon: '✊', label: 'Closed Fist',  action: '⏸ Pause'         },
  'swipe_right':  { icon: '👉', label: 'Swipe Right',  action: '⏩ +5 Seconds'    },
  'swipe_left':   { icon: '👈', label: 'Swipe Left',   action: '⏪ −5 Seconds'    },
  // ── NEW ──
  'cheese':       { icon: '✌️', label: 'Cheese!',      action: '⚡ 2× Speed'      },
  'none':         { icon: '✋', label: 'Waiting...',    action: '—'               },
};

// ============================================================
// UTILITY HELPERS
// ============================================================
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setStatus(msg, type = 'init') {
  statusText.textContent = msg;
  statusPill.className = `status-pill ${type}`;
  console.log(`[Status] ${msg}`);
}

function showSeekNotification(text) {
  seekNotify.textContent = text;
  seekNotify.classList.add('show');
  clearTimeout(showSeekNotification._timer);
  showSeekNotification._timer = setTimeout(() => {
    seekNotify.classList.remove('show');
  }, 900);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ============================================================
// FPS COUNTER
// ============================================================
function updateFPS() {
  const now = performance.now();
  state.frameTimestamps.push(now);
  // Keep only last 30 frames
  state.frameTimestamps = state.frameTimestamps.filter(t => now - t < 1000);
  const fps = state.frameTimestamps.length;
  fpsDisplay.textContent = `FPS: ${fps}`;
}

// ============================================================
// VIDEO PLAYER CONTROLS
// ============================================================
function updatePlayPauseUI() {
  if (!videoPlayer.paused) {
    playIcon.style.display  = 'none';
    pauseIcon.style.display = '';
  } else {
    playIcon.style.display  = '';
    pauseIcon.style.display = 'none';
  }
  state.isPlaying = !videoPlayer.paused;
}

function playVideo() {
  videoPlayer.play()
    .then(() => { updatePlayPauseUI(); console.log('[Player] Playing'); })
    .catch(err => console.warn('[Player] Play blocked:', err));
}

function pauseVideo() {
  videoPlayer.pause();
  updatePlayPauseUI();
  console.log('[Player] Paused');
}

function seekVideo(delta) {
  const newTime = clamp(videoPlayer.currentTime + delta, 0, videoPlayer.duration || 0);
  videoPlayer.currentTime = newTime;
  const label = delta > 0 ? `⏩ +${delta}s` : `⏪ ${delta}s`;
  showSeekNotification(label);
  console.log(`[Player] Seeked ${delta > 0 ? '+' : ''}${delta}s → ${formatTime(newTime)}`);
}

// ── NEW ── Set playback speed and show notification
function setPlaybackSpeed(rate) {
  videoPlayer.playbackRate = rate;
  state.is2xSpeed = rate === 2.0;

  if (rate === 2.0) {
    showSeekNotification('⚡ 2× Speed');
    console.log('[Player] Playback speed set to 2×');
  } else {
    showSeekNotification('▶ 1× Speed');
    console.log('[Player] Playback speed reset to 1×');
  }
}

// Progress bar
function updateProgress() {
  if (!videoPlayer.duration) return;
  const pct = (videoPlayer.currentTime / videoPlayer.duration) * 100;
  progressFill.style.width = `${pct}%`;
  progressThumb.style.left = `${pct}%`;
  timeDisplay.textContent  = `${formatTime(videoPlayer.currentTime)} / ${formatTime(videoPlayer.duration)}`;
}

// Scrub on click
progressWrap.addEventListener('click', (e) => {
  const rect = progressWrap.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  videoPlayer.currentTime = ratio * (videoPlayer.duration || 0);
});

// Play / Pause button
playPauseBtn.addEventListener('click', () => {
  videoPlayer.paused ? playVideo() : pauseVideo();
});

// Seek buttons
seekBackBtn.addEventListener('click', () => seekVideo(-5));
seekFwdBtn.addEventListener('click',  () => seekVideo(+5));

// Mute
muteBtn.addEventListener('click', () => {
  videoPlayer.muted = !videoPlayer.muted;
  state.isMuted = videoPlayer.muted;
  muteBtn.textContent = videoPlayer.muted ? '🔇' : '🔊';
});

// Volume
volumeSlider.addEventListener('input', () => {
  videoPlayer.volume = parseFloat(volumeSlider.value);
  muteBtn.textContent = videoPlayer.volume === 0 ? '🔇' : '🔊';
});

// Fullscreen
fullscreenBtn.addEventListener('click', () => {
  const container = videoPlayer.closest('.video-container');
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => console.warn(err));
  } else {
    document.exitFullscreen();
  }
});

// Video events
videoPlayer.addEventListener('timeupdate', updateProgress);
videoPlayer.addEventListener('play',   updatePlayPauseUI);
videoPlayer.addEventListener('pause',  updatePlayPauseUI);
videoPlayer.addEventListener('ended',  updatePlayPauseUI);
videoPlayer.addEventListener('loadedmetadata', updateProgress);

// ── NEW ── Reset speed to 1× when video ends
videoPlayer.addEventListener('ended', () => {
  if (state.is2xSpeed) {
    setPlaybackSpeed(1.0);
  }
});

// ============================================================
// GESTURE RECOGNITION
// ============================================================

/**
 * Count how many fingers are extended.
 * Returns array: [thumb, index, middle, ring, pinky] — 1 = extended
 */
function getExtendedFingers(landmarks) {
  const tips  = [4, 8, 12, 16, 20];
  const mids  = [3, 7, 11, 15, 19];
  const bases = [2, 6, 10, 14, 18];

  const fingers = [];

  // Thumb: compare x instead of y (sideways movement)
  const thumbExtended = Math.abs(landmarks[4].x - landmarks[2].x) > 0.04;
  fingers.push(thumbExtended ? 1 : 0);

  // Other four fingers: tip y < pip y means extended
  for (let i = 1; i < 5; i++) {
    const tipY = landmarks[tips[i]].y;
    const midY = landmarks[mids[i]].y;
    fingers.push(tipY < midY ? 1 : 0);
  }

  return fingers;  // [thumb, index, middle, ring, pinky]
}

/**
 * Determine gesture name from landmarks
 */
function classifyGesture(landmarks) {
  const fingers = getExtendedFingers(landmarks);

  // fingers[0] = thumb
  // fingers[1] = index
  // fingers[2] = middle
  // fingers[3] = ring
  // fingers[4] = pinky

  const totalExtended = fingers.reduce((a, b) => a + b, 0);

  console.debug('[Gesture] Fingers extended:', fingers, '| Total:', totalExtended);

  // ── NEW ── Cheese / Peace / Victory gesture
  // Index UP, Middle UP, Ring DOWN, Pinky DOWN
  // Thumb can be either — not strict
  if (
    fingers[1] === 1 &&   // index up
    fingers[2] === 1 &&   // middle up
    fingers[3] === 0 &&   // ring down
    fingers[4] === 0      // pinky down
  ) {
    return { name: 'cheese', confidence: 0.92 };
  }

  // Open Palm: all four fingers extended
  const fourOpen = fingers[1] + fingers[2] + fingers[3] + fingers[4];
  if (fourOpen >= 4) {
    return { name: 'open_palm', confidence: 0.9 + fourOpen * 0.02 };
  }

  // Closed Fist: 0 or 1 finger extended
  if (totalExtended <= 1) {
    return { name: 'closed_fist', confidence: 0.85 + (1 - totalExtended) * 0.1 };
  }

  return { name: 'none', confidence: 0 };
}

/**
 * Detect swipe from wrist movement history
 */
function detectSwipe(landmarks) {
  const wrist = landmarks[0];
  const now   = Date.now();

  state.swipeHistory.push({ x: wrist.x, y: wrist.y, t: now });
  state.swipeHistory = state.swipeHistory.filter(p => now - p.t < state.SWIPE_WINDOW_MS);

  if (state.swipeHistory.length < 5) return null;

  const first = state.swipeHistory[0];
  const last  = state.swipeHistory[state.swipeHistory.length - 1];
  const dx    = last.x - first.x;
  const dy    = Math.abs(last.y - first.y);

  if (dy > Math.abs(dx) * 0.8) return null;

  if (dx < -state.SWIPE_THRESHOLD) {
    state.swipeHistory = [];
    return { name: 'swipe_right', confidence: 0.88 };
  }
  if (dx > state.SWIPE_THRESHOLD) {
    state.swipeHistory = [];
    return { name: 'swipe_left', confidence: 0.88 };
  }

  return null;
}

// ============================================================
// ACTION DISPATCHER (debounced)
// ============================================================
function dispatchGestureAction(gestureName) {
  const now = Date.now();
  if (now - state.lastActionTime < state.DEBOUNCE_MS) {
    console.debug('[Debounce] Skipped action:', gestureName);
    return;
  }
  state.lastActionTime = now;

  console.log(`[Action] Dispatching: ${gestureName}`);
  readoutAction.textContent = GESTURE_META[gestureName]?.action || '—';

  // Animate badge
  gestureBadge.classList.remove('triggered');
  void gestureBadge.offsetWidth;
  gestureBadge.classList.add('triggered');

  switch (gestureName) {

    case 'open_palm':
      // Play and reset speed back to 1× when open palm shown
      if (videoPlayer.paused) playVideo();
      if (state.is2xSpeed) setPlaybackSpeed(1.0);
      break;

    case 'closed_fist':
      if (!videoPlayer.paused) pauseVideo();
      break;

    case 'swipe_right':
      seekVideo(+5);
      break;

    case 'swipe_left':
      seekVideo(-5);
      break;

    // ── NEW ── Cheese gesture → 2× speed
    case 'cheese':
      // Make sure video is playing first
      if (videoPlayer.paused) playVideo();
      // Only set if not already at 2×
      if (!state.is2xSpeed) {
        setPlaybackSpeed(2.0);
      }
      break;

    default:
      break;
  }
}

// ============================================================
// UPDATE GESTURE UI
// ============================================================
function updateGestureUI(gestureName, confidence) {
  const meta = GESTURE_META[gestureName] || GESTURE_META['none'];
  gestureIcon.textContent    = meta.icon;
  gestureLabel.textContent   = meta.label;
  readoutGesture.textContent = meta.label;

  const pct = Math.min(100, Math.round(confidence * 100));
  confidenceFill.style.width  = `${pct}%`;
  confidenceLabel.textContent = `Confidence: ${pct}%`;
}

// ============================================================
// DRAW HAND LANDMARKS ON CANVAS
// ============================================================
function drawHands(results) {
  ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    return;
  }

  results.multiHandLandmarks.forEach((landmarks, index) => {
    const handedness = results.multiHandedness?.[index]?.label || 'Unknown';

    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: 'rgba(99, 179, 237, 0.7)',
      lineWidth: 2,
    });

    drawLandmarks(ctx, landmarks, {
      color: '#9f7aea',
      fillColor: 'rgba(159, 122, 234, 0.5)',
      lineWidth: 1,
      radius: 4,
    });

    // Highlight fingertips
    const fingertips = [4, 8, 12, 16, 20];
    fingertips.forEach(tipIdx => {
      const lm = landmarks[tipIdx];
      const cx = lm.x * handCanvas.width;
      const cy = lm.y * handCanvas.height;

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(104, 211, 145, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#68d391';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // ── NEW ── Highlight index and middle tips in yellow when cheese gesture
    const fingers = getExtendedFingers(landmarks);
    if (fingers[1] === 1 && fingers[2] === 1 && fingers[3] === 0 && fingers[4] === 0) {
      [8, 12].forEach(tipIdx => {
        const lm = landmarks[tipIdx];
        const cx = lm.x * handCanvas.width;
        const cy = lm.y * handCanvas.height;

        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 220, 50, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Hand label
    const wrist = landmarks[0];
    const lx = wrist.x * handCanvas.width;
    const ly = wrist.y * handCanvas.height;
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(99, 179, 237, 0.9)';
    ctx.fillText(handedness, lx - 10, ly + 20);

    readoutHand.textContent    = handedness;
    readoutFingers.textContent = `${fingers.reduce((a, b) => a + b, 0)} / 5`;
  });
}

// ============================================================
// MEDIAPIPE HANDS SETUP
// ============================================================
function initMediaPipe() {
  console.log('[MediaPipe] Initialising Hands...');
  setStatus('Loading MediaPipe...', 'init');

  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands:            1,
    modelComplexity:        1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence:  0.6,
  });

  hands.onResults((results) => {
    if (webcamEl.videoWidth > 0) {
      handCanvas.width  = webcamEl.videoWidth;
      handCanvas.height = webcamEl.videoHeight;
    }

    updateFPS();
    drawHands(results);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (state.currentGesture !== 'none') {
        state.currentGesture  = 'none';
        state.gestureHoldName = '';
        updateGestureUI('none', 0);
        readoutAction.textContent = 'Waiting';
      }
      confidenceFill.style.width  = '0%';
      confidenceLabel.textContent = 'Confidence: —';
      return;
    }

    const landmarks = results.multiHandLandmarks[0];

    // Swipe detection (high priority)
    const swipe = detectSwipe(landmarks);
    if (swipe) {
      state.currentGesture = swipe.name;
      updateGestureUI(swipe.name, swipe.confidence);
      dispatchGestureAction(swipe.name);
      return;
    }

    // Static gesture classification
    const { name, confidence } = classifyGesture(landmarks);
    updateGestureUI(name, confidence);

    if (name === 'none') {
      state.gestureHoldName = '';
      state.currentGesture  = 'none';
      return;
    }

    // Gesture hold logic
    if (name !== state.gestureHoldName) {
      state.gestureHoldName  = name;
      state.gestureStartTime = Date.now();
      console.debug('[Gesture] Holding:', name);
    } else {
      const heldMs = Date.now() - state.gestureStartTime;
      if (heldMs >= state.GESTURE_HOLD_MS) {
        if (name !== state.currentGesture) {
          state.currentGesture = name;
          dispatchGestureAction(name);
        }
      }
    }
  });

  return hands;
}

// ============================================================
// WEBCAM SETUP
// ============================================================
async function initWebcam(hands) {
  console.log('[Webcam] Requesting camera access...');
  setStatus('Requesting camera...', 'init');

  try {
    const camera = new Camera(webcamEl, {
      onFrame: async () => {
        await hands.send({ image: webcamEl });
      },
      width:  640,
      height: 480,
      facingMode: 'user',
    });

    await camera.start();
    console.log('[Webcam] Camera started successfully.');
    setStatus('Ready — show your hand!', 'ready');

  } catch (err) {
    console.error('[Webcam] Error:', err);

    if (err.name === 'NotAllowedError') {
      setStatus('Camera permission denied', 'error');
    } else if (err.name === 'NotFoundError') {
      setStatus('No camera found', 'error');
    } else {
      setStatus('Camera error — check console', 'error');
    }

    // Fallback
    try {
      console.log('[Webcam] Trying fallback getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      webcamEl.srcObject = stream;
      await webcamEl.play();

      const processFrame = async () => {
        if (webcamEl.readyState >= 2) {
          await hands.send({ image: webcamEl });
        }
        requestAnimationFrame(processFrame);
      };
      requestAnimationFrame(processFrame);

      console.log('[Webcam] Fallback camera started.');
      setStatus('Ready (fallback mode)', 'ready');

    } catch (fallbackErr) {
      console.error('[Webcam] Fallback also failed:', fallbackErr);
      setStatus('Camera unavailable', 'error');
    }
  }
}

// ============================================================
// BOOT
// ============================================================
async function boot() {
  console.log('=== Gesture Video Player Booting ===');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('Browser not supported', 'error');
    console.error('[Boot] getUserMedia not supported');
    return;
  }

  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    console.warn('[Boot] Not on HTTPS — camera may be blocked');
    setStatus('HTTPS required for camera', 'error');
  }

  const hands = initMediaPipe();
  await new Promise(resolve => setTimeout(resolve, 500));
  await initWebcam(hands);

  console.log('=== Boot complete ===');
}

boot();
