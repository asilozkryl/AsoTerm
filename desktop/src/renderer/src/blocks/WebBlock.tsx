import { useEffect, useRef, useState } from 'react';
import { Block, useStore } from '../store';
import { useSettings } from '../settings';

const HOME = 'https://www.google.com';

// Electron <webview> öğesinin kullandığımız metotları.
interface WebviewEl extends HTMLElement {
  src: string;
  loadURL(url: string): Promise<void>;
  getURL(): string;
  getTitle(): string;
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  reload(): void;
  stop(): void;
}

function normalizeUrl(input: string): string {
  const s = input.trim();
  if (!s) return HOME;
  if (/^[a-zA-Z][\w+.-]*:\/\//.test(s) || s.startsWith('about:')) return s;
  if (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(s) && !s.includes(' ')) return 'https://' + s;
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(s);
}

export default function WebBlock({ block }: { block: Block }) {
  const ref = useRef<WebviewEl | null>(null);
  const initialUrl = useRef<string>((block.props.url as string) || HOME).current;
  const patchBlock = useStore((s) => s.patchBlock);
  const webHome = useSettings((s) => s.webHome);

  const [address, setAddress] = useState(initialUrl);
  const [canBack, setCanBack] = useState(false);
  const [canFwd, setCanFwd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const wv = ref.current;
    if (!wv) return;

    const syncNav = (url?: string) => {
      const u = url || wv.getURL();
      if (u && !u.startsWith('about:')) setAddress(u);
      try {
        setCanBack(wv.canGoBack());
        setCanFwd(wv.canGoForward());
      } catch {
        /* henüz hazır değil */
      }
      if (u) patchBlock(block.id, { props: { url: u } });
    };

    const onNavigate = (e: Event) => syncNav((e as unknown as { url?: string }).url);
    const onTitle = (e: Event) => {
      const t = (e as unknown as { title?: string }).title;
      if (t) patchBlock(block.id, { title: t.length > 40 ? t.slice(0, 40) + '…' : t });
    };
    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      syncNav();
    };

    wv.addEventListener('did-navigate', onNavigate);
    wv.addEventListener('did-navigate-in-page', onNavigate);
    wv.addEventListener('page-title-updated', onTitle);
    wv.addEventListener('did-start-loading', onStart);
    wv.addEventListener('did-stop-loading', onStop);

    return () => {
      wv.removeEventListener('did-navigate', onNavigate);
      wv.removeEventListener('did-navigate-in-page', onNavigate);
      wv.removeEventListener('page-title-updated', onTitle);
      wv.removeEventListener('did-start-loading', onStart);
      wv.removeEventListener('did-stop-loading', onStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = () => {
    const url = normalizeUrl(address);
    ref.current?.loadURL(url).catch(() => {});
  };

  return (
    <div className="web-block">
      <div className="web-bar">
        <button className="mini-btn" disabled={!canBack} onClick={() => ref.current?.goBack()} title="Geri">
          ‹
        </button>
        <button className="mini-btn" disabled={!canFwd} onClick={() => ref.current?.goForward()} title="İleri">
          ›
        </button>
        <button
          className="mini-btn"
          onClick={() => (loading ? ref.current?.stop() : ref.current?.reload())}
          title={loading ? 'Durdur' : 'Yenile'}
        >
          {loading ? '✕' : '⟳'}
        </button>
        <button className="mini-btn" onClick={() => ref.current?.loadURL(webHome || HOME)} title="Ana sayfa">
          ⌂
        </button>
        <input
          className="web-address"
          value={address}
          spellCheck={false}
          onChange={(e) => setAddress(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go();
            }
            e.stopPropagation();
          }}
          placeholder="Adres veya arama…"
        />
        <button className="mini-btn" onClick={go} title="Git">
          ➜
        </button>
      </div>
      {loading && <div className="web-progress" />}
      <webview
        ref={ref}
        className="web-view"
        src={initialUrl}
        partition="persist:asoterm"
        allowpopups="true"
      />
    </div>
  );
}
