/**
 * ============================================================
 * Gesture Controlled Video Player
 * script.js — Main application logic + Gesture Customizer + AI Gesture Recorder
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
const readoutVolume  = document.getElementById('readoutVolume');

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

// History
const historyList    = document.getElementById('historyList');

// Gesture guide container (dynamic)
const gestureGuide   = document.getElementById('gestureGuide');

// Customizer modal elements
const openCustomizerBtn   = document.getElementById('openCustomizer');
const customizerBackdrop  = document.getElementById('customizerBackdrop');
const modalClose          = document.getElementById('modalClose');
const cancelMappings      = document.getElementById('cancelMappings');
const saveMappings        = document.getElementById('saveMappings');
const resetMappings       = document.getElementById('resetMappings');
const actionSelects       = document.querySelectorAll('.action-select');

// AI Recorder modal elements
const openAiRecorderBtn    = document.getElementById('openAiRecorder');
const aiRecorderBackdrop   = document.getElementById('aiRecorderBackdrop');
const aiRecorderClose      = document.getElementById('aiRecorderClose');
const aiRecorderCancel     = document.getElementById('aiRecorderCancel');
const aiRecorderBack       = document.getElementById('aiRecorderBack');
const aiRecorderSave       = document.getElementById('aiRecorderSave');
const aiRecorderWebcam     = document.getElementById('aiRecorderWebcam');
const aiRecorderCanvas     = document.getElementById('aiRecorderCanvas');
const aiRecorderCtx        = aiRecorderCanvas.getContext('2d');
const aiStartRecord        = document.getElementById('aiStartRecord');
const aiCountdownNum       = document.getElementById('aiCountdownNum');
const aiCountdownRing      = document.getElementById('aiCountdownRing');
const aiRingFill           = document.getElementById('aiRingFill');
const aiHandIndicator      = document.getElementById('aiHandIndicator');
const aiAnalyzingMsg       = document.getElementById('aiAnalyzingMsg');
const aiLandmarkPreview    = document.getElementById('aiLandmarkPreview');
const aiResultIcon         = document.getElementById('aiResultIcon');
const aiResultName         = document.getElementById('aiResultName');
const aiResultDesc         = document.getElementById('aiResultDesc');
const aiResultAction       = document.getElementById('aiResultAction');
const aiFingerViz          = document.getElementById('aiFingerViz');
const aiGestureName        = document.getElementById('aiGestureName');
const aiActionGrid         = document.getElementById('aiActionGrid');
const aiSelectedAction     = document.getElementById('aiSelectedAction');
const aiRetryBtn           = document.getElementById('aiRetryBtn');
const customGesturesSection = document.getElementById('customGesturesSection');
const customGesturesTable   = document.getElementById('customGesturesTable');
const clearAllCustomBtn     = document.getElementById('clearAllCustom');

// ============================================================
// GESTURE → ACTION MAPPING SYSTEM
// ============================================================

const DEFAULT_GESTURE_MAPPINGS = {
  'open_palm':   'play',
  'closed_fist': 'pause',
  'swipe_right': 'seek_fwd',
  'swipe_left':  'seek_back',
  'vol_up':      'vol_up',
  'vol_down':    'vol_down',
  'swipe_up':    'fullscreen',
};

let gestureMappings = { ...DEFAULT_GESTURE_MAPPINGS };

const ACTION_DEFS = {
  'play':       { label: '▶ Play',         description: 'Play video'        },
  'pause':      { label: '⏸ Pause',        description: 'Pause video'       },
  'seek_fwd':   { label: '⏩ Seek +5s',     description: 'Skip forward 5s'  },
  'seek_back':  { label: '⏪ Seek −5s',     description: 'Skip back 5s'     },
  'vol_up':     { label: '🔊 Volume Up',    description: 'Increase volume'   },
  'vol_down':   { label: '🔉 Volume Down',  description: 'Decrease volume'   },
  'mute':       { label: '🔇 Mute Toggle',  description: 'Mute / unmute'     },
  'fullscreen': { label: '⛶ Fullscreen',   description: 'Toggle fullscreen' },
  'none':       { label: '— Disabled',      description: 'Do nothing'        },
};

const GESTURE_DISPLAY = {
  'open_palm':   { icon: '🖐️', label: 'Open Palm'   },
  'closed_fist': { icon: '✊',  label: 'Closed Fist' },
  'swipe_right': { icon: '👉', label: 'Swipe Right'  },
  'swipe_left':  { icon: '👈', label: 'Swipe Left'   },
  'vol_up':      { icon: '👆', label: 'Index Up'     },
  'vol_down':    { icon: '👇', label: 'Pinky Up'     },
  'swipe_up':    { icon: '🤙', label: 'Swipe Up'     },
  'none':        { icon: '✋', label: 'Waiting...'   },
};

/**
 * Custom AI-recorded gestures:
 * { key: string, name: string, icon: string, description: string,
 *   fingerPattern: number[], action: string }[]
 */
let customGestures = [];

