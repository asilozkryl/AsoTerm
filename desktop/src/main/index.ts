import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { readFile, writeFile } from 'fs/promises';

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
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0c12',
    frame: false, // özel (frameless) pencere çubuğu
    title: 'AsoTerm',
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

app.whenReady().then(() => {
  startServer();
  createWindow();
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
