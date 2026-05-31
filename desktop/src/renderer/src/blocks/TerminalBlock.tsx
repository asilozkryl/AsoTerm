import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { term, SSHOpts } from '../api/term';
import { Block } from '../store';
import { useSettings } from '../settings';

const THEME = {
  background: '#0c0e15',
  foreground: '#d7dce5',
  cursor: '#6ea8fe',
  selectionBackground: '#2b4a7e',
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function TerminalBlock({ block }: { block: Block }) {
  const ref = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string>('');
  const fontSize = useSettings((s) => s.terminalFontSize);

  useEffect(() => {
    const el = ref.current!;
    const { terminalFontSize, defaultShell } = useSettings.getState();

    const xterm = new Terminal({
      fontFamily: '"JetBrains Mono Variable", "Cascadia Code", Consolas, monospace',
      fontSize: terminalFontSize,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
      theme: THEME,
    });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(el);
    xtermRef.current = xterm;
    fitRef.current = fit;
    try {
      fit.fit();
    } catch {
      /* boyut hazır değil */
    }

    let disposed = false;
    xterm.onData((d) => {
      if (sessionRef.current) term.input(sessionRef.current, d);
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (sessionRef.current) term.resize(sessionRef.current, xterm.cols, xterm.rows);
      } catch {
        /* yoksay */
      }
    });
    ro.observe(el);

    const ssh = block.props.ssh as SSHOpts | undefined;
    if (ssh) {
      xterm.write(`\x1b[90mSSH bağlanılıyor: ${ssh.user}@${ssh.host}…\x1b[0m\r\n`);
    }
    const createPromise = ssh ? term.createSSH(ssh) : term.create((block.props.cwd as string) || '', defaultShell);

    createPromise
      .then((id) => {
        if (disposed) {
          term.close(id);
          return;
        }
        sessionRef.current = id;
        block.props.sessionId = id;
        term.onData(id, (b64) => xterm.write(base64ToBytes(b64)));
        term.onExit(id, () => xterm.write('\r\n\x1b[90m[bağlantı sonlandı]\x1b[0m\r\n'));
        term.resize(id, xterm.cols, xterm.rows);
        xterm.focus();
      })
      .catch((e) => xterm.write(`\r\n\x1b[31m${ssh ? 'SSH bağlantısı başarısız' : 'Terminal açılamadı'}: ${e}\x1b[0m\r\n`));

    return () => {
      disposed = true;
      ro.disconnect();
      if (sessionRef.current) term.close(sessionRef.current);
      xterm.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yazı boyutu ayarı değişince canlı uygula.
  useEffect(() => {
    const xterm = xtermRef.current;
    const fit = fitRef.current;
    if (!xterm || !fit) return;
    xterm.options.fontSize = fontSize;
    try {
      fit.fit();
      if (sessionRef.current) term.resize(sessionRef.current, xterm.cols, xterm.rows);
    } catch {
      /* yoksay */
    }
  }, [fontSize]);

  return <div className="term-host" ref={ref} />;
}