// ============================================================
// STATE
// ============================================================
const state = {
  currentGesture:    'none',
  lastGesture:       'none',
  gestureConfidence: 0,

  lastActionTime:    0,
  DEBOUNCE_MS:       800,
  GESTURE_HOLD_MS:   400,
  gestureStartTime:  0,
  gestureHoldName:   '',

  swipeHistory:      [],
  SWIPE_WINDOW_MS:   600,
  SWIPE_THRESHOLD:   0.18,
  swipeUpThreshold:  0.18,

  frameTimestamps:   [],

  isPlaying:         false,
  isMuted:           false,

  VOLUME_STEP:       0.1,
  MAX_HISTORY:       20,
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

function showVolNotification(text) {
  let volNotify = document.getElementById('volNotify');
  if (!volNotify) {
    volNotify = document.createElement('div');
    volNotify.id = 'volNotify';
    volNotify.className = 'vol-notify';
    videoPlayer.closest('.video-container').appendChild(volNotify);
  }
  volNotify.textContent = text;
  volNotify.classList.add('show');
  clearTimeout(showVolNotification._timer);
  showVolNotification._timer = setTimeout(() => {
    volNotify.classList.remove('show');
  }, 900);
}

function showToast(message) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function nowTime() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => n.toString().padStart(2, '0'))
    .join(':');
}

// ============================================================
// GESTURE GUIDE — DYNAMIC RENDER
// ============================================================
function renderGestureGuide() {
  gestureGuide.innerHTML = '';

  // Built-in gestures
  for (const [gesture, action] of Object.entries(gestureMappings)) {
    if (action === 'none') continue;
    const display = GESTURE_DISPLAY[gesture];
    const actionDef = ACTION_DEFS[action];
    if (!display || !actionDef) continue;

    const div = document.createElement('div');
    div.className = 'guide-item';
    div.innerHTML = `
      <span class="guide-icon">${display.icon}</span>
      <span>${display.label} → ${actionDef.label}</span>
    `;
    gestureGuide.appendChild(div);
  }

  // Custom gestures
  for (const cg of customGestures) {
    const actionDef = ACTION_DEFS[cg.action];
    if (!actionDef || cg.action === 'none') continue;
    const div = document.createElement('div');
    div.className = 'guide-item guide-item-custom';
    div.innerHTML = `
      <span class="guide-icon">${cg.icon}</span>
      <span>${cg.name} → ${actionDef.label}</span>
      <span class="guide-ai-badge">AI</span>
    `;
    gestureGuide.appendChild(div);
  }
}

