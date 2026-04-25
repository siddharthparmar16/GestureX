export class EventBus {
  constructor() { this.events = new Map(); }
  on(name, fn) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    const set = this.events.get(name);
    if (!set) return;
    set.delete(fn);
    if (!set.size) this.events.delete(name);
  }
  emit(name, payload) {
    const set = this.events.get(name);
    if (!set) return;
    for (const fn of set) fn(payload);
  }
}
export const bus = new EventBus();