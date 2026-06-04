// Uygulama durumu: sekmeler, her sekmedeki bloklar ve mosaic döşeme ağacı.
import { create } from 'zustand';
import { getLeaves, MosaicNode } from 'react-mosaic-component';
import { term } from './api/term';
import { basename, blockTypeForFile } from './util';

export type BlockType = 'terminal' | 'files' | 'editor' | 'preview' | 'web';

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  props: Record<string, unknown>;
}

export interface Tab {
  id: string;
  title: string;
  blocks: Record<string, Block>;
  layout: MosaicNode<string> | null;
}

export interface Clipboard {
  path: string;
  op: 'copy' | 'cut';
}

// Diske kaydedilen düzen (terminallerin sessionId gibi geçici alanları hariç).
export interface PersistedState {
  activeTabId: string;
  tabs: Tab[];
}

interface Store {
  tabs: Tab[];
  activeTabId: string;
  home: string;
  focusedBlockId: string | null;
  clipboard: Clipboard | null;
  // Büyütülmüş (tam genişletilmiş) blok — geri yükleme için önceki düzen saklanır.
  maximized: { tabId: string; blockId: string; prevLayout: MosaicNode<string> | null } | null;

  init: (home: string) => void;
  restore: (home: string, data: PersistedState | null) => void;
  addTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  setLayout: (tabId: string, layout: MosaicNode<string> | null) => void;
  addBlock: (type: BlockType, props?: Record<string, unknown>, title?: string) => void;
  createBlock: (type: BlockType, props?: Record<string, unknown>, title?: string) => string;
  patchBlock: (blockId: string, patch: { title?: string; props?: Record<string, unknown> }) => void;
  closeBlock: (blockId: string) => void;
  toggleMaximize: (blockId: string) => void;
  openFile: (path: string) => void;
  openDir: (path: string) => void;
  setFocusedBlock: (blockId: string | null) => void;
  setClipboard: (clip: Clipboard | null) => void;
}

const newId = () => crypto.randomUUID();

function defaultTitle(type: BlockType, props: Record<string, unknown>): string {
  const p = (props.path as string) || '';
  switch (type) {
    case 'terminal':
      return 'Terminal';
    case 'files':
      return p ? basename(p) || p : 'Dosyalar';
    case 'editor':
      return basename(p) || 'Editör';
    case 'preview':
      return basename(p) || 'Önizleme';
    case 'web':
      return 'Web';
  }
}

// Yeni bir yaprağı mevcut düzene ekler (sağa böler).
function insertLeaf(layout: MosaicNode<string> | null, leafId: string): MosaicNode<string> {
  if (!layout) return leafId;
  return { direction: 'row', first: layout, second: leafId, splitPercentage: 55 };
}

// Bir yaprağı mosaic ağacından çıkarır (kalan alt ağacı döndürür).
function pruneLeaf(
  node: MosaicNode<string> | null,
  leafId: string,
): MosaicNode<string> | null {
  if (node == null) return null;
  if (typeof node === 'string') return node === leafId ? null : node;
  const first = pruneLeaf(node.first, leafId);
  const second = pruneLeaf(node.second, leafId);
  if (first == null) return second;
  if (second == null) return first;
  return { ...node, first, second };
}

// Bir yaprağın mosaic ağacında bulunup bulunmadığını döndürür.
function containsLeaf(node: MosaicNode<string> | null, leafId: string): boolean {
  if (node == null) return false;
  if (typeof node === 'string') return node === leafId;
  return containsLeaf(node.first, leafId) || containsLeaf(node.second, leafId);
}

// Hedef yaprağı içeren her dalı %100'e çekerek o bloğu büyütür. Ağacın yapısı
// (ve dolayısıyla blokların React kimliği) korunur — yalnız splitPercentage değişir,
// böylece terminal/webview yeniden başlatılmaz.
function maximizeLeaf(node: MosaicNode<string>, leafId: string): MosaicNode<string> {
  if (typeof node === 'string') return node;
  if (containsLeaf(node.first, leafId)) {
    return { ...node, splitPercentage: 100, first: maximizeLeaf(node.first, leafId) };
  }
  if (containsLeaf(node.second, leafId)) {
    return { ...node, splitPercentage: 0, second: maximizeLeaf(node.second, leafId) };
  }
  return node;
}

