import { appState } from "./appState.js";
import { bus } from "./eventBus.js";
import { VideoController } from "./videoController.js";
import { GestureEngine } from "./gestureEngine.js";
import { UIRenderer } from "./uiRenderer.js";
import { AIRecorder } from "./aiRecorder.js";

function setStatus(model, cam) {
  const m = document.getElementById("modelStatus");
  const c = document.getElementById("cameraStatus");
  if (m) m.textContent = model;
  if (c) c.textContent = cam;
}

async function boot() {
  const video = new VideoController();
  const ui = new UIRenderer();
  const gestures = new GestureEngine();
  const recorder = new AIRecorder();

  video.init();
  ui.init();
  recorder.init();

  try {
    setStatus("Loading…", "Init…");
    await gestures.init();
    appState.set({ modelReady: true, cameraReady: true });
    bus.emit("model:ready", { ready: true });
    setStatus("Ready", "Ready");
  } catch (e) {
    console.error("[BOOT ERROR]", e);
    appState.set({ modelReady: false, cameraReady: false });
    bus.emit("model:ready", { ready: false });
    setStatus("Error", "Error");
    alert(`Initialization failed:\n${e.message || e}\n\nUse localhost/https and allow camera permission.`);
  }
}

boot();