// ============================================================
// GESTURE HISTORY LOG
// ============================================================
function addToHistory(gestureName) {
  // Check if custom gesture
  const custom = customGestures.find(cg => cg.key === gestureName);
  let displayIcon, displayLabel, actionKey;

  if (custom) {
    displayIcon  = custom.icon;
    displayLabel = custom.name;
    actionKey    = custom.action;
  } else {
    const display = GESTURE_DISPLAY[gestureName] || GESTURE_DISPLAY['none'];
    displayIcon  = display.icon;
    displayLabel = display.label;
    actionKey    = gestureMappings[gestureName] || 'none';
  }

  const actionDef = ACTION_DEFS[actionKey] || ACTION_DEFS['none'];

  const empty = historyList.querySelector('.history-empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.className = `history-item ${gestureName}`;
  li.innerHTML = `
    <span class="history-gesture">
      <span>${displayIcon}</span>
      <span>${displayLabel} → ${actionDef.label}</span>
    </span>
    <span class="history-time">${nowTime()}</span>
  `;

  historyList.prepend(li);

  const items = historyList.querySelectorAll('.history-item');
  if (items.length > state.MAX_HISTORY) {
    items[items.length - 1].remove();
  }
}

// ============================================================
// FPS COUNTER
// ============================================================
function updateFPS() {
  const now = performance.now();
  state.frameTimestamps.push(now);
  state.frameTimestamps = state.frameTimestamps.filter(t => now - t < 1000);
  fpsDisplay.textContent = `FPS: ${state.frameTimestamps.length}`;
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
    .then(() => { updatePlayPauseUI(); })
    .catch(err => console.warn('[Player] Play blocked:', err));
}

function pauseVideo() {
  videoPlayer.pause();
  updatePlayPauseUI();
}

function seekVideo(delta) {
  const newTime = clamp(videoPlayer.currentTime + delta, 0, videoPlayer.duration || 0);
  videoPlayer.currentTime = newTime;
  showSeekNotification(delta > 0 ? `⏩ +${delta}s` : `⏪ ${delta}s`);
}

function changeVolume(delta) {
  const newVol = clamp(videoPlayer.volume + delta, 0, 1);
  videoPlayer.volume = newVol;
  volumeSlider.value = newVol;
  muteBtn.textContent = newVol === 0 ? '🔇' : '🔊';
  const pct = Math.round(newVol * 100);
  readoutVolume.textContent = `${pct}%`;
  showVolNotification(`${delta > 0 ? '🔊' : '🔉'} ${pct}%`);
}

function toggleMute() {
  videoPlayer.muted = !videoPlayer.muted;
  state.isMuted = videoPlayer.muted;
  muteBtn.textContent = videoPlayer.muted ? '🔇' : '🔊';
}

function toggleFullscreen() {
  const container = videoPlayer.closest('.video-container');
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => console.warn(err));
  } else {
    document.exitFullscreen();
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

progressWrap.addEventListener('click', (e) => {
  const rect = progressWrap.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  videoPlayer.currentTime = ratio * (videoPlayer.duration || 0);
});

playPauseBtn.addEventListener('click', () => {
  videoPlayer.paused ? playVideo() : pauseVideo();
});

seekBackBtn.addEventListener('click', () => seekVideo(-5));
seekFwdBtn.addEventListener('click',  () => seekVideo(+5));
muteBtn.addEventListener('click', toggleMute);

volumeSlider.addEventListener('input', () => {
  videoPlayer.volume = parseFloat(volumeSlider.value);
  const pct = Math.round(videoPlayer.volume * 100);
  readoutVolume.textContent = `${pct}%`;
  muteBtn.textContent = videoPlayer.volume === 0 ? '🔇' : '🔊';
});

fullscreenBtn.addEventListener('click', toggleFullscreen);
videoPlayer.addEventListener('timeupdate', updateProgress);
videoPlayer.addEventListener('play',   updatePlayPauseUI);
videoPlayer.addEventListener('pause',  updatePlayPauseUI);
videoPlayer.addEventListener('ended',  updatePlayPauseUI);
videoPlayer.addEventListener('loadedmetadata', updateProgress);

// ============================================================
// GESTURE RECOGNITION
// ============================================================
function getExtendedFingers(landmarks) {
  const tips  = [4, 8, 12, 16, 20];
  const mids  = [3, 7, 11, 15, 19];

  const fingers = [];
  const thumbExtended = Math.abs(landmarks[4].x - landmarks[2].x) > 0.04;
  fingers.push(thumbExtended ? 1 : 0);

  for (let i = 1; i < 5; i++) {
    fingers.push(landmarks[tips[i]].y < landmarks[mids[i]].y ? 1 : 0);
  }

  return fingers; // [thumb, index, middle, ring, pinky]
}

function classifyGesture(landmarks) {
  const fingers = getExtendedFingers(landmarks);
  const totalExtended = fingers.reduce((a, b) => a + b, 0);

  // Check custom gestures FIRST (higher priority)
  for (const cg of customGestures) {
    const pattern = cg.fingerPattern;
    if (!pattern || pattern.length !== 5) continue;
    // Count how many fingers match
    let matches = 0;
    for (let i = 0; i < 5; i++) {
      if (fingers[i] === pattern[i]) matches++;
    }
    if (matches >= 5) {
      return { name: cg.key, confidence: 0.92 };
    }
  }

  // Built-in classifications
  const fourOpen = fingers[1] + fingers[2] + fingers[3] + fingers[4];
  if (fourOpen >= 4) {
    return { name: 'open_palm', confidence: 0.9 + fourOpen * 0.02 };
  }

  if (totalExtended <= 1) {
    return { name: 'closed_fist', confidence: 0.85 + (1 - totalExtended) * 0.1 };
  }

  if (fingers[1] === 1 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 0) {
    return { name: 'vol_up', confidence: 0.87 };
  }

  if (fingers[1] === 0 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 1) {
    return { name: 'vol_down', confidence: 0.87 };
  }

  return { name: 'none', confidence: 0 };
}

function detectSwipe(landmarks) {
  const wrist = landmarks[0];
  const now   = Date.now();

  state.swipeHistory.push({ x: wrist.x, y: wrist.y, t: now });
  state.swipeHistory = state.swipeHistory.filter(p => now - p.t < state.SWIPE_WINDOW_MS);

  if (state.swipeHistory.length < 5) return null;

  const first = state.swipeHistory[0];
  const last  = state.swipeHistory[state.swipeHistory.length - 1];
  const dx    = last.x - first.x;
  const dy    = last.y - first.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy > absDx * 1.2 && dy < -state.swipeUpThreshold) {
    state.swipeHistory = [];
    return { name: 'swipe_up', confidence: 0.85 };
  }

  if (absDy > absDx * 0.8) return null;

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
// ACTION EXECUTOR
// ============================================================
function executeAction(actionKey) {
  switch (actionKey) {
    case 'play':       if (videoPlayer.paused) playVideo(); break;
    case 'pause':      if (!videoPlayer.paused) pauseVideo(); break;
    case 'seek_fwd':   seekVideo(+5); break;
    case 'seek_back':  seekVideo(-5); break;
    case 'vol_up':     changeVolume(+state.VOLUME_STEP); break;
    case 'vol_down':   changeVolume(-state.VOLUME_STEP); break;
    case 'mute':       toggleMute(); break;
    case 'fullscreen': toggleFullscreen(); break;
    default: break;
  }
}

// ============================================================
// ACTION DISPATCHER (debounced)
// ============================================================
function dispatchGestureAction(gestureName) {
  const now = Date.now();
  if (now - state.lastActionTime < state.DEBOUNCE_MS) return;
  state.lastActionTime = now;

  // Check custom gestures first
  const customGesture = customGestures.find(cg => cg.key === gestureName);
  let actionKey;

  if (customGesture) {
    actionKey = customGesture.action;
  } else {
    actionKey = gestureMappings[gestureName] || 'none';
  }

  if (actionKey === 'none') return;

  const actionDef = ACTION_DEFS[actionKey];
  console.log(`[Action] ${gestureName} → ${actionKey}`);

  readoutAction.textContent = actionDef?.label || '—';

  gestureBadge.classList.remove('triggered');
  void gestureBadge.offsetWidth;
  gestureBadge.classList.add('triggered');

  addToHistory(gestureName);
  executeAction(actionKey);
}

// ============================================================
// UPDATE GESTURE UI
// ============================================================
function updateGestureUI(gestureName, confidence) {
  // Check custom gesture first
  const custom = customGestures.find(cg => cg.key === gestureName);
  let icon, label;

  if (custom) {
    icon  = custom.icon;
    label = custom.name;
  } else {
    const display = GESTURE_DISPLAY[gestureName] || GESTURE_DISPLAY['none'];
    icon  = display.icon;
    label = display.label;
  }

  gestureIcon.textContent    = icon;
  gestureLabel.textContent   = label;
  readoutGesture.textContent = label;

  const pct = Math.min(100, Math.round(confidence * 100));
  confidenceFill.style.width  = `${pct}%`;
  confidenceLabel.textContent = `Confidence: ${pct}%`;
}

// ============================================================
// DRAW HAND LANDMARKS ON CANVAS
// ============================================================
function drawHands(results) {
  ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;

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

    [4, 8, 12, 16, 20].forEach(tipIdx => {
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

    const wrist = landmarks[0];
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(99, 179, 237, 0.9)';
    ctx.fillText(handedness, wrist.x * handCanvas.width - 10, wrist.y * handCanvas.height + 20);

    const fingers = getExtendedFingers(landmarks);
    readoutHand.textContent    = handedness;
    readoutFingers.textContent = `${fingers.reduce((a, b) => a + b, 0)} / 5`;
  });
}

// ============================================================
// MEDIAPIPE HANDS SETUP
// ============================================================
function initMediaPipe() {
  setStatus('Loading MediaPipe...', 'init');

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
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

    const swipe = detectSwipe(landmarks);
    if (swipe) {
      state.currentGesture = swipe.name;
      updateGestureUI(swipe.name, swipe.confidence);
      dispatchGestureAction(swipe.name);
      return;
    }

    const { name, confidence } = classifyGesture(landmarks);
    updateGestureUI(name, confidence);

    if (name === 'none') {
      state.gestureHoldName = '';
      state.currentGesture  = 'none';
      return;
    }

    if (name !== state.gestureHoldName) {
      state.gestureHoldName  = name;
      state.gestureStartTime = Date.now();
    } else {
      const heldMs = Date.now() - state.gestureStartTime;
      if (heldMs >= state.GESTURE_HOLD_MS && name !== state.currentGesture) {
        state.currentGesture = name;
        dispatchGestureAction(name);
      }
    }
  });

  return hands;
}