function makeTab(home: string): Tab {
  // Varsayılan çalışma alanı: solda dosya gezgini, sağda terminal (döşeme).
  const filesBlock: Block = {
    id: newId(),
    type: 'files',
    title: basename(home) || 'Dosyalar',
    props: { path: home },
  };
  const termBlock: Block = { id: newId(), type: 'terminal', title: 'Terminal', props: { cwd: home } };
  return {
    id: newId(),
    title: 'Çalışma Alanı',
    blocks: { [filesBlock.id]: filesBlock, [termBlock.id]: termBlock },
    layout: {
      direction: 'row',
      first: filesBlock.id,
      second: termBlock.id,
      splitPercentage: 42,
    },
  };
}

// Diske yazılacak güvenli kopya: terminal bloklarından geçici sessionId çıkarılır.
export function serializeState(s: {
  activeTabId: string;
  tabs: Tab[];
  maximized?: { tabId: string; prevLayout: MosaicNode<string> | null } | null;
}): PersistedState {
  return {
    activeTabId: s.activeTabId,
    tabs: s.tabs.map((t) => ({
      id: t.id,
      title: t.title,
      // Büyütülmüş sekmenin gerçek (büyütülmemiş) düzenini kaydet → yeniden
      // başlatınca büyütülmüş halde sıkışıp kalmaz.
      layout: s.maximized && s.maximized.tabId === t.id ? s.maximized.prevLayout : t.layout,
      blocks: Object.fromEntries(
        Object.entries(t.blocks).map(([id, b]) => [
          id,
          {
            id: b.id,
            type: b.type,
            title: b.title,
            props:
              b.type === 'terminal'
                ? {
                    cwd: b.props.cwd ?? '',
                    // SSH config'i koru ama parola/passphrase'i ASLA diske yazma.
                    ...(b.props.ssh
                      ? {
                          ssh: {
                            ...(b.props.ssh as Record<string, unknown>),
                            password: undefined,
                            passphrase: undefined,
                          },
                        }
                      : {}),
                  }
                : b.props,
          },
        ]),
      ),
    })),
  };
}

// Diskten okunan veriyi doğrular; her layout yaprağının bir bloğu olmalı.
function sanitizeTabs(raw: Tab[] | undefined): Tab[] {
  if (!Array.isArray(raw)) return [];
  const out: Tab[] = [];
  for (const t of raw) {
    if (!t || typeof t.id !== 'string' || !t.blocks || t.layout === undefined) continue;
    const leaves = t.layout ? getLeaves(t.layout) : [];
    if (leaves.some((id) => !t.blocks[id])) continue; // tutarsız düzen → atla
    out.push({ id: t.id, title: t.title || 'Çalışma Alanı', blocks: t.blocks, layout: t.layout });
  }
  return out;
}

