import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Papa from 'papaparse';
import { fs, fileUrl } from '../api/rest';
import { previewKind } from '../util';

export default function PreviewBlock({ path }: { path: string }) {
  const kind = previewKind(path);
  const url = fileUrl(path);

  switch (kind) {
    case 'image':
      return (
        <div className="preview preview-center">
          <img className="preview-img" src={url} alt={path} />
        </div>
      );
    case 'video':
      return (
        <div className="preview preview-center">
          <video className="preview-media" src={url} controls />
        </div>
      );
    case 'audio':
      return (
        <div className="preview preview-center">
          <audio src={url} controls />
        </div>
      );
    case 'pdf':
      return <iframe className="preview-frame" src={url} title={path} />;
    case 'markdown':
      return <MarkdownPreview path={path} />;
    case 'csv':
      return <CsvPreview path={path} />;
    default:
      return <TextPreview path={path} />;
  }
}

function useText(path: string): { text: string; status: string } {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('yükleniyor…');
  useEffect(() => {
    let active = true;
    fs.read(path)
      .then((c) => {
        if (!active) return;
        setText(c.content);
        setStatus(c.truncated ? 'kesildi' : '');
      })
      .catch((e) => active && setStatus('hata: ' + e));
    return () => {
      active = false;
    };
  }, [path]);
  return { text, status };
}

function MarkdownPreview({ path }: { path: string }) {
  const { text, status } = useText(path);
  return (
    <div className="preview preview-markdown markdown-body">
      {status && <div className="preview-status">{status}</div>}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function CsvPreview({ path }: { path: string }) {
  const { text, status } = useText(path);
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = (parsed.data as string[][]).slice(0, 1000);
  return (
    <div className="preview preview-csv">
      {status && <div className="preview-status">{status}</div>}
      <table>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === 0 ? 'csv-head' : ''}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextPreview({ path }: { path: string }) {
  const { text, status } = useText(path);
  return (
    <div className="preview preview-text">
      {status && <div className="preview-status">{status}</div>}
      <pre>{text}</pre>
    </div>
  );
}
