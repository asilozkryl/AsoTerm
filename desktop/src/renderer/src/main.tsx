import './setupMonaco';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import 'react-mosaic-component/react-mosaic-component.css';
import '@xterm/xterm/css/xterm.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