// ============================================================
// WEBCAM SETUP
// ============================================================
async function initWebcam(hands) {
  setStatus('Requesting camera...', 'init');

  try {
    const camera = new Camera(webcamEl, {
      onFrame: async () => { await hands.send({ image: webcamEl }); },
      width: 640, height: 480, facingMode: 'user',
    });
    await camera.start();
    setStatus('Ready — show your hand!', 'ready');

  } catch (err) {
    console.error('[Webcam] Error:', err);
    if (err.name === 'NotAllowedError') setStatus('Camera permission denied', 'error');
    else if (err.name === 'NotFoundError') setStatus('No camera found', 'error');
    else setStatus('Camera error — check console', 'error');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }, audio: false,
      });
      webcamEl.srcObject = stream;
      await webcamEl.play();
      const processFrame = async () => {
        if (webcamEl.readyState >= 2) await hands.send({ image: webcamEl });
        requestAnimationFrame(processFrame);
      };
      requestAnimationFrame(processFrame);
      setStatus('Ready (fallback mode)', 'ready');
    } catch (fallbackErr) {
      setStatus('Camera unavailable', 'error');
    }
  }
}

// ============================================================
// GESTURE CUSTOMIZER — MODAL LOGIC
// ============================================================
function openCustomizer() {
  actionSelects.forEach(select => {
    const gesture = select.dataset.gesture;
    select.value = gestureMappings[gesture] || 'none';
    select.closest('.customizer-row').classList.remove('changed');
    const preview = document.querySelector(`.cg-preview[data-gesture="${gesture}"]`);
    if (preview) preview.textContent = ACTION_DEFS[gestureMappings[gesture]]?.label || '—';
  });
  renderCustomGesturesInModal();
  customizerBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCustomizer() {
  customizerBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

function saveCustomizer() {
  const newMappings = {};
  actionSelects.forEach(select => {
    newMappings[select.dataset.gesture] = select.value;
  });
  gestureMappings = { ...newMappings };
  renderGestureGuide();
  closeCustomizer();
  showToast('✓ Gesture mappings saved!');
}

function resetToDefaults() {
  actionSelects.forEach(select => {
    const gesture = select.dataset.gesture;
    select.value = DEFAULT_GESTURE_MAPPINGS[gesture] || 'none';
    select.closest('.customizer-row').classList.remove('changed');
    const preview = document.querySelector(`.cg-preview[data-gesture="${gesture}"]`);
    if (preview) preview.textContent = ACTION_DEFS[DEFAULT_GESTURE_MAPPINGS[gesture]]?.label || '—';
  });
  showToast('↺ Reset to defaults (not saved yet)');
}

function renderCustomGesturesInModal() {
  if (customGestures.length === 0) {
    customGesturesSection.style.display = 'none';
    return;
  }
  customGesturesSection.style.display = 'block';
  customGesturesTable.innerHTML = '';

  customGestures.forEach(cg => {
    const actionDef = ACTION_DEFS[cg.action] || ACTION_DEFS['none'];
    const row = document.createElement('div');
    row.className = 'customizer-row';
    row.innerHTML = `
      <div class="customizer-gesture">
        <span class="cg-icon">${cg.icon}</span>
        <div>
          <div class="cg-name">${cg.name} <span class="ai-tag-inline">AI</span></div>
          <div class="cg-desc">${cg.description}</div>
        </div>
      </div>
      <select class="action-select custom-gesture-action-select" data-custom-key="${cg.key}">
        <option value="play"${cg.action==='play'?' selected':''}>▶ Play</option>
        <option value="pause"${cg.action==='pause'?' selected':''}>⏸ Pause</option>
        <option value="seek_fwd"${cg.action==='seek_fwd'?' selected':''}>⏩ Seek +5s</option>
        <option value="seek_back"${cg.action==='seek_back'?' selected':''}>⏪ Seek −5s</option>
        <option value="vol_up"${cg.action==='vol_up'?' selected':''}>🔊 Volume Up</option>
        <option value="vol_down"${cg.action==='vol_down'?' selected':''}>🔉 Volume Down</option>
        <option value="mute"${cg.action==='mute'?' selected':''}>🔇 Mute Toggle</option>
        <option value="fullscreen"${cg.action==='fullscreen'?' selected':''}>⛶ Fullscreen</option>
        <option value="none"${cg.action==='none'?' selected':''}>— None (Disable)</option>
      </select>
      <button class="btn-remove-custom" data-custom-key="${cg.key}" title="Remove">✕</button>
    `;
    customGesturesTable.appendChild(row);
  });

  // Wire up change handlers
  customGesturesTable.querySelectorAll('.custom-gesture-action-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.customKey;
      const cg = customGestures.find(g => g.key === key);
      if (cg) {
        cg.action = sel.value;
        renderGestureGuide();
      }
    });
  });

  // Wire up remove buttons
  customGesturesTable.querySelectorAll('.btn-remove-custom').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.customKey;
      customGestures = customGestures.filter(g => g.key !== key);
      renderCustomGesturesInModal();
      renderGestureGuide();
      showToast('Custom gesture removed');
    });
  });
}

