import { MosaicWithoutDragDropContext, MosaicWindow, MosaicNode } from 'react-mosaic-component';
import { DndProvider } from 'react-dnd';
import { MultiBackend } from 'react-dnd-multi-backend';
import { HTML5toTouch } from 'rdndmb-html5-to-touch';
import { useStore, Tab } from '../store';
import BlockView from '../blocks/Block';
import TileControls from './TileControls';
import EmptyState from '../components/EmptyState';

// Tek bir sekmenin mosaic düzeni. Pasif sekmeler de mounted kalır (durum korunur),
// yalnızca CSS ile gizlenir → terminaller/webview'ler sekme değişince sıfırlanmaz.
function TabPane({
  tab,
  active,
  focusedBlockId,
  setLayout,
  setFocusedBlock,
}: {
  tab: Tab;
  active: boolean;
  focusedBlockId: string | null;
  setLayout: (tabId: string, layout: MosaicNode<string> | null) => void;
  setFocusedBlock: (id: string) => void;
}) {
  return (
    <div className={'tab-pane' + (active ? ' active' : '')} aria-hidden={!active}>
      {tab.layout ? (
        <MosaicWithoutDragDropContext<string>
          className="asoterm-mosaic"
          value={tab.layout}
          onChange={(node) => setLayout(tab.id, node)}
          resize={{ minimumPaneSizePercentage: 10 }}
          renderTile={(id, path) => {
            const block = tab.blocks[id];
            return (
              <MosaicWindow<string>
                path={path}
                title={block?.title ?? id}
                className={`block-${block?.type ?? 'unknown'}${id === focusedBlockId ? ' tile-focused' : ''}`}
                toolbarControls={<TileControls blockId={id} />}
              >
                <div className="tile-body" onMouseDown={() => setFocusedBlock(id)}>
                  {block ? <BlockView block={block} /> : <div className="block-missing">—</div>}
                </div>
              </MosaicWindow>
            );
          }}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

export default function Workspace() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const setLayout = useStore((s) => s.setLayout);
  const focusedBlockId = useStore((s) => s.focusedBlockId);
  const setFocusedBlock = useStore((s) => s.setFocusedBlock);

  return (
    <div className="workspace">
      <DndProvider backend={MultiBackend} options={HTML5toTouch}>
        {tabs.map((tab) => (
          <TabPane
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            focusedBlockId={focusedBlockId}
            setLayout={setLayout}
            setFocusedBlock={setFocusedBlock}
          />
        ))}
      </DndProvider>
    </div>
  );
}
