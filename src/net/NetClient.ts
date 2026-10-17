import { defaultWsUrl, type ClientMsg, type ServerMsg } from './protocol';

export class NetClient {
  private ws: WebSocket | null = null;
  private queue: ServerMsg[] = [];
  onMessage: ((msg: ServerMsg) => void) | null = null;
  onClose: (() => void) | null = null;

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url = defaultWsUrl()) {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`Could not connect to ${url}`));
      ws.onclose = () => this.onClose?.();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerMsg;
          if (this.onMessage) this.onMessage(msg);
          else this.queue.push(msg);
        } catch {
          /* ignore bad packets */
        }
      };
    });
  }

  /** Drain messages received before the handler was attached. */
  flush() {
    const pending = this.queue.splice(0);
    for (const msg of pending) this.onMessage?.(msg);
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
