export type UpdateEvent =
  | { kind: 'available'; version: string }
  | { kind: 'none' }
  | { kind: 'progress'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string };

export interface AsoTermApi {
  getServerInfo: () => Promise<{ port: number; token: string }>;
  loadState: () => Promise<unknown>;
  saveState: (data: unknown) => Promise<void>;
  loadSettings: () => Promise<unknown>;
  saveSettings: (data: unknown) => Promise<void>;
  getVersion: () => Promise<string>;
  update: {
    check: () => Promise<{ ok: boolean; reason?: string }>;
    download: () => Promise<{ ok: boolean; reason?: string }>;
    install: () => Promise<void>;
    on: (cb: (e: UpdateEvent) => void) => () => void;
  };
  platform: string;
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
  };
}

declare global {
  interface Window {
    asoterm: AsoTermApi;
  }
}
