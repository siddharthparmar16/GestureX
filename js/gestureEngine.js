import { appState } from "./appState.js";
import { bus } from "./eventBus.js";

export class GestureEngine {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.webcam = document.getElementById("webcam");
    this.canvas = document.getElementById("handCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.alpha = 0.3; // EMA
    this.smoothConf = 0;
    this.voteWindow = [];
    this.voteSize = 8;

    this.wristHistory = []; // motion detection
    this.waveHistory = [];  // direction history
    this.frameTs = [];

    this.cooldownsMs = {
      open_palm: 700,
      closed_fist: 700,
      swipe_right: 500,
      swipe_left: 500,
      peace_sign: 900,
      wave_lr: 1200,
      rock_up: 300,
      rock_down: 300,
      none: 0,
    };

    this.gestureToAction = {
      open_palm: "play",
      closed_fist: "pause",
      swipe_right: "seek_fwd",
      swipe_left: "seek_back",
      peace_sign: "toggle_2x",
      wave_lr: "fullscreen",
      rock_up: "vol_up",
      rock_down: "vol_down",
      none: "none",
    };
  }

  async init() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API unavailable. Use localhost/https.");
    }
    if (typeof Hands === "undefined") {
      throw new Error("MediaPipe Hands script not loaded.");
    }

    // Preflight permission
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach(t => t.stop());

    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6
    });
    this.hands.onResults((res) => this.onResults(res));

    // Prefer Camera helper; fallback to getUserMedia loop
    if (typeof Camera !== "undefined") {
      this.camera = new Camera(this.webcam, {
        onFrame: async () => {
          if (this.webcam.readyState >= 2) await this.hands.send({ image: this.webcam });
        },
        width: 640,
        height: 480,
        facingMode: "user"
      });
      await this.camera.start();
    } else {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      this.webcam.srcObject = s;
      await this.webcam.play();
      const loop = async () => {
        if (this.webcam.readyState >= 2) await this.hands.send({ image: this.webcam });
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    appState.set({ modelReady: true, cameraReady: true });
    bus.emit("model:ready", { ready: true });
  }

  onResults(results) {
    this.updateFPS();

    if (this.webcam.videoWidth > 0) {
      this.canvas.width = this.webcam.videoWidth;
      this.canvas.height = this.webcam.videoHeight;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!results.multiHandLandmarks?.length) {
      bus.emit("gesture:detected", { gesture: "none", confidence: 0, action: "none", vector63: null });
      return;
    }

    const lm = results.multiHandLandmarks[0];
    drawConnectors(this.ctx, lm, HAND_CONNECTIONS, { color: "rgba(77,163,255,.75)", lineWidth: 2 });
    drawLandmarks(this.ctx, lm, { color: "#8b5dff", fillColor: "rgba(139,93,255,.35)", radius: 3 });

    const vector63 = this.landmarksTo63(lm);
    const pred = this.classify(lm, vector63);

    this.smoothConf = this.alpha * pred.confidence + (1 - this.alpha) * this.smoothConf;
    this.voteWindow.push(pred.gesture);
    if (this.voteWindow.length > this.voteSize) this.voteWindow.shift();

    const gesture = this.majorityVote(this.voteWindow);
    const action = this.gestureToAction[gesture] || "none";

    bus.emit("gesture:detected", { gesture, confidence: this.smoothConf, action, vector63 });

    if (gesture !== "none" && this.canFire(gesture)) {
      appState.setCooldown(gesture, Date.now());
      appState.set({ lastAction: action });
      bus.emit("action:executed", { gesture, action, ts: Date.now() });
    }
  }

  classify(lm, vector63) {
    const fingers = this.getExtendedFingers(lm);
    const wrist = lm[0];

    this.wristHistory.push({ x: wrist.x, y: wrist.y, t: Date.now() });
    this.wristHistory = this.wristHistory.filter(p => Date.now() - p.t < 900);

    // 1) Open palm
    const fourOpen = fingers[1] + fingers[2] + fingers[3] + fingers[4];
    if (fourOpen >= 4) return { gesture: "open_palm", confidence: 0.9 };

    // 2) Closed fist
    if (fingers.reduce((a, b) => a + b, 0) <= 1) return { gesture: "closed_fist", confidence: 0.88 };

    // 3/4) Swipe right/left
    const swipe = this.detectSwipe();
    if (swipe) return { gesture: swipe, confidence: 0.86 };

    // 5) Peace sign
    if (fingers[1] && fingers[2] && !fingers[3] && !fingers[4]) {
      return { gesture: "peace_sign", confidence: 0.85 };
    }

    // 8) Wave left-right oscillation
    const wave = this.detectWave();
    if (wave) return { gesture: "wave_lr", confidence: 0.82 };

    // 9) Rock sign + vertical motion
    const rock = fingers[0] && fingers[1] && !fingers[2] && !fingers[3] && fingers[4];
    if (rock) {
      const dy = this.motionDY();
      if (dy < -0.03) return { gesture: "rock_up", confidence: 0.83 };
      if (dy > 0.03) return { gesture: "rock_down", confidence: 0.83 };
    }

    // Custom prototype matching fallback
    const custom = this.matchPrototype(vector63);
    if (custom) return custom;

    return { gesture: "none", confidence: 0.2 };
  }

  detectSwipe() {
    if (this.wristHistory.length < 6) return null;
    const first = this.wristHistory[0];
    const last = this.wristHistory[this.wristHistory.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (Math.abs(dx) > 0.14 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      return dx < 0 ? "swipe_right" : "swipe_left"; // mirrored camera
    }
    return null;
  }

  detectWave() {
    if (this.wristHistory.length < 8) return null;
    const n = this.wristHistory.length;
    const a = this.wristHistory[n - 1].x - this.wristHistory[n - 2].x;
    const dir = a > 0.01 ? 1 : a < -0.01 ? -1 : 0;
    if (dir !== 0) this.waveHistory.push({ dir, t: Date.now() });
    this.waveHistory = this.waveHistory.filter(d => Date.now() - d.t < 900);
    if (this.waveHistory.length < 4) return null;

    // alternating directions count
    let flips = 0;
    for (let i = 1; i < this.waveHistory.length; i++) {
      if (this.waveHistory[i].dir !== this.waveHistory[i - 1].dir) flips++;
    }
    return flips >= 3 ? "wave_lr" : null;
    }

  motionDY() {
    if (this.wristHistory.length < 4) return 0;
    const first = this.wristHistory[0];
    const last = this.wristHistory[this.wristHistory.length - 1];
    return last.y - first.y;
  }

  canFire(gesture) {
    const last = appState.getCooldown(gesture);
    const cd = this.cooldownsMs[gesture] ?? 700;
    return Date.now() - last > cd;
  }

  majorityVote(arr) {
    const count = {};
    for (const x of arr) count[x] = (count[x] || 0) + 1;
    return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
  }

  getExtendedFingers(lm) {
    const tips = [4, 8, 12, 16, 20];
    const mids = [3, 7, 11, 15, 19];
    const out = [];
    out.push(Math.abs(lm[4].x - lm[2].x) > 0.04 ? 1 : 0); // thumb
    for (let i = 1; i < 5; i++) out.push(lm[tips[i]].y < lm[mids[i]].y ? 1 : 0);
    return out;
  }

  landmarksTo63(lm) {
    const base = lm[0];
    const vec = [];
    for (const p of lm) vec.push(p.x - base.x, p.y - base.y, p.z - base.z);
    return vec;
  }

  cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return (!na || !nb) ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  matchPrototype(vec) {
    const protos = appState.get().gesturePrototypes;
    let best = null;
    for (const p of protos) {
      const sim = this.cosine(vec, p.embedding);
      if (sim > 0.86 && (!best || sim > best.confidence)) {
        best = { gesture: p.id, confidence: sim };
      }
    }
    return best;
  }

  updateFPS() {
    const now = performance.now();
    this.frameTs.push(now);
    this.frameTs = this.frameTs.filter(t => now - t < 1000);
    appState.set({ fps: this.frameTs.length });
  }
}