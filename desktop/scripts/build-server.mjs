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

// Go PATH'te yoksa Windows varsayılan kurulum yolunu YEDEK olarak SONA ekle
// (PATH'te zaten varsa — CI/setup-go — o kullanılır, sürüm çakışması olmaz).
const env = { ...process.env };
if (isWin) {
  // Windows'ta PATH değişkeni çoğunlukla 'Path' adıyla gelir. process.env'i
  // düz nesneye kopyalayınca anahtarın büyük/küçük harfi korunur; bu yüzden
  // 'PATH' diye AYRI bir anahtar eklemek setup-go'nun PATH'e eklediği Go'yu
  // gölgeler ve child process'te "'go' is not recognized" hatasına yol açar.
  // Çözüm: var olan anahtarı (case-insensitive) bulup onun üzerine ekle.
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'Path';
  env[pathKey] = `${env[pathKey] ?? ''};C:\\Program Files\\Go\\bin`;
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
