import { useEffect, useState } from 'react';
import { initApi } from './api/config';
import { fs } from './api/rest';
import { useStore, serializeState, PersistedState } from './store';
import { useSettings } from './settings';
import TopBar from './components/TopBar';
import Workspace from './tiling/Workspace';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import Settings from './components/Settings';
import SshDialog from './components/SshDialog';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sshOpen, setSshOpen] = useState(false);
  const addBlock = useStore((s) => s.addBlock);
  const addTab = useStore((s) => s.addTab);
  const home = useStore((s) => s.home);

  // Başlatma: API + ev dizini + kaydedilmiş düzeni geri yükle.
  useEffect(() => {
    (async () => {
      try {
        await initApi();
        await useSettings.getState().load();
        const [h, data] = await Promise.all([fs.home(), window.asoterm.loadState()]);
        useStore.getState().restore(h, (data as PersistedState | null) ?? null);
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // Düzen değiştikçe diske kaydet (debounce).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((state, prev) => {
      if (state.tabs === prev.tabs && state.activeTabId === prev.activeTabId) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.asoterm.saveState(serializeState(useStore.getState()));
      }, 500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  // Global klavye kısayolları (Ctrl+Shift, terminal satır düzenlemeyle çakışmaz).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((o) => !o);
        return;
      }
      if (!(e.ctrlKey && e.shiftKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'p') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (k === 't') {
        e.preventDefault();
        addBlock('terminal', { cwd: home }, 'Terminal');
      } else if (k === 'e') {
        e.preventDefault();
        addBlock('files', { path: home });
      } else if (k === 'n') {
        e.preventDefault();
        addTab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addBlock, addTab, home]);

  if (error) return <div className="fullscreen-msg error">Başlatma hatası: {error}</div>;
  if (!ready) return <div className="fullscreen-msg">AsoTerm başlatılıyor…</div>;

  return (
    <div className="app">
      <TopBar
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSSH={() => setSshOpen(true)}
      />
      <Workspace />
      <StatusBar />
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSSH={() => setSshOpen(true)}
        />
      )}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {sshOpen && <SshDialog onClose={() => setSshOpen(false)} />}
    </div>
  );
}
