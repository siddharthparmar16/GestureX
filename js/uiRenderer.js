import { appState } from "./appState.js";
import { bus } from "./eventBus.js";

const ICONS = {
  none: "✋",
  open_palm: "🖐️",
  closed_fist: "✊",
  swipe_right: "👉",
  swipe_left: "👈",
  peace_sign: "✌️",
  wave_lr: "👋",
  rock_up: "🤟",
  rock_down: "🤟",
};

export class UIRenderer {
  constructor() {
    this.modelStatus = document.getElementById("modelStatus");
    this.cameraStatus = document.getElementById("cameraStatus");
    this.gestureIcon = document.getElementById("gestureIcon");
    this.gestureLabel = document.getElementById("gestureLabel");
    this.confidenceFill = document.getElementById("confidenceFill");
    this.confidenceText = document.getElementById("confidenceText");
    this.readGesture = document.getElementById("readGesture");
    this.readAction = document.getElementById("readAction");
    this.fps = document.getElementById("fps");
    this.historyList = document.getElementById("historyList");
  }

  init() {
    bus.on("model:ready", ({ ready }) => {
      this.modelStatus.textContent = ready ? "Ready" : "Error";
    });

    bus.on("gesture:detected", ({ gesture, confidence, action }) => {
      appState.set({ currentGesture: gesture, currentConfidence: confidence });
      this.gestureIcon.textContent = ICONS[gesture] || "🤚";
      this.gestureLabel.textContent = gesture.replaceAll("_", " ");
      this.readGesture.textContent = gesture;
      this.readAction.textContent = action;
      this.confidenceFill.style.width = `${Math.round(confidence * 100)}%`;
      this.confidenceText.textContent = `Confidence: ${Math.round(confidence * 100)}%`;

      const s = appState.get();
      this.cameraStatus.textContent = s.cameraReady ? "Ready" : "Init…";
      this.fps.textContent = String(s.fps || "—");
    });

    bus.on("action:executed", ({ gesture, action, ts }) => {
      appState.pushHistory({
        gesture,
        action,
        at: new Date(ts).toLocaleTimeString()
      });
      this.renderHistory();
    });

    this.renderHistory();
  }

  renderHistory() {
    const data = appState.get().history;
    if (!data.length) {
      this.historyList.innerHTML = `<li class="history-empty">No events yet.</li>`;
      return;
    }
    this.historyList.innerHTML = data.map(x => `
      <li class="history-item">
        <span>${x.gesture} → ${x.action}</span>
        <span>${x.at}</span>
      </li>
    `).join("");
  }
}