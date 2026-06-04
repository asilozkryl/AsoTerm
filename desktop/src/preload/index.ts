import { contextBridge, ipcRenderer } from 'electron';

type UpdateEvent =
  | { kind: 'available'; version: string }
  | { kind: 'none' }
  | { kind: 'progress'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string };

const api = {
  getServerInfo: (): Promise<{ port: number; token: string }> =>
    ipcRenderer.invoke('asoterm:server-info'),
  loadState: (): Promise<unknown> => ipcRenderer.invoke('asoterm:load-state'),
  saveState: (data: unknown): Promise<void> => ipcRenderer.invoke('asoterm:save-state', data),
  loadSettings: (): Promise<unknown> => ipcRenderer.invoke('asoterm:load-settings'),
  saveSettings: (data: unknown): Promise<void> => ipcRenderer.invoke('asoterm:save-settings', data),
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  // Otomatik güncelleme: denetle / indir / kur + olay aboneliği.
  update: {
    check: (): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke('update:check'),
    download: (): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke('update:download'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    on: (cb: (e: UpdateEvent) => void): (() => void) => {
      const listener = (_e: unknown, payload: UpdateEvent): void => cb(payload);
      ipcRenderer.on('update:event', listener);
      return () => ipcRenderer.removeListener('update:event', listener);
    },
  },
  platform: process.platform,
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('win:minimize'),
    toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('win:maximize-toggle'),
    close: (): Promise<void> => ipcRenderer.invoke('win:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:is-maximized'),
    onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
      const listener = (_e: unknown, v: boolean) => cb(v);
      ipcRenderer.on('win:maximized-changed', listener);
      return () => ipcRenderer.removeListener('win:maximized-changed', listener);
    },
  },
};

contextBridge.exposeInMainWorld('asoterm', api);
