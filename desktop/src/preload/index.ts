import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getServerInfo: (): Promise<{ port: number; token: string }> =>
    ipcRenderer.invoke('asoterm:server-info'),
  loadState: (): Promise<unknown> => ipcRenderer.invoke('asoterm:load-state'),
  saveState: (data: unknown): Promise<void> => ipcRenderer.invoke('asoterm:save-state', data),
  loadSettings: (): Promise<unknown> => ipcRenderer.invoke('asoterm:load-settings'),
  saveSettings: (data: unknown): Promise<void> => ipcRenderer.invoke('asoterm:save-settings', data),
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