// Select change live preview
actionSelects.forEach(select => {
  select.addEventListener('change', () => {
    const gesture = select.dataset.gesture;
    const actionKey = select.value;
    const row = select.closest('.customizer-row');
    const preview = document.querySelector(`.cg-preview[data-gesture="${gesture}"]`);
    if (preview) preview.textContent = ACTION_DEFS[actionKey]?.label || '—';
    const isDefault = DEFAULT_GESTURE_MAPPINGS[gesture] === actionKey;
    row.classList.toggle('changed', !isDefault);
  });
});

openCustomizerBtn.addEventListener('click', openCustomizer);
modalClose.addEventListener('click', closeCustomizer);
cancelMappings.addEventListener('click', closeCustomizer);
saveMappings.addEventListener('click', saveCustomizer);
resetMappings.addEventListener('click', resetToDefaults);
customizerBackdrop.addEventListener('click', (e) => {
  if (e.target === customizerBackdrop) closeCustomizer();
});
clearAllCustomBtn.addEventListener('click', () => {
  customGestures = [];
  renderCustomGesturesInModal();
  renderGestureGuide();
  showToast('All custom gestures removed');
});

// ============================================================
// AI GESTURE RECORDER — STATE & LOGIC
// ============================================================
const aiState = {
  phase: 1,           // 1=choose action, 2=record, 3=analyzing, 4=confirm, 'error'
  selectedAction: null,
  recordedLandmarks: [],  // array of landmark snapshots
  isRecording: false,
  recordInterval: null,
  countdownTimer: null,
  cameraStream: null,
  handsInstance: null,
  currentLandmarks: null, // live from AI recorder camera
  pendingResult: null,    // AI-analyzed result
};

function aiShowPhase(phase) {
  aiState.phase = phase;
  const phases = ['aiPhase1','aiPhase2','aiPhase3','aiPhase4','aiPhaseError'];
  phases.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  if (phase === 'error') {
    document.getElementById('aiPhaseError').classList.remove('hidden');
  } else {
    document.getElementById(`aiPhase${phase}`).classList.remove('hidden');
  }

  // Update step indicators
  [1,2,3,4].forEach(n => {
    const step = document.getElementById(`aiStep${n}`);
    if (!step) return;
    step.classList.remove('active', 'done');
    if (typeof phase === 'number') {
      if (n < phase) step.classList.add('done');
      if (n === phase) step.classList.add('active');
    }
  });

  // Button states
  aiRecorderSave.disabled = (phase !== 4);
  aiRecorderBack.disabled = (phase === 3);
}

