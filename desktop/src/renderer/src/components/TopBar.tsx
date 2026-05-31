import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useSettings } from '../settings';

function MinIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none">
      <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function MaxIcon({ maximized }: { maximized: boolean }) {
  return maximized ? (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2.5" y="3.5" width="6" height="6" rx="1" />
      <path d="M4 3.5V2.5h6v6h-1" />
    </svg>
  ) : (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
      <line x1="3" y1="3" x2="9" y2="9" />
      <line x1="9" y1="3" x2="3" y2="9" />
    </svg>
  );
}

export default function TopBar({
  onOpenPalette,
  onOpenSettings,
  onOpenSSH,
}: {
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onOpenSSH: () => void;
}) {
  const webHome = useSettings((s) => s.webHome);
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const home = useStore((s) => s.home);
  const addTab = useStore((s) => s.addTab);
  const closeTab = useStore((s) => s.closeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const addBlock = useStore((s) => s.addBlock);
  const renameTab = useStore((s) => s.renameTab);

  const [editing, setEditing] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    window.asoterm.window.isMaximized().then(setMaximized);
    return window.asoterm.window.onMaximizedChange(setMaximized);
  }, []);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const commitRename = (tabId: string, el: HTMLElement) => {
    renameTab(tabId, el.textContent || '');
    setEditing(null);
  };

  return (
    <header className="topbar">
      <div className="brand">
        Aso<span className="brand-accent">Term</span>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={'tab' + (t.id === activeTabId ? ' active' : '')}
            onClick={() => setActiveTab(t.id)}
            onDoubleClick={() => setEditing(t.id)}
            title="Çift tık: yeniden adlandır"
          >
            <span
              ref={editing === t.id ? editRef : undefined}
              className="tab-title"
              contentEditable={editing === t.id}
              suppressContentEditableWarning
              onBlur={(e) => editing === t.id && commitRename(t.id, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename(t.id, e.currentTarget);
                } else if (e.key === 'Escape') {
                  setEditing(null);
                }
                e.stopPropagation();
              }}
            >
              {t.title}
            </span>
            <span
              className="tab-x"
              title="Sekmeyi kapat"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
            >
              ×
            </span>
          </div>
        ))}
        <button className="tab-add" onClick={addTab} title="Yeni sekme (Ctrl+Shift+N)">
          ＋
        </button>
      </div>

      <div className="add-blocks">
        <button onClick={() => addBlock('terminal', { cwd: home })}>⌨ Terminal</button>
        <button onClick={() => addBlock('files', { path: home })}>📁 Dosyalar</button>
        <button onClick={() => addBlock('web', { url: webHome })}>🌐 Web</button>
        <button onClick={onOpenSSH} title="SSH ile bağlan">🔌 SSH</button>
        <button className="palette-btn" onClick={onOpenPalette} title="Komut paleti (Ctrl+Shift+P)">
          ⌘ Komutlar
        </button>
        <button onClick={onOpenSettings} title="Ayarlar (Ctrl+,)">
          ⚙
        </button>
      </div>

      <div className="win-controls">
        <button className="win-btn" title="Küçült" onClick={() => window.asoterm.window.minimize()}>
          <MinIcon />
        </button>
        <button
          className="win-btn"
          title={maximized ? 'Geri yükle' : 'Büyüt'}
          onClick={() => window.asoterm.window.toggleMaximize()}
        >
          <MaxIcon maximized={maximized} />
        </button>
        <button className="win-btn win-close" title="Kapat" onClick={() => window.asoterm.window.close()}>
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}
