type Listener = () => void;

export class EventEmitter {
  private _listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  emit(): void {
    for (const listener of this._listeners) {
      listener();
    }
  }
}
