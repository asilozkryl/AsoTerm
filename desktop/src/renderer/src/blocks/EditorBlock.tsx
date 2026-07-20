import { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { fs } from '../api/rest';
import { monacoLanguage } from '../util';
import { toast } from '../dialogs';

export default function EditorBlock({ path }: { path: string }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('yükleniyor…');
  const [dirty, setDirty] = useState(false);
  const valueRef = useRef('');
  const savedRef = useRef(''); // son kaydedilen/yüklenen içerik (dirty karşılaştırması)
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    let active = true;
    fs.read(path)
      .then((c) => {
        if (!active) return;
        setValue(c.content);
        valueRef.current = c.content;
        savedRef.current = c.content;
        setDirty(false);
        setStatus(c.truncated ? 'büyük dosya — kesildi' : 'hazır');
      })
      .catch((e) => setStatus('hata: ' + e));
    return () => {
      active = false;
    };
  }, [path]);

  const save = async () => {
    const p = pathRef.current;
    try {
      await fs.write(p, valueRef.current);
      savedRef.current = valueRef.current;
      setValue(valueRef.current); // controlled value ile model senkron kalsın
      setDirty(false);
      setStatus('kaydedildi ✓');
      toast('Kaydedildi: ' + p);
    } catch (e) {
      setStatus('kaydedilemedi');
      toast('Kaydedilemedi: ' + e, true);
    }
  };

  const onMount: OnMount = (editor, monaco) => {
    // path/value ref üzerinden okunur → stale closure ile yanlış dosyaya yazılmaz.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void save();
    });
  };

  return (
    <div className="editor-block">
      <div className="editor-bar">
        <span className="editor-path" title={path}>
          {path}
        </span>
        {dirty && (
          <span className="editor-dirty" title="Kaydedilmemiş değişiklikler">
            ● değiştirildi
          </span>
        )}
        <span className="editor-status">{status}</span>
        <button className="mini-btn" onClick={() => void save()}>
          Kaydet (Ctrl+S)
        </button>
      </div>
      <div className="editor-host">
        <Editor
          theme="vs-dark"
          language={monacoLanguage(path)}
          value={value}
          onChange={(v) => {
            const next = v ?? '';
            valueRef.current = next;
            setValue(next);
            setDirty(next !== savedRef.current);
          }}
          onMount={onMount}
          options={{ fontSize: 13, minimap: { enabled: true }, automaticLayout: true }}
        />
      </div>
    </div>
  );
}
