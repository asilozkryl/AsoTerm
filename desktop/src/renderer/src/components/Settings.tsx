import { useEffect, useState } from 'react';
import { useSettings, ACCENT_PRESETS } from '../settings';
import { shells as fetchShells, ShellInfo } from '../api/rest';

export default function Settings({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const [shells, setShells] = useState<ShellInfo[]>([]);

  useEffect(() => {
    fetchShells()
      .then(setShells)
      .catch(() => {});
  }, []);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <span>⚙ Ayarlar</span>
          <button className="tile-btn tile-close" onClick={onClose} title="Kapat">
            ✕
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-sec">
            <h4>Görünüm</h4>
            <div className="settings-row">
              <label>Vurgu rengi</label>
              <div className="swatches">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    className={'swatch' + (s.accent.toLowerCase() === c.toLowerCase() ? ' active' : '')}
                    style={{ background: c }}
                    onClick={() => s.update('accent', c)}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  className="swatch-custom"
                  value={s.accent}
                  onChange={(e) => s.update('accent', e.target.value)}
                  title="Özel renk"
                />
              </div>
            </div>
            <div className="settings-row">
              <label>Terminal yazı boyutu</label>
              <div className="stepper">
                <button
                  className="mini-btn"
                  onClick={() => s.update('terminalFontSize', Math.max(9, s.terminalFontSize - 1))}
                >
                  −
                </button>
                <span className="stepper-val">{s.terminalFontSize}px</span>
                <button
                  className="mini-btn"
                  onClick={() => s.update('terminalFontSize', Math.min(24, s.terminalFontSize + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <section className="settings-sec">
            <h4>Terminal</h4>
            <div className="settings-row">
              <label>Varsayılan shell</label>
              <select
                className="settings-select"
                value={s.defaultShell}
                onChange={(e) => s.update('defaultShell', e.target.value)}
              >
                <option value="">Otomatik (sistem varsayılanı)</option>
                {shells.map((sh) => (
                  <option key={sh.path} value={sh.path}>
                    {sh.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-note">Yalnızca yeni açılan terminalleri etkiler.</div>
          </section>

          <section className="settings-sec">
            <h4>Web</h4>
            <div className="settings-row">
              <label>Ana sayfa</label>
              <input
                className="settings-input"
                value={s.webHome}
                spellCheck={false}
                onChange={(e) => s.update('webHome', e.target.value)}
              />
            </div>
          </section>
        </div>

        <div className="settings-foot">
          <button className="btn btn-ghost" onClick={() => s.reset()}>
            Varsayılana sıfırla
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
