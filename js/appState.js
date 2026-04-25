const initialState = {
  modelReady: false,
  cameraReady: false,
  fps: 0,
  currentGesture: "none",
  currentConfidence: 0,
  lastAction: "none",
  volume: 1,
  muted: false,
  history: [],
  cooldowns: {},
  gesturePrototypes: []
};

class AppState {
  constructor() { this.state = structuredClone(initialState); }
  get() { return this.state; }
  set(partial) { this.state = { ...this.state, ...partial }; return this.state; }
  pushHistory(item, max = 30) {
    this.state.history = [item, ...this.state.history].slice(0, max);
  }
  setCooldown(key, ts) { this.state.cooldowns[key] = ts; }
  getCooldown(key) { return this.state.cooldowns[key] || 0; }
  addPrototype(p) { this.state.gesturePrototypes.push(p); }
}
export const appState = new AppState();