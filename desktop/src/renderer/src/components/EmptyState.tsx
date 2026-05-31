import { CSSProperties } from 'react';
import { useStore } from '../store';
import { useSettings } from '../settings';

export default function EmptyState() {
  const home = useStore((s) => s.home);
  const addBlock = useStore((s) => s.addBlock);
  const webHome = useSettings((s) => s.webHome);

  const v = (val: string): CSSProperties => ({ ['--ea']: val } as CSSProperties);

  return (
    <div className="empty-state">
      <div className="empty-card">
        <div className="empty-logo">
          Aso<span className="brand-accent">Term</span>
        </div>
        <div className="empty-sub">Bu sekme boş — bir blok ekleyerek başla</div>
        <div className="empty-actions">
          <div className="empty-action" style={v('var(--c-terminal)')} onClick={() => addBlock('terminal', { cwd: home }, 'Terminal')}>
            <span className="ea-icon">⌨</span>
            <span className="ea-label">Terminal</span>
          </div>
          <div className="empty-action" style={v('var(--c-files)')} onClick={() => addBlock('files', { path: home })}>
            <span className="ea-icon">📁</span>
            <span className="ea-label">Dosyalar</span>
          </div>
          <div
            className="empty-action"
            style={v('var(--c-web)')}
            onClick={() => addBlock('web', { url: webHome })}
          >
            <span className="ea-icon">🌐</span>
            <span className="ea-label">Web</span>
          </div>
        </div>
        <div className="empty-hint">
          Komut paleti: <kbd>Ctrl+Shift+P</kbd> &nbsp;·&nbsp; Yeni terminal: <kbd>Ctrl+Shift+T</kbd>
        </div>
      </div>
    </div>
  );
}
