import { useEffect, useState } from 'react';
import { useStore, BlockType } from '../store';

const TYPE_LABEL: Record<BlockType, string> = {
  terminal: 'Terminal',
  files: 'Dosyalar',
  editor: 'Editör',
  preview: 'Önizleme',
  web: 'Web',
};

export default function StatusBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const focusedBlockId = useStore((s) => s.focusedBlockId);

  const tab = tabs.find((t) => t.id === activeTabId);
  const block = tab && focusedBlockId ? tab.blocks[focusedBlockId] : undefined;
  const blockCount = tab ? Object.keys(tab.blocks).length : 0;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const path = (block?.props.path as string) || (block?.props.cwd as string) || '';
  const clock = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className="status-item">
          <span className="status-dot" />
          bağlı
        </span>
        {block && (
          <span className="status-item">
            <span className={`status-type block-${block.type}`}>{TYPE_LABEL[block.type]}</span>
            {path && <span className="status-path">{path}</span>}
          </span>
        )}
      </div>
      <div className="status-right">
        <span className="status-item">⊞ {blockCount} blok</span>
        <span className="status-item">▤ {tabs.length} sekme</span>
        <span className="status-item">{clock}</span>
      </div>
    </footer>
  );
}
