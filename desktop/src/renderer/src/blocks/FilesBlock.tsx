import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { fs, Entry } from '../api/rest';
import { useStore } from '../store';
import { formatSize, formatDate, dirOf, fileGlyph, crumbsOf } from '../util';
import { promptDialog, confirmDialog, toast } from '../dialogs';
import ContextMenu, { MenuItem } from '../components/ContextMenu';

const DRAG_MIME = 'application/x-asoterm-path';

type SortKey = 'name' | 'size' | 'date';
type SortDir = 'asc' | 'desc';

interface MenuState {
  x: number;
  y: number;
  entry: Entry | null;
}

export default function FilesBlock({ path }: { path: string }) {
  const [cwd, setCwd] = useState(path);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const reqRef = useRef(0); // gezinme istek sırası (geç gelen eski yanıtları ele)

  const openFile = useStore((s) => s.openFile);
  const addBlock = useStore((s) => s.addBlock);
  const clipboard = useStore((s) => s.clipboard);
  const setClipboard = useStore((s) => s.setClipboard);

  const load = async (target: string) => {
    const myReq = ++reqRef.current;
    setLoading(true);
    try {
      const list = await fs.list(target);
      if (myReq !== reqRef.current) return; // daha yeni bir gezinme oldu → bu sonucu yok say
      setCwd(target);
      setEntries(list);
      setSelected(null);
    } catch (e) {
      if (myReq === reqRef.current) toast('Dizin açılamadı: ' + e, true);
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Görüntülenen liste: gizli filtre + sıralama (klasörler her zaman önce).
  const displayed = useMemo(() => {
    const filtered = showHidden ? entries : entries.filter((e) => !e.name.startsWith('.'));
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: Entry, b: Entry) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let r = 0;
      if (sortKey === 'name') r = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      else if (sortKey === 'size') r = a.size - b.size;
      else r = a.modUnix - b.modUnix;
      return r * dir;
    };
    return [...filtered].sort(cmp);
  }, [entries, showHidden, sortKey, sortDir]);

  const selectedEntry = displayed.find((e) => e.path === selected) || null;

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const up = async () => {
    const parent = await fs.parent(cwd);
    if (parent && parent !== cwd) load(parent);
  };

  const onOpen = (e: Entry) => {
    if (e.isDir) load(e.path);
    else openFile(e.path);
  };

  // --- işlemler ---
  const newFolder = async () => {
    const name = await promptDialog('Yeni klasör adı:', 'Yeni klasör');
    if (name === null) return;
    try {
      await fs.mkdir(cwd, name);
      load(cwd);
    } catch (e) {
      toast('Oluşturulamadı: ' + e, true);
    }
  };
  const newFile = async () => {
    const name = await promptDialog('Yeni dosya adı:', 'yeni.txt');
    if (name === null) return;
    try {
      await fs.newfile(cwd, name);
      load(cwd);
    } catch (e) {
      toast('Oluşturulamadı: ' + e, true);
    }
  };
  const rename = async (entry: Entry) => {
    const name = await promptDialog('Yeni ad:', entry.name);
    if (name === null || name === entry.name) return;
    try {
      await fs.rename(entry.path, name);
      load(cwd);
    } catch (e) {
      toast('Yeniden adlandırılamadı: ' + e, true);
    }
  };
  const remove = async (entry: Entry) => {
    const ok = await confirmDialog(`"${entry.name}" kalıcı olarak silinsin mi?`);
    if (!ok) return;
    try {
      await fs.remove(entry.path);
      load(cwd);
    } catch (e) {
      toast('Silinemedi: ' + e, true);
    }
  };
  const paste = async () => {
    if (!clipboard) return;
    try {
      if (clipboard.op === 'cut') {
        await fs.move(clipboard.path, cwd);
        setClipboard(null);
      } else {
        await fs.copy(clipboard.path, cwd);
      }
      load(cwd);
    } catch (e) {
      toast('Yapıştırılamadı: ' + e, true);
    }
  };
  const openInTerminal = (dir: string) => addBlock('terminal', { cwd: dir }, 'Terminal');

  // --- klavye gezinme ---
  const moveSel = (delta: number) => {
    if (displayed.length === 0) return;
    const idx = displayed.findIndex((e) => e.path === selected);
    const next = Math.min(displayed.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + delta));
    const e = displayed[next];
    setSelected(e.path);
    listRef.current?.querySelector(`[data-path="${CSS.escape(e.path)}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSel(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSel(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedEntry) onOpen(selectedEntry);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      up();
    } else if (e.key === 'Delete' && selectedEntry) {
      e.preventDefault();
      remove(selectedEntry);
    } else if (e.key === 'F2' && selectedEntry) {
      e.preventDefault();
      rename(selectedEntry);
    }
  };

  // --- bağlam menüsü ---
  const openMenu = (e: ReactMouseEvent, entry: Entry | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (entry) setSelected(entry.path);
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };
  const menuItems = (): MenuItem[] => {
    if (!menu) return [];
    const e = menu.entry;
    if (e) {
      const items: MenuItem[] = [{ label: e.isDir ? 'Aç' : 'Düzenle / Önizle', onClick: () => onOpen(e) }];
      if (e.isDir) items.push({ label: 'Terminalde aç', onClick: () => openInTerminal(e.path) });
      items.push(
        { separator: true },
        { label: 'Kopyala', onClick: () => setClipboard({ path: e.path, op: 'copy' }) },
        { label: 'Kes', onClick: () => setClipboard({ path: e.path, op: 'cut' }) },
        { label: 'Yapıştır', onClick: paste, disabled: !clipboard },
        { separator: true },
        { label: 'Yeniden adlandır', onClick: () => rename(e) },
        { label: 'Sil', onClick: () => remove(e), danger: true },
      );
      return items;
    }
    return [
      { label: 'Yapıştır', onClick: paste, disabled: !clipboard },
      { label: 'Terminalde aç', onClick: () => openInTerminal(cwd) },
      { separator: true },
      { label: 'Yeni klasör', onClick: newFolder },
      { label: 'Yeni dosya', onClick: newFile },
    ];
  };

  // --- sürükle-bırak ---
  const onDrop = async (e: ReactDragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const src = e.dataTransfer.getData(DRAG_MIME);
    if (!src || dirOf(src) === cwd) return;
    try {
      if (e.shiftKey) await fs.move(src, cwd);
      else await fs.copy(src, cwd);
      load(cwd);
      toast(`${e.shiftKey ? 'Taşındı' : 'Kopyalandı'}: ${src}`);
    } catch (err) {
      toast('Aktarılamadı: ' + err, true);
    }
  };

  const caret = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '');

  return (
    <div className="files-block">
      <div className="files-bar">
        <button className="mini-btn" onClick={up} title="Üst klasör (Backspace)">
          ⬆
        </button>
        <button className="mini-btn" onClick={() => load(cwd)} title="Yenile">
          ⟳
        </button>
        <div className="files-crumbs">
          {crumbsOf(cwd).map((c, i, arr) => (
            <span key={c.path} style={{ display: 'contents' }}>
              <span
                className={'crumb' + (i === arr.length - 1 ? ' current' : '')}
                onClick={() => load(c.path)}
              >
                {c.label}
              </span>
              {i < arr.length - 1 && <span className="crumb-sep">›</span>}
            </span>
          ))}
        </div>
        <button
          className={'mini-btn' + (showHidden ? ' active' : '')}
          onClick={() => setShowHidden((v) => !v)}
          title="Gizli dosyalar"
        >
          ⊙
        </button>
        <button className="mini-btn" onClick={newFolder} title="Yeni klasör">
          ＋📁
        </button>
        <button className="mini-btn" onClick={newFile} title="Yeni dosya">
          ＋📄
        </button>
        <button className="mini-btn" onClick={paste} disabled={!clipboard} title="Yapıştır">
          📋
        </button>
      </div>

      <div className="files-cols">
        <div className={'files-col col-name' + (sortKey === 'name' ? ' active' : '')} onClick={() => setSort('name')}>
          Ad <span className="sort-caret">{caret('name')}</span>
        </div>
        <div className={'files-col col-size' + (sortKey === 'size' ? ' active' : '')} onClick={() => setSort('size')}>
          Boyut <span className="sort-caret">{caret('size')}</span>
        </div>
        <div className={'files-col col-date' + (sortKey === 'date' ? ' active' : '')} onClick={() => setSort('date')}>
          Değiştirilme <span className="sort-caret">{caret('date')}</span>
        </div>
      </div>

      <div
        className={'files-list' + (dragOver ? ' drag-over' : '')}
        tabIndex={0}
        ref={listRef}
        onKeyDown={onKey}
        onContextMenu={(e) => openMenu(e, null)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {displayed.map((e) => (
          <div
            key={e.path}
            data-path={e.path}
            className={
              'files-row' +
              (e.isDir ? ' dir' : '') +
              (e.path === selected ? ' selected' : '') +
              (clipboard?.op === 'cut' && clipboard.path === e.path ? ' cut' : '')
            }
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData(DRAG_MIME, e.path);
              ev.dataTransfer.effectAllowed = 'copyMove';
            }}
            onClick={() => setSelected(e.path)}
            onDoubleClick={() => onOpen(e)}
            onContextMenu={(ev) => openMenu(ev, e)}
          >
            <span className="files-icon">{fileGlyph(e.name, e.isDir)}</span>
            <span className="files-name">{e.name}</span>
            <span className="files-size">{formatSize(e.size, e.isDir)}</span>
            <span className="files-date">{formatDate(e.modUnix)}</span>
          </div>
        ))}
        {loading ? (
          <div className="files-loading">yükleniyor…</div>
        ) : (
          displayed.length === 0 && <div className="files-empty">(boş klasör)</div>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
    </div>
  );
}
