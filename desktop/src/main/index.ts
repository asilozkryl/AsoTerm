import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { readFile, writeFile } from 'fs/promises';
import { chmodSync } from 'fs';
import { autoUpdater } from 'electron-updater';

interface ServerInfo {
  port: number;
  token: string;
}

let serverInfo: ServerInfo | null = null;
let serverProc: ChildProcess | null = null;
let serverReady: Promise<ServerInfo>;
let mainWindow: BrowserWindow | null = null;

function serverBinaryPath(): string {
  const name = process.platform === 'win32' ? 'asoterm-server.exe' : 'asoterm-server';
  const base = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
  return join(base, name);
}

function startServer(): void {
  serverReady = new Promise<ServerInfo>((resolve, reject) => {
    const bin = serverBinaryPath();
    // macOS/Linux: kaynak/paket kopyasında execute biti düşebilir → garanti et.
    if (process.platform !== 'win32') {
      try {
        chmodSync(bin, 0o755);
      } catch {
        /* yoksay */
      }
    }
    serverProc = spawn(bin, [], { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });

    serverProc.on('error', (err) => reject(err));
    serverProc.on('exit', (code) => {
      if (!serverInfo) reject(new Error(`sunucu beklenmedik şekilde kapandı (kod ${code})`));
    });

    const rl = createInterface({ input: serverProc.stdout! });
    rl.once('line', (line) => {
      try {
        serverInfo = JSON.parse(line) as ServerInfo;
        resolve(serverInfo);
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0c12',
    title: 'AsoTerm',
    // macOS: yerel trafik ışıkları (kapat/küçült/büyüt) korunur; Windows: tam frameless.
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 16 } }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      webviewTag: true,
    },
  });
  mainWindow = win;

  win.on('maximize', () => win.webContents.send('win:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized-changed', false));
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

ipcMain.handle('asoterm:server-info', async (): Promise<ServerInfo> => {
  return serverInfo ?? (await serverReady);
});

// --- Çalışma alanı düzeni kalıcılığı ---
function workspaceFile(): string {
  return join(app.getPath('userData'), 'workspace.json');
}

ipcMain.handle('asoterm:load-state', async (): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(workspaceFile(), 'utf-8'));
  } catch {
    return null;
  }
});

ipcMain.handle('asoterm:save-state', async (_e, data: unknown): Promise<void> => {
  try {
    await writeFile(workspaceFile(), JSON.stringify(data), 'utf-8');
  } catch {
    /* yoksay */
  }
});

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json');
}

ipcMain.handle('asoterm:load-settings', async (): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(settingsFile(), 'utf-8'));
  } catch {
    return null;
  }
});

ipcMain.handle('asoterm:save-settings', async (_e, data: unknown): Promise<void> => {
  try {
    await writeFile(settingsFile(), JSON.stringify(data), 'utf-8');
  } catch {
    /* yoksay */
  }
});

// --- Pencere kontrolleri (frameless) ---
ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:maximize-toggle', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('win:close', () => mainWindow?.close());
ipcMain.handle('win:is-maximized', () => mainWindow?.isMaximized() ?? false);

// --- Otomatik güncelleme (electron-updater + GitHub Releases) ---
// "Önce sor" akışı: indirme ve kurulum yalnız kullanıcı onayıyla yapılır.
// electron-updater olayları renderer'a 'update:event' kanalıyla iletilir.
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false; // önce sor: kendiliğinden indirme
  autoUpdater.autoInstallOnAppQuit = true; // indirildiyse çıkışta uygula
  const send = (payload: Record<string, unknown>): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:event', payload);
    }
  };
  autoUpdater.on('update-available', (info) => send({ kind: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send({ kind: 'none' }));
  autoUpdater.on('download-progress', (p) =>
    send({ kind: 'progress', percent: Math.round(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) => send({ kind: 'downloaded', version: info.version }));
  autoUpdater.on('error', (err) =>
    send({ kind: 'error', message: err == null ? 'bilinmeyen hata' : err.message || String(err) }),
  );
}

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('update:check', async (): Promise<{ ok: boolean; reason?: string }> => {
  // Güncelleme yalnız paketlenmiş derlemede çalışır (dev'de app-update.yml yok).
  if (!app.isPackaged) return { ok: false, reason: 'dev' };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});

ipcMain.handle('update:download', async (): Promise<{ ok: boolean; reason?: string }> => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
});

// Sessiz kur + otomatik yeniden başlat: kullanıcı sihirbazla uğraşmasın.
ipcMain.handle('update:install', (): void => autoUpdater.quitAndInstall(true, true));

app.whenReady().then(() => {
  startServer();
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  serverProc?.stdin?.end();
  serverProc?.kill();
});