async function openAiRecorder() {
  // Reset state
  aiState.phase = 1;
  aiState.selectedAction = null;
  aiState.recordedLandmarks = [];
  aiState.isRecording = false;
  aiState.pendingResult = null;
  aiState.currentLandmarks = null;

  // Reset UI
  document.querySelectorAll('.ai-action-btn').forEach(b => b.classList.remove('selected'));
  aiSelectedAction.textContent = 'None';
  aiGestureName.value = '';
  aiCountdownRing.classList.remove('active');
  aiStartRecord.disabled = false;
  aiStartRecord.textContent = '🎥 Start Recording (3s)';
  aiHandIndicator.innerHTML = '<span>✋ No hand detected</span>';
  aiHandIndicator.className = 'ai-hand-indicator';

  aiShowPhase(1);

  // Close customizer, open AI modal
  customizerBackdrop.classList.remove('open');
  aiRecorderBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Start AI recorder camera
  await startAiCamera();
}

async function startAiCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' }, audio: false
    });
    aiState.cameraStream = stream;
    aiRecorderWebcam.srcObject = stream;
    await aiRecorderWebcam.play();

    // Setup MediaPipe for AI recorder
    const handsAI = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    handsAI.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    handsAI.onResults((results) => {
      // Draw on AI recorder canvas
      if (aiRecorderWebcam.videoWidth > 0) {
        aiRecorderCanvas.width  = aiRecorderWebcam.videoWidth;
        aiRecorderCanvas.height = aiRecorderWebcam.videoHeight;
      }
      aiRecorderCtx.clearRect(0, 0, aiRecorderCanvas.width, aiRecorderCanvas.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        aiState.currentLandmarks = lm;

        drawConnectors(aiRecorderCtx, lm, HAND_CONNECTIONS, {
          color: 'rgba(104, 211, 145, 0.8)', lineWidth: 2
        });
        drawLandmarks(aiRecorderCtx, lm, {
          color: '#68d391', fillColor: 'rgba(104,211,145,0.4)', lineWidth: 1, radius: 4
        });

        // Update hand indicator
        if (aiState.phase === 2) {
          const fingers = getExtendedFingers(lm);
          const count = fingers.reduce((a,b)=>a+b,0);
          aiHandIndicator.innerHTML = `<span>✅ Hand detected — ${count}/5 fingers extended</span>`;
          aiHandIndicator.className = 'ai-hand-indicator detected';
        }

        // Collect samples during recording
        if (aiState.isRecording) {
          aiState.recordedLandmarks.push(lm.map(p => ({ x: p.x, y: p.y, z: p.z })));
        }
      } else {
        aiState.currentLandmarks = null;
        if (aiState.phase === 2) {
          aiHandIndicator.innerHTML = '<span>✋ No hand detected — show your hand</span>';
          aiHandIndicator.className = 'ai-hand-indicator';
        }
      }
    });

    aiState.handsInstance = handsAI;

    // Process frames for AI recorder
    const processAiFrame = async () => {
      if (!aiState.cameraStream) return;
      if (aiRecorderWebcam.readyState >= 2) {
        await handsAI.send({ image: aiRecorderWebcam });
      }
      aiState._rafId = requestAnimationFrame(processAiFrame);
    };
    requestAnimationFrame(processAiFrame);

  } catch (err) {
    console.error('[AI Recorder] Camera error:', err);
    showToast('⚠️ Camera unavailable for AI recorder');
  }
}

function stopAiCamera() {
  if (aiState._rafId) cancelAnimationFrame(aiState._rafId);
  if (aiState.cameraStream) {
    aiState.cameraStream.getTracks().forEach(t => t.stop());
    aiState.cameraStream = null;
  }
}

function closeAiRecorder() {
  stopAiCamera();
  clearTimeout(aiState.countdownTimer);
  clearInterval(aiState.recordInterval);
  aiState.isRecording = false;
  aiRecorderBackdrop.classList.remove('open');
  document.body.style.overflow = '';
  // Reopen customizer
  openCustomizer();
}

function closeAiRecorderFully() {
  stopAiCamera();
  clearTimeout(aiState.countdownTimer);
  clearInterval(aiState.recordInterval);
  aiState.isRecording = false;
  aiRecorderBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

// Action selection in phase 1
aiActionGrid.querySelectorAll('.ai-action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    aiActionGrid.querySelectorAll('.ai-action-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    aiState.selectedAction = btn.dataset.action;
    aiSelectedAction.textContent = btn.textContent;
    aiShowPhase(2);
  });
});

// Start recording
aiStartRecord.addEventListener('click', () => {
  if (!aiState.selectedAction) {
    showToast('Please choose an action first');
    aiShowPhase(1);
    return;
  }
  if (!aiState.currentLandmarks) {
    showToast('⚠️ No hand detected — show your hand to the camera first');
    return;
  }

  aiState.recordedLandmarks = [];
  aiState.isRecording = true;
  aiStartRecord.disabled = true;
  aiStartRecord.textContent = '⏺ Recording...';
  aiCountdownRing.classList.add('active');

  // Animate countdown ring
  let secondsLeft = 3;
  aiCountdownNum.textContent = secondsLeft;

  // SVG ring animation
  const circumference = 2 * Math.PI * 44; // r=44
  aiRingFill.style.strokeDasharray = circumference;
  aiRingFill.style.strokeDashoffset = circumference;

  const startTime = Date.now();
  const totalMs = 3000;

  function animateRing() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / totalMs, 1);
    const offset = circumference * (1 - progress);
    aiRingFill.style.strokeDashoffset = offset;
    const secs = Math.ceil((totalMs - elapsed) / 1000);
    if (secs !== secondsLeft) {
      secondsLeft = secs;
      if (secondsLeft > 0) aiCountdownNum.textContent = secondsLeft;
    }
    if (progress < 1) {
      requestAnimationFrame(animateRing);
    }
  }
  requestAnimationFrame(animateRing);

  aiState.countdownTimer = setTimeout(async () => {
    aiState.isRecording = false;
    aiCountdownRing.classList.remove('active');
    aiCountdownNum.textContent = '✓';
    aiStartRecord.textContent = '✓ Captured!';

    console.log(`[AI Recorder] Captured ${aiState.recordedLandmarks.length} frames`);

    if (aiState.recordedLandmarks.length < 2) {
      showAiError('Not enough frames captured. Make sure your hand is visible.');
      return;
    }

    await analyzeWithAI();
  }, totalMs);
});

