// Go sidecar'a REST istemcisi (dosya sistemi işlemleri + dosya servis URL'i).
import { api } from './config';

export interface Entry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modUnix: number;
  mode: string;
}

export interface FileContent {
  path: string;
  content: string;
  truncated: boolean;
}

export interface ShellInfo {
  name: string;
  path: string;
}

async function getJSON<T>(path: string): Promise<T> {
  const { base, token } = api();
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const { base, token } = api();
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data as T;
}

export const fs = {
  list: (path: string) => getJSON<Entry[]>(`/api/fs/list?path=${encodeURIComponent(path)}`),
  dirs: (path: string) => getJSON<Entry[]>(`/api/fs/dirs?path=${encodeURIComponent(path)}`),
  home: () => getJSON<{ path: string }>(`/api/fs/home`).then((r) => r.path),
  drives: () => getJSON<string[]>(`/api/fs/drives`),
  parent: (path: string) =>
    getJSON<{ path: string }>(`/api/fs/parent?path=${encodeURIComponent(path)}`).then((r) => r.path),
  read: (path: string) => getJSON<FileContent>(`/api/fs/read?path=${encodeURIComponent(path)}`),
  write: (path: string, content: string) => postJSON(`/api/fs/write`, { path, content }),
  copy: (src: string, dst: string) => postJSON(`/api/fs/copy`, { src, dst }),
  move: (src: string, dst: string) => postJSON(`/api/fs/move`, { src, dst }),
  remove: (path: string) => postJSON(`/api/fs/delete`, { path }),
  rename: (path: string, name: string) => postJSON(`/api/fs/rename`, { path, name }),
  mkdir: (dir: string, name: string) => postJSON(`/api/fs/mkdir`, { dir, name }),
  newfile: (dir: string, name: string) => postJSON(`/api/fs/newfile`, { dir, name }),
};

export const shells = () => getJSON<ShellInfo[]>(`/api/shells`);

// Ham dosya servis URL'i (resim/video/pdf etiketleri için; token query'de).
export function fileUrl(path: string): string {
  const { base, token } = api();
  return `${base}/api/file?path=${encodeURIComponent(path)}&token=${token}`;
}
