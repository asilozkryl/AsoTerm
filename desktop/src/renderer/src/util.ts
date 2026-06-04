export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

// Bir yolun üst dizinini döndürür (yerel basit hesap; ayraç \ veya /).
export function dirOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  if (idx < 0) return path;
  if (idx === 0) return path.slice(0, 1); // kök öğe: '/foo' -> '/'
  return path.slice(0, idx);
}

export function extOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function formatSize(bytes: number, isDir: boolean): string {
  if (isDir) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(unix: number): string {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'csv' | 'text';

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']);
const VIDEO = new Set(['mp4', 'webm', 'mov', 'mkv', 'm4v']);
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']);

export function previewKind(path: string): PreviewKind {
  const e = extOf(path);
  if (IMAGE.has(e)) return 'image';
  if (VIDEO.has(e)) return 'video';
  if (AUDIO.has(e)) return 'audio';
  if (e === 'pdf') return 'pdf';
  if (e === 'md' || e === 'markdown') return 'markdown';
  if (e === 'csv' || e === 'tsv') return 'csv';
  return 'text';
}

// Bir dosya çift tıklandığında hangi blok tipinde açılacağına karar verir.
export function blockTypeForFile(path: string): 'editor' | 'preview' {
  const e = extOf(path);
  if (
    IMAGE.has(e) ||
    VIDEO.has(e) ||
    AUDIO.has(e) ||
    e === 'pdf' ||
    e === 'md' ||
    e === 'markdown' ||
    e === 'csv' ||
    e === 'tsv'
  ) {
    return 'preview';
  }
  return 'editor';
}

const LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  go: 'go',
  py: 'python',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  sh: 'shell',
  bash: 'shell',
  ps1: 'powershell',
  sql: 'sql',
  dockerfile: 'dockerfile',
};

export function monacoLanguage(path: string): string {
  return LANG[extOf(path)] || 'plaintext';
}

const CODE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'go', 'py', 'rs', 'java', 'c', 'h', 'cpp', 'cc',
  'cs', 'rb', 'php', 'swift', 'kt', 'sh', 'bash', 'ps1', 'lua', 'sql', 'vue', 'svelte',
]);
const CONFIG_EXT = new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'conf', 'lock', 'xml']);
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz']);
const DOC_EXT = new Set(['doc', 'docx', 'odt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx']);
const FONT_EXT = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot']);

// Dosya/klasör için tür ikonu (emoji — renk bedava gelir).
export function fileGlyph(name: string, isDir: boolean): string {
  if (isDir) return '📁';
  const e = extOf(name);
  if (e === 'pdf') return '📕';
  if (e === 'md' || e === 'markdown') return '📝';
  if (e === 'csv' || e === 'tsv') return '📊';
  const k = previewKind(name);
  if (k === 'image') return '🖼️';
  if (k === 'video') return '🎬';
  if (k === 'audio') return '🎵';
  if (CODE_EXT.has(e)) return '📜';
  if (CONFIG_EXT.has(e)) return '⚙️';
  if (ARCHIVE_EXT.has(e)) return '🗜️';
  if (DOC_EXT.has(e)) return '📘';
  if (FONT_EXT.has(e)) return '🔠';
  if (e === 'exe' || e === 'msi' || e === 'bat' || e === 'cmd' || e === 'app') return '🟦';
  if (e === 'txt' || e === 'log') return '📄';
  return '📄';
}

// Bir yolu tıklanabilir breadcrumb parçalarına ayırır.
export function crumbsOf(path: string): { label: string; path: string }[] {
  const out: { label: string; path: string }[] = [];
  if (path.includes('\\')) {
    const parts = path.replace(/\\+$/, '').split('\\').filter(Boolean);
    parts.forEach((p, i) => {
      const full = parts.slice(0, i + 1).join('\\') + (i === 0 ? '\\' : '');
      out.push({ label: p, path: full });
    });
  } else {
    out.push({ label: '/', path: '/' });
    const parts = path.split('/').filter(Boolean);
    parts.forEach((p, i) => out.push({ label: p, path: '/' + parts.slice(0, i + 1).join('/') }));
  }
  return out;
}
