import { appState } from "./appState.js";
import { bus } from "./eventBus.js";

export class VideoController {
  constructor() {
    this.video = document.getElementById("videoPlayer");
    this.btnPlayPause = document.getElementById("btnPlayPause");
    this.btnSeekBack = document.getElementById("btnSeekBack");
    this.btnSeekFwd = document.getElementById("btnSeekFwd");
    this.btnMute = document.getElementById("btnMute");
    this.btnFullscreen = document.getElementById("btnFullscreen");
    this.volumeSlider = document.getElementById("volumeSlider");
    this.timeDisplay = document.getElementById("timeDisplay");
    this.progressWrap = document.getElementById("progressWrap");
    this.progressFill = document.getElementById("progressFill");
  }

  init() {
    this.btnPlayPause.addEventListener("click", () => this.togglePlayPause());
    this.btnSeekBack.addEventListener("click", () => this.seek(-5));
    this.btnSeekFwd.addEventListener("click", () => this.seek(5));
    this.btnMute.addEventListener("click", () => this.toggleMute());
    this.btnFullscreen.addEventListener("click", () => this.toggleFullscreen());

    this.volumeSlider.addEventListener("input", () => {
      this.video.volume = Number(this.volumeSlider.value);
      appState.set({ volume: this.video.volume });
    });

    this.video.addEventListener("timeupdate", () => this.updateProgress());
    this.video.addEventListener("loadedmetadata", () => this.updateProgress());

    this.progressWrap.addEventListener("click", (e) => {
      const rect = this.progressWrap.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      this.video.currentTime = ratio * (this.video.duration || 0);
    });

    bus.on("action:executed", ({ action }) => this.applyAction(action));
  }

  applyAction(action) {
    switch (action) {
      case "play": this.play(); break;
      case "pause": this.pause(); break;
      case "seek_fwd": this.seek(5); break;
      case "seek_back": this.seek(-5); break;
      case "toggle_2x": this.toggle2x(); break;
      case "fullscreen": this.toggleFullscreen(); break;
      case "vol_up": this.changeVolume(0.08); break;
      case "vol_down": this.changeVolume(-0.08); break;
      default: break;
    }
  }

  play() { this.video.play().catch(() => {}); }
  pause() { this.video.pause(); }
  togglePlayPause() { this.video.paused ? this.play() : this.pause(); }
  seek(delta) {
    const d = this.video.duration || 0;
    this.video.currentTime = Math.max(0, Math.min(d, this.video.currentTime + delta));
  }
  toggle2x() { this.video.playbackRate = this.video.playbackRate === 2 ? 1 : 2; }
  toggleMute() {
    this.video.muted = !this.video.muted;
    appState.set({ muted: this.video.muted });
  }
  changeVolume(delta) {
    const v = Math.max(0, Math.min(1, this.video.volume + delta));
    this.video.volume = v;
    this.volumeSlider.value = String(v);
    appState.set({ volume: v });
  }
  toggleFullscreen() {
    const target = this.video.closest(".video-wrap");
    if (!document.fullscreenElement) target.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  updateProgress() {
    const cur = this.video.currentTime || 0;
    const dur = this.video.duration || 0;
    this.progressFill.style.width = `${dur ? (cur / dur) * 100 : 0}%`;
    this.timeDisplay.textContent = `${this.format(cur)} / ${this.format(dur)}`;
  }
  format(s) {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${sec}`;
  }
}