// ============================================================
// AI ANALYSIS — calls Claude via Anthropic API
// ============================================================
async function analyzeWithAI() {
  aiShowPhase(3);

  // Compute median finger pattern from all captured frames
  const allFingerPatterns = aiState.recordedLandmarks.map(lm => getExtendedFingers(lm));
  const medianFingers = [0,1,2,3,4].map(i => {
    const vals = allFingerPatterns.map(p => p[i]);
    return vals.filter(v => v === 1).length > vals.length / 2 ? 1 : 0;
  });

  // Pick a representative landmark frame (middle frame)
  const midFrame = aiState.recordedLandmarks[Math.floor(aiState.recordedLandmarks.length / 2)];

  // Build compact landmark description for AI
  const landmarkSummary = midFrame.map((lm, i) => `LM${i}:(${lm.x.toFixed(3)},${lm.y.toFixed(3)},${lm.z.toFixed(3)})`).join(' ');
  const fingerNames = ['Thumb','Index','Middle','Ring','Pinky'];
  const fingerDesc = medianFingers.map((v,i) => `${fingerNames[i]}: ${v ? 'extended' : 'folded'}`).join(', ');

  // Draw a small 2D landmark sketch into a canvas for display
  renderLandmarkPreview(midFrame);

  aiAnalyzingMsg.textContent = 'Sending landmark data to Claude AI...';

  const prompt = `You are a hand gesture recognition AI. Analyze this hand pose and describe it.

FINGER STATES (from MediaPipe 21-landmark model):
${fingerDesc}

NORMALIZED LANDMARK COORDINATES (x,y,z — 0 to 1):
${landmarkSummary}

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "gestureName": "short human-readable name for this gesture (2-4 words max)",
  "description": "one sentence description of the hand shape",
  "emoji": "a single emoji that best represents this hand gesture",
  "confidence": a number from 0.0 to 1.0 indicating how clear/distinct this gesture is,
  "fingerSummary": "brief summary like 'index + middle extended, others folded'"
}`;

  try {
    aiAnalyzingMsg.textContent = 'Claude AI is interpreting your gesture...';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content.map(c => c.text || '').join('').trim();

    // Parse JSON — strip any accidental fences
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch(parseErr) {
      // Try to extract JSON substring
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
      else throw new Error('Could not parse AI response');
    }

    aiState.pendingResult = {
      gestureName:   result.gestureName   || 'Custom Gesture',
      description:   result.description   || 'A custom hand gesture',
      emoji:         result.emoji         || '🤚',
      confidence:    result.confidence    || 0.8,
      fingerSummary: result.fingerSummary || fingerDesc,
      fingerPattern: medianFingers,
    };

    aiAnalyzingMsg.textContent = 'Done! Review your gesture below.';
    showAiResult();

  } catch (err) {
    console.error('[AI Recorder] Analysis error:', err);
    // Fallback: generate name locally without API
    aiState.pendingResult = generateFallbackResult(medianFingers, fingerDesc);
    aiAnalyzingMsg.textContent = 'Used local analysis (API unavailable)';
    showAiResult();
  }
}

function generateFallbackResult(fingerPattern, fingerDesc) {
  const count = fingerPattern.reduce((a,b)=>a+b,0);
  const names = ['Thumb','Index','Middle','Ring','Pinky'];
  const extended = names.filter((n,i) => fingerPattern[i] === 1);

  let name = 'Custom Gesture';
  let emoji = '🤚';

  if (count === 2 && fingerPattern[1] && fingerPattern[2]) { name = 'Peace Sign'; emoji = '✌️'; }
  else if (count === 2 && fingerPattern[0] && fingerPattern[4]) { name = 'Rock On'; emoji = '🤘'; }
  else if (count === 3 && fingerPattern[1] && fingerPattern[2] && fingerPattern[3]) { name = 'Three Fingers'; emoji = '🖖'; }
  else if (count === 0) { name = 'Closed Fist'; emoji = '✊'; }
  else if (count === 5) { name = 'Open Palm'; emoji = '🖐️'; }
  else if (count === 1 && fingerPattern[0]) { name = 'Thumbs Up'; emoji = '👍'; }
  else { name = `${count}-Finger Pose`; emoji = '🤚'; }

  return {
    gestureName: name,
    description: `Hand pose with ${extended.join(', ')} extended.`,
    emoji,
    confidence: 0.75,
    fingerSummary: fingerDesc,
    fingerPattern,
  };
}

