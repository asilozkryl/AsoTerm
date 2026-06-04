// MosaicWindow başlık çubuğu için özel kontroller: yana/aşağı böl, büyüt, kapat.
import { useContext } from 'react';
import { MosaicContext, MosaicWindowContext, MosaicNode } from 'react-mosaic-component';
import { useStore } from '../store';

export default function TileControls({ blockId }: { blockId: string }) {
  const { mosaicActions } = useContext(MosaicContext);
  const { mosaicWindowActions } = useContext(MosaicWindowContext);
  const isMaximized = useStore((s) => s.maximized?.blockId === blockId);
  const toggleMaximize = useStore((s) => s.toggleMaximize);

  const split = (direction: 'row' | 'column') => {
    const st = useStore.getState();
    const tab = st.tabs.find((t) => t.id === st.activeTabId);
    const src = tab?.blocks[blockId];
    const cwd = (src?.props.cwd as string) || (src?.props.path as string) || st.home;

    const newId = st.createBlock('terminal', { cwd }, 'Terminal');
    const branch: MosaicNode<string> = {
      direction,
      first: blockId,
      second: newId,
      splitPercentage: 50,
    };
    mosaicActions.replaceWith(mosaicWindowActions.getPath(), branch);
    st.setFocusedBlock(newId);
  };

  return (
    <div className="tile-controls">
      <button className="tile-btn" title="Yana böl — terminal" onClick={() => split('row')}>
        ▥
      </button>
      <button className="tile-btn" title="Aşağı böl — terminal" onClick={() => split('column')}>
        ▤
      </button>
      <button
        className={'tile-btn' + (isMaximized ? ' active' : '')}
        title={isMaximized ? 'Eski boyuta döndür' : 'Büyüt'}
        onClick={() => toggleMaximize(blockId)}
      >
        {isMaximized ? '⤡' : '⤢'}
      </button>
      <button
        className="tile-btn tile-close"
        title="Bloğu kapat"
        onClick={() => mosaicActions.remove(mosaicWindowActions.getPath())}
      >
        ✕
      </button>
    </div>
  );
}
