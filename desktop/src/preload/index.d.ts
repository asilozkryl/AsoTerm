export interface AsoTermApi {
  getServerInfo: () => Promise<{ port: number; token: string }>;
  loadState: () => Promise<unknown>;
  saveState: (data: unknown) => Promise<void>;
  loadSettings: () => Promise<unknown>;
  saveSettings: (data: unknown) => Promise<void>;
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
