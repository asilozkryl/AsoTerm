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
    try {
      await fs.write(path, valueRef.current);
      savedRef.current = valueRef.current;
      setDirty(false);
      setStatus('kaydedildi ✓');
      toast('Kaydedildi: ' + path);
    } catch (e) {
      setStatus('kaydedilemedi');
      toast('Kaydedilemedi: ' + e, true);
    }
  };

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save);
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
        <button className="mini-btn" onClick={save}>
          Kaydet (Ctrl+S)
        </button>
      </div>
      <div className="editor-host">
        <Editor
          theme="vs-dark"
          language={monacoLanguage(path)}
          value={value}
          onChange={(v) => {
            valueRef.current = v ?? '';
            setDirty(valueRef.current !== savedRef.current);
          }}
          onMount={onMount}
          options={{ fontSize: 13, minimap: { enabled: true }, automaticLayout: true }}
        />
      </div>
    </div>
  );
}
