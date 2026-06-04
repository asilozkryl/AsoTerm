import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useSettings } from '../settings';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export default function CommandPalette({
  onClose,
  onOpenSettings,
  onOpenSSH,
}: {
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenSSH: () => void;
}) {
  const store = useStore();
  const webHome = useSettings((s) => s.webHome);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Cmd[] = useMemo(
    () => [
      {
        id: 'term',
        label: 'Yeni terminal',
        hint: 'Ctrl+Shift+T',
        run: () => store.addBlock('terminal', { cwd: store.home }, 'Terminal'),
      },
      {
        id: 'files',
        label: 'Yeni dosya gezgini',
        hint: 'Ctrl+Shift+E',
        run: () => store.addBlock('files', { path: store.home }),
      },
      {
        id: 'web',
        label: 'Yeni web tarayıcı',
        run: () => store.addBlock('web', { url: webHome }),
      },
      { id: 'ssh', label: 'SSH ile bağlan', run: onOpenSSH },
      { id: 'tab', label: 'Yeni sekme', hint: 'Ctrl+Shift+N', run: () => store.addTab() },
      { id: 'settings', label: 'Ayarları aç', hint: 'Ctrl+,', run: onOpenSettings },
      {
        id: 'closeblock',
        label: 'Aktif bloğu kapat',
        run: () => store.focusedBlockId && store.closeBlock(store.focusedBlockId),
      },
      {
        id: 'closetab',
        label: 'Sekmeyi kapat',
        hint: 'Ctrl+Shift+W',
        run: () => store.closeTab(store.activeTabId),
      },
    ],
    [store, webHome, onOpenSettings, onOpenSSH],
  );

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())),
    [commands, q],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setIdx(0);
  }, [q]);
  // Seçili öğeyi görünür alana kaydır (ok tuşlarıyla gezinince kaybolmasın).
  useEffect(() => {
    listRef.current?.querySelector('.palette-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const run = (c?: Cmd) => {
    c?.run();
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Komut ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(filtered[idx]);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
        />
        <div className="palette-list" ref={listRef}>
          {filtered.map((c, i) => (
            <div
              key={c.id}
              className={'palette-item' + (i === idx ? ' active' : '')}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(c)}
            >
              <span>{c.label}</span>
              {c.hint && <span className="palette-hint">{c.hint}</span>}
            </div>
          ))}
          {filtered.length === 0 && <div className="palette-empty">eşleşme yok</div>}
        </div>
      </div>
    </div>
  );
}
