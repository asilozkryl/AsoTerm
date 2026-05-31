// Go sidecar sunucusunu desktop/resources/ içine derler.
// `npm run dev` ve `npm run build` öncesinde çalışır.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // desktop/scripts -> desktop -> repo kökü
const isWin = process.platform === 'win32';
const out = resolve(here, '..', 'resources', isWin ? 'asoterm-server.exe' : 'asoterm-server');

mkdirSync(dirname(out), { recursive: true });

// Go PATH'te olmayabilir; Windows'ta varsayılan kurulum yolunu ekle.
const env = { ...process.env };
if (isWin) {
  env.PATH = `C:\\Program Files\\Go\\bin;${env.PATH}`;
}

// Windows'ta GUI subsystem olarak derle ki Electron sidecar'ı başlatınca
// ayrı bir konsol penceresi (Windows Terminal) açılmasın. stdin/stdout
// Electron'ın sağladığı pipe'lar üzerinden çalışmaya devam eder.
const ldflags = isWin ? ' -ldflags "-H windowsgui"' : '';
console.log('[build-server] Go sunucusu derleniyor ->', out);
execSync(`go build${ldflags} -o "${out}" ./cmd/asoterm-server`, {
  cwd: repoRoot,
  stdio: 'inherit',
  env,
});
console.log('[build-server] Tamam.');