function renderLandmarkPreview(landmarks) {
  aiLandmarkPreview.innerHTML = '';
  const size = 120;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.borderRadius = '8px';
  canvas.style.background = 'rgba(99,179,237,0.05)';
  canvas.style.border = '1px solid rgba(99,179,237,0.2)';

  const c = canvas.getContext('2d');

  // Scale landmarks to canvas
  const xs = landmarks.map(l => l.x);
  const ys = landmarks.map(l => l.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const pad = 12;

  const toCanvas = (lm) => ({
    x: pad + ((lm.x - minX) / rangeX) * (size - pad*2),
    y: pad + ((lm.y - minY) / rangeY) * (size - pad*2),
  });

  // Draw connections
  HAND_CONNECTIONS.forEach(([a, b]) => {
    const pa = toCanvas(landmarks[a]);
    const pb = toCanvas(landmarks[b]);
    c.beginPath();
    c.moveTo(pa.x, pa.y);
    c.lineTo(pb.x, pb.y);
    c.strokeStyle = 'rgba(99,179,237,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
  });

  // Draw landmarks
  landmarks.forEach((lm, i) => {
    const p = toCanvas(lm);
    const isTip = [4,8,12,16,20].includes(i);
    c.beginPath();
    c.arc(p.x, p.y, isTip ? 4 : 2.5, 0, Math.PI*2);
    c.fillStyle = isTip ? '#68d391' : '#9f7aea';
    c.fill();
  });

  aiLandmarkPreview.appendChild(canvas);
}

function showAiResult() {
  const r = aiState.pendingResult;
  if (!r) return;

  aiResultIcon.textContent = r.emoji;
  aiResultName.textContent = r.gestureName;
  aiResultDesc.textContent = r.description;
  aiResultAction.textContent = ACTION_DEFS[aiState.selectedAction]?.label || '—';
  aiGestureName.value = r.gestureName;

  // Render finger viz chips
  aiFingerViz.innerHTML = '';
  const names = ['👍 Thumb','☝️ Index','🖕 Middle','💍 Ring','🤙 Pinky'];
  r.fingerPattern.forEach((v, i) => {
    const chip = document.createElement('span');
    chip.className = `finger-chip ${v ? 'extended' : 'folded'}`;
    chip.textContent = names[i] + (v ? ' ✓' : ' ✗');
    aiFingerViz.appendChild(chip);
  });

  aiShowPhase(4);
}

function showAiError(msg) {
  document.getElementById('aiErrorMsg').textContent = msg;
  aiShowPhase('error');
}

aiRetryBtn.addEventListener('click', () => {
  aiState.recordedLandmarks = [];
  aiState.isRecording = false;
  clearTimeout(aiState.countdownTimer);
  aiStartRecord.disabled = false;
  aiStartRecord.textContent = '🎥 Start Recording (3s)';
  aiCountdownRing.classList.remove('active');
  aiShowPhase(2);
});

// Back button logic
aiRecorderBack.addEventListener('click', () => {
  if (aiState.phase === 2) aiShowPhase(1);
  else if (aiState.phase === 4) {
    aiState.recordedLandmarks = [];
    aiState.isRecording = false;
    aiStartRecord.disabled = false;
    aiStartRecord.textContent = '🎥 Start Recording (3s)';
    aiCountdownRing.classList.remove('active');
    aiShowPhase(2);
  } else if (aiState.phase === 'error') {
    aiShowPhase(2);
  } else {
    closeAiRecorder();
  }
});

// Save custom gesture
aiRecorderSave.addEventListener('click', () => {
  const r = aiState.pendingResult;
  if (!r || !aiState.selectedAction) return;

  const customName = aiGestureName.value.trim() || r.gestureName;
  const key = `custom_${Date.now()}`;

  const newGesture = {
    key,
    name: customName,
    icon: r.emoji,
    description: r.description,
    fingerPattern: r.fingerPattern,
    action: aiState.selectedAction,
  };

  customGestures.push(newGesture);
  renderGestureGuide();

  closeAiRecorder();
  showToast(`🤖 Custom gesture "${customName}" saved!`);
  console.log('[AI Recorder] Saved custom gesture:', newGesture);
});

aiRecorderClose.addEventListener('click', () => closeAiRecorderFully());
aiRecorderCancel.addEventListener('click', () => closeAiRecorder());
aiRecorderBackdrop.addEventListener('click', (e) => {
  if (e.target === aiRecorderBackdrop) closeAiRecorder();
});
openAiRecorderBtn.addEventListener('click', openAiRecorder);

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (aiRecorderBackdrop.classList.contains('open')) closeAiRecorder();
    else if (customizerBackdrop.classList.contains('open')) closeCustomizer();
  }
});

// ============================================================
// BOOT
// ============================================================
async function boot() {
  console.log('=== Gesture Video Player Booting ===');

  renderGestureGuide();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('Browser not supported', 'error');
    return;
  }

  if (
    location.protocol !== 'https:' &&
    location.hostname !== 'localhost' &&
    location.hostname !== '127.0.0.1'
  ) {
    console.warn('[Boot] Not on HTTPS — camera may be blocked');
    setStatus('HTTPS required for camera', 'error');
  }

  const hands = initMediaPipe();
  await new Promise(resolve => setTimeout(resolve, 500));
  await initWebcam(hands);

  console.log('=== Boot complete ===');
}

boot();
