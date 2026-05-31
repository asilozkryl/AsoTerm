import { Block } from '../store';
import TerminalBlock from './TerminalBlock';
import EditorBlock from './EditorBlock';
import PreviewBlock from './PreviewBlock';
import FilesBlock from './FilesBlock';
import WebBlock from './WebBlock';

export default function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'terminal':
      return <TerminalBlock block={block} />;
    case 'editor':
      return <EditorBlock path={block.props.path as string} />;
    case 'preview':
      return <PreviewBlock path={block.props.path as string} />;
    case 'files':
      return <FilesBlock path={block.props.path as string} />;
    case 'web':
      return <WebBlock block={block} />;
    default:
      return <div className="block-missing">Bilinmeyen blok</div>;
  }
}
