// Terminal WebSocket istemcisi: tek bir bağlantı üzerinden birden çok PTY oturumunu
// çoğullar. Bloklar create/input/resize/close çağırır, data/exit olaylarına abone olur.
import { api } from './config';

export interface SSHOpts {
  host: string;
  port?: number;
  user: string;
  password?: string;
  keyPath?: string;
  passphrase?: string;
}

interface WsMsg {
  type: string;
  reqId?: string;
  id?: string;
  data?: string;
  cwd?: string;
  shell?: string;
  ssh?: SSHOpts;
  cols?: number;
  rows?: number;
  error?: string;
}

type DataListener = (b64: string) => void;
type ExitListener = () => void;

class TermSocket {
  private ws: WebSocket | null = null;
  private queue: WsMsg[] = [];
  private dataListeners = new Map<string, DataListener>();
  private exitListeners = new Map<string, ExitListener>();
  private pending = new Map<string, { resolve: (id: string) => void; reject: (e: Error) => void }>();
  private reqCounter = 0;

  private ensure(): void {
    if (this.ws) return;
    const { wsBase, token } = api();
    const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
    this.ws = ws;
    ws.onopen = () => {
      for (const msg of this.queue) ws.send(JSON.stringify(msg));
      this.queue = [];
    };
    ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data as string) as WsMsg);
    ws.onclose = () => {
      this.ws = null;
      // Açık oturumları sonlandırılmış say.
      for (const [, cb] of this.exitListeners) cb();
    };
  }

  private send(msg: WsMsg): void {
    this.ensure();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  private onMessage(msg: WsMsg): void {
    switch (msg.type) {
      case 'created': {
        const p = msg.reqId ? this.pending.get(msg.reqId) : undefined;
        if (p && msg.id) {
          this.pending.delete(msg.reqId!);
          p.resolve(msg.id);
        }
        break;
      }
      case 'error': {
        const p = msg.reqId ? this.pending.get(msg.reqId) : undefined;
        if (p) {
          this.pending.delete(msg.reqId!);
          p.reject(new Error(msg.error || 'terminal hatası'));
        }
        break;
      }
      case 'data': {
        if (msg.id) this.dataListeners.get(msg.id)?.(msg.data || '');
        break;
      }
      case 'exit': {
        if (msg.id) this.exitListeners.get(msg.id)?.();
        break;
      }
    }
  }

  create(cwd: string, shell = ''): Promise<string> {
    const reqId = `r${++this.reqCounter}`;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.send({ type: 'create', reqId, cwd, shell });
    });
  }

  createSSH(opts: SSHOpts): Promise<string> {
    const reqId = `r${++this.reqCounter}`;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.send({ type: 'create-ssh', reqId, ssh: opts });
    });
  }

  input(id: string, data: string): void {
    this.send({ type: 'input', id, data });
  }

  resize(id: string, cols: number, rows: number): void {
    this.send({ type: 'resize', id, cols, rows });
  }

  close(id: string): void {
    this.send({ type: 'close', id });
    this.dataListeners.delete(id);
    this.exitListeners.delete(id);
  }

  onData(id: string, cb: DataListener): void {
    this.dataListeners.set(id, cb);
  }

  onExit(id: string, cb: ExitListener): void {
    this.exitListeners.set(id, cb);
  }
}

export const term = new TermSocket();
