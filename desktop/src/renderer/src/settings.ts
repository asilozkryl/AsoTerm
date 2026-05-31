// Kullanıcı ayarları: tema vurgusu, terminal yazı boyutu, varsayılan shell, web ana sayfası.
// Diske (settings.json) kalıcı yazılır ve accent CSS değişkeni canlı uygulanır.
import { create } from 'zustand';

// Kayıtlı SSH bağlantı profili (parola asla saklanmaz).
export interface SSHProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  authType: 'password' | 'key';
  keyPath?: string;
}

export interface Settings {
  accent: string;
  terminalFontSize: number;
  defaultShell: string;
  webHome: string;
  sshProfiles: SSHProfile[];
}

const DEFAULTS: Settings = {
  accent: '#6ea8fe',
  terminalFontSize: 13,
  defaultShell: '',
  webHome: 'https://www.google.com',
  sshProfiles: [],
};

export const ACCENT_PRESETS = [
  '#6ea8fe', // mavi (varsayılan)
  '#46d7c0', // teal
  '#b48cf0', // mor
  '#e0b54b', // amber
  '#f0685c', // mercan
  '#5fc77e', // yeşil
  '#ff8fab', // pembe
];

interface SettingsStore extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

// --- renk yardımcıları ---
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function darken(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  const f = 1 - amt;
  return '#' + [clamp(r * f), clamp(g * f), clamp(b * f)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function applyAccent(hex: string): void {
  const root = document.documentElement.style;
  root.setProperty('--accent', hex);
  root.setProperty('--accent-strong', darken(hex, 0.12));
  root.setProperty('--accent-glow', rgba(hex, 0.28));
  root.setProperty('--c-terminal', hex); // terminal bloğu vurgusu accent'i izler
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(s: Settings): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.asoterm.saveSettings(s), 300);
}

const pick = (s: SettingsStore): Settings => ({
  accent: s.accent,
  terminalFontSize: s.terminalFontSize,
  defaultShell: s.defaultShell,
  webHome: s.webHome,
  sshProfiles: s.sshProfiles,
});

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    let raw: Partial<Settings> | null = null;
    try {
      raw = (await window.asoterm.loadSettings()) as Partial<Settings> | null;
    } catch {
      /* yoksay */
    }
    const merged = { ...DEFAULTS, ...(raw || {}) };
    applyAccent(merged.accent);
    set({ ...merged, loaded: true });
  },

  update: (key, value) => {
    set({ [key]: value } as Partial<SettingsStore>);
    if (key === 'accent') applyAccent(value as string);
    scheduleSave(pick(get()));
  },

  reset: () => {
    applyAccent(DEFAULTS.accent);
    set({ ...DEFAULTS });
    scheduleSave(DEFAULTS);
  },
}));
