import { useState } from 'react';
import { useStore } from '../store';
import { useSettings, SSHProfile } from '../settings';
import { SSHOpts } from '../api/term';
import { toast } from '../dialogs';

export default function SshDialog({ onClose }: { onClose: () => void }) {
  const addBlock = useStore((s) => s.addBlock);
  const profiles = useSettings((s) => s.sshProfiles);
  const update = useSettings((s) => s.update);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [user, setUser] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [save, setSave] = useState(false);
  const [profileName, setProfileName] = useState('');

  const loadProfile = (p: SSHProfile) => {
    setHost(p.host);
    setPort(String(p.port));
    setUser(p.user);
    setAuthType(p.authType);
    setKeyPath(p.keyPath || '');
    setPassword('');
    setPassphrase('');
  };

  const deleteProfile = (id: string) => {
    update('sshProfiles', profiles.filter((p) => p.id !== id));
  };

  const connect = () => {
    if (!host.trim() || !user.trim()) {
      toast('Host ve kullanıcı gerekli', true);
      return;
    }
    const opts: SSHOpts = {
      host: host.trim(),
      port: Number(port) || 22,
      user: user.trim(),
    };
    if (authType === 'password') {
      opts.password = password;
    } else {
      opts.keyPath = keyPath.trim();
      if (passphrase) opts.passphrase = passphrase;
    }

    addBlock('terminal', { ssh: opts }, `${user}@${host}`);

    if (save) {
      const profile: SSHProfile = {
        id: crypto.randomUUID(),
        name: profileName.trim() || `${user}@${host}`,
        host: host.trim(),
        port: Number(port) || 22,
        user: user.trim(),
        authType,
        keyPath: authType === 'key' ? keyPath.trim() : undefined,
      };
      update('sshProfiles', [...profiles, profile]);
    }
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ssh-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <span>🔌 SSH Bağlantısı</span>
          <button className="tile-btn tile-close" onClick={onClose} title="Kapat">
            ✕
          </button>
        </div>

        <div className="ssh-body">
          {profiles.length > 0 && (
            <div className="ssh-profiles">
              <div className="ssh-profiles-title">Kayıtlı bağlantılar</div>
              {profiles.map((p) => (
                <div key={p.id} className="ssh-profile" onClick={() => loadProfile(p)}>
                  <span className="ssh-profile-name">{p.name}</span>
                  <span className="ssh-profile-host">
                    {p.user}@{p.host}:{p.port}
                  </span>
                  <span
                    className="ssh-profile-del"
                    title="Sil"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProfile(p.id);
                    }}
                  >
                    🗑
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="ssh-form">
            <div className="ssh-row">
              <label>Host</label>
              <input className="settings-input ssh-grow" value={host} onChange={(e) => setHost(e.target.value)} placeholder="örn. 192.168.1.10 / sunucu.com" spellCheck={false} />
            </div>
            <div className="ssh-row">
              <label>Port</label>
              <input className="settings-input ssh-port" value={port} onChange={(e) => setPort(e.target.value)} />
              <label>Kullanıcı</label>
              <input className="settings-input ssh-grow" value={user} onChange={(e) => setUser(e.target.value)} placeholder="root" spellCheck={false} />
            </div>
            <div className="ssh-row">
              <label>Kimlik</label>
              <select className="settings-select" value={authType} onChange={(e) => setAuthType(e.target.value as 'password' | 'key')}>
                <option value="password">Parola</option>
                <option value="key">Özel anahtar</option>
              </select>
            </div>
            {authType === 'password' ? (
              <div className="ssh-row">
                <label>Parola</label>
                <input className="settings-input ssh-grow" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            ) : (
              <>
                <div className="ssh-row">
                  <label>Anahtar yolu</label>
                  <input className="settings-input ssh-grow" value={keyPath} onChange={(e) => setKeyPath(e.target.value)} placeholder="C:\Users\…\.ssh\id_ed25519" spellCheck={false} />
                </div>
                <div className="ssh-row">
                  <label>Parola (opsiyonel)</label>
                  <input className="settings-input ssh-grow" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="anahtar parolası" />
                </div>
              </>
            )}

            <div className="ssh-row ssh-save">
              <label>
                <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Bu bağlantıyı kaydet (parolasız)
              </label>
              {save && (
                <input className="settings-input ssh-grow" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="profil adı" />
              )}
            </div>
          </div>
        </div>

        <div className="settings-foot">
          <span className="ssh-note">⚠ Host anahtarı doğrulanmaz (v1)</span>
          <div>
            <button className="btn btn-ghost" onClick={onClose}>
              İptal
            </button>
            <button className="btn btn-primary" onClick={connect}>
              Bağlan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