export const useStore = create<Store>((set, get) => ({
  tabs: [],
  activeTabId: '',
  home: '',
  focusedBlockId: null,
  clipboard: null,
  maximized: null,

  init: (home) => {
    const tab = makeTab(home);
    set({ home, tabs: [tab], activeTabId: tab.id });
  },

  restore: (home, data) => {
    const tabs = sanitizeTabs(data?.tabs);
    if (tabs.length === 0) {
      const tab = makeTab(home);
      set({ home, tabs: [tab], activeTabId: tab.id });
      return;
    }
    const activeTabId = tabs.some((t) => t.id === data?.activeTabId) ? data!.activeTabId : tabs[0].id;
    set({ home, tabs, activeTabId });
  },

  addTab: () => {
    const tab = makeTab(get().home);
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab: (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      Object.values(tab.blocks).forEach((b) => {
        if (b.type === 'terminal' && b.props.sessionId) term.close(b.props.sessionId as string);
      });
    }
    const remaining = tabs.filter((t) => t.id !== tabId);
    if (remaining.length === 0) {
      const fresh = makeTab(get().home);
      set({ tabs: [fresh], activeTabId: fresh.id });
      return;
    }
    set((s) => ({
      tabs: remaining,
      activeTabId: s.activeTabId === tabId ? remaining[remaining.length - 1].id : s.activeTabId,
    }));
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  renameTab: (tabId, title) => {
    const clean = title.trim() || 'Çalışma Alanı';
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title: clean } : t)) }));
  },

  setLayout: (tabId, layout) => {
    set((s) => ({
      // Kullanıcı bu sekmenin düzenini elle değiştirdiyse (resize/taşıma/böl/kapat)
      // büyütme kipinden çık — eski düzeni geri yükleme niyeti kalmaz.
      maximized: s.maximized && s.maximized.tabId === tabId ? null : s.maximized,
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const keep = new Set(layout ? getLeaves(layout) : []);
        const blocks: Record<string, Block> = {};
        for (const [id, b] of Object.entries(t.blocks)) {
          if (keep.has(id)) {
            blocks[id] = b;
          } else if (b.type === 'terminal' && b.props.sessionId) {
            term.close(b.props.sessionId as string);
          }
        }
        return { ...t, layout, blocks };
      }),
    }));
  },

  addBlock: (type, props = {}, title) => {
    const block: Block = { id: newId(), type, title: title ?? defaultTitle(type, props), props };
    set((s) => ({
      focusedBlockId: block.id,
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId
          ? { ...t, blocks: { ...t.blocks, [block.id]: block }, layout: insertLeaf(t.layout, block.id) }
          : t,
      ),
    }));
  },

  // Layout'a dokunmadan aktif sekmeye yeni bir blok ekler ve id'sini döndürür
  // (split için: çağıran mosaic ağacını replaceWith ile günceller).
  createBlock: (type, props = {}, title) => {
    const block: Block = { id: newId(), type, title: title ?? defaultTitle(type, props), props };
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId ? { ...t, blocks: { ...t.blocks, [block.id]: block } } : t,
      ),
    }));
    return block.id;
  },

  // Bir bloğun başlığını ve/veya prop'larını günceller (ör. web bloğu gezinince).
  patchBlock: (blockId, patch) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== s.activeTabId) return t;
        const b = t.blocks[blockId];
        if (!b) return t;
        return {
          ...t,
          blocks: {
            ...t.blocks,
            [blockId]: {
              ...b,
              title: patch.title ?? b.title,
              props: patch.props ? { ...b.props, ...patch.props } : b.props,
            },
          },
        };
      }),
    }));
  },

  closeBlock: (blockId) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const newLayout = pruneLeaf(tab.layout, blockId);
    get().setLayout(activeTabId, newLayout);
  },

  // Bloğu büyüt / eski boyutuna döndür (aç-kapa). Büyütme, mosaic ağacının
  // yapısını bozmadan yalnız splitPercentage'ları değiştirerek yapılır; geri
  // yükleme için büyütmeden önceki düzen saklanır.
  toggleMaximize: (blockId) => {
    const { tabs, activeTabId, maximized } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.layout) return;

    // Aynı bloğa tekrar tıklanırsa eski düzeni geri yükle.
    if (maximized && maximized.blockId === blockId) {
      set((s) => ({
        maximized: null,
        tabs: s.tabs.map((t) =>
          t.id === maximized.tabId ? { ...t, layout: maximized.prevLayout } : t,
        ),
      }));
      return;
    }

    // Büyütmeyi her zaman büyütülmemiş "temel" düzen üzerinden hesapla (aynı
    // sekmede başka bir blok zaten büyütülmüşse onun önceki düzenini kullan).
    const baseLayout =
      maximized && maximized.tabId === activeTabId ? maximized.prevLayout : tab.layout;
    // Tek döşeme varsa veya blok bu düzende yoksa büyütülecek bir şey yok.
    if (!baseLayout || typeof baseLayout === 'string' || !containsLeaf(baseLayout, blockId)) return;

    const maxed = maximizeLeaf(baseLayout, blockId);
    set((s) => ({
      focusedBlockId: blockId,
      maximized: { tabId: activeTabId, blockId, prevLayout: baseLayout },
      tabs: s.tabs.map((t) => {
        // Farklı bir sekmede büyütme kalmışsa orayı eski haline döndür.
        if (maximized && maximized.tabId !== activeTabId && t.id === maximized.tabId) {
          return { ...t, layout: maximized.prevLayout };
        }
        return t.id === activeTabId ? { ...t, layout: maxed } : t;
      }),
    }));
  },

  openFile: (path) => {
    const type = blockTypeForFile(path);
    get().addBlock(type, { path });
  },

  openDir: (path) => {
    get().addBlock('files', { path });
  },

  setFocusedBlock: (blockId) => set({ focusedBlockId: blockId }),

  setClipboard: (clip) => set({ clipboard: clip }),
}));
