import { appState } from "./appState.js";
import { bus } from "./eventBus.js";

export class AIRecorder {
  constructor() {
    this.samples = [];
    this.minQuality = 0.58;
    this.maxMotion = 0.3;

    this.nameInput = document.getElementById("customGestureName");
    this.actionSelect = document.getElementById("customGestureAction");
    this.recordBtn = document.getElementById("recordSampleBtn");
    this.saveBtn = document.getElementById("saveCustomGestureBtn");
    this.resetBtn = document.getElementById("resetSamplesBtn");
    this.status = document.getElementById("recordStatus");
  }

  init() {
    this.recordBtn.addEventListener("click", () => this.recordOne());
    this.saveBtn.addEventListener("click", () => this.save());
    this.resetBtn.addEventListener("click", () => this.reset());
    this.updateStatus();
  }

  async recordOne() {
    const seq = [];
    const off = bus.on("gesture:detected", ({ vector63 }) => {
      if (Array.isArray(vector63) && vector63.length === 63) seq.push(vector63);
    });

    this.status.textContent = "Recording sample… hold steady";
    await new Promise(r => setTimeout(r, 1200));
    off();

    if (seq.length < 12) {
      this.status.textContent = "Rejected: low visibility (too few frames).";
      return;
    }

    const q = this.quality(seq);
    if (q < this.minQuality) {
      this.status.textContent = `Rejected: noisy sample (${q.toFixed(2)}).`;
      return;
    }

    this.samples.push({ seq, q });
    this.updateStatus();

    if (this.samples.length >= 3) {
      this.saveBtn.disabled = false;
      this.status.textContent = `3/3 samples ready. Avg quality ${this.avgQ().toFixed(2)}`;
    }
  }

  quality(seq) {
    let m = 0;
    for (let i = 1; i < seq.length; i++) m += this.dist(seq[i], seq[i - 1]);
    m /= (seq.length - 1);
    return Math.max(0, 1 - (m / this.maxMotion));
  }

  dist(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  }

  avgQ() {
    return this.samples.reduce((acc, s) => acc + s.q, 0) / this.samples.length;
  }

  averageEmbedding() {
    const all = this.samples.flatMap(s => s.seq);
    const out = new Array(63).fill(0);
    for (const v of all) for (let i = 0; i < 63; i++) out[i] += v[i];
    for (let i = 0; i < 63; i++) out[i] /= all.length;
    return out;
  }

  save() {
    const name = this.nameInput.value.trim();
    if (!name) return this.status.textContent = "Enter gesture name first.";
    if (this.samples.length < 3) return this.status.textContent = "Capture 3 valid samples first.";

    const id = `custom_${Date.now()}`;
    appState.addPrototype({
      id,
      name,
      action: this.actionSelect.value,
      embedding: this.averageEmbedding(),
      meta: { quality: this.avgQ(), createdAt: Date.now() }
    });

    this.status.textContent = `Saved "${name}"`;
    this.reset();
  }

  reset() {
    this.samples = [];
    this.saveBtn.disabled = true;
    this.updateStatus();
  }

  updateStatus() {
    this.status.textContent = `Samples: ${this.samples.length} / 3`;
  }
}