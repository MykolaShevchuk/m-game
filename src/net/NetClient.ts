import { Client, type Room } from '@colyseus/sdk';
import { defaultServerUrl, type ClientMsg, type ServerMsg } from './protocol';

export class NetClient {
  private room: Room | null = null;
  private queue: ServerMsg[] = [];
  private endpoint: string;
  onMessage: ((msg: ServerMsg) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(endpoint = defaultServerUrl()) {
    this.endpoint = endpoint;
  }

  get connected() {
    return !!this.room?.connection.isOpen;
  }

  get roomId() {
    return this.room?.roomId ?? '';
  }

  get sessionId() {
    return this.room?.sessionId ?? '';
  }

  /** Create a new game room and join as host. */
  async create(name: string, character: number) {
    await this.enter((client) => client.create('game', { name, character }));
  }

  /** Join an existing room by code. */
  async join(code: string, name: string, character: number) {
    await this.enter((client) => client.joinById(code.toUpperCase(), { name, character }));
  }

  private async enter(connect: (client: Client) => Promise<Room>) {
    this.close();
    const client = new Client(this.endpoint);
    try {
      const room = await connect(client);
      this.room = room;
      room.onMessage('msg', (msg: ServerMsg) => this.dispatch(msg));
      room.onLeave(() => {
        this.room = null;
        this.onClose?.();
      });
      room.onError((_code, message) => {
        this.dispatch({ type: 'error', message: message || 'Room error' });
      });
    } catch (e) {
      this.room = null;
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  /** Drain messages received before the handler was attached. */
  flush() {
    const pending = this.queue.splice(0);
    for (const msg of pending) this.onMessage?.(msg);
  }

  send(msg: ClientMsg) {
    if (!this.room?.connection.isOpen) return;
    if (msg.type === 'start') {
      this.room.send('start');
      return;
    }
    if (msg.type === 'input') {
      this.room.send('input', msg);
      return;
    }
    if (msg.type === 'pose') {
      this.room.send('pose', msg);
      return;
    }
    if (msg.type === 'action') {
      this.room.send('action', msg.action);
    }
  }

  close() {
    if (this.room) {
      void this.room.leave(true);
      this.room = null;
    }
  }

  private dispatch(msg: ServerMsg) {
    if (this.onMessage) this.onMessage(msg);
    else this.queue.push(msg);
  }
}
